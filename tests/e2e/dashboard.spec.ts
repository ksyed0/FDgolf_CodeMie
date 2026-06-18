/**
 * E2E tests: Player dashboard — tournament info, team roster, round CTA
 * Covers: TC-0071 through TC-0073
 *
 * Run: npx playwright test --project=chromium-mobile tests/e2e/dashboard.spec.ts
 *
 * The dashboard page is an SSR Server Component — it calls createClient() and
 * reads from Supabase on the server. page.route() mocks intercept only the
 * client-side fetch calls that the browser makes AFTER the page is hydrated.
 * SSR data fetches (from Node, not the browser) are NOT interceptable with
 * page.route().
 *
 * Strategy: these tests are therefore gated behind a real Supabase instance
 * (hasRealSupabase). Without one the dashboard redirects to /login or renders
 * an empty state. The test.skip() guard prevents false negatives in CI.
 */
import { test, expect } from '@playwright/test'
import { mockSupabaseTable } from './helpers/supabase-mock'
import { fakeTournament, fakeTeam, fakePlayers, fakePlayer } from './helpers/fixtures'

const hasRealSupabase = !!process.env.SUPABASE_SERVICE_ROLE_KEY

// Client-side tables the dashboard may fetch after hydration
test.beforeEach(async ({ page }) => {
  await mockSupabaseTable(page, 'tournaments', [fakeTournament])
  await mockSupabaseTable(page, 'teams', [fakeTeam])
  await mockSupabaseTable(page, 'players', fakePlayers)
  await mockSupabaseTable(page, 'scores', [])
  await mockSupabaseTable(page, 'sponsors', [])
})

// ── TC-0071: Dashboard shows tournament name and date ─────────────────────────

test('TC-0071: dashboard shows tournament name and date', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Dashboard is SSR — requires seeded local Supabase')

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

  // The dashboard renders an <h3> with the tournament name inside the status card.
  // The seeded tournament may differ from fakeTournament.name so we assert on the
  // structural element rather than the literal name string.
  const tournamentCard = page.locator('h3').first()
  await expect(tournamentCard).toBeVisible({ timeout: 8000 })

  // Date is rendered via toLocaleDateString — the day-of-week label is always present
  // regardless of which tournament is seeded (e.g. "Sunday", "Monday", etc.)
  await expect(
    page.getByText(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i).first()
  ).toBeVisible({ timeout: 5000 })
})

// ── TC-0072: Dashboard shows team section (assigned or pending) ───────────────

test('TC-0072: dashboard shows team section after welcome card', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Dashboard is SSR — requires seeded local Supabase')

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

  // The welcome card always shows "Welcome back"
  await expect(page.getByText(/welcome back/i).first()).toBeVisible({ timeout: 8000 })

  // The team section renders one of two states:
  //   a) Team assigned: shows team name + "Starting hole:" label
  //   b) No team yet: shows "You have not been assigned to a team yet."
  // Both are valid — we assert whichever is present, confirming the section rendered.
  const hasTeam = await page.getByText(/starting hole/i).first().isVisible().catch(() => false)
  const noPendingMsg = await page.getByText(/not been assigned to a team/i).first().isVisible().catch(() => false)

  expect(hasTeam || noPendingMsg).toBe(true)

  // The "Start Round" CTA must also be present (always rendered regardless of team state)
  await expect(page.getByText(/start round/i).first()).toBeVisible({ timeout: 5000 })
})

// ── TC-0073: Dashboard "Start Round" button is present ───────────────────────

test('TC-0073: dashboard has a "Start Round" button', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Dashboard is SSR — requires seeded local Supabase')

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

  // The CTA always renders — either as a <Link> (active tournament) or a
  // disabled <span> (setup/completed). Both produce a visible element with
  // the text "Start Round".
  await expect(page.getByText(/start round/i).first()).toBeVisible({ timeout: 8000 })
})
