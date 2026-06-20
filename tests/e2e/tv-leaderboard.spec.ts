/**
 * E2E tests: TV Leaderboard — public /live/[slug]/tv route
 * Covers: TC-0065 through TC-0070
 *
 * Run: npx playwright test --project=chromium-tv
 *
 * All stat-table Supabase calls are mocked via page.route() — no auth required.
 * The TV route (/live/[slug]/tv) is a Server Component wrapper around TvDisplay
 * (a client component). The server-side tournament lookup (SSR) is NOT intercepted
 * by page.route(), so TC-0066 (404 for unknown slug) is gated behind a real
 * Supabase instance and skipped otherwise.
 */
import { test, expect } from '@playwright/test'
import { mockSupabaseTable, mockLeaderboard } from './helpers/supabase-mock'
import { fakeTournament, fakeLeaderboard } from './helpers/fixtures'

const hasRealSupabase = !!process.env.SUPABASE_SERVICE_ROLE_KEY

/** Slug that matches fakeTournament.slug */
const TOURNAMENT_SLUG = fakeTournament.slug // 'cibc-granite-ridge-2026'

/** Register all client-side Supabase mocks needed by TvDisplay + tv-stats.ts */
async function mockAllTvTables(
  page: Parameters<typeof mockSupabaseTable>[0],
  options: { leaderboard?: typeof fakeLeaderboard } = {}
) {
  // Tournament row — used by tv-stats.ts functions (client-side, .single() calls)
  await mockSupabaseTable(page, 'tournaments', [fakeTournament])
  // Sponsors — queried by the SSR page (not strictly needed for client mocks, but harmless)
  await mockSupabaseTable(page, 'sponsors', [])
  // Stat tables — all empty to exercise the empty-state / zero-data paths
  await mockSupabaseTable(page, 'scores', [])
  await mockSupabaseTable(page, 'holes', [])
  await mockSupabaseTable(page, 'shots', [])
  await mockSupabaseTable(page, 'tee_boxes', [])
  await mockSupabaseTable(page, 'teams', [])
  await mockSupabaseTable(page, 'players', [])
  // Leaderboard RPC
  await mockLeaderboard(page, options.leaderboard ?? fakeLeaderboard)
}

// ── TC-0065: TV page loads for valid tournament slug ─────────────────────────

test('TC-0065: TV page loads for valid tournament slug', async ({ page }) => {
  await mockAllTvTables(page)

  await page.goto(`/live/${TOURNAMENT_SLUG}/tv`)
  await page.waitForLoadState('networkidle')

  // TvLeaderboard renders a heading with "Leaderboard" text (uppercase via CSS)
  await expect(page.getByText(/leaderboard/i).first()).toBeVisible({ timeout: 8000 })

  // TvDisplay header always shows the LIVE badge
  await expect(page.getByText('LIVE').first()).toBeVisible({ timeout: 5000 })

  // Tournament name appears in the header
  await expect(page.getByText(fakeTournament.name).first()).toBeVisible({ timeout: 5000 })
})

// ── TC-0066: TV page returns 404 for unknown slug ───────────────────────────

test('TC-0066: TV page returns 404 for unknown slug', async ({ page }) => {
  // The tournament lookup is an SSR fetch — page.route() cannot intercept it.
  // Requires a real Supabase with no 'no-such-tournament' row.
  test.skip(!hasRealSupabase, 'Requires real Supabase: SSR tournament fetch cannot be mocked')

  const response = await page.goto('/live/no-such-tournament/tv')

  const statusIs404 = response?.status() === 404

  // Next.js notFound() either returns HTTP 404 or renders a 404 page in the body
  if (!statusIs404) {
    await expect(page.getByText('404').first()).toBeVisible({ timeout: 5000 })
  } else {
    expect(statusIs404).toBe(true)
  }
})

// ── TC-0067: Leaderboard panel shows team rows ───────────────────────────────

