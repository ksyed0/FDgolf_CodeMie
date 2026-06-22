/**
 * E2E tests: Admin role access control — system_admin vs tournament_admin
 * Covers: TC-0090 through TC-0095
 *
 * Run: npx playwright test tests/e2e/admin-roles.spec.ts --project=chromium-desktop
 *
 * All tests require real Supabase (SUPABASE_SERVICE_ROLE_KEY must be set).
 */
import { test, expect } from '@playwright/test'
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_TOURNAMENT_ADMIN_EMAIL,
  TEST_TOURNAMENT_ADMIN_PASSWORD,
} from './global-setup'

const hasRealSupabase = !!process.env.SUPABASE_SERVICE_ROLE_KEY

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard|admin/, { timeout: 10000 })
}

// ── TC-0090 ────────────────────────────────────────────────────────────────
test('TC-0090: system_admin sidebar shows Global section with Tournaments, Players, Venues, Courses, Clubs', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded system_admin user in local Supabase')

  await signIn(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
  await page.goto('/admin/tournament')

  await expect(page.getByText('Global', { exact: false }).first()).toBeVisible({ timeout: 5000 })
  for (const label of ['Tournaments', 'Players', 'Venues', 'Courses', 'Clubs']) {
    await expect(page.getByRole('link', { name: label }).first()).toBeVisible()
  }
})

// ── TC-0091 ────────────────────────────────────────────────────────────────
test('TC-0091: tournament_admin sidebar has no Global section', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded tournament_admin user in local Supabase')

  await signIn(page, TEST_TOURNAMENT_ADMIN_EMAIL, TEST_TOURNAMENT_ADMIN_PASSWORD)
  await page.goto('/admin/tournament')

  await expect(page.getByText('Global', { exact: true })).not.toBeVisible()
  await expect(page.getByRole('link', { name: 'Venues' })).not.toBeVisible()
  await expect(page.getByRole('link', { name: 'Courses' })).not.toBeVisible()
})

// ── TC-0092 ────────────────────────────────────────────────────────────────
test('TC-0092: tournament_admin navigating to /admin/tournaments redirects to /admin/tournament', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded tournament_admin user in local Supabase')

  await signIn(page, TEST_TOURNAMENT_ADMIN_EMAIL, TEST_TOURNAMENT_ADMIN_PASSWORD)
  await page.goto('/admin/tournaments')
  await page.waitForURL(/\/admin\/tournament$/, { timeout: 5000 })
  await expect(page).toHaveURL(/\/admin\/tournament$/)
})

// ── TC-0093 ────────────────────────────────────────────────────────────────
test('TC-0093: tournament_admin navigating to /admin/players redirects to /admin/tournament', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded tournament_admin user in local Supabase')

  await signIn(page, TEST_TOURNAMENT_ADMIN_EMAIL, TEST_TOURNAMENT_ADMIN_PASSWORD)
  await page.goto('/admin/players')
  await page.waitForURL(/\/admin\/tournament$/, { timeout: 5000 })
  await expect(page).toHaveURL(/\/admin\/tournament$/)
})

// ── TC-0094 ────────────────────────────────────────────────────────────────
test('TC-0094: /admin/tournaments renders tournament list for system_admin', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded system_admin + tournament in local Supabase')

  await signIn(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
  await page.goto('/admin/tournaments')
  await expect(page.getByRole('heading', { name: /tournaments/i }).first()).toBeVisible({ timeout: 5000 })
})

// ── TC-0095 ────────────────────────────────────────────────────────────────
test('TC-0095: /admin/roster renders Roster heading for system_admin', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded system_admin in local Supabase')

  await signIn(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
  await page.goto('/admin/roster')
  await expect(page.getByRole('heading', { name: /roster/i }).first()).toBeVisible({ timeout: 5000 })
})
