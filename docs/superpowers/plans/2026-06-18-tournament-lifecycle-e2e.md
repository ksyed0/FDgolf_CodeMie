# Tournament Lifecycle E2E Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `tests/e2e/tournament-lifecycle.spec.ts` (full-browser Playwright test driving the complete Lionhead Spring Classic lifecycle from venue creation to leaderboard) and `scripts/reset-lionhead.ts` (wipe-and-reseed script for clean runs).

**Architecture:** Single `test.describe.serial()` spec using one shared admin `BrowserContext` across all admin steps, plus fresh player contexts for scoring. Player auth accounts seeded via Supabase service-role client in `beforeAll`; all app-level data (venue, course, holes, tournament, teams, team assignments) created through the admin browser UI. `is_best_ball` set via service-role client post-scoring because the `calculate-best-ball` Edge Function is not guaranteed to run in local dev without `supabase functions serve`.

**Tech Stack:** Playwright `@playwright/test`, `@supabase/supabase-js`, `tsx` (TypeScript script runner), local Supabase at `http://127.0.0.1:54321`.

## Global Constraints

- Lionhead entities identified by: venue `Lionhead Golf Club`, course `Legends Course`, slug `lionhead-spring-classic-2026`, emails `e2e-lion-a@fdgolf.test` / `e2e-lion-b@fdgolf.test`
- Must NOT touch CIBC / Granite Ridge data or `e2e-player@fdgolf.test` / `e2e-admin@fdgolf.test` accounts
- Test leaves all created data in DB (no afterAll cleanup)
- `SUPABASE_SERVICE_ROLE_KEY` must be set in `.env.local`; spec self-skips when absent
- All Playwright timeouts: 30 s default; explicit `{ timeout: 8000 }` only where SSR + hydration needs extra headroom
- VenueManager and CourseManager use `<Label>` without `htmlFor` — use `fillByLabel` helper (defined in spec) instead of `page.getByLabel()`
- TournamentManager form DOES use `htmlFor`/`id` — `page.getByLabel()` works there
- Radix Select trigger with no id: use `page.locator('div').filter({ has: page.locator('label:has-text("…")') }).locator('[role="combobox"]')`
- After Sunk! the round page shows a "Next Hole →" button — test must click it to advance

---

### Task 1: Reset script

**Files:**
- Create: `scripts/reset-lionhead.ts`

