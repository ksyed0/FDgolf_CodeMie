/**
 * E2E tests: Admin pages — tournament config, players, teams, scores
 * Covers: TC-0047 through TC-0060
 *
 * Run: npx playwright test tests/e2e/admin.spec.ts --project=chromium-desktop
 *
 * Auth is injected via storageState in playwright.config.ts (admin-setup dependency).
 */
import { test, expect } from '@playwright/test'
import { mockSupabaseTable, mockMagicLinkApi } from './helpers/supabase-mock'
import { fakePlayers, fakeTournament, fakeAdminPlayer } from './helpers/fixtures'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const hasRealSupabase = !!process.env.SUPABASE_SERVICE_ROLE_KEY

const fakeHoles = Array.from({ length: 18 }, (_, i) => ({
  id: `hole-${i + 1}`,
  tournament_id: 'tournament-001',
  hole_number: i + 1,
  par: [4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4][i] ?? 4,
  handicap: i + 1,
  pin_lat: 43.5 + i * 0.001,
  pin_lng: -79.9 + i * 0.001,
}))

const fakeTeams = [
  { id: 'team-001', team_number: 7, team_name: 'Eagles', starting_hole: 14, tournament_id: 'tournament-001' },
  { id: 'team-002', team_number: 8, team_name: 'Birdies', starting_hole: 1, tournament_id: 'tournament-001' },
]

test.beforeEach(async ({ page }) => {
  // storageState (admin session) is injected at the project level
  await mockSupabaseTable(page, 'players', [fakeAdminPlayer])
  await mockSupabaseTable(page, 'tournaments', [fakeTournament])
})

// ── TC-0047: Admin sidebar has all 7 sections ──────────────────────────────

test('TC-0047: admin sidebar shows all 7 management sections', async ({ page }) => {
  // Admin layout is an SSR Server Component; sidebar links are hardcoded and
  // render regardless of DB state — only auth (storageState) is required.
  test.skip(!hasRealSupabase, 'Requires admin storageState from seeded Supabase')

  await page.goto('/admin/tournament')

  const expectedSections = ['tournament', 'holes', 'clubs', 'players', 'teams', 'scores', 'sponsors']
  for (const section of expectedSections) {
    await expect(page.getByRole('link', { name: new RegExp(section, 'i') }).first()).toBeVisible({ timeout: 5000 })
  }
})

// ── TC-0048: Non-admin redirect ────────────────────────────────────────────

test('TC-0048: unauthenticated user is blocked from /admin routes', async ({ page, context }) => {
  // Clear the admin storageState to simulate an anonymous visitor
  await context.clearCookies()

  await page.goto('/admin/tournament')
  await page.waitForURL(/dashboard|login/, { timeout: 5000 })
  await expect(page).not.toHaveURL(/admin/)
})

// ── TC-0049: Tournament config saved ──────────────────────────────────────

test('TC-0049: tournament config edits are saved to database', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded local Supabase — /admin/tournament is SSR')

  let patchCalled = false

  await page.route(`${SB_URL}/rest/v1/tournaments**`, (route) => {
    if (route.request().method() === 'PATCH') {
      patchCalled = true
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    } else {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([fakeTournament]) })
    }
  })

  await page.goto('/admin/tournament')

  // TournamentNameEditor renders an "Edit tournament name" pencil button; clicking it reveals the input
  await page.getByRole('button', { name: /edit tournament name/i }).click()
  const nameInput = page.getByRole('textbox').first()
  await nameInput.clear()
  await nameInput.fill('CIBC 2026 Updated')

  await page.getByRole('button', { name: /save name/i }).click()

  expect(patchCalled).toBe(true)
})

// ── TC-0050: Copy leaderboard URL ─────────────────────────────────────────

test('TC-0050: "Copy Leaderboard URL" button copies URL to clipboard', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded local Supabase — /admin/tournament is SSR')

  await page.goto('/admin/tournament')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

  await page.getByRole('button', { name: /copy.*url|copy.*leaderboard/i }).click()

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboardText).toContain('cibc-granite-ridge-2026')
})

// ── TC-0051: Hole par editing ──────────────────────────────────────────────

