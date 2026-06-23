# Kiosk Demo + E2E Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully automated kiosk demo that simulates an 18-hole best-ball tournament on Lionhead Legends course across two side-by-side browser windows, with restart-on-completion; ship bundled E2E fixes for the admin role changes in PR #38.

**Architecture:** A single `npx tsx scripts/demo/run.ts` entry point seeds the Lionhead course data, launches two Playwright Chromium instances (TV leaderboard left, phone round-scoring right), runs background score injection for teams 2-18, polls for completion, and loops via a restart API. The TV leaderboard gains a `TvRestartOverlay` client component that shows when `tournament.is_demo && status === 'completed'`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + service role), Playwright `@playwright/test` chromium, `tsx` script runner, Jest for unit tests

## Global Constraints

- Design tokens — PROHIBITED in admin/TV files: `text-sm`, `text-xs`, `text-gray-*`, `rounded-lg`; use `text-[13px]`, `rounded-xl`/`rounded-2xl`
- All new `src/` files must pass `npm run type-check` (`tsc --noEmit`)
- Git branch: `feature/admin-role-dashboards` — commit each task
- Commit format: `[TYPE] SHORT-ID: description (max 72 chars)` — types: `feat`, `fix`, `test`, `refactor`, `chore`
- Test coverage threshold: ≥80% statements/functions/lines, ≥70% branches (enforced by `npm run test:ci`)
- Demo slug: `lionhead-legends-demo`; demo captain email: `demo-captain@fdgolf.demo`; demo captain password: `DemoKiosk2026!`
- `shots.start_lat`/`start_lng` (not `lat`/`lng`) — that is the actual DB column name
- Score range: par 3 → [3,7], par 4 → [4,8], par 5 → [5,9] (each player independently random)
- SHOT_DELAY_MS=5000, HOLE_DELAY_MS=20000, POLL_INTERVAL_MS=10000, RESTART_COUNTDOWN_MS=600000

---

### Task 1: E2E fixes — global-setup role + tournament_admin user + TC-0047 + admin-roles spec

**Files:**
- Modify: `tests/e2e/global-setup.ts`
- Modify: `tests/e2e/admin.spec.ts` (TC-0047 only)
- Create: `tests/e2e/admin-roles.spec.ts`
- Modify: `tests/TEST_LOGINS.md`

**Interfaces:**
- Produces: `TEST_TOURNAMENT_ADMIN_EMAIL`, `TEST_TOURNAMENT_ADMIN_PASSWORD` constants exported from `global-setup.ts`; `TOURNAMENT_ADMIN_AUTH_FILE = 'tests/e2e/.auth/tournament-admin.json'` exported from `global-setup.ts`

- [ ] **Step 1: Fix `global-setup.ts` — change role type and call**

In `tests/e2e/global-setup.ts`, make these changes:

1. Line 36: change `role: 'player' | 'admin'` → `role: 'player' | 'system_admin'`
2. Line 143: change second `upsertUser` call argument `'admin'` → `'system_admin'`
3. Add tournament_admin constants and exports after the existing constants (around line 28):

```typescript
export const TEST_TOURNAMENT_ADMIN_EMAIL = 'e2e-tournament-admin@fdgolf.test'
export const TEST_TOURNAMENT_ADMIN_PASSWORD = 'E2eTournamentAdmin789!'
export const TOURNAMENT_ADMIN_AUTH_FILE = 'tests/e2e/.auth/tournament-admin.json'
```

4. In `globalSetup()`, after the `await upsertUser(admin, users, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, 'system_admin')` call, add:

```typescript
const taAuthUserId = await upsertUser(admin, users, TEST_TOURNAMENT_ADMIN_EMAIL, TEST_TOURNAMENT_ADMIN_PASSWORD, 'tournament_admin')
if (taAuthUserId) {
  const { data: taPlayer } = await (admin as any)
    .from('players')
    .select('id')
    .eq('auth_user_id', taAuthUserId)
    .maybeSingle()
  const { data: tournament } = await (admin as any)
    .from('tournaments')
    .select('id')
    .eq('slug', E2E_TOURNAMENT_SLUG)
    .maybeSingle()
  if (taPlayer && tournament) {
    await (admin as any)
      .from('tournament_admin_assignments')
      .upsert(
        { player_id: taPlayer.id, tournament_id: tournament.id },
        { onConflict: 'player_id,tournament_id', ignoreDuplicates: true }
      )
    console.log('[globalSetup] tournament_admin assignment ready')
  }
}
```

Note: `upsertUser` returns the auth UUID (`userId`). The `tournament_admin_assignments` table uses `players.id` (not `auth_user_id`), so we look up the player record first.

- [ ] **Step 2: Update TC-0047 in `tests/e2e/admin.spec.ts`**

Find TC-0047 (line 39) and replace the `expectedSections` array:

```typescript
// Before:
const expectedSections = ['tournament', 'venues', 'courses', 'players', 'teams', 'clubs', 'scores', 'sponsors']

// After:
const expectedSections = ['roster', 'tournament', 'teams', 'scores', 'sponsors', 'tournaments', 'venues', 'courses', 'clubs']
```

- [ ] **Step 3: Create `tests/e2e/admin-roles.spec.ts`**

```typescript
/**
 * E2E tests: Admin role access control — system_admin vs tournament_admin
 * Covers: TC-0090 through TC-0095
 *
 * Run: npx playwright test tests/e2e/admin-roles.spec.ts --project=chromium-desktop
 *
 * All tests require real Supabase (SUPABASE_SERVICE_ROLE_KEY must be set).
 */
import { test, expect } from '@playwright/test'
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_TOURNAMENT_ADMIN_EMAIL,
  TEST_TOURNAMENT_ADMIN_PASSWORD,
} from './global-setup'

const hasRealSupabase = !!process.env.SUPABASE_SERVICE_ROLE_KEY

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard|admin/, { timeout: 10000 })
}

// ── TC-0090 ────────────────────────────────────────────────────────────────
test('TC-0090: system_admin sidebar shows Global section with Tournaments, Players, Venues, Courses, Clubs', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded system_admin user in local Supabase')

  await signIn(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
  await page.goto('/admin/tournament')

  await expect(page.getByText('Global', { exact: false }).first()).toBeVisible({ timeout: 5000 })
  for (const label of ['Tournaments', 'Players', 'Venues', 'Courses', 'Clubs']) {
    await expect(page.getByRole('link', { name: label }).first()).toBeVisible()
  }
})

// ── TC-0091 ────────────────────────────────────────────────────────────────
test('TC-0091: tournament_admin sidebar has no Global section', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded tournament_admin user in local Supabase')

  await signIn(page, TEST_TOURNAMENT_ADMIN_EMAIL, TEST_TOURNAMENT_ADMIN_PASSWORD)
  await page.goto('/admin/tournament')

  await expect(page.getByText('Global', { exact: true })).not.toBeVisible()
  await expect(page.getByRole('link', { name: 'Venues' })).not.toBeVisible()
  await expect(page.getByRole('link', { name: 'Courses' })).not.toBeVisible()
})

// ── TC-0092 ────────────────────────────────────────────────────────────────
test('TC-0092: tournament_admin navigating to /admin/tournaments redirects to /admin/tournament', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded tournament_admin user in local Supabase')

  await signIn(page, TEST_TOURNAMENT_ADMIN_EMAIL, TEST_TOURNAMENT_ADMIN_PASSWORD)
  await page.goto('/admin/tournaments')
  await page.waitForURL(/\/admin\/tournament$/, { timeout: 5000 })
  await expect(page).toHaveURL(/\/admin\/tournament$/)
})

// ── TC-0093 ────────────────────────────────────────────────────────────────
test('TC-0093: tournament_admin navigating to /admin/players redirects to /admin/tournament', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded tournament_admin user in local Supabase')

  await signIn(page, TEST_TOURNAMENT_ADMIN_EMAIL, TEST_TOURNAMENT_ADMIN_PASSWORD)
  await page.goto('/admin/players')
  await page.waitForURL(/\/admin\/tournament$/, { timeout: 5000 })
  await expect(page).toHaveURL(/\/admin\/tournament$/)
})

// ── TC-0094 ────────────────────────────────────────────────────────────────
test('TC-0094: /admin/tournaments renders tournament list for system_admin', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded system_admin + tournament in local Supabase')

  await signIn(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
  await page.goto('/admin/tournaments')
  await expect(page.getByRole('heading', { name: /tournaments/i }).first()).toBeVisible({ timeout: 5000 })
})

// ── TC-0095 ────────────────────────────────────────────────────────────────
test('TC-0095: /admin/roster renders Roster heading for system_admin', async ({ page }) => {
  test.skip(!hasRealSupabase, 'Requires seeded system_admin in local Supabase')

  await signIn(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
  await page.goto('/admin/roster')
  await expect(page.getByRole('heading', { name: /roster/i }).first()).toBeVisible({ timeout: 5000 })
})
```