**Interfaces:**
- Consumes: `.env.local` (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- Produces: side-effects only; exits 0 on success, 1 on fatal error

- [ ] **Step 1: Create `scripts/reset-lionhead.ts`**

```typescript
// scripts/reset-lionhead.ts
import { createClient } from '@supabase/supabase-js'
import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'path'

dotenvConfig({ path: resolve(process.cwd(), '.env.local') })

const VENUE_NAME = 'Lionhead Golf Club'
const COURSE_NAME = 'Legends Course'
const TOURNAMENT_SLUG = 'lionhead-spring-classic-2026'
const TEST_EMAILS = ['e2e-lion-a@fdgolf.test', 'e2e-lion-b@fdgolf.test']
const PLAYERS = [
  { email: 'e2e-lion-a@fdgolf.test', name: 'Alex Lion',   password: 'E2eLionA789!' },
  { email: 'e2e-lion-b@fdgolf.test', name: 'Blake Lion',  password: 'E2eLionB789!' },
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env.local')
    process.exit(1)
  }

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  console.log('=== Wiping Lionhead test data ===\n')

  // 1. Find tournament(s) with this slug
  const { data: tournaments } = await db
    .from('tournaments').select('id').eq('slug', TOURNAMENT_SLUG)
  const tIds = (tournaments ?? []).map((t: { id: string }) => t.id)

  if (tIds.length > 0) {
    for (const table of ['shots', 'scores', 'round_states'] as const) {
      const { error } = await db.from(table).delete().in('tournament_id', tIds)
      if (error) console.warn(`  [warn] ${table}:`, error.message)
      else        console.log(`  ✓ ${table} cleared`)
    }
    const { error: tErr } = await db.from('teams').delete().in('tournament_id', tIds)
    if (tErr) console.warn('  [warn] teams:', tErr.message)
    else      console.log('  ✓ teams cleared')

    const { error: tournErr } = await db.from('tournaments').delete().eq('slug', TOURNAMENT_SLUG)
    if (tournErr) console.warn('  [warn] tournament:', tournErr.message)
    else          console.log('  ✓ tournament deleted')
  } else {
    console.log('  (no tournament found — skipping tournament/teams/scores)')
  }

  // 2. Player profiles
  const { error: pErr } = await db.from('players').delete().in('email', TEST_EMAILS)
  if (pErr) console.warn('  [warn] player profiles:', pErr.message)
  else      console.log('  ✓ player profiles deleted')

  // 3. Auth users
  const { data: { users } } = await db.auth.admin.listUsers()
  for (const email of TEST_EMAILS) {
    const u = users.find((x: { email?: string }) => x.email === email)
    if (u) {
      const { error } = await db.auth.admin.deleteUser(u.id)
      if (error) console.warn(`  [warn] auth ${email}:`, error.message)
      else        console.log(`  ✓ auth user deleted: ${email}`)
    }
  }

  // 4. Holes → course → venue (manual cascade — RLS on delete policies)
  const { data: venues } = await db.from('venues').select('id').eq('name', VENUE_NAME)
  const vIds = (venues ?? []).map((v: { id: string }) => v.id)

  if (vIds.length > 0) {
    const { data: courses } = await db
      .from('courses').select('id').in('venue_id', vIds).eq('name', COURSE_NAME)
    const cIds = (courses ?? []).map((c: { id: string }) => c.id)

    if (cIds.length > 0) {
      const { error: hErr } = await db.from('holes').delete().in('course_id', cIds)
      if (hErr) console.warn('  [warn] holes:', hErr.message)
      else      console.log('  ✓ holes deleted')

      const { error: cErr } = await db.from('courses').delete().in('id', cIds)
      if (cErr) console.warn('  [warn] courses:', cErr.message)
      else      console.log('  ✓ course deleted')
    }

    const { error: vErr } = await db.from('venues').delete().eq('name', VENUE_NAME)
    if (vErr) console.warn('  [warn] venues:', vErr.message)
    else      console.log('  ✓ venue deleted')
  }

  console.log('\n=== Re-seeding test players ===\n')

  for (const { email, name, password } of PLAYERS) {
    const { data: created, error: authErr } = await db.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (authErr) { console.error(`  ERROR auth ${email}:`, authErr.message); continue }
    console.log(`  ✓ auth user: ${email}`)

    const { error: profErr } = await db.from('players').insert({
      auth_user_id: created.user.id, name, email, role: 'player', team_id: null,
    })
    if (profErr) console.warn(`  [warn] profile ${email}:`, profErr.message)
    else         console.log(`  ✓ player profile: ${name}`)
  }

  console.log('\n✅ Done. Ready for E2E run.\n')
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Run the script on a clean DB (first run)**

```bash
npx tsx scripts/reset-lionhead.ts
```

Expected output ends with:
```
  ✓ auth user: e2e-lion-a@fdgolf.test
  ✓ player profile: Alex Lion
  ✓ auth user: e2e-lion-b@fdgolf.test
  ✓ player profile: Blake Lion

✅ Done. Ready for E2E run.
```

- [ ] **Step 3: Run a second time to verify idempotency**

```bash
npx tsx scripts/reset-lionhead.ts
```

Expected: completes without error. Previous auth users deleted and re-created. No crash on second run.

- [ ] **Step 4: Commit**

```bash
git checkout -b feature/tournament-lifecycle-e2e
git add scripts/reset-lionhead.ts
git commit -m "chore: add reset-lionhead script for E2E test data management"
```

---

### Task 2: Playwright config + spec scaffold with beforeAll

**Files:**
- Modify: `playwright.config.ts`
- Create: `tests/e2e/tournament-lifecycle.spec.ts`

**Interfaces:**
- Produces:
  - `adminPage: Page` — module-level, shared admin browser page used in Tasks 3-5
  - `adminCtx: BrowserContext` — closed in `afterAll`
  - `tournamentId: string` — set in Task 4 step-05, consumed in Task 7

- [ ] **Step 1: Add the `chromium-lifecycle` project to `playwright.config.ts`**

In the `projects` array, after the closing brace of the `chromium-desktop` block, add:

```typescript
    // ── Full lifecycle test (real Supabase, desktop) ──────────────────────────
    {
      name: 'chromium-lifecycle',
      testMatch: '**/tournament-lifecycle.spec.ts',
      use: { ...desktopDevice },
      dependencies: ['admin-setup'],
    },
```

- [ ] **Step 2: Verify the project is registered**

```bash
npx playwright test --list --project=chromium-lifecycle 2>&1 | head -5
```

Expected: shows `chromium-lifecycle` in output (no test files listed yet — that's fine).

- [ ] **Step 3: Create the spec skeleton**

```typescript
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
```

- [ ] **Step 4: Run the scaffold test**

```bash
npx playwright test tests/e2e/tournament-lifecycle.spec.ts --project=chromium-lifecycle
```

Expected: 1 test passes (`scaffold — beforeAll smoke check`). beforeAll logs appear.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/tournament-lifecycle.spec.ts
git commit -m "test: tournament-lifecycle spec scaffold with beforeAll player seeding"
```

---

### Task 3: Admin creates venue → course → holes (steps 2-4)

**Files:**
- Modify: `tests/e2e/tournament-lifecycle.spec.ts`

**Interfaces:**
- Consumes: `adminPage`, `fillByLabel`, `selectByLabel` (from Task 2)
- Produces: Lionhead venue, Legends Course, 18 holes in local DB

- [ ] **Step 1: Replace the scaffold test with steps 2-4**

Remove `test('scaffold — beforeAll smoke check', ...)` and add:

```typescript
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
    await expect(adminPage.getByRole('cell', { name: 'Lionhead Golf Club' })).toBeVisible()
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
      .locator('div')
      .filter({ has: adminPage.locator('label:has-text("Par total")') })
      .locator('input')
      .first()
    await parInput.clear()
    await parInput.fill('72')

    await adminPage
      .locator('div')
      .filter({ has: adminPage.locator('label:has-text("Course rating")') })
      .locator('input').first().fill('73.2')

    await adminPage
      .locator('div')
      .filter({ has: adminPage.locator('label:has-text("Slope rating")') })
      .locator('input').first().fill('135')

    await adminPage.getByRole('button', { name: /^add course$/i }).last().click()

    await expect(adminPage.getByText(/course added/i)).toBeVisible({ timeout: 8000 })
    await expect(adminPage.getByText('Legends Course')).toBeVisible()
  })

  // ── Step 4: Generate holes ────────────────────────────────────────────────
  test('step-04: admin generates 18 holes for Legends Course', async () => {
    // Click the "Holes →" button on the Legends Course row
    await adminPage
      .locator('tr')
      .filter({ hasText: 'Legends Course' })
      .getByRole('button', { name: /holes/i })
      .click()

    // URL is now /admin/courses/[courseId]/holes
    await adminPage.waitForURL(/\/admin\/courses\/[^/]+\/holes$/, { timeout: 8000 })

    // HolesGeneratorPanel shown when no holes exist yet
    await adminPage.getByRole('button', { name: /generate 18 holes/i }).click()

    await expect(adminPage.getByText(/generated 18 holes/i)).toBeVisible({ timeout: 8000 })
    // Hole grid should render
    await expect(adminPage.getByText('Hole 1')).toBeVisible({ timeout: 5000 })
    await expect(adminPage.getByText('Hole 18')).toBeVisible()
  })
```

- [ ] **Step 2: Run through step 4**

```bash
npx playwright test tests/e2e/tournament-lifecycle.spec.ts --project=chromium-lifecycle
```

Expected: 3 tests pass (step-02, step-03, step-04).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/tournament-lifecycle.spec.ts
git commit -m "test: lifecycle steps 2-4 — venue, course, holes creation"
```

---

### Task 4: Tournament creation and activation (steps 5-6)

**Files:**
- Modify: `tests/e2e/tournament-lifecycle.spec.ts`

**Interfaces:**
- Produces: `tournamentId` (module-level string, captured from DB after creation)

- [ ] **Step 1: Add steps 5-6 inside the describe.serial block**

```typescript
  // ── Step 5: Create tournament ─────────────────────────────────────────────
  test('step-05: admin creates Lionhead Spring Classic 2026', async () => {
    await adminPage.goto('/admin/tournament')
    await adminPage.getByRole('button', { name: /add tournament/i }).click()

    // TournamentManager form wires htmlFor/id — page.getByLabel() works
    await adminPage.getByLabel('Name *').fill('Lionhead Spring Classic 2026')

    // Slug auto-fills from name — verify before proceeding
    await expect(adminPage.getByLabel('URL slug *'))
      .toHaveValue('lionhead-spring-classic-2026', { timeout: 3000 })

    // Venue select (id="t-venue", htmlFor="t-venue") — Radix trigger is a button
    await adminPage.getByLabel('Venue *').click()
    await adminPage.getByRole('option', { name: /lionhead golf club/i }).click()

    // Course select enabled after venue chosen
    await adminPage.getByLabel('Course *').click()
    await adminPage.getByRole('option', { name: /legends course/i }).click()

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
    // TournamentManager list is already visible — click the edit (pencil) button
    await adminPage
      .locator('tr')
      .filter({ hasText: 'Lionhead Spring Classic 2026' })
      .getByRole('button', { name: 'Edit tournament' })
      .click()

    await expect(adminPage.getByText(/edit tournament/i)).toBeVisible({ timeout: 5000 })

    // Status select — Label "Status" has no htmlFor in TournamentManager
    await selectByLabel(adminPage, 'Status', 'Active')

    await adminPage.getByRole('button', { name: /save changes/i }).click()

    await expect(adminPage.getByText(/tournament updated/i)).toBeVisible({ timeout: 8000 })

    // Back to list view — the Lionhead row should show the Active badge
    await expect(
      adminPage.locator('tr').filter({ hasText: 'Lionhead Spring Classic 2026' }).getByText('Active')
    ).toBeVisible({ timeout: 5000 })
  })
```

- [ ] **Step 2: Run through step 6**

```bash
npx playwright test tests/e2e/tournament-lifecycle.spec.ts --project=chromium-lifecycle
```

Expected: 5 tests pass (steps 02-06).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/tournament-lifecycle.spec.ts
git commit -m "test: lifecycle steps 5-6 — tournament creation and activation"
```

---

### Task 5: Admin creates teams and assigns players (steps 7-8)

**Files:**
- Modify: `tests/e2e/tournament-lifecycle.spec.ts`

**Interfaces:**
- Consumes: `adminPage`, `selectByLabel`, `PLAYER_A`, `PLAYER_B`
- Produces: Team Alpha (starting hole 1), Team Beta (starting hole 10); both players assigned to their teams in DB

**Note:** The teams page SSR picks the most-recently-created tournament (`order('created_at', desc)`) regardless of status. After step 5, `/admin/teams` already scopes to Lionhead. Player assignment uses the "Assign Players to Teams" section of `TeamsManager`, which shows all players with `team_id = null`.

- [ ] **Step 1: Add steps 7-8 inside the describe.serial block**

```typescript
  // ── Step 7: Create teams ──────────────────────────────────────────────────
  test('step-07: admin creates Team Alpha and Team Beta', async () => {
    await adminPage.goto('/admin/teams')

    // ── Team Alpha ────────────────────────────────────────────────────────────
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
    await expect(adminPage.getByText('Team Alpha')).toBeVisible()

    // ── Team Beta ─────────────────────────────────────────────────────────────
    await adminPage.getByRole('button', { name: /\+ add team/i }).click()
    await adminPage.getByPlaceholder('Team name (optional)').fill('Team Beta')
    await adminPage
      .locator('div')
      .filter({ has: adminPage.locator('label:has-text("Starting hole")') })
      .locator('input[type="number"]')
      .fill('10')
    await adminPage.getByRole('button', { name: /^add team$/i }).click()
    await expect(adminPage.getByText(/team added/i)).toBeVisible({ timeout: 8000 })
    await expect(adminPage.getByText('Team Beta')).toBeVisible()
  })

  // ── Step 8: Assign players to teams ──────────────────────────────────────
  test('step-08: admin assigns Alex → Team Alpha and Blake → Team Beta', async () => {
    // Still on /admin/teams — TeamsManager renders the "Assign Players to Teams"
    // section showing all players with team_id = null.
    // Both players were created with team_id = null in beforeAll.

    await expect(adminPage.getByText('Assign Players to Teams')).toBeVisible({ timeout: 5000 })

    // Assign Alex Lion → Team Alpha
    const alexRow = adminPage
      .locator('div')
      .filter({ has: adminPage.locator(`span:text-is("${PLAYER_A.name}")`) })
    await alexRow.getByRole('combobox').click()
    await adminPage.getByRole('option', { name: 'Team Alpha' }).click()
    await expect(adminPage.getByText(/player assigned/i)).toBeVisible({ timeout: 5000 })

    // Assign Blake Lion → Team Beta
    const blakeRow = adminPage
      .locator('div')
      .filter({ has: adminPage.locator(`span:text-is("${PLAYER_B.name}")`) })
    await blakeRow.getByRole('combobox').click()
    await adminPage.getByRole('option', { name: 'Team Beta' }).click()
    await expect(adminPage.getByText(/player assigned/i)).toBeVisible({ timeout: 5000 })

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
```

- [ ] **Step 2: Run through step 8**

```bash
npx playwright test tests/e2e/tournament-lifecycle.spec.ts --project=chromium-lifecycle
```

Expected: 7 tests pass (steps 02-08).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/tournament-lifecycle.spec.ts
git commit -m "test: lifecycle steps 7-8 — team creation and player assignment"
```

---

### Task 6: Player scoring — Team Alpha (holes 1-3) and Team Beta (holes 10-12)

**Files:**
- Modify: `tests/e2e/tournament-lifecycle.spec.ts`

**Interfaces:**
- Consumes: `PLAYER_A`, `PLAYER_B`, `loginAsPlayer` (from Task 2)
- Produces: scores in DB for Team Alpha holes 1-3 (3,3,4 strokes) and Team Beta holes 10-12 (5,5,5 strokes)

**Round page mechanics:**
- Club selector is a Radix `<Select>` (combobox); outcome buttons are disabled until a club is selected
- Each `recordShot` call (In Play / OOB / etc.) increments `shotNumber`
- Clicking "Sunk!" records the final shot AND writes a `scores` row (`strokes = shotNumber`, `is_best_ball = false`)
- After Sunk!, a "Next Hole →" button appears; clicking it advances `round_states.current_hole`
- The round page picks the **most-recently-created active tournament** — Lionhead qualifies after step 6

**Scoring targets:**
- Team Alpha — 3 shots/hole × 3 holes = −2 vs par (birdie, birdie, par on par-4s)
- Team Beta — 5 shots/hole × 3 holes = +3 vs par (bogey × 3 on par-4s)

- [ ] **Step 1: Add helper `scoreHole` and the two scoring tests**

```typescript
  /**
   * Record one complete hole on the round page.
   * @param page      The player's round page (already loaded at /round)
   * @param shots     Array of [clubName, outcome] pairs; last pair must use 'Sunk!'
   */
  async function scoreHole(
    page: Page,
    shots: [club: string, outcome: string][],
  ) {
    for (const [club, outcome] of shots) {
      // Open club selector and pick the club
      await page.getByRole('combobox').click()
      await page.getByRole('option', { name: club }).click()

      // Click the outcome button
      await page.getByRole('button', { name: new RegExp(`^${outcome}$`, 'i') }).click()
      // Small wait for the shot to be enqueued/flushed
      await page.waitForTimeout(300)
    }

    // After Sunk! the hole summary appears — click Next Hole to advance
    await expect(page.getByRole('button', { name: /next hole/i })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /next hole/i }).click()
  }

  // ── Step 10: Team Alpha scores holes 1–3 (birdie, birdie, par) ────────────
  test('step-10: Team Alpha player scores holes 1-3 (−2 vs par)', async ({ browser }) => {
    const { ctx, page } = await loginAsPlayer(browser, PLAYER_A.email, PLAYER_A.password)

    try {
      await page.goto('/round', { waitUntil: 'domcontentloaded' })

      // Round page loads at Team Alpha's starting_hole = 1
      await expect(page.getByText(/hole 1/i).first()).toBeVisible({ timeout: 8000 })
      // Player pill is present — active state is CSS-only (no data-active attr); visibility is enough
      await expect(page.getByRole('button', { name: /^alex$/i })).toBeVisible({ timeout: 5000 })

      // Hole 1 — birdie (3 shots: Driver, 7 Iron, Putter → Sunk!)
      await scoreHole(page, [
        ['Driver',  'In Play'],
        ['7 Iron',  'In Play'],
        ['Putter',  'Sunk!'],
      ])
      await expect(page.getByText(/hole 2/i).first()).toBeVisible({ timeout: 5000 })

      // Hole 2 — birdie
      await scoreHole(page, [
        ['Driver',  'In Play'],
        ['7 Iron',  'In Play'],
        ['Putter',  'Sunk!'],
      ])
      await expect(page.getByText(/hole 3/i).first()).toBeVisible({ timeout: 5000 })

      // Hole 3 — par (4 shots)
      await scoreHole(page, [
        ['Driver',  'In Play'],
        ['7 Iron',  'In Play'],
        ['9 Iron',  'In Play'],
        ['Putter',  'Sunk!'],
      ])
      // After hole 3, round advances to hole 4
      await expect(page.getByText(/hole 4/i).first()).toBeVisible({ timeout: 5000 })
    } finally {
      await ctx.close()
    }

    // Verify scores landed in DB (3 score rows for Team Alpha)
    const admin = svc()
    const { data: alphaPlayer } = await admin
      .from('players').select('id, team_id').eq('email', PLAYER_A.email).single()
    const { data: scores } = await admin
      .from('scores')
      .select('hole_number, strokes')
      .eq('player_id', alphaPlayer!.id)
      .eq('tournament_id', tournamentId)
      .order('hole_number')

    expect(scores).toHaveLength(3)
    expect(scores![0]).toMatchObject({ hole_number: 1, strokes: 3 })
    expect(scores![1]).toMatchObject({ hole_number: 2, strokes: 3 })
    expect(scores![2]).toMatchObject({ hole_number: 3, strokes: 4 })
  })

  // ── Step 11: Team Beta scores holes 10–12 (bogey × 3) ────────────────────
  test('step-11: Team Beta player scores holes 10-12 (+3 vs par)', async ({ browser }) => {
    const { ctx, page } = await loginAsPlayer(browser, PLAYER_B.email, PLAYER_B.password)

    try {
      await page.goto('/round', { waitUntil: 'domcontentloaded' })

      // Team Beta starts at hole 10
      await expect(page.getByText(/hole 10/i).first()).toBeVisible({ timeout: 8000 })
      await expect(page.getByRole('button', { name: /^blake$/i })).toBeVisible({ timeout: 5000 })

      // Holes 10, 11, 12 — bogey each (5 shots)
      for (const expectedNext of [11, 12, 13]) {
        await scoreHole(page, [
          ['Driver',  'In Play'],
          ['5 Iron',  'In Play'],
          ['7 Iron',  'In Play'],
          ['9 Iron',  'In Play'],
          ['Putter',  'Sunk!'],
        ])
        await expect(page.getByText(new RegExp(`hole ${expectedNext}`, 'i')).first())
          .toBeVisible({ timeout: 5000 })
      }
    } finally {
      await ctx.close()
    }

    // Verify scores in DB
    const admin = svc()
    const { data: betaPlayer } = await admin
      .from('players').select('id').eq('email', PLAYER_B.email).single()
    const { data: scores } = await admin
      .from('scores')
      .select('hole_number, strokes')
      .eq('player_id', betaPlayer!.id)
      .eq('tournament_id', tournamentId)
      .order('hole_number')

    expect(scores).toHaveLength(3)
    expect(scores![0]).toMatchObject({ hole_number: 10, strokes: 5 })
    expect(scores![1]).toMatchObject({ hole_number: 11, strokes: 5 })
    expect(scores![2]).toMatchObject({ hole_number: 12, strokes: 5 })
  })
