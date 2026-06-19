/**
 * E2E tests: Player scorecard — column headers, par values, no-scores state
 * Covers: TC-0074 through TC-0075
 *
 * Run: npx playwright test --project=chromium-mobile tests/e2e/scorecard.spec.ts
 *
 * Like the dashboard, the scorecard page is an SSR Server Component — all DB
 * reads happen inside the Next.js Node process, so page.route() mocks only
 * affect client-side hydration fetches (none on this page). Tests therefore
 * require a real Supabase instance with seeded player/score data and are
 * gated behind hasRealSupabase.
 */
import { test, expect } from '@playwright/test'
import { mockSupabaseTable } from './helpers/supabase-mock'
import { fakeHoles } from './helpers/fixtures'

const hasRealSupabase = !!process.env.SUPABASE_SERVICE_ROLE_KEY

/** Minimal score rows for a player — hole 1 through 3 */
const fakeScores = [
  { id: 'score-001', player_id: 'player-001', tournament_id: 'tournament-001', hole_number: 1, strokes: 4, is_best_ball: true },
  { id: 'score-002', player_id: 'player-001', tournament_id: 'tournament-001', hole_number: 2, strokes: 3, is_best_ball: false },
  { id: 'score-003', player_id: 'player-001', tournament_id: 'tournament-001', hole_number: 3, strokes: 5, is_best_ball: false },
]

test.beforeEach(async ({ page }) => {
  // Pre-seed client-side mocks (no effect on SSR but harmless)
  await mockSupabaseTable(page, 'scores', fakeScores)
  await mockSupabaseTable(page, 'holes', fakeHoles)
})

// ── TC-0074: Scorecard page loads and renders content ────────────────────────

test('TC-0074: scorecard page loads and shows either the scorecard table or the no-scores empty state', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Scorecard is SSR — requires seeded local Supabase')

  await page.goto('/scorecard', { waitUntil: 'domcontentloaded' })

  // The scorecard page renders one of two states:
  //   a) Scores exist → h1 "Scorecard" + table with columns Hole / Par / Strokes / vs Par / Best Ball
  //   b) No scores yet → empty-state paragraph
  // Both indicate the page loaded successfully without an error.
  const hasHeading = await page.getByRole('heading', { name: /scorecard/i }).isVisible().catch(() => false)
  const hasEmptyState = await page.getByText(/no scores recorded yet/i).isVisible().catch(() => false)

  expect(hasHeading || hasEmptyState).toBe(true)

  // In either state the player layout nav is always present
  await expect(page.getByRole('navigation')).toBeVisible({ timeout: 5000 })
})

// ── TC-0075: Scorecard shows correct column headers when scores exist ─────────

test('TC-0075: scorecard table has Hole and Par column headers when scores are present', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Scorecard is SSR — requires seeded local Supabase')

  await page.goto('/scorecard', { waitUntil: 'domcontentloaded' })

  // Check whether the table is rendered (only happens when scores exist)
  const tableVisible = await page.getByRole('table').isVisible().catch(() => false)

  if (tableVisible) {
    // Column headers from <thead> in scorecard page.tsx
    const table = page.getByRole('table')
    await expect(table.getByText('Hole').first()).toBeVisible({ timeout: 5000 })
    await expect(table.getByText('Par').first()).toBeVisible({ timeout: 5000 })
    await expect(table.getByText('Strokes').first()).toBeVisible({ timeout: 5000 })
  } else {
    // No scores in seeded DB for this test user — assert the empty state
    await expect(page.getByText(/no scores recorded yet/i).first()).toBeVisible({ timeout: 5000 })
  }
})
