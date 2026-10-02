/**
 * Playwright setup: log in as the E2E admin test user and save storageState.
 *
 * This runs as a dependency of the 'chromium-desktop' (admin) project.
 */
import { test as setup, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, ADMIN_AUTH_FILE, E2E_TOURNAMENT_SLUG } from '../global-setup'

const hasRealSupabase = !!process.env.SUPABASE_SERVICE_ROLE_KEY

// Mirrors ACTIVE_TOURNAMENT_COOKIE from src/lib/active-tournament.ts — not imported
// directly, since that module pulls in `next/headers`, which isn't safe outside a
// Next.js server context (this file runs as a plain Node/Playwright process).
const ACTIVE_TOURNAMENT_COOKIE = 'x-active-tournament'

setup('authenticate as admin', async ({ page, baseURL }) => {
  setup.skip(!hasRealSupabase, 'Requires seeded admin user — set SUPABASE_SERVICE_ROLE_KEY')

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(TEST_ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(TEST_ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()

  // Admin with no team → dashboard shows "Account pending setup" but auth cookies are set
  await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 10_000 })

  // BUG-0016: getActiveTournamentId() falls back to "most recently created
  // tournament" when the cookie is absent — any demo/manual tournament created
  // outside the E2E flow (with a newer created_at than the CIBC fixture) hijacks
  // every admin.spec.ts assertion. Pin the cookie to the CIBC fixture explicitly
  // so admin-setup's storageState is immune to whatever else exists in the DB.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: tournament } = await admin
    .from('tournaments')
    .select('id')
    .eq('slug', E2E_TOURNAMENT_SLUG)
    .maybeSingle()

  if (tournament) {
    await page.context().addCookies([
      {
        name: ACTIVE_TOURNAMENT_COOKIE,
        value: tournament.id,
        url: baseURL ?? 'http://localhost:3000',
      },
    ])
  } else {
    console.warn(`[admin.setup] Could not resolve tournament id for slug "${E2E_TOURNAMENT_SLUG}" — cookie not pinned`)
  }

  await page.context().storageState({ path: ADMIN_AUTH_FILE })
})