```

- [ ] **Step 2: Run through step 11**

```bash
npx playwright test tests/e2e/tournament-lifecycle.spec.ts --project=chromium-lifecycle
```

Expected: 9 tests pass (steps 02-08, 10-11). The DB now has 6 score rows for the Lionhead tournament.

If a club name is not found (no option visible), it means the DB club name differs from the fixture name used here. Check the actual club names in Supabase Studio (`select name from clubs order by sort_order`) and update the `scoreHole` call accordingly.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/tournament-lifecycle.spec.ts
git commit -m "test: lifecycle steps 10-11 — player scoring for Team Alpha and Team Beta"
```

---

### Task 7: Set is_best_ball and verify leaderboard (step 12)

**Files:**
- Modify: `tests/e2e/tournament-lifecycle.spec.ts`

**Interfaces:**
- Consumes: `tournamentId`, `adminPage`, `svc()`
- Produces: Full passing test suite; leaderboard shows Team Alpha ranked above Team Beta

**Why is_best_ball must be set manually:** The `get_leaderboard()` RPC (migration 008) queries `scores WHERE is_best_ball = true`. The round page writes scores with `is_best_ball = false` (the `calculate-best-ball` Edge Function sets it). In local dev, the Edge Function only runs if `supabase functions serve` is active — this is not a guaranteed prerequisite. Since each team has exactly one player, every score from that player IS the best ball. The service-role step sets it directly.

