/**
 * E2E tests: Active round — shot recording, outcomes, offline sync
 * Covers: TC-0020 through TC-0032, TC-0062 through TC-0064
 *
 * Run: npx playwright test tests/e2e/round-scoring.spec.ts
 *
 * Auth is injected via storageState in playwright.config.ts (player-setup dependency).
 *
 * Component facts (keep tests aligned):
 *  - PlayerPills: renders first names only; active player has data-active="true"
 *  - ClubSelector: Radix Select; group labels are "Wood", "Iron", "Wedge", "Putter"
 *  - ShotOutcomeButtons: direct outcome buttons ("In Play", "OOB", "Mulligan", "Sunk!")
 *    disabled until a club is selected; no "Capture Shot" step
 *  - SyncEngine: enqueues to localStorage then flushes via supabase.from('shots').insert()
 */
import { test, expect } from '@playwright/test'
import { mockSupabaseTable, mockShotsApi } from './helpers/supabase-mock'
import { fakeClubs, fakePlayers, fakeRoundState, fakeTournament, fakeTeam, fakeHoles } from './helpers/fixtures'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'

// The round page (client component) fetches these tables in sequence:
// players (single) → tournaments (single) → teams (single) → players (list) → clubs → holes → round_states (single)
test.beforeEach(async ({ page }) => {
  await mockSupabaseTable(page, 'players', fakePlayers)
  await mockSupabaseTable(page, 'tournaments', [fakeTournament])
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

  // fakeRoundState has active_player_id: 'player-001' = Alice
  const aliceBtn = page.getByRole('button', { name: /^alice$/i })
  await expect(aliceBtn).toBeVisible({ timeout: 8000 })
  await expect(aliceBtn).toHaveAttribute('data-active', 'true')
})

// ── TC-0021: Selecting a different player ─────────────────────────────────

test('TC-0021: tapping a player card selects that player as active shooter', async ({ page }) => {
  await page.goto('/round', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: /^alice$/i })).toBeVisible({ timeout: 8000 })

  await page.getByRole('button', { name: /^bob$/i }).click()

  await expect(page.getByRole('button', { name: /^bob$/i })).toHaveAttribute('data-active', 'true')
  await expect(page.getByRole('button', { name: /^alice$/i })).not.toHaveAttribute('data-active', 'true')
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
  await page.goto('/round', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox')).toBeVisible({ timeout: 8000 })

  await selectClub(page)
  await page.getByRole('button', { name: /^oob$/i }).click()

  const queue = await page.evaluate(() => {
    const raw = localStorage.getItem('fdgolf_sync_queue')
    return raw ? JSON.parse(raw) : []
  })
  expect(queue.length).toBeGreaterThan(0)
  expect(queue[0].payload?.outcome).toBe('out_of_bounds')
})

// ── TC-0031: Mulligan outcome ──────────────────────────────────────────────

test('TC-0031: Mulligan outcome records shot with mulligan outcome', async ({ page }) => {
  await page.goto('/round', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox')).toBeVisible({ timeout: 8000 })

  await selectClub(page)
  await page.getByRole('button', { name: /^mulligan$/i }).click()

  const queue = await page.evaluate(() => {
    const raw = localStorage.getItem('fdgolf_sync_queue')
    return raw ? JSON.parse(raw) : []
  })
  expect(queue.length).toBeGreaterThan(0)
  expect(queue[0].payload?.outcome).toBe('mulligan')
})

// ── TC-0026: Shot queued offline ───────────────────────────────────────────

test('TC-0026: shot captured offline is queued in SyncEngine (localStorage)', async ({ page }) => {
  // Block the Supabase shots REST endpoint to simulate offline flush failure
  await page.route(`${SB_URL}/rest/v1/shots**`, (route) => route.abort('failed'))

  await page.goto('/round', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('combobox')).toBeVisible({ timeout: 8000 })

  await selectClub(page)
  await page.getByRole('button', { name: /^in play$/i }).click()

  const queue = await page.evaluate(() => {
    const raw = localStorage.getItem('fdgolf_sync_queue')
    return raw ? JSON.parse(raw) : []
  })
  expect(Array.isArray(queue)).toBe(true)
  expect(queue.length).toBeGreaterThan(0)
})

// ── TC-0064: Offline indicator shows pending count ─────────────────────────

test('TC-0064: offline indicator reflects pending shot count', async ({ page }) => {
  await page.addInitScript(() => {
    const entry = { id: 'local-1', table: 'shots', payload: {}, retries: 0, createdAt: Date.now() }
    localStorage.setItem('fdgolf_sync_queue', JSON.stringify([entry, { ...entry, id: 'local-2' }, { ...entry, id: 'local-3' }]))
  })

  await page.route(`${SB_URL}/rest/v1/shots**`, (route) => route.abort('failed'))

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
