# Tournament Lifecycle E2E Test — Design Spec

**Date:** 2026-06-18  
**Status:** Approved  
**Author:** Kamal Syed + Claude Code  

---

## Overview

A full-browser Playwright E2E test (`tournament-lifecycle.spec.ts`) that walks through the complete tournament lifecycle using real local Supabase data. Covers: create venue → course → holes → tournament → activate → teams → players → simulate 2 teams scoring → verify leaderboard.

Accompanied by a wipe-and-reset script (`scripts/reset-lionhead.ts`) that wipes all Lionhead test data and re-seeds baseline player auth accounts for clean re-runs.

---

## Goals

- Prove the full admin setup flow works end-to-end in a real browser against a live local DB
- Prove 2 player sessions can independently score holes and the leaderboard reflects correct rankings
- Provide a repeatable manual-testing baseline via the reset script
- Leave all created data in the DB for post-run inspection in Supabase Studio

---

## Out of Scope

- Tee box GPS coordinate editing (tested in course-holes E2E separately)
- Shot GPS capture (Playwright can't simulate geolocation meaningfully here)
- CSV player import edge cases (covered in `admin.spec.ts`)
- Real-time leaderboard Supabase Realtime updates (page reload is sufficient for assertion)

---

## Fixtures — Lionhead Golf Club

All test entities use these exact values. The reset script uses these same values to identify and delete test data.

### Venue
| Field | Value |
|---|---|
| Name | Lionhead Golf Club |
| Address | 8525 Mississauga Rd |
| City | Brampton |
| Province | ON |
| Postal code | L6Y 0C3 |
| Country | CA |

### Course
| Field | Value |
|---|---|
| Name | Legends Course |
| Venue | Lionhead Golf Club |
| Holes | 18 |
| Par total | 72 |
| Course rating | 73.2 |
| Slope rating | 135 |

### Holes
Generated via "Generate 18 Holes" button (all default to par 4, total par 72). Individual par values are not edited during the test — par 4 × 18 = 72 is sufficient for meaningful vs-par scoring.

### Tournament
| Field | Value |
|---|---|
| Name | Lionhead Spring Classic 2026 |
| Slug | `lionhead-spring-classic-2026` |
| Venue | Lionhead Golf Club |
| Course | Legends Course |
| Date | 2026-06-22 |
| Format | Best Ball |
| Holes played | 18 |
| Initial status | setup (activated in test step 6) |

### Teams
| Team | Starting hole |
|---|---|
| Team Alpha | 1 |
| Team Beta | 10 |

### Test Players
| Field | Player A | Player B |
|---|---|---|
| Name | Alex Lion | Blake Lion |
| Email | `e2e-lion-a@fdgolf.test` | `e2e-lion-b@fdgolf.test` |
| Password | `E2eLionA789!` | `E2eLionB789!` |
| Team | Team Alpha | Team Beta |
| Role | player | player |

### Simulated Scores (holes 1–3 only)
| | Hole 1 (par 4) | Hole 2 (par 4) | Hole 3 (par 4) | Total vs par |
|---|---|---|---|---|
| Team Alpha (Player A) | 3 (birdie) | 3 (birdie) | 4 (par) | **-2** |
| Team Beta (Player B) | 5 (bogey) | 5 (bogey) | 5 (bogey) | **+3** |

Expected leaderboard: Team Alpha #1 (-2), Team Beta #2 (+3).

---

## Architecture

### Test File
`tests/e2e/tournament-lifecycle.spec.ts`

### Execution Model
`test.describe.serial()` — all steps run in order. A failure in any step halts the remaining steps. This is intentional: subsequent steps depend on prior state.

### Browser Contexts
Three contexts created within the single spec:

| Context | Session | Used for |
|---|---|---|
| `adminPage` | Admin storageState (from `admin-setup` dependency) | Steps 2–8, 12 |
| `teamAPage` | Fresh context, logs in as `e2e-lion-a@fdgolf.test` | Step 10 |
| `teamBPage` | Fresh context, logs in as `e2e-lion-b@fdgolf.test` | Step 11 |

### Playwright Config Addition
New project in `playwright.config.ts`:
```ts
{
  name: 'chromium-lifecycle',
  testMatch: '**/tournament-lifecycle.spec.ts',
  use: { ...desktopDevice },
  dependencies: ['admin-setup'],
}
```

The `admin-setup` dependency ensures the admin storageState is available before the lifecycle test runs. It skips itself if `SUPABASE_SERVICE_ROLE_KEY` is absent (same guard as other admin tests).

---

## Test Steps

### beforeAll — Seed player auth accounts

Uses Supabase service-role client (same pattern as `global-setup.ts`).

1. Check if `e2e-lion-a@fdgolf.test` exists in `auth.users`; create with `email_confirm: true` if not
2. Check if `e2e-lion-b@fdgolf.test` exists; create if not
3. Upsert player profiles in `players` table with `auth_user_id` linked, `role: 'player'`, no `team_id` yet
4. Store both `userId`s for later use

The `auth_user_id` → player profile link is what allows the round page to find the player when they log in. CSV import alone cannot establish this link (it creates a profile without `auth_user_id`).

### Step 2 — Admin creates venue

- Navigate to `/admin/venues`
- Click `+ Add Venue`
- Fill: Name = "Lionhead Golf Club", Address = "8525 Mississauga Rd", City = "Brampton", Province = "ON", Postal = "L6Y 0C3"
- Click `Add Venue`
- **Assert:** Toast "Venue added." visible; row "Lionhead Golf Club" appears in table

### Step 3 — Admin creates course

- Navigate to `/admin/courses`
- Click `+ Add Course`
- Select venue "Lionhead Golf Club" from Radix Select
- Fill: Name = "Legends Course", Par total = 72, Course rating = 73.2, Slope = 135
- Click `Add Course`
- **Assert:** Toast "Course added." visible; row "Legends Course — Lionhead Golf Club" appears
- **State capture:** Click `Holes →` on the new row → URL becomes `/admin/courses/[courseId]/holes`; capture `courseId` from URL

### Step 4 — Admin generates holes

- Already on `/admin/courses/[courseId]/holes` (navigated by clicking `Holes →`)
- Click `Generate 18 Holes`
- **Assert:** Toast "Generated 18 holes" visible; hole grid with 18 rows appears

### Step 5 — Admin creates tournament

- Navigate to `/admin/tournament`
- Click `+ Add Tournament`
- Fill Name = "Lionhead Spring Classic 2026" (slug auto-populates)
- Select Venue = "Lionhead Golf Club" (Radix Select)
- Select Course = "Legends Course" (Radix Select, enabled after venue selected)
- Fill Date = "2026-06-22"
- Leave Format = "Best Ball", Holes = 18
- Click `Create Tournament`
- **Assert:** Toast "Tournament created" visible; row with "Lionhead Spring Classic 2026" and "Setup" badge appears

### Step 6 — Admin activates tournament

- On `/admin/tournament` page (tournament list view)
- Click Edit (pencil icon) on "Lionhead Spring Classic 2026"
- Change Status dropdown to "Active"
- Click `Save Changes`
- **Assert:** Badge changes to "Active"

### Step 7 — Admin creates teams

- Navigate to `/admin/teams`
- Click `+ Add Team`
- Fill Team Name = "Team Alpha", Starting Hole = 1
- Click `Add Team`
- **Assert:** "Team Alpha" row appears

- Click `+ Add Team`
- Fill Team Name = "Team Beta", Starting Hole = 10
- Click `Add Team`
- **Assert:** "Team Beta" row appears

### Step 8 — Admin imports players via CSV

- Navigate to `/admin/players`
- Click `Import CSV`
- Upload CSV:
  ```
  name,email,company,team
  Alex Lion,e2e-lion-a@fdgolf.test,Lionhead,Team Alpha
  Blake Lion,e2e-lion-b@fdgolf.test,Lionhead,Team Beta
  ```
- **Assert:** Preview shows "2 valid"
- Click `Import 2 Players`
- **Assert:** "2 imported" result visible

### Post-import auth link (service-role, mid-test)

After the CSV import creates player profiles, link `auth_user_id` on both:
```
UPDATE players SET auth_user_id = '<userId>' WHERE email = 'e2e-lion-a@fdgolf.test'
UPDATE players SET auth_user_id = '<userId>' WHERE email = 'e2e-lion-b@fdgolf.test'
```
Uses the `userId` values captured in `beforeAll`. This step runs in the test body (not `beforeAll`) because the player profiles don't exist until after step 8.

### Step 10 — Team Alpha player scores holes 1–3

New browser context (`teamAPage`), no pre-loaded storageState.

- Navigate to `/login`
- Fill email = `e2e-lion-a@fdgolf.test`, password = `E2eLionA789!`
- Click `Sign In`
- **Assert:** URL becomes `/dashboard`
- Navigate to `/round`
- **Assert:** Round page loads, hole 1 visible, "Alex" player pill active
- **Hole 1 (target: 3 strokes = birdie):**
  - Select "Driver" from club selector
  - Click "In Play" → shot 1 recorded
  - Select "7 Iron" from club selector
  - Click "In Play" → shot 2 recorded
  - Select "Putter" from club selector
  - Click "Sunk!" → hole complete (3 strokes)
- **Assert:** Hole advances to hole 2
- **Hole 2 (target: 3 strokes):** repeat same sequence
- **Hole 3 (target: 4 strokes = par):**
  - Select "Driver" → "In Play"
  - Select "7 Iron" → "In Play"
  - Select "9 Iron" → "In Play"
  - Select "Putter" → "Sunk!"
- **Assert:** Hole advances to hole 4

### Step 11 — Team Beta player scores holes 10–12

New browser context (`teamBPage`).

- Login as `e2e-lion-b@fdgolf.test` / `E2eLionB789!`
- Navigate to `/round`
- **Assert:** Hole 10 visible (round page initialises at `starting_hole = 10` for Team Beta)
- **Holes 10–12 (target: 5 strokes each = bogey):**
  - Each hole: Driver → In Play, 7 Iron → In Play, 9 Iron → In Play, Putter → In Play, Putter → Sunk! (5 shots)
- **Assert:** Hole advances after each Sunk!

### Step 12 — Leaderboard verification

Using `adminPage` context:

- Navigate to `/leaderboard`
- Wait for leaderboard to load
- **Assert:** "Team Alpha" row visible
- **Assert:** "Team Beta" row visible
- **Assert:** "Team Alpha" row appears before "Team Beta" row in the DOM (rank 1 above rank 2)
- **Assert:** Team Alpha score shows `-2` (or "−2")
- **Assert:** Team Beta score shows `+3`

---

## Reset Script

**File:** `scripts/reset-lionhead.ts`  
**Run:** `npx tsx scripts/reset-lionhead.ts`  
**Requires:** `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

### What it does (in order)

1. Delete shots where `tournament_id` matches any Lionhead tournament
2. Delete scores where `tournament_id` matches
3. Delete round_states where `tournament_id` matches
4. Delete tournaments where `slug = 'lionhead-spring-classic-2026'`
5. Delete teams where `name IN ('Team Alpha', 'Team Beta')` and `tournament_id` was Lionhead
6. Delete player profiles where `email IN ('e2e-lion-a@fdgolf.test', 'e2e-lion-b@fdgolf.test')`
7. Delete auth users for those emails
8. Delete holes where `course_id` matches Legends Course
9. Delete courses where `name = 'Legends Course'` and venue is Lionhead
10. Delete venues where `name = 'Lionhead Golf Club'`
11. Re-seed: create auth users for both test players (email_confirm: true)
12. Re-seed: create player profiles with `auth_user_id` linked, no `team_id`

After running, the DB is ready for a fresh E2E test run or manual testing via the admin UI.

### What it does NOT touch

- CIBC Capital Markets / Granite Ridge tournament and all its data
- The `e2e-player@fdgolf.test` and `e2e-admin@fdgolf.test` accounts used by other E2E tests
- Any real player data

---

## Files to Create / Modify

| File | Action |
|---|---|
| `tests/e2e/tournament-lifecycle.spec.ts` | Create |
| `scripts/reset-lionhead.ts` | Create |
| `playwright.config.ts` | Modify — add `chromium-lifecycle` project |

No changes to `global-setup.ts`, `fixtures.ts`, or any existing test files.

---

## Acceptance Criteria

- [ ] `npx playwright test tests/e2e/tournament-lifecycle.spec.ts` passes all 10 steps against local Supabase
- [ ] After the test, Supabase Studio shows: Lionhead venue, Legends Course, 18 holes, Lionhead Spring Classic tournament (Active), Team Alpha + Team Beta, 2 players, scores for holes 1–3 for each team
- [ ] `/leaderboard` in the browser shows Team Alpha ranked above Team Beta
- [ ] `npx tsx scripts/reset-lionhead.ts` completes without errors and leaves no Lionhead data in the DB
- [ ] Running `npx tsx scripts/reset-lionhead.ts` then `npx playwright test tests/e2e/tournament-lifecycle.spec.ts` succeeds on a second run
- [ ] No CIBC / Granite Ridge data is modified at any point