**Expected leaderboard output:**
- Team Alpha: strokes 3+3+4=10, par 4+4+4=12 → total_score=10, par_total=12 → score_vs_par = −2
- Team Beta: strokes 5+5+5=15, par 4+4+4=12 → total_score=15, par_total=12 → score_vs_par = +3
- `ORDER BY (total_score - par_total) ASC` → Team Alpha (−2) ranks before Team Beta (+3)

- [ ] **Step 1: Add the is_best_ball fix and leaderboard assertion**

```typescript
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
```

- [ ] **Step 2: Run the full suite**

```bash
npx playwright test tests/e2e/tournament-lifecycle.spec.ts --project=chromium-lifecycle
```

Expected: **10 tests pass** (steps 02-08, 10-12). Full lifecycle confirmed.

If the leaderboard score assertions fail, check what format the leaderboard page renders scores in (`formatVsPar()` in `src/lib/scoring.ts` returns `"E"`, `"+N"`, `"-N"`). Adjust the regex accordingly — e.g., `-2` vs `−2` (en-dash vs hyphen).

- [ ] **Step 3: Run the full existing test suite to confirm no regressions**

```bash
npm run test:ci
```

Expected: all Jest unit tests pass (≥80% coverage thresholds met).

```bash
npx playwright test --project=chromium-mobile --project=chromium-desktop
```

