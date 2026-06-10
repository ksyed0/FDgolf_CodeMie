/**
 * E2E tests: Authentication flows
 * Covers: TC-0001 through TC-0015
 *
 * Run: npx playwright test tests/e2e/auth.spec.ts
 */
import { test, expect } from '@playwright/test'
import { mockSignInFailure } from './helpers/supabase-mock'
import { fakeSession } from './helpers/fixtures'
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from './global-setup'

const hasRealSupabase = !!process.env.SUPABASE_SERVICE_ROLE_KEY

// ── TC-0007: Successful login ──────────────────────────────────────────────

test('TC-0007: player logs in with valid credentials and lands on /dashboard', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded test user — set SUPABASE_SERVICE_ROLE_KEY')

  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()

  await page.getByLabel(/email/i).fill(TEST_USER_EMAIL)
  await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.waitForURL('**/dashboard', { timeout: 8000 })
  await expect(page).toHaveURL(/dashboard/)
})

// ── TC-0008 & TC-0009: Login failures ─────────────────────────────────────

test('TC-0008: wrong password shows generic error', async ({ page }) => {
  await mockSignInFailure(page)

  await page.goto('/login')
  await page.getByLabel(/email/i).fill('alice@example.com')
  await page.getByLabel(/password/i).fill('wrong-password')
  await page.getByRole('button', { name: /sign in/i }).click()

  // Login page normalises the error — never exposes the raw Supabase message
  await expect(page.getByText(/invalid email or password/i)).toBeVisible()
  await expect(page).toHaveURL(/login/)
})

test('TC-0009: unknown email shows same generic error (no account enumeration)', async ({ page }) => {
  await mockSignInFailure(page)

  await page.goto('/login')
  await page.getByLabel(/email/i).fill('nobody@example.com')
  await page.getByLabel(/password/i).fill('any-password')
  await page.getByRole('button', { name: /sign in/i }).click()

  // Same message as TC-0008 — no "user not found" hint
  await expect(page.getByText(/invalid email or password/i)).toBeVisible()
})

// ── TC-0003: Password validation ───────────────────────────────────────────

test('TC-0003: registration rejects password shorter than 8 characters', async ({ page }) => {
  await page.goto('/register')

  // Fill all required fields; only password is intentionally short
  await page.getByLabel(/full name/i).fill('Test User')
  await page.getByLabel(/email/i).fill('new@example.com')
  await page.getByLabel(/password/i).fill('abc')
  await page.getByRole('button', { name: /create account/i }).click()

  // JS validation renders a visible error before calling Supabase
  await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible()
  await expect(page).toHaveURL(/register/)
})

// ── TC-0010: Middleware — unauthenticated redirect ─────────────────────────

test('TC-0010: unauthenticated user accessing /dashboard is redirected to /login', async ({ page }) => {
  // No auth cookie — middleware should redirect
  await page.goto('/dashboard')
  await page.waitForURL('**/login', { timeout: 5000 })
  await expect(page).toHaveURL(/login/)
})

// ── TC-0011: Middleware — logged-in user on /login redirected ──────────────

test('TC-0011: authenticated user accessing /login is redirected to /dashboard', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded test user — set SUPABASE_SERVICE_ROLE_KEY')

  // Establish a real session via the login form
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(TEST_USER_EMAIL)
  await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 8000 })

  // Navigate back to /login — middleware should redirect away
  await page.goto('/login')
  await page.waitForURL(/dashboard|round/, { timeout: 5000 })
  await expect(page).not.toHaveURL(/login/)
})

// ── TC-0012: Middleware — player blocked from /admin ───────────────────────

test('TC-0012: player role user is blocked from /admin routes', async ({ page, context }) => {
  await context.addCookies([
    {
      name: 'sb-access-token',
      value: fakeSession.access_token,
      domain: 'localhost',
      path: '/',
    },
  ])

  await page.goto('/admin/tournament')
  // Should be redirected away — to /dashboard or /login
  await page.waitForURL(/dashboard|login/, { timeout: 5000 })
  await expect(page).not.toHaveURL(/admin/)
})

// ── TC-0013: Middleware — /live route is public ────────────────────────────

test('TC-0013: /live/slug is accessible without authentication', async ({ page }) => {
  // No cookies set — public route should render
  await page.goto('/live/cibc-granite-ridge-2026')

  // Should NOT redirect to login
  await expect(page).not.toHaveURL(/login/)

  // The page should contain leaderboard content
  await expect(page.getByText(/leaderboard|LIVE|tournament/i).first()).toBeVisible({ timeout: 8000 })
})