test('TC-0051: hole par value is editable and saved', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded holes in local Supabase — /admin/holes is SSR')
  await mockSupabaseTable(page, 'holes', fakeHoles)

  let patchCalled = false
  await page.route(`${SB_URL}/rest/v1/holes**`, (route) => {
    if (route.request().method() === 'PATCH') {
      patchCalled = true
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    } else {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeHoles) })
    }
  })

  await page.goto('/admin/holes')

  const hole7Row = page.locator('tr', { hasText: /^7/ }).first()
  const parCell = hole7Row.locator('td').nth(1)
  await parCell.click()

  const parInput = parCell.locator('input').first()
  await parInput.clear()
  await parInput.fill('5')

  await page.getByRole('button', { name: /save/i }).click()

  expect(patchCalled).toBe(true)
})

// ── TC-0053: Player table search ───────────────────────────────────────────

test('TC-0053: player table filters by search term', async ({ page }) => {
  // /admin/players is an SSR Server Component — page.route() mocks don't affect it.
  // globalSetup seeds Alice Nguyen, John Smith, Jane Smith as fixture players so the
  // client-side search filter can be tested against real SSR-rendered data.
  test.skip(!hasRealSupabase, 'Requires seeded fixture players in local Supabase — /admin/players is SSR')

  await page.goto('/admin/players')

  // Wait for the players table to render (SSR + hydration)
  await expect(page.getByPlaceholder(/search|filter/i).first()).toBeVisible({ timeout: 8000 })

  const searchInput = page.getByPlaceholder(/search|filter/i).first()
  await searchInput.fill('Smith')

  await expect(page.getByText('John Smith')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Jane Smith')).toBeVisible()
  await expect(page.getByText('Alice Nguyen')).not.toBeVisible()
})

// ── TC-0055: Magic link sent ───────────────────────────────────────────────

test('TC-0055: sending magic link calls /api/auth/magic-link', async ({ page }) => {
  // /admin/players is SSR — seeded fixture players (globalSetup) appear in the table.
  // Clicking "Send Invite" on any player calls /api/auth/magic-link and copies the link.
  test.skip(!hasRealSupabase, 'Requires seeded fixture players in local Supabase — /admin/players is SSR')

  let magicLinkCalled = false
  await page.route('**/api/auth/magic-link', (route) => {
    magicLinkCalled = true
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ link: 'http://localhost:3000/auth/confirm?token=e2e-test' }),
    })
  })

  await page.goto('/admin/players')

  // Button label in PlayersTable is "Send Invite"
  await page.getByRole('button', { name: /send invite/i }).first().click()

  expect(magicLinkCalled).toBe(true)
  // On success, a toast shows the player name and "Invite link copied"
  await expect(page.getByText(/invite link copied|copied to clipboard/i).first()).toBeVisible({ timeout: 5000 })
})

// ── TC-0056: Create new team ───────────────────────────────────────────────

test('TC-0056: new team can be created with team number and starting hole', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded local Supabase — /admin/teams is SSR')
  await mockSupabaseTable(page, 'teams', fakeTeams)

  let insertCalled = false
  await page.route(`${SB_URL}/rest/v1/teams**`, (route) => {
    if (route.request().method() === 'POST') {
      insertCalled = true
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([{ id: 'team-new' }]) })
    } else {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeTeams) })
    }
  })

  await page.goto('/admin/teams')

  // team_number is auto-generated (max + 1) — no field for it in the form
  await page.getByRole('button', { name: /\+ add team/i }).click()
  await page.getByPlaceholder(/team name/i).fill('Eagles')
  await page.locator('input[type="number"]').fill('5')
  await page.getByRole('button', { name: /^add team$/i }).click()

  expect(insertCalled).toBe(true)
})

// ── TC-0059: CSV player import ────────────────────────────────────────────

