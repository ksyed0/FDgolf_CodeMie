// scripts/reset-lionhead.ts
import { createClient } from '@supabase/supabase-js'
import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'path'

dotenvConfig({ path: resolve(process.cwd(), '.env.local') })

const VENUE_NAME = 'Lionhead Golf Club'
const COURSE_NAME = 'Legends Course'
const TOURNAMENT_SLUG = 'lionhead-spring-classic-2026'
const TEST_EMAILS = ['e2e-lion-a@fdgolf.test', 'e2e-lion-b@fdgolf.test']
const PLAYERS = [
  { email: 'e2e-lion-a@fdgolf.test', name: 'Alex Lion',   password: 'E2eLionA789!' },
  { email: 'e2e-lion-b@fdgolf.test', name: 'Blake Lion',  password: 'E2eLionB789!' },
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env.local')
    process.exit(1)
  }

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  console.log('=== Wiping Lionhead test data ===\n')

  // 1. Find tournament(s) with this slug
  const { data: tournaments } = await db
    .from('tournaments').select('id').eq('slug', TOURNAMENT_SLUG)
  const tIds = (tournaments ?? []).map((t: { id: string }) => t.id)

  if (tIds.length > 0) {
    for (const table of ['shots', 'scores', 'round_states'] as const) {
      const { error } = await db.from(table).delete().in('tournament_id', tIds)
      if (error) console.warn(`  [warn] ${table}:`, error.message)
      else        console.log(`  ✓ ${table} cleared`)
    }
    const { error: tErr } = await db.from('teams').delete().in('tournament_id', tIds)
    if (tErr) console.warn('  [warn] teams:', tErr.message)
    else      console.log('  ✓ teams cleared')

    const { error: tournErr } = await db.from('tournaments').delete().eq('slug', TOURNAMENT_SLUG)
    if (tournErr) console.warn('  [warn] tournament:', tournErr.message)
    else          console.log('  ✓ tournament deleted')
  } else {
    console.log('  (no tournament found — skipping tournament/teams/scores)')
  }

  // 2. Player profiles
  const { error: pErr } = await db.from('players').delete().in('email', TEST_EMAILS)
  if (pErr) console.warn('  [warn] player profiles:', pErr.message)
  else      console.log('  ✓ player profiles deleted')

  // 3. Auth users
  const { data: { users } } = await db.auth.admin.listUsers()
  for (const email of TEST_EMAILS) {
    const u = users.find((x: { email?: string }) => x.email === email)
    if (u) {
      const { error } = await db.auth.admin.deleteUser(u.id)
      if (error) console.warn(`  [warn] auth ${email}:`, error.message)
      else        console.log(`  ✓ auth user deleted: ${email}`)
    }
  }

  // 4. Holes → course → venue (manual cascade — RLS on delete policies)
  const { data: venues } = await db.from('venues').select('id').eq('name', VENUE_NAME)
  const vIds = (venues ?? []).map((v: { id: string }) => v.id)

  if (vIds.length > 0) {
    const { data: courses } = await db
      .from('courses').select('id').in('venue_id', vIds).eq('name', COURSE_NAME)
    const cIds = (courses ?? []).map((c: { id: string }) => c.id)

    if (cIds.length > 0) {
      const { error: hErr } = await db.from('holes').delete().in('course_id', cIds)
      if (hErr) console.warn('  [warn] holes:', hErr.message)
      else      console.log('  ✓ holes deleted')

      const { error: cErr } = await db.from('courses').delete().in('id', cIds)
      if (cErr) console.warn('  [warn] courses:', cErr.message)
      else      console.log('  ✓ course deleted')
    }

    const { error: vErr } = await db.from('venues').delete().eq('name', VENUE_NAME)
    if (vErr) console.warn('  [warn] venues:', vErr.message)
    else      console.log('  ✓ venue deleted')
  }

  console.log('\n=== Re-seeding test players ===\n')

  for (const { email, name, password } of PLAYERS) {
    const { data: created, error: authErr } = await db.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (authErr) { console.error(`  ERROR auth ${email}:`, authErr.message); continue }
    console.log(`  ✓ auth user: ${email}`)

    const { error: profErr } = await db.from('players').insert({
      auth_user_id: created.user.id, name, email, role: 'player', team_id: null,
    })
    if (profErr) console.warn(`  [warn] profile ${email}:`, profErr.message)
    else         console.log(`  ✓ player profile: ${name}`)
  }

  console.log('\n✅ Done. Ready for E2E run.\n')
}

main().catch(err => { console.error(err); process.exit(1) })
