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
            role: 'player', team_id: null,
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
        role: 'player', team_id: null,
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

    // "Add Venue" button — use .last() because "+ Add Venue" header button may still render
    await adminPage.getByRole('button', { name: /^add venue$/i }).last().click()

    await expect(adminPage.getByText(/venue added/i)).toBeVisible({ timeout: 8000 })
    await expect(adminPage.getByRole('cell', { name: 'Lionhead Golf Club' }).first()).toBeVisible()
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
    // Click the "Holes →" button on the Legends Course row
    await adminPage
      .locator('tr')
      .filter({ hasText: 'Legends Course' })
      .getByRole('button', { name: /holes/i })
      .first()
      .click()

    // URL is now /admin/courses/[courseId]/holes
    await adminPage.waitForURL(/\/admin\/courses\/[^/]+\/holes$/, { timeout: 8000 })

    // HolesGeneratorPanel shown when no holes exist yet
    await adminPage.getByRole('button', { name: /generate 18 holes/i }).click()

    await expect(adminPage.getByText(/generated 18 holes/i)).toBeVisible({ timeout: 8000 })
    // Hole grid should render — use exact match to avoid 'Hole 1' substring matching Hole 10–18
    await expect(adminPage.getByText('Hole 1 —', { exact: false }).first()).toBeVisible({ timeout: 5000 })
    await expect(adminPage.getByText('Hole 18 —', { exact: false }).first()).toBeVisible()
  })
})