test('TC-0059: CSV import creates players and shows invite links', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded local Supabase — /admin/players is SSR')

  let importCalled = false
  let importBody: unknown = null

  await page.route('**/api/admin/import-players', (route) => {
    importCalled = true
    importBody = route.request().postDataJSON()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        imported: 3,
        errors: [],
        teamsCreated: ['Eagles', 'Hawks'],
        invites: [
          { name: 'Test Player 1', email: 'tp1@test.com', link: 'http://localhost:3000/auth/confirm?token=1' },
          { name: 'Test Player 2', email: 'tp2@test.com', link: 'http://localhost:3000/auth/confirm?token=2' },
          { name: 'Test Player 3', email: 'tp3@test.com', link: 'http://localhost:3000/auth/confirm?token=3' },
        ],
      }),
    })
  })

  await page.goto('/admin/players')

  // Click Import CSV button
  await page.getByRole('button', { name: /import csv/i }).click()

  // Verify the import panel is visible
  await expect(page.getByText(/import players from csv/i)).toBeVisible()

  // Upload a CSV file
  const csvContent = 'name,email,company,team\nTest Player 1,tp1@test.com,CIBC,Eagles\nTest Player 2,tp2@test.com,CIBC,Eagles\nTest Player 3,tp3@test.com,TD,Hawks'
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'players.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvContent),
  })

  // Preview should show 3 valid rows
  await expect(page.getByText('3 valid')).toBeVisible()

  // Click import button
  await page.getByRole('button', { name: /import 3 players/i }).click()

  // Verify API was called
  expect(importCalled).toBe(true)
  expect((importBody as { rows: unknown[] }).rows).toHaveLength(3)

  // Results should show success
  await expect(page.getByText(/3 imported/i)).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(/2 teams created/i)).toBeVisible()

  // Copy all links button should be visible
  await expect(page.getByRole('button', { name: /copy all invite links/i })).toBeVisible()
})

// ── TC-0060: CSV import shows validation errors ─────────────────────────────

test('TC-0060: CSV import shows validation errors for invalid rows', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded local Supabase — /admin/players is SSR')

  await page.goto('/admin/players')
  await page.getByRole('button', { name: /import csv/i }).click()

  // Upload CSV with invalid rows
  const csvContent = 'name,email,team\n,missing-name@test.com,Eagles\nNo Email,,Hawks\nValid Player,valid@test.com,Eagles'
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'bad-players.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvContent),
  })

  // Should show 1 valid, 2 errors
  await expect(page.getByText('1 valid')).toBeVisible()
  await expect(page.getByText('2 errors')).toBeVisible()

  // Error rows should be highlighted
  await expect(page.getByText('Missing name')).toBeVisible()
  await expect(page.getByText('Missing email')).toBeVisible()
})

// ── TC-0058: Score override ────────────────────────────────────────────────
// SKIPPED: /admin/scores is SSR — page.route() score/team mocks don't affect the initial
// render. ScoresTable also uses Radix UI Select (not a native <select>), so Playwright's
// .selectOption() doesn't work; it requires click-to-open interaction. Rewrite is tracked
// as a backlog item once the scores page is converted to use a client-fetched approach.

test.skip('TC-0058: admin can override stroke count and trigger recalculation', async ({ page }) => {
  const fakeScores = [
    { id: 'score-001', player_id: 'player-001', team_id: 'team-001', hole_number: 5, strokes: 5, is_best_ball: false },
    { id: 'score-002', player_id: 'player-002', team_id: 'team-001', hole_number: 5, strokes: 4, is_best_ball: true },
  ]
  await mockSupabaseTable(page, 'scores', fakeScores)
  await mockSupabaseTable(page, 'teams', fakeTeams)

  let overrideCalled = false
  await page.route(`${SB_URL}/rest/v1/scores**`, (route) => {
    if (route.request().method() === 'PATCH') {
      overrideCalled = true
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    } else {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeScores) })
    }
  })

  await page.goto('/admin/scores')

  await page.getByRole('combobox', { name: /team/i }).selectOption({ label: 'Eagles' })
  await page.getByRole('combobox', { name: /hole/i }).selectOption('5')

  const aliceStrokesInput = page.locator('input[data-player-id="player-001"], [data-testid="strokes-player-001"]').first()
  await aliceStrokesInput.clear()
  await aliceStrokesInput.fill('4')

  await page.getByRole('button', { name: /recalculate|save/i }).click()

  expect(overrideCalled).toBe(true)
})
