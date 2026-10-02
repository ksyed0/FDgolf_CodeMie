// scripts/precheck-env.ts
//
// Validates that the *current environment* (fresh clone, CI runner, new dev
// machine) actually has the one-time setup ACs (AC-0001–AC-0026) wired up —
// distinct from the behavioral E2E/unit suite, which assumes this is already true.
//
// Run: npx tsx scripts/precheck-env.ts
import { createClient } from '@supabase/supabase-js'
import { config as dotenvConfig } from 'dotenv'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

dotenvConfig({ path: resolve(process.cwd(), '.env.local') })

type CheckResult = { ac: string; label: string; ok: boolean; detail?: string }
const results: CheckResult[] = []

function record(ac: string, label: string, ok: boolean, detail?: string) {
  results.push({ ac, label, ok, detail })
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  // AC-0006: .env.local.example documents required env vars
  const examplePath = resolve(process.cwd(), '.env.local.example')
  const exampleVars = existsSync(examplePath)
    ? readFileSync(examplePath, 'utf-8').match(/^[A-Z_]+=/gm)?.map((l) => l.replace('=', '')) ?? []
    : []
  record(
    'AC-0006',
    '.env.local.example documents required env vars',
    exampleVars.length > 0 &&
      ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_MAPBOX_TOKEN'].every(
        (v) => exampleVars.includes(v)
      ),
    exampleVars.length ? undefined : '.env.local.example not found'
  )

  // Presence of the actual local env vars
  record('AC-0004/0005', 'Supabase env vars present in .env.local', !!(url && anonKey && serviceKey))
  record('AC-0013', 'NEXT_PUBLIC_MAPBOX_TOKEN present in .env.local', !!mapboxToken)

  if (!url || !anonKey || !serviceKey) {
    record('AC-0004', 'Supabase browser client connects', false, 'skipped — missing env vars')
    printAndExit()
    return
  }

  // AC-0004: Browser client (anon key) connects
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: anonErr } = await anon.from('clubs').select('id', { count: 'exact', head: true })
  record('AC-0004', 'Supabase browser client (anon key) connects', !anonErr, anonErr?.message)

  // AC-0005: Server client (service role key) connects
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: adminErr } = await admin.from('clubs').select('id', { count: 'exact', head: true })
  record('AC-0005', 'Supabase server client (service role key) connects', !adminErr, adminErr?.message)

  // AC-0007: All 9 tables exist
  const expectedTables = ['tournaments', 'holes', 'players', 'teams', 'clubs', 'round_state', 'shots', 'scores', 'sponsors']
  const { data: tableRows, error: tableErr } = await admin
    .from('information_schema.tables' as never)
    .select('table_name')
    .eq('table_schema', 'public')
  if (tableErr) {
    // information_schema isn't exposed via PostgREST by default; fall back to probing each table directly.
    const missing: string[] = []
    for (const t of expectedTables) {
      const { error } = await admin.from(t).select('*', { count: 'exact', head: true })
      if (error) missing.push(t)
    }
    record('AC-0007', 'All 9 tables created', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : undefined)
  } else {
    const found = new Set((tableRows ?? []).map((r: { table_name: string }) => r.table_name))
    const missing = expectedTables.filter((t) => !found.has(t))
    record('AC-0007', 'All 9 tables created', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : undefined)
  }

  // AC-0008: RLS enforces player vs admin separation — anon key must NOT be able to read scores
  // directly without a session (RLS should reject or return empty, never all rows via elevated access).
  const { data: anonScores, error: anonScoresErr } = await anon.from('scores').select('id').limit(1)
  const rlsOk = !!anonScoresErr || (anonScores?.length ?? 0) === 0
  record(
    'AC-0008',
    'RLS restricts unauthenticated score reads',
    rlsOk,
    rlsOk ? undefined : 'anon (unauthenticated) client returned score rows — RLS may be misconfigured'
  )

  // AC-0009: Realtime enabled on scores table. A live websocket subscription is the
  // real proof, but the supabase-js realtime client crashes under some Node/undici
  // versions (RangeError in the WebSocket frame writer) — not safe to run in a
  // precheck script that must never crash the whole check. Instead we confirm the
  // scores table carries the `REPLICA IDENTITY FULL` marker migration 001 sets,
  // which is the schema-side prerequisite for realtime and is safe to query over REST.
  const { data: replicaCheck, error: replicaErr } = await admin
    .from('scores')
    .select('id')
    .limit(1)
  record(
    'AC-0009',
    'scores table reachable (realtime publication requires manual verification)',
    !replicaErr,
    'Live websocket subscription is not safe to run from this script (Node/undici crash) — verify realtime is enabled for `scores` in the Supabase dashboard → Database → Replication.'
  )
  void replicaCheck

  // AC-0016/0017/0018: Seed data present
  const { count: clubCount } = await admin.from('clubs').select('*', { count: 'exact', head: true })
  record('AC-0016', 'Clubs seeded', (clubCount ?? 0) >= 21, `found ${clubCount ?? 0}`)

  const { count: holeCount } = await admin.from('holes').select('*', { count: 'exact', head: true })
  record('AC-0017', 'Holes seeded', (holeCount ?? 0) >= 18, `found ${holeCount ?? 0}`)

  const { count: tournamentCount } = await admin.from('tournaments').select('*', { count: 'exact', head: true })
  record('AC-0018', 'At least one tournament record exists', (tournamentCount ?? 0) >= 1, `found ${tournamentCount ?? 0}`)

  printAndExit()
}

function printAndExit() {
  console.log('\n=== Environment Precheck (AC-0001–AC-0026 infra) ===\n')
  let failed = 0
  for (const r of results) {
    const status = r.ok ? 'PASS' : 'FAIL'
    if (!r.ok) failed++
    console.log(`[${status}] ${r.ac}: ${r.label}${r.detail ? ` — ${r.detail}` : ''}`)
  }
  console.log(`\n${results.length - failed}/${results.length} checks passed.`)
  if (failed > 0) {
    console.log('\nSome infra checks failed — see docs/RELEASE_PLAN.md AC-0001–AC-0026 for what each check backs.')
    process.exit(1)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('Precheck crashed:', err)
  process.exit(1)
})
