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
 */
async function fillByLabel(page: Page, labelText: string, value: string) {
  await page
    .locator('div')
    .filter({ has: page.locator(`label:has-text("${labelText}")`) })
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
  await page.getByRole('option', { name: optionText }).click()
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

  // Steps 2–12 added in Tasks 3–7
  test('scaffold — beforeAll smoke check', async () => {
    const admin = svc()
    const { data: { users } } = await admin.auth.admin.listUsers()
    const emailsInDb = users.map((u: { email?: string }) => u.email)
    expect(emailsInDb).toContain(PLAYER_A.email)
    expect(emailsInDb).toContain(PLAYER_B.email)
  })
})
