/**
 * Playwright route helpers for mocking Supabase REST and Auth endpoints.
 *
 * Usage:
 *   import { mockSupabaseAuth, mockSupabaseTable } from './helpers/supabase-mock'
 *
 *   test('...', async ({ page }) => {
 *     await mockSupabaseAuth(page, { user: fakeUser, session: fakeSession })
 *     await mockSupabaseTable(page, 'teams', [fakeTeam])
 *   })
 */
import type { Page } from '@playwright/test'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'

export interface FakeUser {
  id: string
  email: string
  role?: string
}

export interface FakeSession {
  access_token: string
  refresh_token: string
  user: FakeUser
}

/** Mock POST /auth/v1/token (signInWithPassword) */
export async function mockSignIn(page: Page, session: FakeSession) {
  await page.route(`${SB_URL}/auth/v1/token**`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    })
  })
}

/** Mock POST /auth/v1/token to return 400 (wrong password) */
export async function mockSignInFailure(page: Page) {
  await page.route(`${SB_URL}/auth/v1/token**`, (route) => {
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
    })
  })
}

/** Mock GET /rest/v1/<table> to return rows.
 *
 * Detects whether the caller used .single() by inspecting the Accept header.
 * PostgREST's .single() sends Accept: application/vnd.pgrst.object+json and
 * expects a bare JSON object in response, not an array.  Returning an array
 * causes postgrest-js v1 to reject the result and return data: null, which
 * breaks any page that guards on a missing player/team/tournament row.
 */
export async function mockSupabaseTable(page: Page, table: string, rows: unknown[]) {
  await page.route(`${SB_URL}/rest/v1/${table}**`, (route) => {
    if (route.request().method() === 'GET') {
      const accept = route.request().headers()['accept'] ?? ''
      const isSingle = accept.includes('pgrst.object')
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isSingle ? (rows[0] ?? null) : rows),
      })
    } else {
      route.continue()
    }
  })
}

/** Mock POST /rest/v1/<table> (insert) to return inserted row */
export async function mockSupabaseInsert(page: Page, table: string, row: unknown) {
  await page.route(`${SB_URL}/rest/v1/${table}**`, (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([row]),
      })
    } else {
      route.continue()
    }
  })
}

/** Mock POST /api/shots (internal Next.js route) */
export async function mockShotsApi(page: Page, response: { id: string } = { id: 'shot-001' }) {
  await page.route('**/api/shots', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })
}

/** Mock POST /api/auth/magic-link */
export async function mockMagicLinkApi(page: Page) {
  await page.route('**/api/auth/magic-link', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ link: 'http://localhost:3000/auth/confirm?token=test' }),
    })
  })
}

/** Mock GET /rest/v1/rpc/get_leaderboard */
export async function mockLeaderboard(page: Page, rows: unknown[]) {
  await page.route(`${SB_URL}/rest/v1/rpc/get_leaderboard**`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rows),
    })
  })
}
