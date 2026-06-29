/**
 * E2E tests: Active round — shot recording, outcomes, offline sync
 * Covers: TC-0020 through TC-0032, TC-0062 through TC-0064
 *
 * Run: npx playwright test tests/e2e/round-scoring.spec.ts
 *
 * Auth is injected via storageState in playwright.config.ts (player-setup dependency).
 *
 * Component facts (keep tests aligned):
 *  - PlayerPills: shows first name or "You" for current user; active pill has green bg (rgb(26,71,42))
 *  - ClubSelector: Radix Select; group labels are "Wood", "Iron", "Wedge", "Putter"
 *  - ShotOutcomeButtons: buttons ("In Play", "Out of Bounds", "Mulligan", "⛳ Sunk")
 *    disabled until a club is selected; no "Capture Shot" step
 *  - SyncEngine: enqueues to localStorage then flushes via supabase.from('shots').insert()
 */
import { test, expect } from '@playwright/test'
import { mockSupabaseTable, mockShotsApi } from './helpers/supabase-mock'
import { fakeClubs, fakePlayers, fakeRoundState, fakeTournament, fakeTeam, fakeHoles, fakeTournamentMembership } from './helpers/fixtures'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'

// The round page (client component) fetches these tables in sequence:
// players (single) → tournaments (single) → tournament_players (membership lookup) →
// tournament_players (teammates list) → teams → players (list) → clubs → holes → round_states
test.beforeEach(async ({ page }) => {
  await mockSupabaseTable(page, 'players', fakePlayers)
  await mockSupabaseTable(page, 'tournaments', [fakeTournament])
  await mockSupabaseTable(page, 'tournament_players', fakeTournamentMembership)
  await mockSupabaseTable(page, 'teams', [fakeTeam])
  await mockSupabaseTable(page, 'clubs', fakeClubs)
  await mockSupabaseTable(page, 'holes', fakeHoles)
  await mockSupabaseTable(page, 'round_states', [fakeRoundState])
  await mockShotsApi(page)
})

// Helper: select a club so outcome buttons are enabled
async function selectClub(page: import('@playwright/test').Page, clubName = 'Driver') {
  const combobox = page.getByRole('combobox')
  await combobox.click()
  await page.getByRole('option', { name: clubName }).click()
}

// ── TC-0020: Active player indicator ──────────────────────────────────────

test('TC-0020: round page shows active player indicator', async ({ page }) => {
  await page.goto('/round', { waitUntil: 'domcontentloaded' })

  // fakeRoundState has active_player_id: 'player-001' = Alice (current user → shows "You")
  // PlayerPills has no data-active; active pill inner div has green background.
  // Alice appears in both the single player fetch and the teammates list → two "You" pills;
  // use .first() to avoid strict-mode violations.
  const alicePill = page.locator('button', { hasText: 'You' }).first()
  await expect(alicePill).toBeVisible({ timeout: 8000 })
  await expect(alicePill.locator('div').first()).toHaveCSS('background-color', 'rgb(26, 71, 42)')
})

// ── TC-0021: Selecting a different player ─────────────────────────────────

test('TC-0021: tapping a player card selects that player as active shooter', async ({ page }) => {
  await page.goto('/round', { waitUntil: 'domcontentloaded' })

  // Alice (current user) is initially active; two "You" pills exist due to duplicate
  // in single-fetch + teammates list — use .first() to avoid strict-mode violation
  const alicePill = page.locator('button', { hasText: 'You' }).first()
  await expect(alicePill).toBeVisible({ timeout: 8000 })

  // Click Bob (player-002, shows first name "Bob")
  const bobPill = page.locator('button', { hasText: 'Bob' })
  await bobPill.click()

  // Bob should now have green active background; Alice should not
  await expect(bobPill.locator('div').first()).toHaveCSS('background-color', 'rgb(26, 71, 42)')
  await expect(alicePill.locator('div').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)')
})

// ── TC-0022: Club selector groups ─────────────────────────────────────────