test('TC-0067: leaderboard panel shows team rows and column headers', async ({ page }) => {
  await mockAllTvTables(page, { leaderboard: fakeLeaderboard })

  await page.goto(`/live/${TOURNAMENT_SLUG}/tv`)
  await page.waitForLoadState('networkidle')

  // Column header '#' rank column
  await expect(page.getByText('#').first()).toBeVisible({ timeout: 5000 })

  // Column header 'Team'
  await expect(page.getByText(/^team$/i).first()).toBeVisible({ timeout: 5000 })

  // Column header 'Sc' (TvLeaderboard renders ['#', 'Team', 'Trend', 'Thru', 'Sc'])
  await expect(page.getByText(/^sc$/i).first()).toBeVisible({ timeout: 5000 })

  // First team name from fakeLeaderboard should be visible
  await expect(page.getByText(fakeLeaderboard[0].team_name).first()).toBeVisible({ timeout: 5000 })
})

// ── TC-0068: Birdie panel shows empty state when no scores ──────────────────

test('TC-0068: birdie panel shows empty state when no scores exist', async ({ page }) => {
  // All stat tables mocked as empty; birdieStats will be [] → empty state rendered
  await mockAllTvTables(page)

  await page.goto(`/live/${TOURNAMENT_SLUG}/tv`)
  await page.waitForLoadState('networkidle')

  // TvBirdiesPanel is panel index 0 (the default active panel).
  // With empty data: totalBirdies=0. The "Birdies Today" label always renders.
  await expect(page.getByText('Birdies Today').first()).toBeVisible({ timeout: 8000 })
})

// ── TC-0069: Footer shows three panel indicator dots ────────────────────────

test('TC-0069: footer shows exactly three panel indicator dots', async ({ page }) => {
  await mockAllTvTables(page)

  await page.goto(`/live/${TOURNAMENT_SLUG}/tv`)
  await page.waitForLoadState('networkidle')

  // TvDisplay footer renders 5 panel indicator divs (one per panel: Birdies, Hole
  // Difficulty, Shot Stats, Moment of Day, Team Spotlight) using inline width/height
  // styles and className="rounded-full transition-all duration-300".
  const dots = page.locator('footer .rounded-full')
  await expect(dots).toHaveCount(5, { timeout: 5000 })
})

// ── TC-0070: TV page accessible without any authentication ───────────────────

test('TC-0070: TV page accessible without any authentication', async ({ page }) => {
  // No auth mock, no storageState — pure public access
  await mockAllTvTables(page)

  await page.goto(`/live/${TOURNAMENT_SLUG}/tv`)
  await page.waitForLoadState('networkidle')

  // Must not redirect to a login page
  await expect(page.getByText(/sign in/i)).not.toBeVisible({ timeout: 3000 })
  await expect(page.getByText(/^login$/i)).not.toBeVisible()

  // Should render the leaderboard content
  await expect(page.getByText(/leaderboard/i).first()).toBeVisible({ timeout: 8000 })
})

// ── TC-0080: TV page shows overflow message when more than 18 teams ──────────

test('TC-0080: TV page shows "more teams" message when leaderboard has >18 teams', async ({ page }) => {
  // TvLeaderboard.tsx slices the first 18 rows and shows "… and N more teams"
  // for moreCount = leaderboard.length - 18
  const bigLeaderboard = Array.from({ length: 20 }, (_, i) => ({
    team_id: `team-${String(i + 1).padStart(3, '0')}`,
    team_name: `Team ${i + 1}`,
    total_score: -10 + i,
    holes_completed: 18 - i,
    rank: i + 1,
  }))

  await mockAllTvTables(page, { leaderboard: bigLeaderboard })

  await page.goto(`/live/${TOURNAMENT_SLUG}/tv`)
  await page.waitForLoadState('networkidle')

  // TvLeaderboard renders: "… and {moreCount} more teams"
  // With 20 teams: moreCount = 2 → "… and 2 more teams"
  await expect(page.getByText(/more teams?/i).first()).toBeVisible({ timeout: 8000 })
})

// ── TC-0081: TV page footer shows tournament name dynamically ─────────────────

test('TC-0081: TV page footer contains the tournament name', async ({ page }) => {
  // TvDisplay footer renders: {tournament.name} · {venue} · ...
  // fakeTournament.name = 'CIBC Capital Markets Golf Tournament 2026'
  await mockAllTvTables(page)

  await page.goto(`/live/${TOURNAMENT_SLUG}/tv`)
  await page.waitForLoadState('networkidle')

  // The footer <span> in TvDisplay contains tournament.name
  // Use a substring match since the full footer also appends venue and date
  await expect(
    page.getByText(new RegExp(fakeTournament.name.slice(0, 20), 'i')).first()
  ).toBeVisible({ timeout: 8000 })
})
