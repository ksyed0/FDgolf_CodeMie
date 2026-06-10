import { defineConfig, devices } from '@playwright/test'
import { PLAYER_AUTH_FILE, ADMIN_AUTH_FILE } from './tests/e2e/global-setup'

/**
 * Playwright E2E test configuration for FDgolf.
 *
 * Prerequisites:
 *   npm install -D @playwright/test
 *   npx playwright install chromium
 *
 * Run all E2E tests:
 *   npx playwright test
 *
 * Run specific file:
 *   npx playwright test tests/e2e/auth.spec.ts
 *
 * Run with UI:
 *   npx playwright test --ui
 *
 * Environment variables:
 *   BASE_URL                   Dev server URL (default: http://localhost:3000)
 *   CI                         Set in CI — disables webServer auto-start and retries
 *   SUPABASE_SERVICE_ROLE_KEY  Required for auth-dependent tests
 */

const mobileDevice = { ...devices['Pixel 5'], browserName: 'chromium' as const }
const desktopDevice = { ...devices['Desktop Chrome'], browserName: 'chromium' as const }

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,

  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 390, height: 844 },
  },

  projects: [
    // ── Setup: capture real sessions once ───────────────────────────────────
    {
      name: 'player-setup',
      testMatch: '**/setup/player.setup.ts',
      use: { ...mobileDevice },
    },
    {
      name: 'admin-setup',
      testMatch: '**/setup/admin.setup.ts',
      use: { ...desktopDevice },
    },

    // ── Auth flows (no pre-loaded session — tests the login flow itself) ────
    {
      name: 'chromium-auth',
      testMatch: '**/auth.spec.ts',
      use: { ...mobileDevice },
      dependencies: ['player-setup'],
    },

    // ── Player tests (round scoring + leaderboard) ───────────────────────────
    {
      name: 'chromium-mobile',
      testMatch: ['**/round-scoring.spec.ts', '**/leaderboard.spec.ts'],
      use: { ...mobileDevice, storageState: PLAYER_AUTH_FILE },
      dependencies: ['player-setup'],
    },

    // ── Admin tests (desktop viewport, admin session) ─────────────────────────
    {
      name: 'chromium-desktop',
      testMatch: '**/admin.spec.ts',
      use: { ...desktopDevice, storageState: ADMIN_AUTH_FILE },
      dependencies: ['admin-setup'],
    },
  ],

  // Start the Next.js dev server automatically when not in CI
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
