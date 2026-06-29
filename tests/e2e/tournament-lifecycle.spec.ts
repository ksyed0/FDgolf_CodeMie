// tests/e2e/tournament-lifecycle.spec.ts
/**
 * Full tournament lifecycle E2E — Lionhead Spring Classic 2026
 *
 * Prerequisites:
 *   1. Local Supabase running (OrbStack / supabase start)
 *   2. Reset: npx tsx scripts/reset-lionhead.ts
 *   3. Run:   npx playwright test tests/e2e/tournament-lifecycle.spec.ts --project=chromium-lifecycle
 *
 * All steps run serially. A failure in any step halts subsequent steps.
 * Data is intentionally left in the DB after the run for Supabase Studio inspection.
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'path'
import { ADMIN_AUTH_FILE } from './global-setup'

dotenvConfig({ path: resolve(process.cwd(), '.env.local') })

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const PLAYER_A = { email: 'e2e-lion-a@fdgolf.test', password: 'E2eLionA789!', name: 'Alex Lion' }
const PLAYER_B = { email: 'e2e-lion-b@fdgolf.test', password: 'E2eLionB789!', name: 'Blake Lion' }

// Shared across serial steps
let adminCtx: BrowserContext
let adminPage: Page
let tournamentId: string   // set in step-05, used in step-12 + is_best_ball fix

function svc() {
  return createClient(SB_URL, SB_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
}

/**
 * Fill a plain <Input> that sits inside a div alongside a <Label> without htmlFor association.
 * Used for VenueManager and CourseManager forms which omit id/htmlFor on their inputs.
 *
 * Strategy: locate the label by visible text, then use xpath=.. parent traversal to navigate
 * to the immediate parent element, then find the input. This is more reliable than div.filter()
 * which relies on DOM traversal order and breaks silently with wrapper div changes.
 */
async function fillByLabel(page: Page, labelText: string, value: string) {
  await page
    .locator('label', { hasText: labelText })
    .first()
    .locator('xpath=..')
    .locator('input')
    .first()
    .fill(value)
}

/**
 * Open a Radix <Select> whose trigger is inside a div labelled with labelText,
 * then click the option with the given visible text.
 */
async function selectByLabel(page: Page, labelText: string, optionText: string) {
  await page
    .locator('div')
    .filter({ has: page.locator(`label:has-text("${labelText}")`) })
    .locator('[role="combobox"]')
    .first()
    .click()
  await page.getByRole('option', { name: optionText }).first().click()
}

/**
 * Log in as a player in a fresh browser context and return the page.
 * The caller is responsible for closing the context.
 */
async function loginAsPlayer(
  browser: import('@playwright/test').Browser,
  email: string,
  password: string,
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 10_000 })
  return { ctx, page }
}