Expected: existing admin + round-scoring + leaderboard E2E tests pass (they use mocks and are unaffected).

- [ ] **Step 4: Final commit**

```bash
git add tests/e2e/tournament-lifecycle.spec.ts
git commit -m "test: lifecycle steps 12 — is_best_ball fix and leaderboard assertion"
```

- [ ] **Step 5: Open PR**

```bash
gh pr create \
  --title "test: full tournament lifecycle E2E test (Lionhead Spring Classic)" \
  --body "$(cat <<'EOF'
## Summary
- Adds `tests/e2e/tournament-lifecycle.spec.ts`: 10-step serial Playwright test covering the full tournament lifecycle (venue → course → holes → tournament → activate → teams → player assignment → scoring → leaderboard) against local Supabase
- Adds `scripts/reset-lionhead.ts`: wipe-and-reseed script for clean E2E runs and manual testing setup
- Adds `chromium-lifecycle` Playwright project to `playwright.config.ts`

## Test data
Uses Lionhead Golf Club / Legends Course, Brampton ON. All test entities identifiable by venue name and tournament slug. Does not touch CIBC / Granite Ridge data.

## How to run
1. `npx tsx scripts/reset-lionhead.ts`
2. `npx playwright test tests/e2e/tournament-lifecycle.spec.ts --project=chromium-lifecycle`

## Test plan
- [ ] Reset script runs clean on first run
- [ ] Reset script is idempotent (second run succeeds)
- [ ] All 10 lifecycle steps pass
- [ ] Existing Jest unit tests still pass (`npm run test:ci`)
- [ ] Existing Playwright mock tests still pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Files Summary

| File | Action |
|---|---|
| `scripts/reset-lionhead.ts` | Create |
| `tests/e2e/tournament-lifecycle.spec.ts` | Create |
| `playwright.config.ts` | Modify — add `chromium-lifecycle` project |
