/**
 * Playwright globalSetup — seeds test users + CIBC tournament in local Supabase.
 *
 * Runs once before all E2E tests. Requires:
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
 *
 * If SERVICE_ROLE_KEY is absent, setup skips silently — auth-dependent and
 * SSR-dependent tests skip themselves inline via `test.skip(!hasRealSupabase, ...)`.
 */
import { createClient } from '@supabase/supabase-js'
import { config as dotenvConfig } from 'dotenv'
import { mkdirSync } from 'fs'
import { resolve } from 'path'

// Load .env.local so env vars are available in this Node.js process
dotenvConfig({ path: resolve(process.cwd(), '.env.local') })

export const TEST_USER_EMAIL = 'e2e-player@fdgolf.test'
export const TEST_USER_PASSWORD = 'E2ePassword123!'

export const TEST_ADMIN_EMAIL = 'e2e-admin@fdgolf.test'
export const TEST_ADMIN_PASSWORD = 'E2eAdminPass456!'

export const TEST_TOURNAMENT_ADMIN_EMAIL = 'e2e-tournament-admin@fdgolf.test'
export const TEST_TOURNAMENT_ADMIN_PASSWORD = 'E2eTournamentAdmin789!'

export const PLAYER_AUTH_FILE = 'tests/e2e/.auth/player.json'
export const ADMIN_AUTH_FILE = 'tests/e2e/.auth/admin.json'
export const TOURNAMENT_ADMIN_AUTH_FILE = 'tests/e2e/.auth/tournament-admin.json'

const E2E_TOURNAMENT_SLUG = 'cibc-granite-ridge-2026'

async function upsertUser(
  admin: // eslint-disable-next-line @typescript-eslint/no-explicit-any
any,
  users: Array<{ id: string; email?: string }>,
  email: string,
  password: string,
  role: 'player' | 'system_admin' | 'tournament_admin',
): Promise<string | undefined> {
  const existing = users.find((u) => u.email === email)
  let userId = existing?.id

  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) {
      console.error(`[globalSetup] Failed to create ${role} user:`, error.message)
      return undefined
    }
    userId = created.user.id
    console.log(`[globalSetup] Created ${role} user:`, email)
  } else {
    console.log(`[globalSetup] ${role} user already exists:`, email)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: playerError } = await (admin as any)
    .from('players')
    .upsert({ auth_user_id: userId, name: `E2E ${role}`, email, role }, { onConflict: 'auth_user_id' })

  if (playerError) {
    console.warn(`[globalSetup] Could not upsert ${role} player record:`, playerError.message)
  } else {
    console.log(`[globalSetup] Player profile (${role}) ready for:`, email)
  }

  return userId
}

async function seedTestPlayers(admin: // eslint-disable-next-line @typescript-eslint/no-explicit-any
any) {
  // Fixture players for TC-0053 (admin player search filter).
  // auth_user_id is required NOT NULL; use fixed test UUIDs that won't clash with real auth users.
  const fixtures = [
    { auth_user_id: '00000000-ffff-0000-0000-000000000010', name: 'Alice Nguyen', email: 'alice@fdgolf.test', role: 'player' as const },
    { auth_user_id: '00000000-ffff-0000-0000-000000000011', name: 'John Smith', email: 'john.smith@fdgolf.test', role: 'player' as const },
    { auth_user_id: '00000000-ffff-0000-0000-000000000012', name: 'Jane Smith', email: 'jane.smith@fdgolf.test', role: 'player' as const },
  ]

  for (const p of fixtures) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('players')
      .upsert(p, { onConflict: 'email', ignoreDuplicates: true })
    if (error) {
      console.warn(`[globalSetup] Could not upsert fixture player ${p.name}:`, error.message)
    }
  }
  console.log('[globalSetup] Fixture players ready')
}

async function seedTournament(admin: // eslint-disable-next-line @typescript-eslint/no-explicit-any
any) {
  // seed.sql inserts the CIBC tournament with status='setup'. E2E tests need status='active' to
  // exercise round-scoring flows, so we ensure the row exists and bump its status.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any
  const { data: existing } = await adminAny
    .from('tournaments')
    .select('id, status')
    .eq('slug', E2E_TOURNAMENT_SLUG)
    .maybeSingle()

  if (existing) {
    if (existing.status !== 'active') {
      const { error: updateError } = await adminAny
        .from('tournaments')
        .update({ status: 'active' })
        .eq('id', existing.id)
      if (updateError) {
        console.warn('[globalSetup] Could not activate tournament:', updateError.message)
      } else {
        console.log('[globalSetup] Tournament activated:', E2E_TOURNAMENT_SLUG)
      }
    } else {
      console.log('[globalSetup] Tournament already active:', E2E_TOURNAMENT_SLUG)
    }
    return
  }

  // Fallback path if seed.sql hasn't run: look up the venue + course it would have created and
  // insert the tournament with proper FKs. Migration 007 replaced the text `venue` column with
  // `venue_id`/`course_id` NOT NULL FKs.
  const { data: venue } = await adminAny
    .from('venues')
    .select('id')
    .eq('name', 'Granite Ridge Golf Club')
    .maybeSingle()

  const { data: course } = await adminAny
    .from('courses')
    .select('id')
    .eq('name', 'Main Course')
    .maybeSingle()

  if (!venue || !course) {
    console.warn(
      '[globalSetup] Venue or course not found — run `supabase db reset` to load seed data first',
    )
    return
  }

  const { error } = await adminAny.from('tournaments').insert({
    name: 'CIBC Capital Markets Golf Tournament 2026',
    slug: E2E_TOURNAMENT_SLUG,
    date: '2026-06-22',
    format: 'best_ball',
    venue_id: venue.id,
    course_id: course.id,
    status: 'active',
  })

  if (error) {
    console.warn('[globalSetup] Could not insert tournament:', error.message)
  } else {
    console.log('[globalSetup] Tournament seeded:', E2E_TOURNAMENT_SLUG)
  }
}

export default async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  if (!serviceKey) {
    console.warn('[globalSetup] SUPABASE_SERVICE_ROLE_KEY not set — skipping test user seeding')
    return
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { users } } = await admin.auth.admin.listUsers()

  await upsertUser(admin, users, TEST_USER_EMAIL, TEST_USER_PASSWORD, 'player')
  await upsertUser(admin, users, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, 'system_admin')
  const taAuthUserId = await upsertUser(admin, users, TEST_TOURNAMENT_ADMIN_EMAIL, TEST_TOURNAMENT_ADMIN_PASSWORD, 'tournament_admin')
  if (taAuthUserId) {
    const { data: taPlayer } = await (admin as any)
      .from('players')
      .select('id')
      .eq('auth_user_id', taAuthUserId)
      .maybeSingle()
    const { data: tournament } = await (admin as any)
      .from('tournaments')
      .select('id')
      .eq('slug', E2E_TOURNAMENT_SLUG)
      .maybeSingle()
    if (taPlayer && tournament) {
      const { error } = await (admin as any)
        .from('tournament_admin_assignments')
        .upsert(
          { player_id: taPlayer.id, tournament_id: tournament.id },
          { onConflict: 'player_id,tournament_id', ignoreDuplicates: true }
        )
      if (error) {
        console.warn('[globalSetup] Could not upsert tournament_admin assignment:', error.message)
      } else {
        console.log('[globalSetup] tournament_admin assignment ready')
      }
    }
  }
  await seedTestPlayers(admin)
  await seedTournament(admin)

  // Ensure .auth/ directory exists for storageState files
  mkdirSync('tests/e2e/.auth', { recursive: true })
}