test.describe.serial('Tournament Lifecycle — Lionhead Spring Classic 2026', () => {
  test.skip(!SB_KEY, 'Requires SUPABASE_SERVICE_ROLE_KEY — run: npx tsx scripts/reset-lionhead.ts first')

  test.beforeAll(async ({ browser }) => {
    const admin = svc()
    const { data: { users } } = await admin.auth.admin.listUsers()

    for (const p of [PLAYER_A, PLAYER_B]) {
      const existing = users.find((u: { email?: string }) => u.email === p.email)

      if (existing) {
        // Ensure player profile exists (reset script may have been skipped)
        const { data: profile } = await admin
          .from('players').select('id').eq('auth_user_id', existing.id).maybeSingle()
        if (!profile) {
          const { error } = await admin.from('players').insert({
            auth_user_id: existing.id, name: p.name, email: p.email,
            role: 'player',
          })
          if (error) throw new Error(`[beforeAll] player profile: ${error.message}`)
        }
        console.log(`[beforeAll] reused: ${p.email}`)
        continue
      }

      const { data, error: authErr } = await admin.auth.admin.createUser({
        email: p.email, password: p.password, email_confirm: true,
      })
      if (authErr) throw new Error(`[beforeAll] createUser ${p.email}: ${authErr.message}`)

      const { error: profErr } = await admin.from('players').insert({
        auth_user_id: data.user.id, name: p.name, email: p.email,
        role: 'player',
      })
      if (profErr) throw new Error(`[beforeAll] profile ${p.email}: ${profErr.message}`)
      console.log(`[beforeAll] created: ${p.name}`)
    }

    adminCtx = await browser.newContext({ storageState: ADMIN_AUTH_FILE })
    adminPage = await adminCtx.newPage()
  })

  test.afterAll(async () => {
    await adminCtx?.close()
  })

  // ── Step 2: Venue ─────────────────────────────────────────────────────────
  test('step-02: admin creates Lionhead Golf Club venue', async () => {
    await adminPage.goto('/admin/venues')
    await adminPage.getByRole('button', { name: /\+ add venue/i }).click()

    await fillByLabel(adminPage, 'Venue name', 'Lionhead Golf Club')
    await fillByLabel(adminPage, 'Address line 1', '8525 Mississauga Rd')
    await fillByLabel(adminPage, 'City', 'Brampton')
    await fillByLabel(adminPage, 'Province / State', 'ON')
    await fillByLabel(adminPage, 'Postal code', 'L6Y 0C3')

    // Submit the form — VenueManager renders "Save Venue" (not "Add Venue") when adding
    await adminPage.getByRole('button', { name: /^save venue$/i }).click()

    await expect(adminPage.getByText(/venue added/i)).toBeVisible({ timeout: 8000 })
    // Venues render as cards with the name inside a <p>, not as table cells
    await expect(adminPage.getByText('Lionhead Golf Club').first()).toBeVisible()
  })

  // ── Step 3: Course ────────────────────────────────────────────────────────
  test('step-03: admin creates Legends Course for Lionhead', async () => {
    await adminPage.goto('/admin/courses')
    await adminPage.getByRole('button', { name: /\+ add course/i }).click()

    // Venue select — Label "Venue *" has no htmlFor; use selectByLabel
    await selectByLabel(adminPage, 'Venue', 'Lionhead Golf Club')
    await fillByLabel(adminPage, 'Course name', 'Legends Course')

    // Clear default par total and enter 72
    const parInput = adminPage
      .locator('label', { hasText: 'Par total' })
      .first()
      .locator('xpath=..')
      .locator('input')
      .first()
    await parInput.clear()
    await parInput.fill('72')

    await adminPage
      .locator('label', { hasText: 'Course rating' })
      .first()
      .locator('xpath=..')
      .locator('input')
      .first()
      .fill('73.2')

    await adminPage
      .locator('label', { hasText: 'Slope rating' })
      .first()
      .locator('xpath=..')
      .locator('input')
      .first()
      .fill('135')

    await adminPage.getByRole('button', { name: /^add course$/i }).last().click()

    await expect(adminPage.getByText(/course added/i)).toBeVisible({ timeout: 8000 })
    await expect(adminPage.getByText('Legends Course').first()).toBeVisible()
  })

  // ── Step 4: Generate holes ────────────────────────────────────────────────
  test('step-04: admin generates 18 holes for Legends Course', async () => {
    // CourseManager renders each course as a `.rounded-2xl` card (not a <tr>) with
    // a <Link> labelled "Set up holes →" when empty or "Edit holes & GPS →" once
    // generated. Both accessible names contain "holes", so /holes/i matches either.
    await adminPage
      .locator('div.rounded-2xl')
      .filter({ hasText: 'Legends Course' })
      .getByRole('link', { name: /holes/i })
      .first()
      .click()

    // URL is now /admin/courses/[courseId]/holes
    await adminPage.waitForURL(/\/admin\/courses\/[^/]+\/holes$/, { timeout: 8000 })

    // HolesGeneratorPanel is only shown when no holes exist yet.
    // If holes already exist (idempotent re-run), skip generation and assert the grid.
    const generateBtn = adminPage.getByRole('button', { name: /generate 18 holes/i })
    const holeGridAlreadyPresent = await adminPage.getByText('Hole 1 —', { exact: false }).isVisible()

    if (!holeGridAlreadyPresent) {
      await generateBtn.click()
      await expect(adminPage.getByText(/generated 18 holes/i)).toBeVisible({ timeout: 8000 })
    }

    // Hole grid should render — use exact match to avoid 'Hole 1' substring matching Hole 10–18
    await expect(adminPage.getByText('Hole 1 —', { exact: false }).first()).toBeVisible({ timeout: 5000 })
    await expect(adminPage.getByText('Hole 18 —', { exact: false }).first()).toBeVisible()
  })

  // ── Step 5: Create tournament ─────────────────────────────────────────────
  test('step-05: admin creates Lionhead Spring Classic 2026', async () => {
    // Idempotent: if the tournament already exists in DB (re-run), skip UI creation
    const { data: existing } = await svc()
      .from('tournaments').select('id').eq('slug', 'lionhead-spring-classic-2026').maybeSingle()
    if (existing) {
      tournamentId = existing.id
      console.log('[step-05] tournament already exists, skipping creation')
      return
    }

    await adminPage.goto('/admin/tournament')
    await adminPage.getByRole('button', { name: /add tournament/i }).click()

    // TournamentManager form wires htmlFor/id — page.getByLabel() works
    await adminPage.getByLabel('Name *').fill('Lionhead Spring Classic 2026')

    // Slug auto-fills from name — verify before proceeding
    await expect(adminPage.getByLabel('URL slug *'))
      .toHaveValue('lionhead-spring-classic-2026', { timeout: 3000 })

    // Venue select (id="t-venue", htmlFor="t-venue") — Radix trigger is a button
    await adminPage.getByLabel('Venue *').click()
    await adminPage.getByRole('option', { name: /lionhead golf club/i }).first().click()

    // Course select enabled after venue chosen
    await adminPage.getByLabel('Course *').click()
    await adminPage.getByRole('option', { name: /legends course/i }).first().click()

    await adminPage.getByLabel('Date *').fill('2026-06-22')
    // Format defaults to "Best Ball", Holes played defaults to 18 — no changes needed

    await adminPage.getByRole('button', { name: /create tournament/i }).click()

    await expect(adminPage.getByText(/tournament created/i)).toBeVisible({ timeout: 8000 })
    await expect(adminPage.getByText('Lionhead Spring Classic 2026')).toBeVisible()

    // Capture ID from DB for use in leaderboard assertion and is_best_ball fix
    const { data } = await svc()
      .from('tournaments').select('id').eq('slug', 'lionhead-spring-classic-2026').single()
    if (!data) throw new Error('step-05: tournament not found in DB after creation')
    tournamentId = data.id
  })

  // ── Step 6: Activate tournament ───────────────────────────────────────────
  test('step-06: admin activates the Lionhead tournament', async () => {
    // Navigate to tournament list (step-05 may have returned early without navigating)
    await adminPage.goto('/admin/tournament')
    await expect(adminPage.getByText('Lionhead Spring Classic 2026')).toBeVisible({ timeout: 8000 })

    // Click the edit (pencil) button on the Lionhead row
    await adminPage
      .locator('tr')
      .filter({ hasText: 'Lionhead Spring Classic 2026' })
      .getByRole('button', { name: 'Edit tournament' })
      .click()

    await expect(adminPage.getByText(/edit tournament/i)).toBeVisible({ timeout: 5000 })

    // Status select — Label has no htmlFor/id; use xpath parent traversal to scope to its div
    await adminPage
      .locator('label', { hasText: 'Status' })
      .first()
      .locator('xpath=..')
      .locator('[role="combobox"]')
      .first()
      .click()
    await adminPage.getByRole('option', { name: 'Active' }).first().click()

    await adminPage.getByRole('button', { name: /save changes/i }).click()

    await expect(adminPage.getByText(/tournament updated/i)).toBeVisible({ timeout: 8000 })

    // Back to list view — the Lionhead row should show the Active badge
    await expect(
      adminPage.locator('tr').filter({ hasText: 'Lionhead Spring Classic 2026' }).getByText('Active')
    ).toBeVisible({ timeout: 5000 })
  })

  // ── Step 7: Create teams ──────────────────────────────────────────────────
  test('step-07: admin creates Team Alpha and Team Beta', async () => {
    await adminPage.goto('/admin/teams')

    // Idempotency: skip creation if teams already exist from a prior run.
    // Team names are rendered as Input elements (editable), not plain text nodes.
    const alphaExists = await adminPage.locator('input[value="Team Alpha"]').isVisible()
    const betaExists  = await adminPage.locator('input[value="Team Beta"]').isVisible()

    // ── Team Alpha ────────────────────────────────────────────────────────────
    if (!alphaExists) {
      await adminPage.getByRole('button', { name: /\+ add team/i }).click()
      await adminPage.getByPlaceholder('Team name (optional)').fill('Team Alpha')
      // Starting hole input — label text "Starting hole" without htmlFor
      await adminPage
        .locator('div')
        .filter({ has: adminPage.locator('label:has-text("Starting hole")') })
        .locator('input[type="number"]')
        .fill('1')
      await adminPage.getByRole('button', { name: /^add team$/i }).click()
      await expect(adminPage.getByText(/team added/i)).toBeVisible({ timeout: 8000 })
      // Team name is rendered as an editable Input, not plain text
      await expect(adminPage.locator('input[value="Team Alpha"]')).toBeVisible()
    } else {
      console.log('[step-07] Team Alpha already exists, skipping creation')
    }

    // ── Team Beta ─────────────────────────────────────────────────────────────
    if (!betaExists) {
      await adminPage.getByRole('button', { name: /\+ add team/i }).click()
      await adminPage.getByPlaceholder('Team name (optional)').fill('Team Beta')
      await adminPage
        .locator('div')
        .filter({ has: adminPage.locator('label:has-text("Starting hole")') })
        .locator('input[type="number"]')
        .fill('10')
      await adminPage.getByRole('button', { name: /^add team$/i }).click()
      await expect(adminPage.getByText(/team added/i)).toBeVisible({ timeout: 8000 })
      // Team name is rendered as an editable Input, not plain text
      await expect(adminPage.locator('input[value="Team Beta"]')).toBeVisible()
    } else {
      console.log('[step-07] Team Beta already exists, skipping creation')
    }
  })

  // ── Step 8: Assign players to teams ──────────────────────────────────────
  test('step-08: admin assigns Alex → Team Alpha and Blake → Team Beta', async () => {
    // Idempotency guard — skip UI assignment if players already have team_ids
    const adminCheck = svc()
    const { data: playersCheck } = await adminCheck
      .from('players').select('email, team_id').in('email', [PLAYER_A.email, PLAYER_B.email])
    const alexCheck  = playersCheck?.find((p: { email: string }) => p.email === PLAYER_A.email)
    const blakeCheck = playersCheck?.find((p: { email: string }) => p.email === PLAYER_B.email)
    if (alexCheck?.team_id && blakeCheck?.team_id && alexCheck.team_id !== blakeCheck.team_id) {
      console.log('[step-08] players already assigned to teams, verifying DB state only')
      expect(alexCheck.team_id).not.toBeNull()
      expect(blakeCheck.team_id).not.toBeNull()
      expect(alexCheck.team_id).not.toEqual(blakeCheck.team_id)
      return
    }

    // Still on /admin/teams — TeamsManager renders the "Assign Players to Teams"
    // section showing all players with team_id = null.
    // Both players were created with team_id = null in beforeAll.

    await expect(adminPage.getByText('Assign Players to Teams')).toBeVisible({ timeout: 5000 })

    // Assign Alex Lion → Team Alpha
    // Player rows: <div class="flex items-center gap-2"><span ...>Name</span><Select...>
    // Use xpath: locate the span by text, go to parent div, then find the combobox within it.
    // waitForResponse ensures the Supabase PATCH has committed before the DB assertion below.
    await Promise.all([
      adminPage.waitForResponse((r) => r.url().includes('/rest/v1/players') && r.request().method() === 'PATCH'),
      adminPage
        .locator(`span:text-is("${PLAYER_A.name}")`)
        .locator('xpath=..')
        .getByRole('combobox')
        .click()
        .then(() => adminPage.getByRole('option', { name: 'Team Alpha' }).click()),
    ])
    await expect(adminPage.getByText(/player assigned/i).first()).toBeVisible({ timeout: 5000 })

    // Assign Blake Lion → Team Beta
    await Promise.all([
      adminPage.waitForResponse((r) => r.url().includes('/rest/v1/players') && r.request().method() === 'PATCH'),
      adminPage
        .locator(`span:text-is("${PLAYER_B.name}")`)
        .locator('xpath=..')
        .getByRole('combobox')
        .click()
        .then(() => adminPage.getByRole('option', { name: 'Team Beta' }).click()),
    ])
    await expect(adminPage.getByText(/player assigned/i).first()).toBeVisible({ timeout: 5000 })

    // Verify DB state — both players should now have a non-null team_id
    const admin = svc()
    const { data: players } = await admin
      .from('players')
      .select('email, team_id')
      .in('email', [PLAYER_A.email, PLAYER_B.email])

    const alex  = players?.find((p: { email: string }) => p.email === PLAYER_A.email)
    const blake = players?.find((p: { email: string }) => p.email === PLAYER_B.email)
    expect(alex?.team_id).not.toBeNull()
    expect(blake?.team_id).not.toBeNull()
    expect(alex?.team_id).not.toEqual(blake?.team_id)
  })

  /**
   * Record one complete hole on the round page.
   * @param page  The player's round page (already loaded at /round)
   * @param shots Array of [clubName, outcome] pairs; last pair must use 'Sunk!'
   */
  async function scoreHole(
    page: Page,
    shots: [club: string, outcome: string][],
  ) {
    for (const [club, outcome] of shots) {
      await page.getByRole('combobox').click()
      await page.getByRole('option', { name: club }).click()
      await page.getByRole('button', { name: new RegExp(`^${outcome}$`, 'i') }).click()
      await page.waitForTimeout(300)
    }
    await expect(page.getByRole('button', { name: /next hole/i })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /next hole/i }).click()
  }

  // ── Step 10: Team Alpha scores holes 1–3 ─────────────────────────────────
  test('step-10: Team Alpha player scores holes 1-3 (−2 vs par)', async ({ browser }) => {
    // Idempotency guard — skip browser scoring if scores already exist
    const adminCheck = svc()
    const { data: alphaPlayerCheck } = await adminCheck
      .from('players').select('id').eq('email', PLAYER_A.email).single()
    const { data: existingScores } = await adminCheck
      .from('scores')
      .select('hole_number')
      .eq('player_id', alphaPlayerCheck!.id)
      .eq('tournament_id', tournamentId)
    if (existingScores && existingScores.length >= 3) {
      console.log('[step-10] scores already exist, verifying DB state only')
      const { data: scores } = await adminCheck
        .from('scores').select('hole_number, strokes')
        .eq('player_id', alphaPlayerCheck!.id).eq('tournament_id', tournamentId).order('hole_number')
      expect(scores).toHaveLength(3)
      expect(scores![0]).toMatchObject({ hole_number: 1, strokes: 3 })
      expect(scores![1]).toMatchObject({ hole_number: 2, strokes: 3 })
      expect(scores![2]).toMatchObject({ hole_number: 3, strokes: 4 })
      return
    }

    const { ctx, page } = await loginAsPlayer(browser, PLAYER_A.email, PLAYER_A.password)
    try {
      await page.goto('/round', { waitUntil: 'domcontentloaded' })
      await expect(page.getByText(/hole 1/i).first()).toBeVisible({ timeout: 8000 })
      await expect(page.getByRole('button', { name: /^alex$/i })).toBeVisible({ timeout: 5000 })

      // Hole 1 — birdie (3 shots)
      await scoreHole(page, [
        ['Driver (1W)', 'In Play'],
        ['7 Iron',      'In Play'],
        ['Putter',      'Sunk!'],
      ])
      await expect(page.getByText(/hole 2/i).first()).toBeVisible({ timeout: 5000 })

      // Hole 2 — birdie
      await scoreHole(page, [
        ['Driver (1W)', 'In Play'],
        ['7 Iron',      'In Play'],
        ['Putter',      'Sunk!'],
      ])
      await expect(page.getByText(/hole 3/i).first()).toBeVisible({ timeout: 5000 })

      // Hole 3 — par (4 shots)
      await scoreHole(page, [
        ['Driver (1W)', 'In Play'],
        ['7 Iron',      'In Play'],
        ['9 Iron',      'In Play'],
        ['Putter',      'Sunk!'],
      ])
      await expect(page.getByText(/hole 4/i).first()).toBeVisible({ timeout: 5000 })
    } finally {
      await ctx.close()
    }

    const admin = svc()
    const { data: alphaPlayer } = await admin
      .from('players').select('id').eq('email', PLAYER_A.email).single()
    const { data: scores } = await admin
      .from('scores').select('hole_number, strokes')
      .eq('player_id', alphaPlayer!.id).eq('tournament_id', tournamentId).order('hole_number')
    expect(scores).toHaveLength(3)
    expect(scores![0]).toMatchObject({ hole_number: 1, strokes: 3 })
    expect(scores![1]).toMatchObject({ hole_number: 2, strokes: 3 })
    expect(scores![2]).toMatchObject({ hole_number: 3, strokes: 4 })
  })

  // ── Step 11: Team Beta scores holes 10–12 ────────────────────────────────
  test('step-11: Team Beta player scores holes 10-12 (+3 vs par)', async ({ browser }) => {
    // Idempotency guard
    const adminCheck = svc()
    const { data: betaPlayerCheck } = await adminCheck
      .from('players').select('id').eq('email', PLAYER_B.email).single()
    const { data: existingScores } = await adminCheck
      .from('scores')
      .select('hole_number')
      .eq('player_id', betaPlayerCheck!.id)
      .eq('tournament_id', tournamentId)
    if (existingScores && existingScores.length >= 3) {
      console.log('[step-11] scores already exist, verifying DB state only')
      const { data: scores } = await adminCheck
        .from('scores').select('hole_number, strokes')
        .eq('player_id', betaPlayerCheck!.id).eq('tournament_id', tournamentId).order('hole_number')
      expect(scores).toHaveLength(3)
      expect(scores![0]).toMatchObject({ hole_number: 10, strokes: 5 })
      expect(scores![1]).toMatchObject({ hole_number: 11, strokes: 5 })
      expect(scores![2]).toMatchObject({ hole_number: 12, strokes: 5 })
      return
    }

    const { ctx, page } = await loginAsPlayer(browser, PLAYER_B.email, PLAYER_B.password)
    try {
      await page.goto('/round', { waitUntil: 'domcontentloaded' })
      await expect(page.getByText(/hole 10/i).first()).toBeVisible({ timeout: 8000 })
      await expect(page.getByRole('button', { name: /^blake$/i })).toBeVisible({ timeout: 5000 })

      for (const expectedNext of [11, 12, 13]) {
        await scoreHole(page, [
          ['Driver (1W)', 'In Play'],
          ['5 Iron',      'In Play'],
          ['7 Iron',      'In Play'],
          ['9 Iron',      'In Play'],
          ['Putter',      'Sunk!'],
        ])
        await expect(page.getByText(new RegExp(`hole ${expectedNext}`, 'i')).first())
          .toBeVisible({ timeout: 5000 })
      }
    } finally {
      await ctx.close()
    }

    const admin = svc()
    const { data: betaPlayer } = await admin
      .from('players').select('id').eq('email', PLAYER_B.email).single()
    const { data: scores } = await admin
      .from('scores').select('hole_number, strokes')
      .eq('player_id', betaPlayer!.id).eq('tournament_id', tournamentId).order('hole_number')
    expect(scores).toHaveLength(3)
    expect(scores![0]).toMatchObject({ hole_number: 10, strokes: 5 })
    expect(scores![1]).toMatchObject({ hole_number: 11, strokes: 5 })
    expect(scores![2]).toMatchObject({ hole_number: 12, strokes: 5 })
  })

  // ── Step 12: Set is_best_ball and verify leaderboard ─────────────────────
  test('step-12: leaderboard ranks Team Alpha above Team Beta', async () => {
    // The get_leaderboard() RPC requires is_best_ball = true on scores.
    // Since each team has one player, every score IS best ball — set it directly.
    const admin = svc()
    const { error: bbErr } = await admin
      .from('scores')
      .update({ is_best_ball: true })
      .eq('tournament_id', tournamentId)
    if (bbErr) throw new Error(`step-12: cannot set is_best_ball: ${bbErr.message}`)

    // Navigate to the leaderboard as admin (any authenticated user can view it)
    await adminPage.goto('/leaderboard')

    // Wait for leaderboard data to render
    await expect(adminPage.getByText(/team alpha/i).first()).toBeVisible({ timeout: 8000 })
    await expect(adminPage.getByText(/team beta/i).first()).toBeVisible({ timeout: 5000 })

    // Team Alpha should appear in the DOM before Team Beta (rank 1 before rank 2)
    const alphaIndex = await adminPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr, [data-testid="leaderboard-row"]'))
      return rows.findIndex(r => r.textContent?.includes('Team Alpha'))
    })
    const betaIndex = await adminPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr, [data-testid="leaderboard-row"]'))
      return rows.findIndex(r => r.textContent?.includes('Team Beta'))
    })

    expect(alphaIndex).toBeGreaterThanOrEqual(0)
    expect(betaIndex).toBeGreaterThanOrEqual(0)
    expect(alphaIndex).toBeLessThan(betaIndex)

    // Score display — leaderboard shows strokes_vs_par
    // Team Alpha: −2 (displayed as "-2" or "−2")
    await expect(adminPage.getByText(/[−-]2/).first()).toBeVisible({ timeout: 5000 })
    // Team Beta: +3
    await expect(adminPage.getByText(/\+3/).first()).toBeVisible({ timeout: 5000 })
  })
})
