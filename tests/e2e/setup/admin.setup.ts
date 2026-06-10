/**
 * Playwright setup: log in as the E2E admin test user and save storageState.
 *
 * This runs as a dependency of the 'chromium-desktop' (admin) project.
 */
import { test as setup, expect } from '@playwright/test'
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, ADMIN_AUTH_FILE } from '../global-setup'

const hasRealSupabase = !!process.env.SUPABASE_SERVICE_ROLE_KEY

setup('authenticate as admin', async ({ page }) => {
  setup.skip(!hasRealSupabase, 'Requires seeded admin user — set SUPABASE_SERVICE_ROLE_KEY')

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(TEST_ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(TEST_ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()

  // Admin with no team → dashboard shows "Account pending setup" but auth cookies are set
  await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })

  await page.context().storageState({ path: ADMIN_AUTH_FILE })
})
