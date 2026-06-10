/**
 * Playwright setup: log in as the E2E player test user and save storageState.
 *
 * This runs as a dependency of the 'chromium-mobile' project.
 * All subsequent player tests reuse the captured session cookies,
 * bypassing the login flow on every test.
 */
import { test as setup, expect } from '@playwright/test'
import { TEST_USER_EMAIL, TEST_USER_PASSWORD, PLAYER_AUTH_FILE } from '../global-setup'

const hasRealSupabase = !!process.env.SUPABASE_SERVICE_ROLE_KEY

setup('authenticate as player', async ({ page }) => {
  setup.skip(!hasRealSupabase, 'Requires seeded test user — set SUPABASE_SERVICE_ROLE_KEY')

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(TEST_USER_EMAIL)
  await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })

  // Capture cookies + localStorage so subsequent tests skip the login form
  await page.context().storageState({ path: PLAYER_AUTH_FILE })
})