- [ ] **Step 4: Update `tests/TEST_LOGINS.md`**

Read the file and append this row to the test logins table:

```markdown
| `e2e-tournament-admin@fdgolf.test` | `E2eTournamentAdmin789!` | `tournament_admin` | Assigned to CIBC tournament; used for TC-0091–TC-0093 |
```

- [ ] **Step 5: Verify E2E compile**

```bash
npx tsc --noEmit --project tsconfig.json
```

Expected: no errors related to the changed files. (E2E tests are excluded from the main tsconfig but run through Playwright's own transpile.)

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/global-setup.ts tests/e2e/admin.spec.ts tests/e2e/admin-roles.spec.ts tests/TEST_LOGINS.md
git commit -m "test: fix global-setup role constraint + add tournament_admin E2E user + TC-0090-TC-0095"
```

---

### Task 2: `is_demo` migration + Tournament type + restart API

**Files:**
- Create: `supabase/migrations/013_demo_tournament_flag.sql`
- Modify: `src/lib/types.ts`
- Create: `src/app/api/demo/restart/route.ts`
- Create: `src/__tests__/demo-restart-api.test.ts`

**Interfaces:**
- Produces: `Tournament.is_demo: boolean` — used in Task 3 (TV overlay) and Task 5 (seed script)
- Produces: `POST /api/demo/restart` — accepts `{ tournamentId: string }` body, returns `{ ok: true }` or `{ error: string }` with 400/403/500

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/demo-restart-api.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { POST } from '@/app/api/demo/restart/route'

const mockFrom = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
  })),
}))

function makeChain(returnValue: unknown) {
  const chain: Record<string, jest.Mock> = {}
  chain.select = jest.fn(() => chain)
  chain.eq = jest.fn(() => chain)
  chain.in = jest.fn(() => chain)
  chain.single = jest.fn(() => Promise.resolve(returnValue))
  chain.update = jest.fn(() => chain)
  chain.delete = jest.fn(() => chain)
  return chain
}

describe('POST /api/demo/restart', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
  })

  it('returns 400 when tournamentId is missing', async () => {
    const req = new Request('http://localhost/api/demo/restart', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/tournamentId/)
  })

  it('returns 403 when tournament is not a demo tournament', async () => {
    const chain = makeChain({ data: { id: 'tid', is_demo: false }, error: null })
    mockFrom.mockReturnValue(chain)

    const req = new Request('http://localhost/api/demo/restart', {
      method: 'POST',
      body: JSON.stringify({ tournamentId: 'tid' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/not a demo/i)
  })

  it('returns 200 and resets tournament when is_demo is true', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return makeChain({ data: { id: 'tid', is_demo: true }, error: null })
      }
      const chain = makeChain({ data: [], error: null })
      chain.delete = jest.fn(() => chain)
      chain.update = jest.fn(() => chain)
      return chain
    })

    const req = new Request('http://localhost/api/demo/restart', {
      method: 'POST',
      body: JSON.stringify({ tournamentId: 'tid' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/demo-restart-api.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/demo/restart/route'`

- [ ] **Step 3: Create migration**

Create `supabase/migrations/013_demo_tournament_flag.sql`:

```sql
-- Add is_demo flag to tournaments table.
-- When true: TV leaderboard shows restart overlay after completion.
ALTER TABLE tournaments
  ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
```

- [ ] **Step 4: Add `is_demo` to Tournament type**

In `src/lib/types.ts`, update the Tournament interface (currently lines 31-44):

```typescript
export interface Tournament {
  id: string;
  name: string;
  slug: string;
  venue_id: string;
  course_id: string;
  date: string;
  start_time: string | null;
  format: string;
  holes_played: 9 | 18;
  nine_hole_selection: 'front' | 'back' | null;
  status: TournamentStatus;
  is_demo: boolean;
  created_at: string;
}
```

- [ ] **Step 5: Create restart API route**

Create `src/app/api/demo/restart/route.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { tournamentId } = body as { tournamentId?: string };

  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, is_demo')
    .eq('id', tournamentId)
    .single();

  if (!tournament?.is_demo) {
    return NextResponse.json({ error: 'Not a demo tournament' }, { status: 403 });
  }

  const { data: tournamentPlayers } = await supabase
    .from('tournament_players')
    .select('player_id')
    .eq('tournament_id', tournamentId);

  const playerIds = (tournamentPlayers ?? []).map((r: { player_id: string }) => r.player_id);

  if (playerIds.length > 0) {
    await supabase.from('shots').delete().in('player_id', playerIds);
  }

  await supabase.from('scores').delete().eq('tournament_id', tournamentId);

  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('tournament_id', tournamentId);
  const teamIds = (teams ?? []).map((r: { id: string }) => r.id);
  if (teamIds.length > 0) {
    await supabase.from('round_states').delete().in('team_id', teamIds);
  }

  await supabase.from('tournaments').update({ status: 'active' }).eq('id', tournamentId);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx jest src/__tests__/demo-restart-api.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 7: Run full type check**

```bash
npm run type-check
```

Expected: no errors. If you see errors about `is_demo` missing in existing code that constructs Tournament objects, add `is_demo: false` as a default value in those locations.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/013_demo_tournament_flag.sql src/lib/types.ts src/app/api/demo/restart/route.ts src/__tests__/demo-restart-api.test.ts
git commit -m "feat: is_demo migration, Tournament type, POST /api/demo/restart"
```

---

### Task 3: TV restart overlay

**Files:**
- Create: `src/components/tv/TvRestartOverlay.tsx`
- Modify: `src/components/tv/TvDisplay.tsx`

**Interfaces:**
- Consumes: `Tournament.is_demo: boolean`, `Tournament.status: TournamentStatus` (from Task 2)
- Consumes: `POST /api/demo/restart` (from Task 2)
- Produces: `TvRestartOverlay` component with `{ tournamentId: string }` props — shown when tournament is a completed demo

- [ ] **Step 1: Create `TvRestartOverlay.tsx`**

Create `src/components/tv/TvRestartOverlay.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';

const COUNTDOWN_MS = 600_000; // 10 minutes

interface TvRestartOverlayProps {
  tournamentId: string;
}

export function TvRestartOverlay({ tournamentId }: TvRestartOverlayProps) {
  const [remainingMs, setRemainingMs] = useState(COUNTDOWN_MS);
  const [restarting, setRestarting] = useState(false);

  const triggerRestart = useCallback(async () => {
    if (restarting) return;
    setRestarting(true);
    await fetch('/api/demo/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId }),
    });
  }, [tournamentId, restarting]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          triggerRestart();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [triggerRestart]);

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-10 py-6 z-50"
      style={{ background: 'rgba(26,71,42,0.96)', borderTop: '2px solid #2f8f4e' }}
    >
      <div className="flex items-center gap-3">
        <span style={{ fontSize: 28 }}>🏆</span>
        <div>
          <p className="font-barlow font-extrabold text-white" style={{ fontSize: 22 }}>
            Tournament Complete
          </p>
          <p style={{ fontSize: 13, color: '#9fd6ad' }}>
            Restarting automatically in {minutes}:{seconds}
          </p>
        </div>
      </div>
      <button
        onClick={triggerRestart}
        disabled={restarting}
        className="rounded-xl font-semibold disabled:opacity-60 transition-colors"
        style={{
          background: restarting ? '#2f8f4e' : '#fff',
          color: restarting ? '#fff' : '#1a472a',
          fontSize: 15,
          padding: '10px 28px',
        }}
      >
        {restarting ? 'Restarting…' : 'Restart Demo'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add polling + overlay to `TvDisplay.tsx`**

In `src/components/tv/TvDisplay.tsx`, make three additions:

**1. Import `TvRestartOverlay` at the top** (after existing imports):

```typescript
import { TvRestartOverlay } from './TvRestartOverlay';
```

**2. Add state after the existing state declarations** (after the `const [teamSpotlight, ...]` line):

```typescript
const [tournamentStatus, setTournamentStatus] = useState<string>(tournament.status);
const isDemoMode = tournament.is_demo;
```

**3. Add a polling effect** (after the existing `useEffect` blocks that fetch stats):

```typescript
useEffect(() => {
  if (!isDemoMode) return;
  const supabase = createClient();
  const interval = setInterval(async () => {
    const { data } = await supabase
      .from('tournaments')
      .select('status')
      .eq('id', tournament.id)
      .single();
    if (data?.status) setTournamentStatus(data.status as string);
  }, 10_000);
  return () => clearInterval(interval);
}, [tournament.id, isDemoMode]);
```

**4. Add overlay in JSX** — add this just before the final closing `</div>` of the component's return:

```typescript
{isDemoMode && tournamentStatus === 'completed' && (
  <TvRestartOverlay tournamentId={tournament.id} />
)}
```

- [ ] **Step 3: Run type check**

```bash
npm run type-check
```

Expected: no errors. The TV page's `select('*', ...)` already includes `is_demo` once the migration runs; the `TournamentWithVenue` type alias extends `Tournament` so `is_demo` flows through automatically.

- [ ] **Step 4: Commit**

```bash
git add src/components/tv/TvRestartOverlay.tsx src/components/tv/TvDisplay.tsx
git commit -m "feat: TV restart overlay for demo tournaments (is_demo + completed status)"
```

---

### Task 4: Demo utilities — types, score generator, GPS generator

**Files:**
- Create: `scripts/demo/types.ts`
- Create: `scripts/demo/score-gen.ts`
- Create: `scripts/demo/gps-gen.ts`
- Create: `src/__tests__/demo-score-gen.test.ts`
- Create: `src/__tests__/demo-gps-gen.test.ts`

**Interfaces:**
- Produces:
  - `DemoHole` — `{ id: string; holeNumber: number; par: number; pinLat: number; pinLng: number; teeLat: number; teeLng: number; }`
  - `DemoPlayer` — `{ id: string; name: string; }`
  - `DemoTeam` — `{ id: string; name: string; startingHole: number; players: DemoPlayer[]; }`
  - `DemoClub` — `{ id: string; name: string; category: string; }`
  - `DemoConfig` — `{ tournamentId: string; holes: DemoHole[]; teams: DemoTeam[]; clubs: DemoClub[]; }`
  - `ShotInsert` — `{ player_id: string; tournament_id: string; hole_number: number; shot_number: number; club_name: string; start_lat: number; start_lng: number; outcome: 'in_play' | 'sunk'; }`
  - `generateScore(par: number): number` — random int in range [par, par+4]
  - `generateShots(tournamentId: string, hole: DemoHole, players: DemoPlayer[], scores: number[], clubs: DemoClub[]): ShotInsert[]`

Note: `scripts/demo/` runs under `tsx`, NOT in Jest/Next.js. Do NOT use `@/` path aliases — use relative imports only.

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/demo-score-gen.test.ts`:

```typescript
import { generateScore } from '../../scripts/demo/score-gen'

describe('generateScore', () => {
  it('par 3: always returns value in [3, 7]', () => {
    for (let i = 0; i < 200; i++) {
      const s = generateScore(3)
      expect(s).toBeGreaterThanOrEqual(3)
      expect(s).toBeLessThanOrEqual(7)
    }
  })

  it('par 4: always returns value in [4, 8]', () => {
    for (let i = 0; i < 200; i++) {
      const s = generateScore(4)
      expect(s).toBeGreaterThanOrEqual(4)
      expect(s).toBeLessThanOrEqual(8)
    }
  })

  it('par 5: always returns value in [5, 9]', () => {
    for (let i = 0; i < 200; i++) {
      const s = generateScore(5)
      expect(s).toBeGreaterThanOrEqual(5)
      expect(s).toBeLessThanOrEqual(9)
    }
  })

  it('returns an integer', () => {
    expect(Number.isInteger(generateScore(4))).toBe(true)
  })
})
```

Create `src/__tests__/demo-gps-gen.test.ts`:

```typescript
import { generateShots } from '../../scripts/demo/gps-gen'
import type { DemoHole, DemoPlayer, DemoClub } from '../../scripts/demo/types'

const hole: DemoHole = {
  id: 'hole-1',
  holeNumber: 1,
  par: 4,
  pinLat: 43.651,
  pinLng: -79.842,
  teeLat: 43.6498,
  teeLng: -79.8432,
}

const players: DemoPlayer[] = [
  { id: 'p1', name: 'Alice Smith' },
  { id: 'p2', name: 'Bob Jones' },
]

const clubs: DemoClub[] = [
  { id: 'c1', name: 'Driver', category: 'wood' },
  { id: 'c2', name: '7 Iron', category: 'iron' },
  { id: 'c3', name: 'Putter', category: 'putter' },
]

describe('generateShots', () => {
  it('produces one ShotInsert per stroke per player', () => {
    const shots = generateShots('tid', hole, players, [5, 4], clubs)
    expect(shots.filter((s) => s.player_id === 'p1').length).toBe(5)
    expect(shots.filter((s) => s.player_id === 'p2').length).toBe(4)
  })

  it('last shot for each player has outcome sunk', () => {
    const shots = generateShots('tid', hole, players, [5, 4], clubs)
    const p1shots = shots.filter((s) => s.player_id === 'p1').sort((a, b) => a.shot_number - b.shot_number)
    const p2shots = shots.filter((s) => s.player_id === 'p2').sort((a, b) => a.shot_number - b.shot_number)
    expect(p1shots.at(-1)?.outcome).toBe('sunk')
    expect(p2shots.at(-1)?.outcome).toBe('sunk')
  })

  it('non-last shots have outcome in_play', () => {
    const shots = generateShots('tid', hole, players, [5, 4], clubs)
    const p1shots = shots.filter((s) => s.player_id === 'p1').sort((a, b) => a.shot_number - b.shot_number)
    for (const s of p1shots.slice(0, -1)) {
      expect(s.outcome).toBe('in_play')
    }
  })

  it('all shots have valid lat/lng within ~1 degree of pin', () => {
    const shots = generateShots('tid', hole, players, [5, 4], clubs)
    for (const s of shots) {
      expect(Math.abs(s.start_lat - hole.pinLat)).toBeLessThan(1)
      expect(Math.abs(s.start_lng - hole.pinLng)).toBeLessThan(1)
    }
  })

  it('hole-in-one (score=1) produces single sunk shot near pin', () => {
    const shots = generateShots('tid', hole, [players[0]], [1], clubs)
    expect(shots.length).toBe(1)
    expect(shots[0].outcome).toBe('sunk')
    expect(Math.abs(shots[0].start_lat - hole.pinLat)).toBeLessThan(0.001)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/__tests__/demo-score-gen.test.ts src/__tests__/demo-gps-gen.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../scripts/demo/score-gen'`

- [ ] **Step 3: Create `scripts/demo/types.ts`**

```typescript
export interface DemoHole {
  id: string;
  holeNumber: number;
  par: number;
  pinLat: number;
  pinLng: number;
  teeLat: number;
  teeLng: number;
}

export interface DemoPlayer {
  id: string;
  name: string;
}

export interface DemoTeam {
  id: string;
  name: string;
  startingHole: number;
  players: DemoPlayer[];
}

export interface DemoClub {
  id: string;
  name: string;
  category: string;
}

export interface DemoConfig {
  tournamentId: string;
  holes: DemoHole[];
  teams: DemoTeam[];
  clubs: DemoClub[];
}

export interface ShotInsert {
  player_id: string;
  tournament_id: string;
  hole_number: number;
  shot_number: number;
  club_name: string;
  start_lat: number;
  start_lng: number;
  outcome: 'in_play' | 'sunk';
}
```

- [ ] **Step 4: Create `scripts/demo/score-gen.ts`**

```typescript
export function generateScore(par: number): number {
  return par + Math.floor(Math.random() * 5); // par+0 to par+4
}
```

- [ ] **Step 5: Create `scripts/demo/gps-gen.ts`**

```typescript
import type { DemoHole, DemoPlayer, DemoClub, ShotInsert } from './types';

function jitter(): number {
  return (Math.random() - 0.5) * 0.0004; // ±0.0002°, ~20m spread
}

function pickClub(shotNumber: number, totalShots: number, par: number, clubs: DemoClub[]): string {
  const byName = (name: string) => clubs.find((c) => c.name === name)?.name ?? clubs[0].name;
  if (shotNumber === totalShots) return byName('Putter');
  if (shotNumber === 1 && par >= 4) return byName('Driver');
  if (shotNumber === 1 && par === 3) return byName('9 Iron');
  return byName('7 Iron');
}

export function generateShots(
  tournamentId: string,
  hole: DemoHole,
  players: DemoPlayer[],
  scores: number[],
  clubs: DemoClub[]
): ShotInsert[] {
  const shots: ShotInsert[] = [];

  players.forEach((player, idx) => {
    const totalShots = scores[idx];
    for (let shotNum = 1; shotNum <= totalShots; shotNum++) {
      const isLast = shotNum === totalShots;
      const progress = totalShots === 1 ? 1 : (shotNum - 1) / (totalShots - 1);

      const lat =
        hole.teeLat +
        (hole.pinLat - hole.teeLat) * progress +
        (isLast ? (Math.random() - 0.5) * 0.0001 : jitter());
      const lng =
        hole.teeLng +
        (hole.pinLng - hole.teeLng) * progress +
        (isLast ? (Math.random() - 0.5) * 0.0001 : jitter());

      shots.push({
        player_id: player.id,
        tournament_id: tournamentId,
        hole_number: hole.holeNumber,
        shot_number: shotNum,
        club_name: pickClub(shotNum, totalShots, hole.par, clubs),
        start_lat: lat,
        start_lng: lng,
        outcome: isLast ? 'sunk' : 'in_play',
      });
    }
  });

  return shots;
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest src/__tests__/demo-score-gen.test.ts src/__tests__/demo-gps-gen.test.ts --no-coverage
```

Expected: PASS (9 tests total)

- [ ] **Step 7: Run full test suite**

```bash
npm run test:ci
```

Expected: all tests pass, coverage ≥80%.

- [ ] **Step 8: Commit**

```bash
git add scripts/demo/types.ts scripts/demo/score-gen.ts scripts/demo/gps-gen.ts src/__tests__/demo-score-gen.test.ts src/__tests__/demo-gps-gen.test.ts
git commit -m "feat: demo utilities — DemoHole/Player/Team types, score-gen, gps-gen"
```

---

### Task 5: Lionhead seed script

**Files:**
- Create: `scripts/demo/seed-lionhead.ts`

**Interfaces:**
- Consumes: `DemoHole`, `DemoTeam`, `DemoConfig`, `DemoClub` from `./types`
- Produces: `seedLionhead(): Promise<DemoConfig>` — idempotent seed; returns config with tournamentId, holes, teams, clubs

After running, all required rows exist in: `venues`, `courses`, `holes`, `tee_boxes`, `tournaments`, `players`, `teams`, `tournament_players`. Clubs are read from existing active clubs (run `reset-and-seed.sh` first). Also creates the Supabase auth user for the demo captain (`demo-captain@fdgolf.demo`).

- [ ] **Step 1: Create `scripts/demo/seed-lionhead.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import type { DemoConfig, DemoHole, DemoTeam, DemoClub } from './types';

dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SERVICE_KEY) {
  console.error('[seed-lionhead] SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_SLUG = 'lionhead-legends-demo';
const DEMO_CAPTAIN_EMAIL = 'demo-captain@fdgolf.demo';
const DEMO_CAPTAIN_PASSWORD = 'DemoKiosk2026!';

const HOLE_DATA = [
  { holeNumber: 1,  par: 4, yards: 415, handicap: 9,  pinLat: 43.6510, pinLng: -79.8420, teeLat: 43.6498, teeLng: -79.8432 },
  { holeNumber: 2,  par: 4, yards: 390, handicap: 5,  pinLat: 43.6525, pinLng: -79.8405, teeLat: 43.6512, teeLng: -79.8418 },
  { holeNumber: 3,  par: 3, yards: 185, handicap: 17, pinLat: 43.6538, pinLng: -79.8388, teeLat: 43.6530, teeLng: -79.8395 },
  { holeNumber: 4,  par: 5, yards: 510, handicap: 1,  pinLat: 43.6550, pinLng: -79.8370, teeLat: 43.6535, teeLng: -79.8385 },
  { holeNumber: 5,  par: 4, yards: 405, handicap: 11, pinLat: 43.6542, pinLng: -79.8350, teeLat: 43.6550, teeLng: -79.8363 },
  { holeNumber: 6,  par: 4, yards: 360, handicap: 13, pinLat: 43.6528, pinLng: -79.8335, teeLat: 43.6540, teeLng: -79.8348 },
  { holeNumber: 7,  par: 5, yards: 530, handicap: 3,  pinLat: 43.6512, pinLng: -79.8318, teeLat: 43.6520, teeLng: -79.8332 },
  { holeNumber: 8,  par: 3, yards: 170, handicap: 15, pinLat: 43.6498, pinLng: -79.8302, teeLat: 43.6505, teeLng: -79.8315 },
  { holeNumber: 9,  par: 4, yards: 394, handicap: 7,  pinLat: 43.6485, pinLng: -79.8288, teeLat: 43.6492, teeLng: -79.8300 },
  { holeNumber: 10, par: 4, yards: 370, handicap: 10, pinLat: 43.6470, pinLng: -79.8305, teeLat: 43.6480, teeLng: -79.8292 },
  { holeNumber: 11, par: 4, yards: 400, handicap: 6,  pinLat: 43.6458, pinLng: -79.8322, teeLat: 43.6468, teeLng: -79.8310 },
  { holeNumber: 12, par: 5, yards: 500, handicap: 2,  pinLat: 43.6445, pinLng: -79.8340, teeLat: 43.6455, teeLng: -79.8328 },
  { holeNumber: 13, par: 3, yards: 175, handicap: 18, pinLat: 43.6432, pinLng: -79.8358, teeLat: 43.6440, teeLng: -79.8345 },
  { holeNumber: 14, par: 4, yards: 385, handicap: 12, pinLat: 43.6420, pinLng: -79.8375, teeLat: 43.6430, teeLng: -79.8362 },
  { holeNumber: 15, par: 5, yards: 460, handicap: 4,  pinLat: 43.6408, pinLng: -79.8392, teeLat: 43.6418, teeLng: -79.8380 },
  { holeNumber: 16, par: 4, yards: 415, handicap: 8,  pinLat: 43.6418, pinLng: -79.8410, teeLat: 43.6408, teeLng: -79.8398 },
  { holeNumber: 17, par: 3, yards: 165, handicap: 16, pinLat: 43.6432, pinLng: -79.8425, teeLat: 43.6422, teeLng: -79.8415 },
  { holeNumber: 18, par: 4, yards: 420, handicap: 14, pinLat: 43.6448, pinLng: -79.8438, teeLat: 43.6438, teeLng: -79.8428 },
] as const;

const TEAM_NAMES = [
  'Eagle Squadron', 'Birdie Brigade', 'Par Patrol', 'Bogey Busters',
  'Fairway Falcons', 'Iron Rangers', 'Wedge Warriors', 'Chip Shots',
  'Bunker Boys', "Driver's Club", 'Green Machines', 'Sand Savers',
  'Back Nine', 'Front Runners', 'Links Lions', 'Turf Tigers',
  'Pin Seekers', 'Rough Riders',
];

const PLAYER_FIRST = ['James', 'Sarah', 'Michael', 'Emma', 'David', 'Olivia', 'Ryan', 'Sophie',
  'Chris', 'Laura', 'Daniel', 'Anna', 'Mark', 'Rachel', 'Tom', 'Jessica'];
const PLAYER_LAST = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Taylor', 'Wilson',
  'Moore', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson'];

function playerName(teamIdx: number, playerIdx: number): string {
  const firstIdx = (teamIdx * 4 + playerIdx) % PLAYER_FIRST.length;
  const lastIdx = (teamIdx * 7 + playerIdx * 3) % PLAYER_LAST.length;
  return `${PLAYER_FIRST[firstIdx]} ${PLAYER_LAST[lastIdx]}`;
}

async function upsertVenueAndCourse(): Promise<{ venueId: string; courseId: string }> {
  let { data: venue } = await (supabase as any)
    .from('venues').select('id').eq('name', 'Lionhead Golf and Country Club').maybeSingle();
  if (!venue) {
    const { data } = await (supabase as any).from('venues').insert({
      name: 'Lionhead Golf and Country Club',
      address1: '8525 Mississauga Rd',
      city: 'Brampton',
      province_state: 'ON',
      postal_code: 'L6Y 0E3',
      country: 'Canada',
    }).select('id').single();
    venue = data;
    console.log('[seed] Venue created');
  } else {
    console.log('[seed] Venue exists');
  }

  let { data: course } = await (supabase as any)
    .from('courses').select('id').eq('name', 'Legends Course').eq('venue_id', venue.id).maybeSingle();
  if (!course) {
    const { data } = await (supabase as any).from('courses').insert({
      venue_id: venue.id,
      name: 'Legends Course',
      hole_count: 18,
      par_total: 72,
      course_rating: 72.4,
      slope_rating: 139,
    }).select('id').single();
    course = data;
    console.log('[seed] Course created');
  } else {
    console.log('[seed] Course exists');
  }

  return { venueId: venue.id as string, courseId: course.id as string };
}

async function upsertHoles(courseId: string): Promise<DemoHole[]> {
  const demoHoles: DemoHole[] = [];

  for (const h of HOLE_DATA) {
    let { data: hole } = await (supabase as any)
      .from('holes').select('id').eq('course_id', courseId).eq('hole_number', h.holeNumber).maybeSingle();
    if (!hole) {
      const { data } = await (supabase as any).from('holes').insert({
        course_id: courseId,
        hole_number: h.holeNumber,
        par: h.par,
        handicap: h.handicap,
        pin_lat: h.pinLat,
        pin_lng: h.pinLng,
      }).select('id').single();
      hole = data;
    }

    let { data: teeBox } = await (supabase as any)
      .from('tee_boxes').select('id').eq('hole_id', hole.id).eq('name', 'Blue').maybeSingle();
    if (!teeBox) {
      await (supabase as any).from('tee_boxes').insert({
        hole_id: hole.id,
        name: 'Blue',
        lat: h.teeLat,
        lng: h.teeLng,
        distance_yards: h.yards,
      });
    }

    demoHoles.push({
      id: hole.id as string,
      holeNumber: h.holeNumber,
      par: h.par,
      pinLat: h.pinLat,
      pinLng: h.pinLng,
      teeLat: h.teeLat,
      teeLng: h.teeLng,
    });
  }

  console.log('[seed] 18 holes + tee boxes ready');
  return demoHoles;
}

async function upsertTournament(venueId: string, courseId: string): Promise<string> {
  let { data: tournament } = await (supabase as any)
    .from('tournaments').select('id').eq('slug', DEMO_SLUG).maybeSingle();
  if (!tournament) {
    const { data } = await (supabase as any).from('tournaments').insert({
      name: 'Lionhead Legends Demo Tournament',
      slug: DEMO_SLUG,
      venue_id: venueId,
      course_id: courseId,
      date: '2026-06-21',
      format: 'best_ball',
      holes_played: 18,
      status: 'setup',
      is_demo: true,
    }).select('id').single();
    tournament = data;
    console.log('[seed] Tournament created');
  } else {
    console.log('[seed] Tournament exists');
  }
  return tournament.id as string;
}

async function upsertDemoCaptainAuth(): Promise<string> {
  const { data: { users } } = await supabase.auth.admin.listUsers();
  let user = users.find((u) => u.email === DEMO_CAPTAIN_EMAIL);
  if (!user) {
    const { data: created } = await supabase.auth.admin.createUser({
      email: DEMO_CAPTAIN_EMAIL,
      password: DEMO_CAPTAIN_PASSWORD,
      email_confirm: true,
    });
    user = created.user!;
    console.log('[seed] Demo captain auth user created');
  } else {
    console.log('[seed] Demo captain auth user exists');
  }
  return user.id;
}

async function upsertTeamsAndPlayers(tournamentId: string, captainAuthUserId: string): Promise<DemoTeam[]> {
  const demoTeams: DemoTeam[] = [];

  for (let teamIdx = 0; teamIdx < TEAM_NAMES.length; teamIdx++) {
    const teamName = TEAM_NAMES[teamIdx];
    const startingHole = teamIdx + 1;

    let { data: team } = await (supabase as any)
      .from('teams').select('id').eq('tournament_id', tournamentId).eq('team_name', teamName).maybeSingle();
    if (!team) {
      const { data } = await (supabase as any).from('teams').insert({
        tournament_id: tournamentId,
        team_number: teamIdx + 1,
        team_name: teamName,
        starting_hole: startingHole,
        max_players: 4,
      }).select('id').single();
      team = data;
    }

    const demoPlayers: DemoTeam['players'] = [];
    for (let pi = 0; pi < 4; pi++) {
      const name = playerName(teamIdx, pi);
      const email = `demo-${teamIdx}-${pi}@fdgolf.demo`;
      const isCaptain = teamIdx === 0 && pi === 0;

      // Non-captain players use fixed fake UUIDs — DB record only, no auth needed
      const authUserId = isCaptain
        ? captainAuthUserId
        : `00000000-dddd-0000-${String(teamIdx).padStart(4, '0')}-${String(pi).padStart(12, '0')}`;

      let { data: player } = await (supabase as any)
        .from('players').select('id').eq('email', email).maybeSingle();
      if (!player) {
        const { data } = await (supabase as any).from('players').insert({
          auth_user_id: authUserId,
          name,
          email,
          title: '',
          company: 'Demo Corp',
          role: 'player',
        }).select('id').single();
        player = data;
      }

      await (supabase as any).from('tournament_players').upsert(
        { player_id: player.id, team_id: team.id, tournament_id: tournamentId },
        { onConflict: 'player_id,tournament_id', ignoreDuplicates: true }
      );

      if (isCaptain) {
        await (supabase as any).from('teams').update({ captain_id: player.id }).eq('id', team.id);
      }

      demoPlayers.push({ id: player.id as string, name });
    }

    demoTeams.push({ id: team.id as string, name: teamName, startingHole, players: demoPlayers });
  }

  console.log('[seed] 18 teams + 72 players ready');
  return demoTeams;
}

async function fetchClubs(): Promise<DemoClub[]> {
  const { data } = await (supabase as any)
    .from('clubs').select('id, name, category').eq('is_active', true).order('sort_order');
  if (!data || data.length === 0) {
    throw new Error('[seed] No active clubs found — run ./scripts/reset-and-seed.sh first');
  }
  return data as DemoClub[];
}

export async function seedLionhead(): Promise<DemoConfig> {
  console.log('[seed-lionhead] Starting…');
  const { venueId, courseId } = await upsertVenueAndCourse();
  const holes = await upsertHoles(courseId);
  const tournamentId = await upsertTournament(venueId, courseId);
  const captainAuthUserId = await upsertDemoCaptainAuth();
  const teams = await upsertTeamsAndPlayers(tournamentId, captainAuthUserId);
  const clubs = await fetchClubs();
  console.log('[seed-lionhead] Done.');
  return { tournamentId, holes, teams, clubs };
}

if (require.main === module) {
  seedLionhead().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit --skipLibCheck scripts/demo/seed-lionhead.ts 2>&1 | head -20
```

Expected: no errors (or only missing `.d.ts` declarations which `--skipLibCheck` handles).

- [ ] **Step 3: Commit**

```bash
git add scripts/demo/seed-lionhead.ts
git commit -m "feat: Lionhead seed script — venue, course, 18 holes, 18 teams, 72 players, demo tournament"
```

---

### Task 6: Background team score injector

**Files:**
- Create: `scripts/demo/background.ts`

**Interfaces:**
- Consumes: `DemoConfig`, `DemoTeam` from `./types`; `generateScore` from `./score-gen`; `generateShots` from `./gps-gen`
- Produces: `runBackgroundTeams(config: DemoConfig): Promise<void>` — injects all 17 background teams' scores + GPS shots, paced to HOLE_DELAY_MS (20 seconds between holes per team)

- [ ] **Step 1: Create `scripts/demo/background.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import type { DemoConfig, DemoTeam } from './types';
import { generateScore } from './score-gen';
import { generateShots } from './gps-gen';

dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

const HOLE_DELAY_MS = 20_000;

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

async function injectTeamHole(
  supabase: ReturnType<typeof createClient>,
  config: DemoConfig,
  team: DemoTeam,
  holeIndex: number
) {
  const hole = config.holes[holeIndex % 18];
  const scores = team.players.map(() => generateScore(hole.par));

  const scoreRows = team.players.map((player, idx) => ({
    player_id: player.id,
    team_id: team.id,
    tournament_id: config.tournamentId,
    hole_number: hole.holeNumber,
    strokes: scores[idx],
    is_best_ball: false,
    override_by: null,
    override_at: null,
  }));

  const { error: scoreError } = await (supabase as any)
    .from('scores')
    .upsert(scoreRows, { onConflict: 'player_id,tournament_id,hole_number' });

  if (scoreError) {
    console.error(`[background] Score error team=${team.name} hole=${hole.holeNumber}:`, scoreError.message);
  }

  const shots = generateShots(config.tournamentId, hole, team.players, scores, config.clubs);
  if (shots.length > 0) {
    const { error: shotError } = await (supabase as any).from('shots').insert(shots);
    if (shotError) {
      console.error(`[background] Shot error team=${team.name} hole=${hole.holeNumber}:`, shotError.message);
    }
  }

  // Trigger best-ball edge function (non-fatal if not running locally)
  await (supabase as any).functions
    .invoke('calculate-best-ball', {
      body: { tournament_id: config.tournamentId, team_id: team.id, hole_number: hole.holeNumber },
    })
    .catch(() => {});
}

async function runTeam(
  supabase: ReturnType<typeof createClient>,
  config: DemoConfig,
  team: DemoTeam,
  teamIndex: number // 1-17
) {
  for (let i = 0; i < 18; i++) {
    await injectTeamHole(supabase, config, team, (teamIndex + i) % 18);
    if (i < 17) await sleep(HOLE_DELAY_MS);
  }
  console.log(`[background] Team ${team.name} complete`);
}

export async function runBackgroundTeams(config: DemoConfig): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // config.teams[0] is the foreground team; teams 1-17 are background
  const backgroundTeams = config.teams.slice(1);
  await Promise.all(
    backgroundTeams.map((team, idx) => runTeam(supabase, config, team, idx + 1))
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit --skipLibCheck scripts/demo/background.ts 2>&1 | head -20
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/demo/background.ts
git commit -m "feat: background team score + GPS injector for kiosk demo"
```

---

### Task 7: Foreground Playwright controller

**Files:**
- Create: `scripts/demo/foreground.ts`

**Interfaces:**
- Consumes: `DemoConfig` from `./types`; `generateScore` from `./score-gen`; `generateShots` from `./gps-gen`
- Produces: `runForeground(config: DemoConfig): Promise<void>` — launches TV window (left) + phone window (right), logs in as demo captain, drives round scoring for Team 1 through holes 1-18

**UI interaction details:**
- Login: fill `#email`, fill `#password`, click `button[type="submit"]`
- Club selector: `page.getByRole('combobox').click()` → `page.getByRole('option', { name: '...' }).click()`
- Shot buttons: `page.getByRole('button', { name: 'In Play' })`, `page.getByRole('button', { name: /Sunk/ })`
- Next hole: `page.getByRole('button', { name: 'Next Hole →' })`
- The captain (active player by default) records all shots; other 3 players' scores injected to DB after captain sinks

- [ ] **Step 1: Create `scripts/demo/foreground.ts`**

```typescript
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import type { DemoConfig } from './types';
import { generateScore } from './score-gen';
import { generateShots } from './gps-gen';

dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

const SHOT_DELAY_MS = 5_000;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const DEMO_CAPTAIN_EMAIL = 'demo-captain@fdgolf.demo';
const DEMO_CAPTAIN_PASSWORD = 'DemoKiosk2026!';

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

async function injectOtherPlayers(
  supabase: ReturnType<typeof createClient>,
  config: DemoConfig,
  teamId: string,
  holeIdx: number,
  otherPlayers: Array<{ id: string; name: string }>
) {
  const hole = config.holes[holeIdx];
  const scores = otherPlayers.map(() => generateScore(hole.par));

  const scoreRows = otherPlayers.map((player, idx) => ({
    player_id: player.id,
    team_id: teamId,
    tournament_id: config.tournamentId,
    hole_number: hole.holeNumber,
    strokes: scores[idx],
    is_best_ball: false,
    override_by: null,
    override_at: null,
  }));

  await (supabase as any)
    .from('scores')
    .upsert(scoreRows, { onConflict: 'player_id,tournament_id,hole_number' });

  const shots = generateShots(config.tournamentId, hole, otherPlayers, scores, config.clubs);
  if (shots.length > 0) {
    await (supabase as any).from('shots').insert(shots);
  }

  await (supabase as any).functions
    .invoke('calculate-best-ball', {
      body: { tournament_id: config.tournamentId, team_id: teamId, hole_number: hole.holeNumber },
    })
    .catch(() => {});
}

export async function runForeground(config: DemoConfig): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const foregroundTeam = config.teams[0];
  const otherPlayers = foregroundTeam.players.slice(1);

  // TV window (left)
  const tvBrowser = await chromium.launch({
    headless: false,
    args: ['--window-position=0,60', '--window-size=1270,980'],
  });
  const tvPage = await tvBrowser.newPage();
  await tvPage.goto(`${BASE_URL}/live/lionhead-legends-demo/tv`);

  // Phone window (right)
  const phoneBrowser = await chromium.launch({
    headless: false,
    args: ['--window-position=1280,60', '--window-size=390,844'],
  });
  const phonePage = await phoneBrowser.newPage();
  await phonePage.setViewportSize({ width: 390, height: 844 });

  // Log in as demo captain
  await phonePage.goto(`${BASE_URL}/login`);
  await phonePage.fill('#email', DEMO_CAPTAIN_EMAIL);
  await phonePage.fill('#password', DEMO_CAPTAIN_PASSWORD);
  await phonePage.click('button[type="submit"]');
  await phonePage.waitForURL(/dashboard|round/, { timeout: 15_000 });

  // Navigate to round page (creates round_state from starting_hole=1)
  await phonePage.goto(`${BASE_URL}/round`);
  await phonePage.waitForSelector('text=Hole 1', { timeout: 15_000 });

  for (let holeIdx = 0; holeIdx < 18; holeIdx++) {
    const hole = config.holes[holeIdx];
    const captainScore = generateScore(hole.par);

    // Wait for current hole to be visible
    await phonePage.waitForSelector(`text=Hole ${hole.holeNumber}`, { timeout: 10_000 });

    // Select opening club
    const openingClub = hole.par === 3 ? '9 Iron' : 'Driver';
    await phonePage.getByRole('combobox').click();
    await phonePage.getByRole('option', { name: openingClub }).click();

    // Record each shot
    for (let shot = 1; shot <= captainScore; shot++) {
      const isLast = shot === captainScore;

      if (shot > 1) {
        const nextClub = isLast ? 'Putter' : '7 Iron';
        await phonePage.getByRole('combobox').click();
        await phonePage.getByRole('option', { name: nextClub }).click();
      }

      if (isLast) {
        await phonePage.getByRole('button', { name: /Sunk/ }).click();
      } else {
        await phonePage.getByRole('button', { name: 'In Play' }).click();
      }

      await sleep(SHOT_DELAY_MS);
    }

    // Inject other 3 players' scores to DB while captain's sunk is processing
    await injectOtherPlayers(supabase, config, foregroundTeam.id, holeIdx, otherPlayers);

    // Advance to next hole
    await phonePage.waitForSelector('text=Next Hole →', { timeout: 10_000 });
    await phonePage.getByRole('button', { name: 'Next Hole →' }).click();
    await sleep(1_000);
  }

  // Round complete — app redirects to /leaderboard
  await phonePage.waitForURL(/leaderboard/, { timeout: 15_000 });
  console.log('[foreground] Round complete');

  // Store browser refs for run.ts to close on next loop iteration
  (runForeground as any).__browsers = { tvBrowser, phoneBrowser };
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit --skipLibCheck scripts/demo/foreground.ts 2>&1 | head -20
```

Expected: no type errors. If Playwright types are missing, run:
```bash
npm install --save-dev playwright
```

- [ ] **Step 3: Commit**

```bash
git add scripts/demo/foreground.ts
git commit -m "feat: foreground Playwright controller — TV + phone windows, round scoring for kiosk demo"
```

---

### Task 8: Orchestrator

**Files:**
- Create: `scripts/demo/run.ts`

**Interfaces:**
- Consumes: `seedLionhead` from `./seed-lionhead`; `runBackgroundTeams` from `./background`; `runForeground` from `./foreground`; `DemoConfig` from `./types`
- Entry point: `npx tsx scripts/demo/run.ts` — runs forever until Ctrl+C

**Loop:**
1. `seedLionhead()` — idempotent, safe to call on every restart
2. `resetTournament()` — wipes scores, shots, round_states; sets status → `'active'`
3. `runBackgroundTeams()` — fire-and-forget (no await)
4. `runForeground()` — awaited; drives simulation pace
5. `waitForCompletion()` — polls score count every 10s; when 1,296 rows → sets status → `'completed'`
6. `waitForRestart()` — polls status every 10s; returns when status becomes `'active'` again
7. Close browsers; loop back to step 2

- [ ] **Step 1: Create `scripts/demo/run.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { seedLionhead } from './seed-lionhead';
import { runBackgroundTeams } from './background';
import { runForeground } from './foreground';
import type { DemoConfig } from './types';

dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

const POLL_INTERVAL_MS = 10_000;
const COMPLETION_TARGET = 1296; // 18 teams × 18 holes × 4 players

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!serviceKey) {
  console.error('[run] SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

async function resetTournament(tournamentId: string) {
  console.log('[run] Resetting tournament…');

  const { data: tp } = await (supabase as any)
    .from('tournament_players').select('player_id').eq('tournament_id', tournamentId);
  const playerIds = (tp ?? []).map((r: { player_id: string }) => r.player_id);
  if (playerIds.length > 0) {
    await (supabase as any).from('shots').delete().in('player_id', playerIds);
  }

  await (supabase as any).from('scores').delete().eq('tournament_id', tournamentId);

  const { data: teams } = await (supabase as any)
    .from('teams').select('id').eq('tournament_id', tournamentId);
  const teamIds = (teams ?? []).map((r: { id: string }) => r.id);
  if (teamIds.length > 0) {
    await (supabase as any).from('round_states').delete().in('team_id', teamIds);
  }

  await (supabase as any).from('tournaments').update({ status: 'active' }).eq('id', tournamentId);
  console.log('[run] Tournament reset — status: active');
}

async function waitForCompletion(tournamentId: string): Promise<void> {
  console.log(`[run] Waiting for ${COMPLETION_TARGET} score rows…`);
  while (true) {
    await sleep(POLL_INTERVAL_MS);
    const { count } = await (supabase as any)
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);

    console.log(`[run] Score count: ${count ?? 0} / ${COMPLETION_TARGET}`);

    if ((count ?? 0) >= COMPLETION_TARGET) {
      await (supabase as any)
        .from('tournaments').update({ status: 'completed' }).eq('id', tournamentId);
      console.log('[run] Tournament completed — restart overlay visible on TV');
      return;
    }
  }
}

async function waitForRestart(tournamentId: string): Promise<void> {
  console.log('[run] Waiting for restart signal…');
  while (true) {
    await sleep(POLL_INTERVAL_MS);
    const { data } = await (supabase as any)
      .from('tournaments').select('status').eq('id', tournamentId).single();
    if (data?.status === 'active') {
      console.log('[run] Restart signal received');
      return;
    }
  }
}

async function closeBrowsers() {
  const browsers = (runForeground as any).__browsers;
  if (browsers) {
    await browsers.tvBrowser?.close().catch(() => {});
    await browsers.phoneBrowser?.close().catch(() => {});
    (runForeground as any).__browsers = null;
  }
}

async function main() {
  console.log('[run] Starting kiosk demo…');
  const config: DemoConfig = await seedLionhead();

  while (true) {
    await resetTournament(config.tournamentId);

    // Background teams run concurrently with foreground
    const backgroundPromise = runBackgroundTeams(config);

    // Foreground drives the pace — await it
    await runForeground(config);

    // Wait for any lagging background inserts
    await backgroundPromise;

    // Poll until all 1,296 scores are present
    await waitForCompletion(config.tournamentId);

    // Wait for TV restart button or 10-min auto-restart countdown
    await waitForRestart(config.tournamentId);

    await closeBrowsers();
    console.log('[run] Loop complete — starting next iteration…');
  }
}

main().catch((err) => {
  console.error('[run] Fatal error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit --skipLibCheck scripts/demo/run.ts 2>&1 | head -20
```

Expected: no type errors.

- [ ] **Step 3: Run full Jest suite**

```bash
npm run test:ci
```

Expected: all passing, coverage ≥80%.

- [ ] **Step 4: Run full type check on the app**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/demo/run.ts
git commit -m "feat: kiosk demo orchestrator — seed, reset, foreground+background loop, completion watcher"
```

---

## Self-Review Checklist

Spec coverage verified:

1. ✅ `is_demo` migration — Task 2
2. ✅ `Tournament.is_demo` type — Task 2
3. ✅ `POST /api/demo/restart` — Task 2
4. ✅ TV restart overlay with 10-min countdown — Task 3
5. ✅ TV polls tournament.status every 10s — Task 3
6. ✅ Demo types (DemoHole, DemoPlayer, DemoTeam, DemoConfig) — Task 4
7. ✅ Score generation par+0 to par+4 — Task 4
8. ✅ GPS shot injection (start_lat/start_lng, progress-based) — Task 4
9. ✅ Lionhead seed (venue, course, 18 holes, tee boxes, 18 teams, 72 players, tournament) — Task 5
10. ✅ Background team injector (teams 2-18, shotgun start pacing, 20s per hole) — Task 6
11. ✅ Foreground Playwright (TV window left + phone window right) — Task 7
12. ✅ Orchestrator (seed → reset → background+foreground → completion → restart loop) — Task 8
13. ✅ E2E global-setup role fix (`'admin'` → `'system_admin'`) — Task 1
14. ✅ Tournament admin E2E user + assignment row — Task 1
15. ✅ TC-0047 updated (9 sidebar links) — Task 1
16. ✅ TC-0090 through TC-0095 — Task 1
17. ✅ Demo captain auth account (`demo-captain@fdgolf.demo`) — Task 5
18. ✅ Completion target 1,296 rows — Task 8
19. ✅ Restart polling (orchestrator waits for status → 'active') — Task 8
20. ✅ round_states cleared on reset — Task 8 (`resetTournament`)