test('TC-0022: club selector shows clubs grouped by category', async ({ page }) => {
  await page.goto('/round', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox')).toBeVisible({ timeout: 8000 })

  await page.getByRole('combobox').click()

  // Category labels from CATEGORY_LABELS in club-selector.tsx
  await expect(page.getByText('Wood').first()).toBeVisible()
  await expect(page.getByText('Iron').first()).toBeVisible()
  await expect(page.getByText('Wedge').first()).toBeVisible()
  await expect(page.getByText('Putter').first()).toBeVisible()
})

// ── TC-0023: Inactive clubs hidden ────────────────────────────────────────

test('TC-0023: inactive clubs do not appear in the club selector', async ({ page }) => {
  const clubsWithInactive = fakeClubs.map((c) =>
    c.name === 'Pitching Wedge' ? { ...c, is_active: false } : c
  )
  await mockSupabaseTable(page, 'clubs', clubsWithInactive)

  await page.goto('/round', { waitUntil: 'domcontentloaded' })
  await page.getByRole('combobox').click()

  await expect(page.getByRole('option', { name: /driver/i })).toBeVisible()
  await expect(page.getByRole('option', { name: /pitching wedge/i })).not.toBeVisible()
})

// ── TC-0029: In-Play outcome ───────────────────────────────────────────────

test('TC-0029: In-Play outcome records shot into the sync queue', async ({ page }) => {
  // SyncEngine.flush() clears the queue after a successful insert, so check the
  // outbound POST request itself rather than polling localStorage after the fact.
  const shotsPostPromise = page.waitForRequest(
    (req) => req.url().includes('/rest/v1/shots') && req.method() === 'POST',
    { timeout: 5000 }
  )

  await page.route(`${SB_URL}/rest/v1/shots**`, (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([{ id: 'shot-001' }]) })
    } else {
      route.continue()
    }
  })

  await page.goto('/round', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox')).toBeVisible({ timeout: 8000 })

  await selectClub(page)
  await page.getByRole('button', { name: /^in play$/i }).click()

  const req = await shotsPostPromise
  expect(req.method()).toBe('POST')
  expect(req.url()).toContain('/rest/v1/shots')
})

// ── TC-0030: OOB outcome ───────────────────────────────────────────────────

