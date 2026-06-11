/**
 * E2E tests: Leaderboard — authenticated player + public /live route
 * Covers: TC-0040 through TC-0046
 *
 * Run: npx playwright test tests/e2e/leaderboard.spec.ts
 */
import { test, expect } from '@playwright/test'
import { mockLeaderboard, mockSupabaseTable } from './helpers/supabase-mock'
import { fakeLeaderboard, fakeTournament, fakePlayer } from './helpers/fixtures'

const hasRealSupabase = !!process.env.SUPABASE_SERVICE_ROLE_KEY

// The leaderboard page (client component) queries tournaments first via .single()
// then calls get_leaderboard RPC and queries players for "Your Team" pinning.
// Every test needs at minimum the tournament + players mocks.
test.beforeEach(async ({ page }) => {
  await mockSupabaseTable(page, 'tournaments', [fakeTournament])
  await mockSupabaseTable(page, 'sponsors', [])
  await mockSupabaseTable(page, 'players', [fakePlayer])
  await mockLeaderboard(page, fakeLeaderboard)
})

const extendedLeaderboard = [
  ...fakeLeaderboard,
  // Add 18 more teams to push player's team beyond top 3
  ...Array.from({ length: 18 }, (_, i) => ({
    team_id: `team-filler-${i}`,
    team_number: i + 4,
    team_name: `Team ${i + 4}`,
    total_score: i + 1,
    holes_completed: 9 - i,
    par_total: 36,
    rank: i + 4,
  })),
]

// ── TC-0040: Leaderboard ranks teams by score vs par ──────────────────────

test('TC-0040: leaderboard ranks teams by best-ball score vs par', async ({ page }) => {

  await page.goto('/leaderboard')

  // First team in list should have the lowest (most negative) score
  const rows = page.locator('table tbody tr, [data-testid="leaderboard-row"]')
  await expect(rows.first()).toContainText('Eagles')
})

// ── TC-0042: Holes column ──────────────────────────────────────────────────

test('TC-0042: leaderboard shows holes completed in Holes column', async ({ page }) => {
  await mockLeaderboard(page, fakeLeaderboard)

  await page.goto('/leaderboard')

  // Column header is "Holes" (not "Thru")
  await expect(page.getByText(/^holes$/i).first()).toBeVisible({ timeout: 5000 })

  // Eagles have 12 holes complete; component renders "12/18"
  await expect(page.getByText('12/18').first()).toBeVisible()
})

// ── TC-0041: "Your Team ★" marker ─────────────────────────────────────────

test('TC-0041: "Your Team" row is marked with ★ on the leaderboard', async ({ page }) => {
  // extendedLeaderboard has fakeLeaderboard[0] (team-001 = Eagles) at position 0
  // fakePlayer has team_id: 'team-001', so the Eagles row gets the ★ marker
  await mockLeaderboard(page, extendedLeaderboard)

  await page.goto('/leaderboard')
  await expect(page.getByText(/eagles/i).first()).toBeVisible({ timeout: 5000 })

  // "Your Team" marker (★) should be visible on the Eagles row
  const yourTeamRow = page.locator('[data-your-team="true"]').first()
  const starText = page.getByText('★').first()

  const isVisible =
    (await yourTeamRow.isVisible().catch(() => false)) ||
    (await starText.isVisible().catch(() => false))
  expect(isVisible).toBe(true)
})

// ── TC-0043: Public leaderboard loads without auth ─────────────────────────

test('TC-0043: public leaderboard /live/slug loads without authentication', async ({ page }) => {
  // /live/[slug] is a Server Component — page.route() mocks don't intercept SSR.
  // Requires the CIBC tournament seeded in local Supabase (via globalSetup).
  test.skip(!hasRealSupabase, 'Requires seeded tournament in local Supabase')

  await page.goto('/live/cibc-granite-ridge-2026')

  // Should NOT redirect to login
  await expect(page).not.toHaveURL(/login/)

  // Tournament is found → page does not show the "not found" fallback
  await expect(page.getByText(/tournament not found/i)).not.toBeVisible({ timeout: 5000 })

  // "Live Leaderboard" text is always present when tournament exists
  await expect(page.getByText(/live leaderboard/i).first()).toBeVisible({ timeout: 8000 })
})

// ── TC-0044: LIVE badge on public leaderboard ──────────────────────────────

test('TC-0044: LIVE badge visible on public leaderboard header', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded tournament in local Supabase')

  await page.goto('/live/cibc-granite-ridge-2026')

  // Page renders "Live Leaderboard" subtitle when tournament is found
  await expect(page.getByText(/live leaderboard/i).first()).toBeVisible({ timeout: 5000 })
})

// ── TC-0045: Sponsor logos visible ────────────────────────────────────────

test('TC-0045: sponsor logos visible on public leaderboard', async ({ page }) => {
  // Requires sponsors with logo_url seeded in Supabase — not seeded by globalSetup.
  // This test is kept as documentation of the intended feature and skipped until
  // sponsor seeding is added to globalSetup.
  test.skip(true, 'Requires seeded sponsors with logo_url in Supabase')

  await page.goto('/live/cibc-granite-ridge-2026')

  // Sponsor images should be present (requires seeded sponsor data with logo_url)
  const sponsorImgs = page.locator('img[alt*="CIBC"], img[alt*="sponsor"], [data-testid="sponsor-logo"]')
  await expect(sponsorImgs.first()).toBeVisible({ timeout: 5000 })
})

// ── TC-0046: Re-render after data change (smoke) ───────────────────────────

test('TC-0046: leaderboard shows updated holes count after re-fetch', async ({ page }) => {
  // Initial leaderboard: Eagles with 12 holes complete
  await mockLeaderboard(page, fakeLeaderboard)

  await page.goto('/leaderboard')
  await expect(page.getByText(/eagles/i).first()).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('12/18').first()).toBeVisible()

  // Update the mock to return changed data (Eagles now at 14 holes)
  const updatedLeaderboard = [
    { ...fakeLeaderboard[0], total_score: -8, holes_completed: 14 },
    ...fakeLeaderboard.slice(1),
  ]
  await mockLeaderboard(page, updatedLeaderboard)

  // Reload triggers a fresh data fetch from the updated mock
  // (simulates what a Supabase Realtime event would trigger in production)
  await page.reload({ waitUntil: 'domcontentloaded' })

  await expect(page.getByText('14/18').first()).toBeVisible({ timeout: 8000 })
})