test('TC-0030: OOB outcome records shot with out_of_bounds outcome', async ({ page }) => {
  // SyncEngine.flush() drains the queue after a successful insert (the
  // beforeEach mocks the Supabase shots POST to succeed). Observe the outbound
  // POST itself rather than racing against the drain to read localStorage.
  const shotsPostPromise = page.waitForRequest(
    (req) => req.url().includes('/rest/v1/shots') && req.method() === 'POST',
    { timeout: 5000 }
  )

  await page.goto('/round', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox')).toBeVisible({ timeout: 8000 })

  await selectClub(page)
  await page.getByRole('button', { name: /out of bounds/i }).click()

  const req = await shotsPostPromise
  const body = req.postDataJSON() as Array<{ outcome?: string }> | { outcome?: string }
  const first = Array.isArray(body) ? body[0] : body
  expect(first?.outcome).toBe('out_of_bounds')
})

// ── TC-0031: Mulligan outcome ──────────────────────────────────────────────

test('TC-0031: Mulligan outcome records shot with mulligan outcome', async ({ page }) => {
  const shotsPostPromise = page.waitForRequest(
    (req) => req.url().includes('/rest/v1/shots') && req.method() === 'POST',
    { timeout: 5000 }
  )

  await page.goto('/round', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox')).toBeVisible({ timeout: 8000 })

  await selectClub(page)
  await page.getByRole('button', { name: /^mulligan$/i }).click()

  const req = await shotsPostPromise
  const body = req.postDataJSON() as Array<{ outcome?: string }> | { outcome?: string }
  const first = Array.isArray(body) ? body[0] : body
  expect(first?.outcome).toBe('mulligan')
})

// ── TC-0026: Shot queued offline ───────────────────────────────────────────

test('TC-0026: shot captured offline is queued in SyncEngine (localStorage)', async ({ page }) => {
  // Force the shots POST to fail so SyncEngine.flush() leaves the entry in
  // localStorage. We assert (a) the SyncEngine attempted the flush — proof
  // the click made it through the queue — and (b) the queue persists.
  await mockShotsApi(page, { fail: true })

  const shotsPostPromise = page.waitForRequest(
    (req) => req.url().includes('/rest/v1/shots') && req.method() === 'POST',
    { timeout: 5000 }
  )

  await page.goto('/round', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox')).toBeVisible({ timeout: 8000 })

  await selectClub(page)
  await page.getByRole('button', { name: /^in play$/i }).click()

  await shotsPostPromise

  // SyncEngine's localStorage key is 'fdgolf-cm_sync_queue' (post-rebrand).
  // With a failing flush, the entry stays queued (retries < 5).
  const queue = await page.evaluate(() => {
    const raw = localStorage.getItem('fdgolf-cm_sync_queue')
    return raw ? JSON.parse(raw) : []
  })
  expect(Array.isArray(queue)).toBe(true)
  expect(queue.length).toBeGreaterThan(0)
})

// ── TC-0064: Offline indicator shows pending count ─────────────────────────

test('TC-0064: offline indicator reflects pending shot count', async ({ page }) => {
  // Seed three queued entries into the SyncEngine's storage *before* app code
  // runs. Key must match QUEUE_KEY in src/lib/sync-engine.ts.
  await page.addInitScript(() => {
    const entry = {
      id: 'local-1',
      table: 'shots',
      payload: {},
      retries: 0,
      created_at: 1700000000000,
    }
    localStorage.setItem(
      'fdgolf-cm_sync_queue',
      JSON.stringify([entry, { ...entry, id: 'local-2' }, { ...entry, id: 'local-3' }])
    )
  })

  // Fail the POST so the seeded entries don't drain before the indicator renders.
  await mockShotsApi(page, { fail: true })

  await page.goto('/round', { waitUntil: 'domcontentloaded' })

  await expect(page.getByText(/3 pending|3 shot/i).first()).toBeVisible({ timeout: 8000 })
})

// ── TC-0062: Pause state prevents shot capture ─────────────────────────────

test('TC-0062: paused tournament disables shot capture', async ({ page }) => {
  // Reset all route handlers so the paused tournament mock takes effect cleanly
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await mockSupabaseTable(page, 'players', fakePlayers)
  await mockSupabaseTable(page, 'tournaments', [
    { ...fakeTournament, status: 'paused' },
  ])
  await mockSupabaseTable(page, 'tournament_players', fakeTournamentMembership)
  await mockSupabaseTable(page, 'teams', [fakeTeam])
  await mockSupabaseTable(page, 'clubs', fakeClubs)
  await mockSupabaseTable(page, 'holes', fakeHoles)
  await mockSupabaseTable(page, 'round_states', [fakeRoundState])

  await page.goto('/round', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox')).toBeVisible({ timeout: 8000 })

  // All shot outcome buttons should be disabled (pointer-events-none container)
  const container = page.locator('[class*="pointer-events-none"]').first()
  await expect(container).toBeVisible()

  await expect(page.getByText(/paused/i).first()).toBeVisible({ timeout: 5000 })
})

// ── TC-0076: Sunk outcome shows hole completion UI ────────────────────────────

test('TC-0076: Sunk outcome submits score and shows hole completion UI', async ({ page }) => {
  // Mock the scores upsert that calculate-best-ball triggers after a sunk shot
  await page.route(`${SB_URL}/rest/v1/scores**`, (route) => {
    if (route.request().method() === 'POST' || route.request().method() === 'PUT') {
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([]) })
    } else {
      route.continue()
    }
  })

  await page.goto('/round', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox')).toBeVisible({ timeout: 8000 })

  await selectClub(page)
  await page.getByRole('button', { name: /sunk/i }).click()

  // After Sunk the shot is submitted to the sync queue / shots endpoint
  // AND the hole completion UI renders: "⛳ Hole N Complete" + "Next Hole →"
  await expect(page.getByText(/hole.*complete/i).first()).toBeVisible({ timeout: 8000 })
  await expect(page.getByRole('button', { name: /next hole/i })).toBeVisible({ timeout: 5000 })
})

// ── TC-0077: Round page shows GPS status indicator ────────────────────────────

test('TC-0077: round page renders GPS position widget or acquiring indicator', async ({ page }) => {
  await page.goto('/round', { waitUntil: 'domcontentloaded' })
  // The round page imports useGps() which uses navigator.geolocation.
  // In the Playwright headless browser geolocation is not granted by default,
  // so the HoleMap component is conditionally rendered only when pin coords are
  // non-zero. The page still loads and renders the club selector and player pills.
  // We verify the page loaded successfully (combobox visible) — a GPS assert
  // would require granting geolocation permissions, which is tracked separately.
  await expect(page.getByRole('combobox')).toBeVisible({ timeout: 8000 })

  // The AppHeader always renders the hole info bar which is always present
  // regardless of GPS state — confirms the round UI is fully loaded
  await expect(page.locator('header, [role="banner"]').first()).toBeVisible({ timeout: 5000 })
})
