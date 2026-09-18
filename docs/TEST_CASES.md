# FDgolf — Test Cases

> CIBC Capital Markets Golf Tournament App — Granite Ridge Golf Club, June 22, 2026
>
> Format: PlanVisualizer TC-XXXX. Status starts as `[ ] Not Run`; update to `[x] Pass` or `[x] Fail` after execution.
> All test cases reference ACs from `docs/RELEASE_PLAN.md`.

---

## EPIC-0001 — Project Setup & Infrastructure

TC-0130: Next.js dev server runs (App Router)
Related Story: US-0001
Related Task: TASK-0001
Related AC: AC-0001
Type: Functional
Preconditions: Dependencies installed (`npm install`); `.env.local` populated.
Steps:
  1. Run `npm run dev`
  2. Open http://localhost:3000
Expected Result: Server starts without error and the homepage renders. Note: the AC text says "Next.js 14"; the installed version is `next@^16.3.3` (package.json) — verify against current App Router behavior, not the literal v14 wording.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0131: Tailwind CSS classes render correctly
Related Story: US-0001
Related Task: TASK-0001
Related AC: AC-0002
Type: Functional
Preconditions: Dev server running (TC-0130).
Steps:
  1. Open any page (e.g. /login)
  2. Inspect an element using a Tailwind utility class (e.g. a button with `bg-[#1a472a]`)
Expected Result: Tailwind v3.4.1 utility classes (configured in `tailwind.config.ts`, scanning `src/app|components|pages`, entry `src/app/globals.css`) apply their computed styles in the browser.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0132: shadcn/ui Button component renders without errors
Related Story: US-0001
Related Task: TASK-0002
Related AC: AC-0003
Type: Functional
Preconditions: Dev server running.
Steps:
  1. Navigate to any page that renders a `Button` from `src/components/ui/button.tsx` (e.g. /login "Sign In" button)
Expected Result: Button renders with the shadcn "default" style variant (per `components.json`, `cssVariables: true`) with no console errors.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0133: Supabase browser client connects (anon key)
Related Story: US-0002
Related Task: TASK-0003
Related AC: AC-0004
Type: Integration
Preconditions: `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`; Supabase reachable.
Steps:
  1. Run `npm run precheck` (`scripts/precheck-env.ts`)
  2. Check the AC-0004 line in its output
Expected Result: `src/lib/supabase/client.ts`'s `createClient()` (wraps `createBrowserClient`) connects successfully; precheck prints `[PASS] AC-0004: Supabase browser client (anon key) connects`.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0134: Supabase server client works in Server Components
Related Story: US-0002
Related Task: TASK-0003
Related AC: AC-0005
Type: Integration
Preconditions: Same as TC-0133; service role key present.
Steps:
  1. Run `npm run precheck` and check the AC-0005 line
  2. Load an SSR page that fetches via `src/lib/supabase/server.ts` (e.g. /admin/tournament)
Expected Result: `server.ts`'s async `createClient()` (uses `createServerClient` + `cookies()` from `next/headers`) connects and returns data server-side; precheck prints `[PASS] AC-0005`.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0135: .env.local.example documents required env vars
Related Story: US-0002
Related Task: TASK-0003
Related AC: AC-0006
Type: Functional
Preconditions: None.
Steps:
  1. Open `.env.local.example`
  2. Run `npm run precheck` and check the AC-0006 line
Expected Result: File lists all 4 required vars — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`; precheck prints `[PASS] AC-0006`.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0136: All 9 core tables exist in the schema
Related Story: US-0003
Related Task: TASK-0004
Related AC: AC-0007
Type: Integration
Preconditions: Migrations 001–013 applied to the target Supabase instance.
Steps:
  1. Run `npm run precheck` and check the AC-0007 line (probes `tournaments`, `holes`, `players`, `teams`, `clubs`, `round_state`, `shots`, `scores`, `sponsors` directly if `information_schema` isn't exposed)
Expected Result: All 9 tables from `001_initial_schema.sql` are present and reachable via PostgREST; precheck prints `[PASS] AC-0007`. Note: the schema has drifted since migration 001 (e.g. `007_master_data_hierarchy.sql` added `venues`/`courses`/`tee_boxes`; `011_tournament_players.sql` added `tournament_players` and dropped `players.team_id` — see BUG-0011) — this check only verifies the original 9 tables still exist, not that no columns moved.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0137: RLS policies enforce player vs admin separation
Related Story: US-0003
Related Task: TASK-0004
Related AC: AC-0008
Type: Integration
Preconditions: RLS enabled per migration 001, patched by `004_fix_admin_rls.sql` / `005_scores_player_rls.sql`.
Steps:
  1. Run `npm run precheck` and check the AC-0008 line (queries `scores` with the anon/unauthenticated client)
  2. Sign in as a player and confirm they can only read their own team's rows via the app UI
Expected Result: The anon client's `select` on `scores` returns either an error or zero rows (never all rows); precheck prints `[PASS] AC-0008`. Admin-authenticated requests retain full access per the "Admin full access" policies.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0138: Realtime enabled on the scores table
Related Story: US-0003
Related Task: TASK-0004
Related AC: AC-0009
Type: Integration
Preconditions: `alter publication supabase_realtime add table scores;` applied (migration 001, line 206).
Steps:
  1. Run `npm run precheck` and check the AC-0009 line
  2. Manually verify in the Supabase dashboard → Database → Replication that `scores` is listed under the `supabase_realtime` publication
  3. Optionally, open the leaderboard in two browser sessions and confirm a score update in one propagates to the other via `useRealtimeScores`
Expected Result: `scores` is reachable via REST (precheck prints `[PASS] AC-0009`, noting live websocket verification must be done manually — the script deliberately avoids opening a realtime subscription itself, since supabase-js's realtime client can crash under some Node/undici versions); the Replication page shows `scores` enabled; realtime updates propagate within the 5s debounce window.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0139: Unique constraints prevent duplicate entries
Related Story: US-0003
Related Task: TASK-0004
Related AC: AC-0010
Type: Negative
Preconditions: Direct DB/service-role access (e.g. via Supabase SQL editor or the service-role client).
Steps:
  1. Attempt to insert a second `tournaments` row with a duplicate `slug`
  2. Attempt to insert a duplicate `holes` row for the same `(tournament_id, hole_number)`
  3. Attempt to insert a duplicate `teams` row for the same `(tournament_id, team_number)`
  4. Attempt to insert a duplicate `scores` row for the same `(player_id, tournament_id, hole_number)`
Expected Result: Each insert is rejected with a unique-constraint violation. Note: constraints were defined against the migration-001 schema; `players.team_id` no longer exists post-migration-011 (see BUG-0011) — re-verify the exact current constraint list rather than assuming migration 001 is still literal.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0140: Hole map renders with satellite view centered on pin coordinates
Related Story: US-0005
Related Task: TASK-0014
Related AC: AC-0013
Type: Functional
Preconditions: `NEXT_PUBLIC_MAPBOX_TOKEN` set; player signed in with an active round.
Steps:
  1. Navigate to /round for a hole with `pin_lat`/`pin_lng` set
  2. Observe the map component (`src/components/hole-map.tsx`)
Expected Result: Map renders using `react-map-gl/mapbox` with `mapStyle="mapbox://styles/mapbox/satellite-v9"`, centered on the hole's pin coordinates. Note: AC text says "Google Maps" — the actual implementation is Mapbox; test against the real Mapbox behavior.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0141: Pin marker displays at hole location
Related Story: US-0005
Related Task: TASK-0014
Related AC: AC-0014
Type: Functional
Preconditions: Same as TC-0140.
Steps:
  1. Open /round for any hole
  2. Locate the pin marker on the map
Expected Result: A green pin marker (`fill="#16a34a"`) renders at the hole's `pin_lat`/`pin_lng` position in `hole-map.tsx`.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0142: Shot/position markers update on GPS capture
Related Story: US-0005
Related Task: TASK-0014
Related AC: AC-0015
Type: Functional
Preconditions: Browser geolocation permission granted; player mid-round.
Steps:
  1. Record a shot with outcome "in_play" via GPS capture
  2. Record additional shots with other outcomes (e.g. "out_of_bounds", "mulligan", "sunk")
Expected Result: Each shot renders as a colored marker on the map, colored by outcome — `in_play:#2563eb`, `out_of_bounds:#dc2626`, `mulligan:#f97316`, `sunk:#ca8a04` — updating live as new shots are captured.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0143: 21 clubs seeded across 5 categories
Related Story: US-0006
Related Task: TASK-0005
Related AC: AC-0016
Type: Integration
Preconditions: `supabase/seed.sql` applied.
Steps:
  1. Run `npm run precheck` and check the AC-0016 line
Expected Result: `clubs` table has ≥21 rows with category/sort_order set; precheck prints `[PASS] AC-0016: Clubs seeded`.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0144: 18 holes seeded with par values and approximate GPS
Related Story: US-0006
Related Task: TASK-0005
Related AC: AC-0017
Type: Integration
Preconditions: Same as TC-0143.
Steps:
  1. Run `npm run precheck` and check the AC-0017 line
Expected Result: `holes` table has ≥18 rows, each with `par` and `pin_lat`/`pin_lng` populated (Granite Ridge course data); precheck prints `[PASS] AC-0017`.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0145: Tournament record created for CIBC 2026 event
Related Story: US-0006
Related Task: TASK-0005
Related AC: AC-0018
Type: Integration
Preconditions: Same as TC-0143.
Steps:
  1. Run `npm run precheck` and check the AC-0018 line
  2. Confirm the tournament row: name `'CIBC Capital Markets Golf Tournament 2026'`, slug `cibc-granite-ridge-2026`, date `2026-06-22`, format `best_ball`
Expected Result: At least one tournament row exists; precheck prints `[PASS] AC-0018`; the CIBC 2026 record matches the seed values above.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0146: Full header shows branding + AI/Run™ pill
Related Story: US-0007
Related Task: TASK-0007
Related AC: AC-0019
Type: Functional
Preconditions: None.
Steps:
  1. Open a page rendering `AppHeader` in its full variant (`variant="full"`)
Expected Result: Header shows the `"FDgolf-CM"` wordmark and a green `"AI/Run™"` pill on a `bg-[#1a472a]` background. Note: AC text says `"FDgolf | created by AI/Run™"` — the actual rendered strings are `"FDgolf-CM"` plus a separate `"AI/Run™"` pill; test against the real strings, not the AC wording.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0147: Compact header shows condensed branding + hole info
Related Story: US-0007
Related Task: TASK-0007
Related AC: AC-0020
Type: Functional
Preconditions: Player mid-round (compact header shows `holeInfo`).
Steps:
  1. Navigate to /round
  2. Observe the compact `AppHeader` (`variant="compact"`)
Expected Result: Header shows `"FDgolf-CM"`, a green pulse dot, and hole/par/handicap chips driven by the `holeInfo` prop.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0148: Dark green (#1a472a) consistent across header variants
Related Story: US-0007
Related Task: TASK-0007
Related AC: AC-0021
Type: Functional
Preconditions: None.
Steps:
  1. Inspect `AppHeader` in both `full` and `compact` variants
Expected Result: Both variants use `bg-[#1a472a]` for the header background.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0149: Writes enqueue to localStorage regardless of connectivity
Related Story: US-0008
Related Task: TASK-0006
Related AC: AC-0022
Type: Functional
Preconditions: None (works offline or online).
Steps:
  1. Go offline (DevTools → Network → Offline)
  2. Record a shot
Expected Result: `syncEngine.enqueue()` pushes `{id, table, payload, created_at, retries}` into the `fdgolf-cm_sync_queue` localStorage key (constant `QUEUE_KEY` in `src/lib/sync-engine.ts`) regardless of `navigator.onLine`.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0150: Queue flushes automatically when online
Related Story: US-0008
Related Task: TASK-0006
Related AC: AC-0023
Type: Functional
Preconditions: One or more items queued while offline (TC-0149).
Steps:
  1. While offline with queued items, go back online
Expected Result: `flush()` runs (it only no-ops when `!navigator.onLine`); queued items are POSTed and cleared from the queue.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0151: Failed writes retry up to 5 times
Related Story: US-0008
Related Task: TASK-0006
Related AC: AC-0024
Type: Negative
Preconditions: Mock/force the outbound POST to fail repeatedly (see `mockShotsApi(page, { fail: true })` in the E2E helpers).
Steps:
  1. Queue a write and force its POST to fail on every flush attempt
  2. Observe the item's `retries` counter across repeated flush cycles
Expected Result: The item's `retries` increments on each failed flush; once `retries >= 5`, `flush()` drops the item from the queue instead of retrying indefinitely.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0152: Offline indicator shows pending count
Related Story: US-0008
Related Task: TASK-0006
Related AC: AC-0025
Type: Functional
Preconditions: Player offline with queued writes.
Steps:
  1. Go offline
  2. Record 2–3 shots
  3. Observe the offline indicator in the UI
Expected Result: The indicator reflects `syncEngine.pendingCount`, updating as items are enqueued/flushed (see `round-scoring.spec.ts` TC-0026/TC-0064 for the E2E behavior, fixed under BUG-0007).
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0153: Online event triggers immediate flush
Related Story: US-0008
Related Task: TASK-0006
Related AC: AC-0026
Type: Functional
Preconditions: Items queued while offline.
Steps:
  1. While offline with queued items, trigger the browser's `online` event (e.g. reconnect network)
Expected Result: `startAutoSync()`'s `window.addEventListener('online', ...)` handler fires and calls `flush()` immediately, without waiting for the 10s polling interval.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0162: Reset script wipes and re-seeds Lionhead E2E fixture data
Related Story: US-0038
Related Task: TASK-0036
Related AC: AC-0128
Type: Integration
Preconditions: `scripts/reset-lionhead.ts` present; local Supabase reachable.
Steps:
  1. Run `npx tsx scripts/reset-lionhead.ts` twice in a row
Expected Result: Both runs succeed — the script cascade-deletes shots → scores → round_states → teams → tournaments for slug `lionhead-spring-classic-2026`, deletes/reseeds the 2 Supabase auth users (`e2e-lion-a@fdgolf.test` / `e2e-lion-b@fdgolf.test`), and is idempotent (the second run does not error on already-absent rows).
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0163: Lifecycle E2E suite runs against local Supabase (setup steps)
Related Story: US-0038
Related Task: TASK-0037
Related AC: AC-0129
Type: Integration
Preconditions: Local Supabase running with migrations applied; `scripts/reset-lionhead.ts` has been run.
Steps:
  1. Run `npx playwright test tests/e2e/tournament-lifecycle.spec.ts --project=chromium-lifecycle`
Expected Result: The `chromium-lifecycle` project executes `tournament-lifecycle.spec.ts`'s serial steps against the local Supabase instance (not a mocked one).
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0164: All 10 lifecycle steps pass end-to-end
Related Story: US-0038
Related Task: TASK-0037
Related AC: AC-0130
Type: Integration
Preconditions: Same as TC-0163.
Steps:
  1. Run the full `tournament-lifecycle.spec.ts` suite
  2. Review step-02 (venue) through step-12 (leaderboard)
Expected Result: All 10 steps (venue → course → holes → tournament → activate → teams → player assignment → scoring → leaderboard) pass. Known current gap: step-08 (player-to-team assignment) times out per **BUG-0011** (`assignPlayer()` now upserts into `tournament_players`, not `players`, after migration 011 dropped `players.team_id`; the test still waits for a `/rest/v1/players` PATCH) — this cascades to skip steps 10–12. This TC should fail until BUG-0011 is fixed.
Actual Result:
Status: [ ] Not Run
Defect Raised: BUG-0011

TC-0165: Existing Jest unit tests still pass at ≥80% coverage after E2E additions
Related Story: US-0038
Related Task: TASK-0037
Related AC: AC-0131
Type: Regression
Preconditions: None.
Steps:
  1. Run `npm run test:ci`
Expected Result: All Jest suites pass; coverage on `src/lib/**/*.ts` and `src/app/api/**/*.ts` remains ≥80% statements/functions/lines and ≥70% branches, unaffected by the lifecycle E2E addition.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0166: Existing Playwright mock-based tests remain unaffected by the lifecycle suite
Related Story: US-0038
Related Task: TASK-0037
Related AC: AC-0132
Type: Regression
Preconditions: None.
Steps:
  1. Run `npx playwright test --project=chromium-desktop --project=chromium-mobile`
Expected Result: All pre-existing mock-based Playwright specs still pass; adding the `chromium-lifecycle` project and `tournament-lifecycle.spec.ts` did not change the behavior or fixtures relied on by the desktop/mobile mock suites.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

## EPIC-0002 — Registration & Authentication

TC-0001: Player completes 3-step registration (happy path)
Related Story: US-0009
Related Task: TASK-0009
Related AC: AC-0027
Type: Functional
Preconditions: Tournament status is "active"; team number 7 exists; test email not previously registered.
Steps:
  1. Open /register
  2. Enter valid email and password (8+ chars)
  3. Click "Create Account"
  4. Enter display name and phone number on Step 2
  5. Click "Continue"
  6. Enter team number 7 on Step 3
  7. Click "Join Team"
Expected Result: Account created; player linked to team; redirected to /dashboard showing team members.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0002: Registration — duplicate email rejected
Related Story: US-0009
Related Task: TASK-0009
Related AC: AC-0028
Type: Negative
Preconditions: player@example.com already exists in Supabase Auth.
Steps:
  1. Open /register
  2. Enter player@example.com and any password
  3. Click "Create Account"
Expected Result: Error message "Email already registered" shown; user remains on Step 1.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0003: Registration — password validation enforced on Step 1
Related Story: US-0009
Related Task: TASK-0009
Related AC: AC-0029
Type: Negative
Preconditions: None.
Steps:
  1. Open /register
  2. Enter valid email, then enter password "abc" (3 chars)
  3. Attempt to submit Step 1
Expected Result: Validation error displayed before form is submitted; "Create Account" request not sent to Supabase.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0004: Registration Step 2 — profile fields validated (name required)
Related Story: US-0010
Related Task: TASK-0010
Related AC: AC-0030
Type: Negative
Preconditions: Step 1 completed; on Step 2.
Steps:
  1. Leave display name blank
  2. Click "Continue"
Expected Result: Validation error on name field; form not submitted.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0005: Registration Step 3 — invalid team number shows error
Related Story: US-0011
Related Task: TASK-0011
Related AC: AC-0034
Type: Negative
Preconditions: Steps 1 and 2 complete; team 999 does not exist.
Steps:
  1. Enter team number 999 on Step 3
  2. Click "Join Team"
Expected Result: Error message "Team not found"; player not linked to any team.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0006: Registration Step 3 — team at capacity rejected
Related Story: US-0011
Related Task: TASK-0011
Related AC: AC-0034
Type: Edge Case
Preconditions: Team 3 already has max_players (4) members.
Steps:
  1. Reach Step 3 of registration
  2. Enter team number 3
  3. Click "Join Team"
Expected Result: Error "Team is full" displayed; player not linked to team.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0007: Player logs in with valid email and password
Related Story: US-0012
Related Task: TASK-0012
Related AC: AC-0035
Type: Functional
Preconditions: Player account exists for test@example.com with password "correct-password".
Steps:
  1. Open /login
  2. Enter test@example.com and "correct-password"
  3. Click "Sign In"
Expected Result: Session cookie set; redirected to /dashboard.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0008: Login — wrong password shows error
Related Story: US-0012
Related Task: TASK-0012
Related AC: AC-0036
Type: Negative
Preconditions: Player account exists for test@example.com.
Steps:
  1. Open /login
  2. Enter test@example.com and "wrong-password"
  3. Click "Sign In"
Expected Result: Generic error "Invalid email or password" shown; no session created.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0009: Login — unknown email shows generic error (no account enumeration)
Related Story: US-0012
Related Task: TASK-0012
Related AC: AC-0036
Type: Negative
Preconditions: nobody@example.com does not exist in Supabase Auth.
Steps:
  1. Open /login
  2. Enter nobody@example.com and any password
  3. Click "Sign In"
Expected Result: Same "Invalid email or password" error as TC-0008; no indication account doesn't exist.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0010: Auth middleware — unauthenticated user redirected to /login
Related Story: US-0013
Related Task: TASK-0008
Related AC: AC-0038
Type: Functional
Preconditions: No active session cookie.
Steps:
  1. Open /dashboard in incognito window
Expected Result: Browser redirected to /login immediately.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0011: Auth middleware — logged-in user redirected away from /login
Related Story: US-0013
Related Task: TASK-0008
Related AC: AC-0039
Type: Functional
Preconditions: Valid session cookie active for a player role account.
Steps:
  1. Navigate directly to /login
Expected Result: Redirected to /dashboard; login page not shown.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0012: Auth middleware — player role blocked from /admin routes
Related Story: US-0013
Related Task: TASK-0008
Related AC: AC-0040
Type: Functional
Preconditions: Valid session for a player role account.
Steps:
  1. Navigate to /admin/tournament
Expected Result: Redirected to /dashboard; admin page not shown.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0013: Auth middleware — /live/slug accessible without authentication
Related Story: US-0013
Related Task: TASK-0008
Related AC: AC-0041
Type: Functional
Preconditions: No session cookie; tournament slug "cibc-granite-ridge-2026" exists.
Steps:
  1. Open /live/cibc-granite-ridge-2026 in incognito window
Expected Result: Public leaderboard renders; no redirect to /login.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0014: Magic link — player session created on link click
Related Story: US-0015
Related Task: N/A
Related AC: AC-0047
Type: Functional
Preconditions: Admin has triggered magic link for player email via /admin/players. Email received.
Steps:
  1. Open magic link URL from email in browser
  2. Observe redirect target
Expected Result: Session created; browser lands on /auth/magic-link; player either directed to profile form or /dashboard.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0015: Magic link — profile completion form shown for new player
Related Story: US-0015
Related Task: N/A
Related AC: AC-0048
Type: Functional
Preconditions: Player clicked magic link for first time; no prior profile.
Steps:
  1. Complete magic link auth flow
  2. Observe /auth/magic-link page
Expected Result: Profile form displayed asking for display name; player not yet on /dashboard.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

TC-0156: "Send Magic Link" button on login page does not trigger form validation
Related Story: US-0036
Related Task: N/A
Related AC: AC-0122
Type: Functional
Preconditions: On /login with the email/password form empty or partially filled.
Steps:
  1. Leave the password field empty (or invalid)
  2. Click "Send Magic Link"
Expected Result: The button is `type="button"`, so clicking it does not trigger the form's password-field validation; the magic-link request proceeds independent of the password field's state.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0157: Player self-service magic-link request via /api/auth/request-link
Related Story: US-0036
Related Task: N/A
Related AC: AC-0123
Type: Integration
Preconditions: A `players` row exists with a known email.
Steps:
  1. Run the Jest suite: `npx jest src/__tests__/api-request-link.test.ts --no-coverage`
  2. Separately, POST an enrolled player's email to `/api/auth/request-link` via the login page UI
Expected Result: The route (`src/app/api/auth/request-link/route.ts`) looks up `players.email` and calls `supabase.auth.signInWithOtp({ shouldCreateUser: false })` for enrolled players; all 4 `it` cases in `api-request-link.test.ts` pass.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0158: Magic-link request endpoint is anti-enumeration safe
Related Story: US-0036
Related Task: N/A
Related AC: AC-0124
Type: Negative
Preconditions: None.
Steps:
  1. POST a known enrolled player's email to `/api/auth/request-link`
  2. POST an email with no matching `players` row to the same endpoint
Expected Result: Both requests return `200 { ok: true }` — the response never reveals whether the email matched a player, per the anti-enumeration requirement covered in `api-request-link.test.ts`.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0159: "Forgot password" link on login page
Related Story: US-0037
Related Task: N/A
Related AC: AC-0125
Type: Functional
Preconditions: On /login.
Steps:
  1. Click the "Forgot password" link
Expected Result: Navigates to `/forgot-password` (`src/app/(auth)/forgot-password/page.tsx`).
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0160: Reset email sent via Supabase Auth, anti-enumeration message
Related Story: US-0037
Related Task: N/A
Related AC: AC-0126
Type: Negative
Preconditions: On /forgot-password.
Steps:
  1. Submit a known account's email
  2. Submit an email with no matching account
Expected Result: `resetPasswordForEmail` is called in both cases; the page shows the same "Check your email" message regardless of whether the account exists (anti-enumeration).
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0161: New password accepted after clicking reset link
Related Story: US-0037
Related Task: N/A
Related AC: AC-0127
Type: Functional
Preconditions: A valid Supabase password-reset link has been requested and opened, landing on `/reset-password`.
Steps:
  1. Enter a new password (≥8 chars) and matching confirmation
  2. Submit the form
  3. Also verify: submit with `password !== confirm`, and submit with a password shorter than 8 chars
Expected Result: On valid input, `reset-password/page.tsx` calls `updateUser({ password })` and redirects to `/dashboard`. On mismatched or too-short input, the form is rejected client-side with a validation message and `updateUser` is not called.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

## EPIC-0003 — Player Dashboard

TC-0016: Dashboard shows team name, members, and starting hole
Related Story: US-0014
Related Task: TASK-0013
Related AC: AC-0042
Type: Functional
Preconditions: Player logged in; assigned to team 5 with starting hole 14; team has 3 other members.
Steps:
  1. Navigate to /dashboard
Expected Result: Team card shows team name, 4 player names, and "Starting Hole: 14".
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0017: Dashboard shows current round status
Related Story: US-0014
Related Task: TASK-0013
Related AC: AC-0043
Type: Functional
Preconditions: Round in progress for team; currently on hole 7.
Steps:
  1. Navigate to /dashboard
Expected Result: Round status shows "In Progress — Hole 7" or equivalent.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0018: Dashboard "Start Round" navigates to /round
Related Story: US-0014
Related Task: TASK-0013
Related AC: AC-0044
Type: Functional
Preconditions: Player logged in; round not yet started (status: not_started).
Steps:
  1. Navigate to /dashboard
  2. Click "Start Round" button
Expected Result: Navigated to /round; round status changes to "in_progress".
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0019: Dashboard shows quick-link to leaderboard
Related Story: US-0014
Related Task: TASK-0013
Related AC: AC-0046
Type: Functional
Preconditions: Player logged in.
Steps:
  1. Navigate to /dashboard
  2. Click leaderboard link
Expected Result: Navigated to /leaderboard; team standings visible.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

## EPIC-0004 — Active Round / Shot Tracking

TC-0020: Round page shows active player indicator
Related Story: US-0017
Related Task: N/A
Related AC: AC-0053
Type: Functional
Preconditions: Player on /round; round in progress; active player is "Alice".
Steps:
  1. Observe /round page
Expected Result: Alice's player card highlighted as active; other players shown as inactive.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0021: Tapping a player card selects that player as active shooter
Related Story: US-0017
Related Task: N/A
Related AC: AC-0054
Type: Functional
Preconditions: On /round; multiple team members visible.
Steps:
  1. Tap on player card for "Bob"
Expected Result: Bob's card highlighted; club selector updates to Bob's last-used club.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0022: Club selector shows clubs grouped by category
Related Story: US-0018
Related Task: N/A
Related AC: AC-0057
Type: Functional
Preconditions: On /round; clubs seeded with 21 active clubs across 5 categories.
Steps:
  1. Open club selector dropdown
Expected Result: Clubs grouped into: Woods, Hybrids, Irons, Wedges, Putter.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0023: Inactive club not shown in player club selector
Related Story: US-0018
Related Task: N/A
Related AC: AC-0057
Type: Edge Case
Preconditions: "3 Wood" club is deactivated in admin clubs table.
Steps:
  1. Open club selector dropdown on /round
Expected Result: "3 Wood" does not appear in the dropdown list.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0024: GPS position captured on "Capture Shot" tap
Related Story: US-0019
Related Task: TASK-0006
Related AC: AC-0059
Type: Functional
Preconditions: Device has geolocation permission granted; on /round.
Steps:
  1. Select active player and club
  2. Tap "Capture Shot"
Expected Result: GPS lat/lng captured and shown; player pin appears on map at captured position.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0025: GPS permission prompt shown on first use
Related Story: US-0019
Related Task: N/A
Related AC: AC-0062
Type: Functional
Preconditions: Browser geolocation permission not yet granted.
Steps:
  1. Navigate to /round for the first time
Expected Result: Browser geolocation permission dialog appears with explanation text.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0026: Shot recorded offline — queued in SyncEngine
Related Story: US-0008
Related Task: TASK-0006
Related AC: AC-0060
Type: Edge Case
Preconditions: On /round; device network disconnected (airplane mode).
Steps:
  1. Capture shot with GPS
  2. Select "In Play" outcome
Expected Result: Shot accepted in UI without error; offline indicator shows "1 pending"; entry in localStorage.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0027: SyncEngine flushes queue on network reconnect
Related Story: US-0008
Related Task: TASK-0006
Related AC: AC-0060
Type: Edge Case
Preconditions: 2 shots queued in localStorage while offline.
Steps:
  1. Reconnect device to network
  2. Wait up to 10 seconds
Expected Result: Offline indicator clears to 0 pending; both shots appear in Supabase shots table.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0028: SyncEngine drops entry after 5 consecutive failures
Related Story: US-0008
Related Task: TASK-0006
Related AC: AC-0060
Type: Edge Case
Preconditions: Shot in SyncEngine queue; /api/shots returns 500 on every attempt.
Steps:
  1. Trigger 5 flush attempts (wait ~50s with 10s interval)
Expected Result: Entry removed from queue; no further API calls for that entry.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0029: In-Play outcome records shot and rotates to next player
Related Story: US-0020
Related Task: N/A
Related AC: AC-0064
Type: Functional
Preconditions: On /round; Alice is active player; 3 other players in team.
Steps:
  1. Capture shot for Alice
  2. Tap "In Play" outcome button
Expected Result: Shot written to DB; rotation moves to next player; Alice's card no longer highlighted.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0030: OOB outcome adds +1 penalty stroke and shows rehit prompt
Related Story: US-0020
Related Task: N/A
Related AC: AC-0065
Type: Functional
Preconditions: On /round; Alice is active player.
Steps:
  1. Capture shot for Alice
  2. Tap "Out of Bounds" outcome
Expected Result: Penalty shot added (stroke count +1); prompt shown to capture rehit from same position.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0031: Mulligan outcome discards shot — no stroke counted
Related Story: US-0020
Related Task: N/A
Related AC: AC-0066
Type: Functional
Preconditions: On /round; Bob is active player; mulligans available.
Steps:
  1. Capture shot for Bob
  2. Tap "Mulligan" outcome
Expected Result: Shot record discarded; Bob's stroke count unchanged; Bob remains active to reshoot.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0032: Sunk outcome closes hole for that player
Related Story: US-0020
Related Task: N/A
Related AC: AC-0067
Type: Functional
Preconditions: On /round; Carol is active player.
Steps:
  1. Capture shot for Carol
  2. Tap "Sunk" outcome
Expected Result: Carol's hole marked complete; remaining players still active for this hole.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

TC-0154: Shot history visible for the current hole
Related Story: US-0021
Related Task: TASK-0035
Related AC: AC-0068
Type: Functional
Preconditions: Player mid-round with at least one recorded shot on the current hole.
Steps:
  1. Navigate to /round
  2. Record 2 shots on the current hole
  3. Observe the "This hole" shot list
Expected Result: `src/app/(player)/round/page.tsx`'s "This hole" list shows every shot recorded so far on the current hole, in order, with club and outcome.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0155: Tapping a previous shot opens edit mode
Related Story: US-0021
Related Task: TASK-0035
Related AC: AC-0069
Type: Functional
Preconditions: Same as TC-0154; at least one shot recorded on the current hole.
Steps:
  1. On the "This hole" shot list, click a shot row
  2. Observe the row's ✏/✕ glyph icon and edit affordance
  3. Change the club (`editClub`) and/or outcome (`editOutcome`) and save
Expected Result: Clicking a row toggles `editingShot` state and reveals editable club/outcome controls (no labeled "Edit" button — just the ✏/✕ icon glyphs); saving updates the shot in place.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

## EPIC-0005 — Hole & Round Completion

TC-0033: Hole completes when all team members have sunk
Related Story: US-0022
Related Task: N/A
Related AC: AC-0071
Type: Functional
Preconditions: On /round hole 3; Alice, Bob, Carol previously sunk; Dave is last active player.
Steps:
  1. Capture Dave's shot and tap "Sunk"
Expected Result: Hole completion detected; hole summary screen displayed.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0034: Best Ball Edge Function called on hole completion
Related Story: US-0022
Related Task: N/A
Related AC: AC-0072
Type: Functional
Preconditions: All 4 players have sunk on hole 3.
Steps:
  1. Observe response after last Sunk outcome
Expected Result: calculate-best-ball Edge Function invoked; scores.is_best_ball set for minimum stroke player.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0035: Hole summary shows each player's stroke count
Related Story: US-0023
Related Task: N/A
Related AC: AC-0074
Type: Functional
Preconditions: Hole 3 completed; Alice 4, Bob 3, Carol 5, Dave 4 strokes.
Steps:
  1. View hole summary screen
Expected Result: Summary shows Alice: 4, Bob: 3, Carol: 5, Dave: 4.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0036: Best ball highlighted with star on hole summary
Related Story: US-0023
Related Task: N/A
Related AC: AC-0075
Type: Functional
Preconditions: Hole summary showing; Bob has lowest stroke count (3) — is_best_ball = true.
Steps:
  1. Observe hole summary screen
Expected Result: Bob's row shows ★ indicator; other rows do not.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0037: Score vs par label shown on hole summary (birdie/par/bogey)
Related Story: US-0023
Related Task: N/A
Related AC: AC-0076
Type: Functional
Preconditions: Hole 3 par is 4; best ball score is 3.
Steps:
  1. View hole summary
Expected Result: Score label shows "Birdie" or "-1" for the best ball result.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0038: Shotgun wraparound — hole 18 advances to hole 1
Related Story: US-0024
Related Task: N/A
Related AC: AC-0078
Type: Edge Case
Preconditions: Team starting hole is 14; currently on hole 18 (last before wrap).
Steps:
  1. Complete hole 18
  2. Tap "Next Hole"
Expected Result: Current hole becomes 1; hole counter shows 1, not 19.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0039: Round complete summary shown after 18 holes
Related Story: US-0024
Related Task: N/A
Related AC: AC-0079
Type: Functional
Preconditions: Team has completed exactly 18 holes.
Steps:
  1. Tap "Next Hole" after completing the 18th hole
Expected Result: "Round Complete" screen displayed with total team score; no further hole navigation.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

## EPIC-0006 — Leaderboard

TC-0040: Leaderboard ranks teams by best-ball score vs par
Related Story: US-0025
Related Task: N/A
Related AC: AC-0080
Type: Functional
Preconditions: Player logged in; 5+ teams with varying scores in database.
Steps:
  1. Navigate to /leaderboard
Expected Result: Teams ordered ascending by (total_best_ball_score - par_total); lowest score at top.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0041: "Your Team ★" row pinned with green highlight outside top 20
Related Story: US-0025
Related Task: N/A
Related AC: AC-0082
Type: Edge Case
Preconditions: Player's team is ranked 24th; top 20 visible.
Steps:
  1. Navigate to /leaderboard
Expected Result: Top 20 teams shown; player's team appears below as pinned entry with ★ and green highlight.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0042: Leaderboard "Thru" column shows holes completed per team
Related Story: US-0025
Related Task: N/A
Related AC: AC-0083
Type: Functional
Preconditions: Team A: 9 holes complete; Team B: 0 holes complete.
Steps:
  1. Navigate to /leaderboard
Expected Result: Team A shows "9" in Thru column; Team B shows "0" or "-".
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0043: Public leaderboard loads without authentication
Related Story: US-0026
Related Task: N/A
Related AC: AC-0085
Type: Functional
Preconditions: No session cookie; tournament slug cibc-granite-ridge-2026 exists and is active.
Steps:
  1. Open /live/cibc-granite-ridge-2026 in incognito window
Expected Result: Leaderboard renders with team standings; no login prompt; no "Your Team" pin row.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0044: LIVE badge visible on public leaderboard header
Related Story: US-0026
Related Task: N/A
Related AC: AC-0087
Type: Functional
Preconditions: Tournament status is "active".
Steps:
  1. Open /live/cibc-granite-ridge-2026
Expected Result: Header shows "LIVE" badge.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0045: Sponsor logos visible on public leaderboard
Related Story: US-0027
Related Task: N/A
Related AC: AC-0089
Type: Functional
Preconditions: 3 active sponsors with logos configured.
Steps:
  1. Open /live/cibc-granite-ridge-2026
Expected Result: Sponsor logos displayed below header in configured display_order.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0046: Leaderboard updates in real-time after score change
Related Story: US-0025
Related Task: N/A
Related AC: AC-0084
Type: Functional
Preconditions: /leaderboard open; another device completes a hole.
Steps:
  1. Wait up to 10 seconds after a hole is completed on another device
Expected Result: Leaderboard re-renders with updated score within ~6 seconds (5 s debounce + query time).
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

TC-0167: tv-stats.ts unit tests achieve ≥80% coverage
Related Story: US-0039
Related Task: TASK-0038
Related AC: AC-0137
Type: Unit
Preconditions: None.
Steps:
  1. Run `npx jest src/__tests__/tv-stats.test.ts --coverage`
  2. Run the full suite: `npm run test:ci`
Expected Result: All ~40 `it` cases across the 7 `describe` blocks in `tv-stats.test.ts` (covering the 7 exported fetch functions in `src/lib/tv-stats.ts`) pass; `tv-stats.ts` coverage is ≥80%; the full suite remains ≥80% overall.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

## EPIC-0007 — Admin: Tournament & Course Setup

TC-0047: Admin sidebar shows all 7 management sections
Related Story: US-0028
Related Task: N/A
Related AC: AC-0092
Type: Functional
Preconditions: Logged in as admin role.
Steps:
  1. Navigate to /admin/tournament
Expected Result: Left sidebar shows: Tournament, Holes, Clubs, Players, Teams, Scores, Sponsors.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0048: Non-admin user cannot reach admin routes
Related Story: US-0028
Related Task: TASK-0008
Related AC: AC-0095
Type: Functional
Preconditions: Logged in as player role.
Steps:
  1. Navigate to /admin/tournament
Expected Result: Redirected to /dashboard.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0049: Tournament config edits saved to database
Related Story: US-0029
Related Task: N/A
Related AC: AC-0096
Type: Functional
Preconditions: Admin on /admin/tournament.
Steps:
  1. Edit tournament name to "CIBC 2026 Updated"
  2. Click Save
Expected Result: tournaments.name updated in Supabase; page shows updated value after save.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0050: Copy public leaderboard URL to clipboard
Related Story: US-0029
Related Task: N/A
Related AC: AC-0097
Type: Functional
Preconditions: Admin on /admin/tournament; tournament has slug.
Steps:
  1. Click "Copy Leaderboard URL" button
Expected Result: Clipboard contains https://<domain>/live/<slug>; success toast shown.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0051: Hole par values editable inline and saved
Related Story: US-0030
Related Task: N/A
Related AC: AC-0100
Type: Functional
Preconditions: Admin on /admin/holes.
Steps:
  1. Click par value cell for hole 7
  2. Change value from 4 to 5
  3. Click Save
Expected Result: holes.par = 5 for hole 7 updated in Supabase.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0052: Club deactivation hides club from player selector
Related Story: US-0031
Related Task: N/A
Related AC: AC-0104
Type: Functional
Preconditions: "Pitching Wedge" is active in clubs table.
Steps:
  1. Admin on /admin/clubs — toggle "Pitching Wedge" to inactive
  2. Player on /round opens club selector
Expected Result: "Pitching Wedge" does not appear in club dropdown.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

## EPIC-0008 — Admin: Players & Teams

TC-0053: Player table filtered by search term
Related Story: US-0032
Related Task: N/A
Related AC: AC-0105
Type: Functional
Preconditions: Admin on /admin/players; 125 players in table.
Steps:
  1. Type "Smith" in search field
Expected Result: Table filters to rows where name contains "Smith".
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0054: Edit player modal updates name and team assignment
Related Story: US-0032
Related Task: N/A
Related AC: AC-0106
Type: Functional
Preconditions: Admin on /admin/players; player "John Doe" exists.
Steps:
  1. Click edit icon for "John Doe"
  2. Change name to "John Smith"
  3. Change team assignment to team 12
  4. Click Save
Expected Result: players.name and players.team_id updated; table reflects new values.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0055: Magic link sent to player from admin players page
Related Story: US-0016
Related Task: N/A
Related AC: AC-0050
Type: Functional
Preconditions: Admin on /admin/players; player has valid email.
Steps:
  1. Click "Send Magic Link" for a player
Expected Result: POST /api/magic-link called; success toast shown.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0056: New team created with starting hole
Related Story: US-0033
Related Task: N/A
Related AC: AC-0109
Type: Functional
Preconditions: Admin on /admin/teams.
Steps:
  1. Click "New Team"
  2. Enter team number 32, name "Eagles", starting hole 5
  3. Click Create
Expected Result: New team row appears in table; teams record created in Supabase.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0057: Auto-assign starting holes distributes teams across 1–18
Related Story: US-0033
Related Task: N/A
Related AC: AC-0112
Type: Functional
Preconditions: 36 teams created with no starting holes set.
Steps:
  1. Admin on /admin/teams
  2. Click "Auto-Assign Starting Holes"
Expected Result: Teams receive starting holes 1–18 cycling evenly (2 teams per hole for 36 teams).
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

## EPIC-0009 — Admin: Score Override & Sponsors

TC-0058: Admin overrides player stroke count and best ball recalculates
Related Story: US-0034
Related Task: N/A
Related AC: AC-0113
Type: Functional
Preconditions: Admin on /admin/scores; Team 7 Hole 5 has scores recorded.
Steps:
  1. Select Team 7 and Hole 5
  2. Edit Alice's stroke count from 5 to 4
  3. Click "Recalculate Best Ball"
Expected Result: scores.strokes updated to 4; is_best_ball recalculated; leaderboard reflects change.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0059: Score override logged with admin ID and timestamp
Related Story: US-0034
Related Task: N/A
Related AC: AC-0116
Type: Functional
Preconditions: Admin override performed as per TC-0058.
Steps:
  1. Check scores row in Supabase after override
Expected Result: scores.override_by = admin's player ID; scores.override_at = current timestamp.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0060: Sponsor logo uploaded and visible on leaderboard
Related Story: US-0035
Related Task: N/A
Related AC: AC-0118
Type: Functional
Preconditions: Admin on /admin/sponsors; valid PNG file available.
Steps:
  1. Click "Add Sponsor", upload logo PNG, set display order 1, click Save
Expected Result: Logo uploaded to Supabase Storage; visible on /live/slug in sponsor banner.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

## Phase 6 — Scorecard, Pause State, Mulligans

TC-0061: Scorecard shows hole-by-hole best-ball view
Related Story: US-0016
Related Task: N/A
Related AC: AC-0052
Type: Functional
Preconditions: Player on /scorecard; team has 9 holes complete.
Steps:
  1. Navigate to /scorecard
Expected Result: 18-row table shows hole number, par, best-ball strokes, and score vs par per hole. Incomplete holes show "-".
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0062: Tournament pause state — shot recording disabled
Related Story: US-0013
Related Task: N/A
Related AC: AC-0041
Type: Edge Case
Preconditions: Admin has set tournament status to "paused".
Steps:
  1. Player on /round attempts to capture a shot
Expected Result: "Tournament paused" message shown; "Capture Shot" button disabled or absent.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0063: Mulligan allowance enforced — cannot take more than allowed
Related Story: US-0020
Related Task: N/A
Related AC: AC-0066
Type: Edge Case
Preconditions: Team has used all allocated mulligans.
Steps:
  1. Capture shot and tap "Mulligan" after allowance exhausted
Expected Result: Mulligan button disabled or error "No mulligans remaining" shown.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0064: Offline indicator reflects pending shot count
Related Story: US-0008
Related Task: TASK-0006
Related AC: AC-0060
Type: Functional
Preconditions: 3 shots queued offline.
Steps:
  1. Observe OfflineIndicator component
Expected Result: Component shows "3 pending" and wifi-off icon.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0065: TV page loads for valid tournament slug
Related Story: US-0039
Related Task: N/A
Related AC: AC-0133
Type: Functional
Preconditions: Tournament exists with slug 'cibc-granite-ridge-2026'; tournaments/sponsors/scores/holes/shots/tee_boxes/teams/players tables and leaderboard RPC mocked.
Steps:
  1. Navigate to /live/{slug}/tv
  2. Wait for network idle
Expected Result: "Leaderboard" text, "LIVE" badge, and tournament name all visible in the header.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0066: TV page returns 404 for unknown slug
Related Story: US-0039
Related Task: N/A
Related AC: AC-0133
Type: Edge Case
Preconditions: Real Supabase instance (SSR tournament lookup cannot be mocked with page.route()); no tournament row for slug 'no-such-tournament'.
Steps:
  1. Navigate to /live/no-such-tournament/tv
Expected Result: HTTP 404 response, or a rendered 404 page.
Actual Result:
Status: [ ] Not Run (skipped without real Supabase)
Defect Raised: None

TC-0067: Leaderboard panel shows team rows and column headers
Related Story: US-0039
Related Task: N/A
Related AC: AC-0134
Type: Functional
Preconditions: Leaderboard RPC mocked with fakeLeaderboard data.
Steps:
  1. Navigate to /live/{slug}/tv
  2. Wait for network idle
Expected Result: Column headers "#", "Team", "Sc" visible; first team's name from the mocked leaderboard visible.
Actual Result: Originally failed — first team name selector matched a hidden element outside the leaderboard panel; fixed by scoping the locator to the leaderboard panel testid.
Status: [ ] Not Run
Defect Raised: BUG-0008 (resolved)

TC-0068: Birdie panel shows empty state when no scores exist
Related Story: US-0039
Related Task: N/A
Related AC: AC-0136
Type: Edge Case
Preconditions: scores/holes/shots/tee_boxes tables mocked empty.
Steps:
  1. Navigate to /live/{slug}/tv
Expected Result: "Birdies Today" label renders with a zero-count empty state; no crash.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0069: Footer shows a panel indicator dot for every rotating TV panel
Related Story: US-0039
Related Task: N/A
Related AC: AC-0135
Type: Functional
Preconditions: TV page loaded with mocked tables.
Steps:
  1. Navigate to /live/{slug}/tv
  2. Count footer indicator dots
Expected Result: Footer renders exactly 5 indicator dots — one per panel (Birdies, Hole Difficulty, Shot Stats, Moment of Day, Team Spotlight).
Actual Result: Note — test title says "three" dots but the current UI (and assertion) has 5; test title is stale relative to the assertion.
Status: [ ] Not Run
Defect Raised: None

TC-0070: TV page accessible without any authentication
Related Story: US-0039
Related Task: N/A
Related AC: AC-0133
Type: Functional
Preconditions: No auth session or cookies set.
Steps:
  1. Navigate to /live/{slug}/tv while signed out
Expected Result: No redirect to a sign-in/login page; leaderboard content renders directly.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0071: Dashboard shows tournament name and date
Related Story: US-0014
Related Task: N/A
Related AC: AC-0043
Type: Functional
Preconditions: Real Supabase seeded; player signed in; tournaments/teams/players/scores/sponsors tables mocked. Dashboard is SSR — requires seeded local Supabase.
Steps:
  1. Navigate to /dashboard
Expected Result: Heading with tournament name visible; day-of-week text visible.
Actual Result:
Status: [ ] Not Run (skipped without real Supabase)
Defect Raised: None

TC-0072: Dashboard shows team section after welcome card
Related Story: US-0014
Related Task: N/A
Related AC: AC-0044
Type: Functional
Preconditions: Same as TC-0071.
Steps:
  1. Navigate to /dashboard
Expected Result: "Welcome back" text visible; either starting-hole info or "not been assigned to a team" message shown; "start round" text visible.
Actual Result:
Status: [ ] Not Run (skipped without real Supabase)
Defect Raised: None

TC-0073: Dashboard has a "Start Round" button
Related Story: US-0014
Related Task: N/A
Related AC: AC-0045
Type: Functional
Preconditions: Same as TC-0071.
Steps:
  1. Navigate to /dashboard
Expected Result: "Start Round" button visible.
Actual Result:
Status: [ ] Not Run (skipped without real Supabase)
Defect Raised: None

TC-0074: Scorecard page loads and shows table or empty state
Related Story: US-0046
Related Task: TASK-0045
Related AC: AC-0151
Type: Functional
Preconditions: Real Supabase seeded; player signed in; scores/holes tables mocked.
Steps:
  1. Navigate to /scorecard
Expected Result: Either a "Scorecard" heading with a table renders, or a "no scores recorded yet" empty state renders; player navigation is visible in both cases.
Actual Result:
Status: [ ] Not Run (skipped without real Supabase)
Defect Raised: None

TC-0075: Scorecard table shows Hole, Par, and Strokes column headers when scores exist
Related Story: US-0046
Related Task: TASK-0045
Related AC: AC-0152
Type: Functional
Preconditions: Same as TC-0074.
Steps:
  1. Navigate to /scorecard
  2. If a table is rendered, inspect its column headers; otherwise inspect the empty state
Expected Result: "Hole", "Par", and "Strokes" headers visible when a table is present; "no scores recorded yet" text visible otherwise.
Actual Result:
Status: [ ] Not Run (skipped without real Supabase)
Defect Raised: None

TC-0076: Sunk outcome submits score and shows hole completion UI
Related Story: US-0020
Related Task: N/A
Related AC: AC-0067
Type: Functional
Preconditions: Player in an active round; club selected; scores POST/PUT mocked to succeed.
Steps:
  1. Navigate to /round
  2. Select a club
  3. Tap the "Sunk" outcome button
Expected Result: "Hole ... Complete" text and a "Next Hole" button both become visible.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0077: Round page renders GPS position widget or acquiring indicator
Related Story: US-0019
Related Task: N/A
Related AC: AC-0059
Type: Functional
Preconditions: Player in an active round; geolocation permission not granted (headless browser default).
Steps:
  1. Navigate to /round
Expected Result: Club selector and header/banner render successfully even without GPS permission granted. (A full GPS-position assertion requires granting geolocation permissions and is tracked separately.)
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0078: Admin tournament page renders TournamentControlDashboard for an active tournament
Related Story: US-0044
Related Task: TASK-0043
Related AC: AC-0149
Type: Functional
Preconditions: Real Supabase seeded; system_admin signed in; tournament status active.
Steps:
  1. Navigate to /admin/tournament
Expected Result: "Teams on course" text, "Setup checklist" text, and an "Open TV Leaderboard" link are all visible.
Actual Result:
Status: [ ] Not Run (skipped without real Supabase)
Defect Raised: None

TC-0079: Admin venues page shows AdminTopBar heading and venue cards
Related Story: US-0042
Related Task: TASK-0041
Related AC: AC-0143
Type: Functional
Preconditions: Real Supabase seeded; admin signed in.
Steps:
  1. Navigate to /admin/venues
Expected Result: H1 "Venues" heading visible; a "Venue" count pill is visible when venues exist.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0080: TV page shows "more teams" message when leaderboard has more than 18 teams
Related Story: US-0039
Related Task: N/A
Related AC: AC-0134
Type: Edge Case
Preconditions: Leaderboard RPC mocked with 20 fake teams.
Steps:
  1. Navigate to /live/{slug}/tv with a 20-team leaderboard mocked
Expected Result: "… and N more teams" overflow message visible (N=2 for 20 teams, since the panel shows the first 18).
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0081: TV page footer contains the tournament name
Related Story: US-0039
Related Task: N/A
Related AC: AC-0134
Type: Functional
Preconditions: TV page loaded with mocked tables.
Steps:
  1. Navigate to /live/{slug}/tv
  2. Inspect footer text
Expected Result: Footer text contains the tournament's name.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0082: AdminTopBar renders the correct h1 title on every redesigned admin page
Related Story: US-0045
Related Task: TASK-0044
Related AC: AC-0150
Type: Functional
Preconditions: Admin signed in.
Steps:
  1. Navigate to each of /admin/venues, /admin/players, /admin/teams, /admin/clubs, /admin/scores, /admin/sponsors
Expected Result: Each page shows the correct h1 title (Venues, Players, Teams, Clubs, Scores, Sponsors respectively).
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0083: Venues page shows venue cards with Edit and Delete buttons
Related Story: US-0042
Related Task: TASK-0041
Related AC: AC-0145
Type: Functional
Preconditions: Real Supabase seeded with venues.
Steps:
  1. Navigate to /admin/venues
Expected Result: Edit and Delete buttons visible on venue cards; "Venue" count pill visible.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0084: Courses page shows Front 9 and Back 9 sections
Related Story: US-0043
Related Task: TASK-0042
Related AC: AC-0146
Type: Functional
Preconditions: Real Supabase seeded with a course.
Steps:
  1. Navigate to /admin/courses
Expected Result: H1 "Courses" heading; "Front 9" and "Back 9" section headings both visible.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0085: Players page filter bar includes a static "Pending —" pill
Related Story: US-0032
Related Task: N/A
Related AC: AC-0105
Type: Functional
Preconditions: Real Supabase seeded with players. Admin signed in.
Steps:
  1. Navigate to /admin/players
Expected Result: H1 "Players" heading; "⏳ Pending —" and "✓ Linked" filter pills both visible.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0086: Teams page shows team cards with starting hole badges
Related Story: US-0033
Related Task: N/A
Related AC: AC-0111
Type: Functional
Preconditions: Real Supabase seeded with at least one team (seeded in global-setup).
Steps:
  1. Navigate to /admin/teams
Expected Result: H1 "Teams" heading; starting-hole badge matching pattern "H<number>" visible; Edit button visible on team cards.
Actual Result: Originally failed with no data to assert on; fixed by seeding teams in global-setup.
Status: [ ] Not Run
Defect Raised: BUG-0009 (resolved)

TC-0087: Clubs page shows a drag handle icon on every club row
Related Story: US-0031
Related Task: N/A
Related AC: AC-0103
Type: Functional
Preconditions: Real Supabase seeded with clubs. Admin signed in.
Steps:
  1. Navigate to /admin/clubs
Expected Result: H1 "Clubs" heading; a drag-handle icon (⠿) visible on every club row.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0088: Scores page shows Eagle/Birdie/Par/Bogey+ legend chips in AdminTopBar
Related Story: US-0034
Related Task: N/A
Related AC: N/A
Type: Functional
Preconditions: Admin signed in. Note: /admin/scores is SSR — page.route() score/team mocks do not affect the initial render, and ScoresTable uses a Radix UI Select rather than a native <select>, so this test does not exercise score entry itself, only the legend chips. Rewriting /admin/scores E2E coverage once the page is converted to a client-fetched approach is tracked as a backlog item.
Steps:
  1. Navigate to /admin/scores
Expected Result: H1 "Scores" heading; Eagle, Birdie, Par, and Bogey+ legend chip labels all visible.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0089: Sponsors page shows TV Footer Preview section and "Show on TV" labels
Related Story: US-0035
Related Task: N/A
Related AC: AC-0121
Type: Functional
Preconditions: Real Supabase seeded with sponsors. Admin signed in.
Steps:
  1. Navigate to /admin/sponsors
Expected Result: H1 "Sponsors" heading; "TV Footer Preview" text visible; "Show on TV" labels and drag handles visible when sponsors exist.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0090: system_admin sidebar shows Global section with Tournaments, Players, Venues, Courses, Clubs
Related Story: US-0040
Related Task: TASK-0039
Related AC: AC-0138
Type: Functional
Preconditions: Real Supabase seeded with a system_admin user.
Steps:
  1. Sign in as system_admin
  2. Navigate to /admin/tournament
Expected Result: "Global" section label visible; nav links for Tournaments, Players, Venues, Courses, and Clubs all visible.
Actual Result:
Status: [ ] Not Run (skipped without real Supabase)
Defect Raised: None

TC-0091: tournament_admin sidebar has no Global section
Related Story: US-0040
Related Task: TASK-0039
Related AC: AC-0139
Type: Functional
Preconditions: Real Supabase seeded with a tournament_admin user.
Steps:
  1. Sign in as tournament_admin
  2. Navigate to /admin/tournament
Expected Result: "Global" section not visible; "Venues" and "Courses" nav links not visible.
Actual Result:
Status: [ ] Not Run (skipped without real Supabase)
Defect Raised: None

TC-0092: tournament_admin navigating to /admin/tournaments redirects to /admin/tournament
Related Story: US-0040
Related Task: TASK-0039
Related AC: AC-0140
Type: Functional
Preconditions: Real Supabase seeded with a tournament_admin user.
Steps:
  1. Sign in as tournament_admin
  2. Navigate to /admin/tournaments
Expected Result: Browser redirects to /admin/tournament.
Actual Result:
Status: [ ] Not Run (skipped without real Supabase)
Defect Raised: None

TC-0093: tournament_admin navigating to /admin/players redirects to /admin/tournament
Related Story: US-0040
Related Task: TASK-0039
Related AC: AC-0140
Type: Functional
Preconditions: Real Supabase seeded with a tournament_admin user.
Steps:
  1. Sign in as tournament_admin
  2. Navigate to /admin/players
Expected Result: Browser redirects to /admin/tournament.
Actual Result:
Status: [ ] Not Run (skipped without real Supabase)
Defect Raised: None

TC-0094: /admin/tournaments renders tournament list for system_admin
Related Story: US-0041
Related Task: TASK-0040
Related AC: AC-0141
Type: Functional
Preconditions: Real Supabase seeded with a system_admin user and at least one tournament.
Steps:
  1. Sign in as system_admin
  2. Navigate to /admin/tournaments
Expected Result: "Tournaments" heading visible.
Actual Result:
Status: [ ] Not Run (skipped without real Supabase)
Defect Raised: None

TC-0095: /admin/roster renders Roster heading for system_admin
Related Story: US-0041
Related Task: TASK-0040
Related AC: AC-0142
Type: Functional
Preconditions: Real Supabase seeded with a system_admin user.
Steps:
  1. Sign in as system_admin
  2. Navigate to /admin/roster
Expected Result: "Roster" heading visible.
Actual Result:
Status: [ ] Not Run (skipped without real Supabase)
Defect Raised: None

TC-0096: Player record created in players table linked to auth user
Related Story: US-0010
Related Task: N/A
Related AC: AC-0031
Type: Functional
Preconditions: Registration step 1 (account creation) complete; auth user exists.
Steps:
  1. Submit profile form (name, title, company, phone) on registration step 2
Expected Result: New row in players table with the correct auth user_id foreign key.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0097: Team number input validates against existing teams
Related Story: US-0011
Related Task: N/A
Related AC: AC-0032
Type: Edge Case
Preconditions: Registration step 3 (team link) reached.
Steps:
  1. Enter a team number that does not exist
Expected Result: Validation error shown; registration cannot proceed until a valid team number is entered.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0098: Teammates displayed after team lookup
Related Story: US-0011
Related Task: N/A
Related AC: AC-0033
Type: Functional
Preconditions: Registration step 3 reached; team number belongs to a team with existing players.
Steps:
  1. Enter a valid, existing team number
Expected Result: Existing teammates' names are displayed for confirmation before completing registration.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0099: Login shows error message for invalid credentials
Related Story: US-0012
Related Task: N/A
Related AC: AC-0037
Type: Edge Case
Preconditions: A registered account exists.
Steps:
  1. Navigate to /login
  2. Enter a correct email with an incorrect password
  3. Submit the form
Expected Result: Error message shown; user remains on /login (not redirected).
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0100: Player redirected to shot tracking screen after starting round
Related Story: US-0015
Related Task: N/A
Related AC: AC-0049
Type: Functional
Preconditions: Player signed in; tournament active; starting hole assigned.
Steps:
  1. Navigate to /dashboard
  2. Tap "Start Round"
Expected Result: Player is redirected to the shot-tracking screen (/round) for their assigned starting hole.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0101: Pin marker visible on hole map with distinct color
Related Story: US-0016
Related Task: N/A
Related AC: AC-0051
Type: Functional
Preconditions: Round in progress; current hole has pin GPS coordinates set.
Steps:
  1. Navigate to /round
  2. Inspect the hole map
Expected Result: Pin marker renders on the map in a color visually distinct from player/shot markers.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0102: Completed players shown with strikethrough in player pills
Related Story: US-0017
Related Task: N/A
Related AC: AC-0055
Type: Functional
Preconditions: Round in progress; at least one teammate has sunk their shot for the current hole.
Steps:
  1. Navigate to /round
  2. Inspect the player pills row
Expected Result: The completed (sunk) player's name renders with a strikethrough style.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0103: Tapping a player pill switches the active player
Related Story: US-0017
Related Task: N/A
Related AC: AC-0056
Type: Functional
Preconditions: Round in progress; multiple teammates present.
Steps:
  1. Navigate to /round
  2. Tap a teammate's player pill
Expected Result: The tapped player becomes the active shooter (green highlight moves to that pill).
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0104: Selected club name stored on shot record
Related Story: US-0018
Related Task: N/A
Related AC: AC-0058
Type: Functional
Preconditions: Round in progress; club selector available.
Steps:
  1. Select a club (e.g. "Driver")
  2. Capture a shot
Expected Result: The resulting shots row has club_id/club name matching the selected club.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0105: Player pin appears on map at captured GPS position
Related Story: US-0019
Related Task: N/A
Related AC: AC-0061
Type: Functional
Preconditions: Round in progress; geolocation permission granted.
Steps:
  1. Navigate to /round
  2. Capture a shot
Expected Result: A pin marker for the player's shot appears on the map at the captured latitude/longitude.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0106: Four shot outcome buttons displayed after shot capture
Related Story: US-0020
Related Task: N/A
Related AC: AC-0063
Type: Functional
Preconditions: Round in progress; club selected.
Steps:
  1. Navigate to /round with a club selected
Expected Result: "In Play", "Out of Bounds", "Mulligan", and "Sunk" outcome buttons are all displayed.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0107: Modified shot updates in database and recalculates sequence
Related Story: US-0021
Related Task: N/A
Related AC: AC-0070
Type: Functional
Preconditions: At least one prior shot recorded for the current hole; shot history visible.
Steps:
  1. Open a previous shot in edit mode
  2. Change its outcome and save
Expected Result: The shot record updates in the database; subsequent shot sequence numbers recalculate correctly.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0108: Hole summary screen displayed after hole completion
Related Story: US-0022
Related Task: N/A
Related AC: AC-0073
Type: Functional
Preconditions: All active players on the team have an outcome of 'sunk' for the current hole.
Steps:
  1. Complete the final player's shot with the "Sunk" outcome
Expected Result: Hole summary screen is displayed automatically, showing all players' strokes.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0109: "Next Hole" button advances correctly in shotgun sequence
Related Story: US-0024
Related Task: N/A
Related AC: AC-0077
Type: Functional
Preconditions: Hole summary screen displayed; team started on a non-1 hole (e.g. hole 10).
Steps:
  1. Tap "Next Hole" on the hole summary screen
Expected Result: Round advances to the correct next hole in shotgun order (e.g. 10 → 11).
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0110: Leaderboard shows top 20 teams by default
Related Story: US-0025
Related Task: N/A
Related AC: AC-0081
Type: Functional
Preconditions: More than 20 teams exist in the tournament.
Steps:
  1. Navigate to the leaderboard
Expected Result: Only the top 20 teams by cumulative best-ball score are shown by default.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0111: Public leaderboard renders same UI without "Your Team" pin
Related Story: US-0026
Related Task: N/A
Related AC: AC-0086
Type: Functional
Preconditions: Not signed in; public leaderboard URL known.
Steps:
  1. Navigate to /live/cibc-granite-ridge-2026 while signed out
Expected Result: Leaderboard renders the same layout as the authenticated view, but with no "Your Team ★" pinned row.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0112: Sponsor logos visible below header on public leaderboard
Related Story: US-0026
Related Task: N/A
Related AC: AC-0088
Type: Functional
Preconditions: At least one active sponsor exists.
Steps:
  1. Navigate to /live/cibc-granite-ridge-2026
Expected Result: Sponsor logos render in a banner below the page header.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0113: Sponsor logos displayed in admin-set order below header
Related Story: US-0027
Related Task: N/A
Related AC: AC-0090
Type: Functional
Preconditions: Multiple sponsors exist with distinct display_order values.
Steps:
  1. Navigate to the leaderboard
  2. Inspect sponsor logo order
Expected Result: Sponsor logos render in the order set via display_order in /admin/sponsors.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0114: Sponsor logos visible on both authenticated and public leaderboard
Related Story: US-0027
Related Task: N/A
Related AC: AC-0091
Type: Functional
Preconditions: Sponsors exist; both a signed-in player session and a signed-out session available.
Steps:
  1. View the leaderboard while signed in
  2. View the public leaderboard while signed out
Expected Result: Sponsor logos are visible in both views.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0115: Admin sidebar shows FDgolf + AI/Run branding at top, First Derivative at bottom
Related Story: US-0028
Related Task: N/A
Related AC: AC-0093
Type: Functional
Preconditions: Admin signed in.
Steps:
  1. Navigate to any /admin page
  2. Inspect the sidebar
Expected Result: "FDgolf + AI/Run" branding appears at the top of the sidebar; "First Derivative" appears at the bottom.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0116: Active admin section highlighted with green border
Related Story: US-0028
Related Task: N/A
Related AC: AC-0094
Type: Functional
Preconditions: Admin signed in.
Steps:
  1. Navigate to /admin/teams
  2. Inspect the sidebar nav item for "Teams"
Expected Result: The "Teams" nav item shows a green border/highlight indicating it is the active section.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0117: Admin changes tournament status between setup/active/completed
Related Story: US-0029
Related Task: N/A
Related AC: AC-0098
Type: Functional
Preconditions: Admin signed in; tournament in 'setup' status.
Steps:
  1. Navigate to /admin/tournament
  2. Change status to "active" and save
Expected Result: tournaments.status updates to 'active'; dependent UI (e.g. Start Round button) reflects the new status.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0118: Hole management table shows all 18 holes with number, par, handicap, and pin coordinates
Related Story: US-0030
Related Task: N/A
Related AC: AC-0099
Type: Functional
Preconditions: Admin signed in; course holes seeded.
Steps:
  1. Navigate to /admin/holes (or equivalent hole management page)
Expected Result: Table shows 18 rows with hole number, par, handicap, and pin lat/lng columns populated.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0119: Hole par and GPS edits are saved to the database
Related Story: US-0030
Related Task: N/A
Related AC: AC-0101
Type: Functional
Preconditions: Same as TC-0118.
Steps:
  1. Edit a hole's par value and pin GPS coordinates
  2. Submit the change
Expected Result: holes table row updates with the new par and pin coordinates.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0120: Admin adds, edits, and deletes clubs
Related Story: US-0031
Related Task: N/A
Related AC: AC-0102
Type: Functional
Preconditions: Admin signed in.
Steps:
  1. Navigate to /admin/clubs
  2. Add a new club, edit an existing one, then delete a club
Expected Result: clubs table reflects each operation; club list UI updates accordingly.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0121: Password reset button sends reset email from player admin
Related Story: US-0032
Related Task: N/A
Related AC: AC-0107
Type: Functional
Preconditions: Admin signed in; target player has a valid email.
Steps:
  1. Navigate to /admin/players
  2. Open a player's edit modal and click "Send Password Reset"
Expected Result: Supabase Auth sends a password reset email to the player's address.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0122: Player status indicators show active/pending correctly
Related Story: US-0032
Related Task: N/A
Related AC: AC-0108
Type: Functional
Preconditions: Admin signed in; at least one active and one pending (unregistered) player exist.
Steps:
  1. Navigate to /admin/players
Expected Result: Active players show an "active" indicator; pending/unlinked players show a "pending" indicator.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0123: Admin searches and assigns unassigned players to a team
Related Story: US-0033
Related Task: N/A
Related AC: AC-0110
Type: Functional
Preconditions: Admin signed in; at least one player with no team assignment exists.
Steps:
  1. Navigate to /admin/teams
  2. Search for an unassigned player and assign them to a team
Expected Result: players.team_id updates; the player now appears on that team's card.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0124: Admin edits stroke count for any player
Related Story: US-0034
Related Task: N/A
Related AC: AC-0114
Type: Functional
Preconditions: Admin signed in; scores exist for a team/hole.
Steps:
  1. Navigate to /admin/scores
  2. Select a team and hole, then edit a player's stroke count
Expected Result: scores.strokes updates to the new value for that player.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0125: "Recalculate Best Ball" updates is_best_ball flag
Related Story: US-0034
Related Task: N/A
Related AC: AC-0115
Type: Functional
Preconditions: Same as TC-0124.
Steps:
  1. After editing a stroke count, click "Recalculate Best Ball"
Expected Result: is_best_ball flag is recalculated correctly across the team's scores for that hole.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0126: Leaderboard updates immediately after a score override is saved
Related Story: US-0034
Related Task: N/A
Related AC: AC-0117
Type: Functional
Preconditions: Same as TC-0124; leaderboard open in another view/tab.
Steps:
  1. Save a score override from /admin/scores
  2. Observe the leaderboard
Expected Result: Leaderboard reflects the updated score without requiring a manual page refresh.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0127: Admin sets sponsor name and display order
Related Story: US-0035
Related Task: N/A
Related AC: AC-0119
Type: Functional
Preconditions: Admin signed in; at least one sponsor exists.
Steps:
  1. Navigate to /admin/sponsors
  2. Edit a sponsor's name and display order
Expected Result: sponsors table updates with the new name and display_order; leaderboard sponsor banner reorders accordingly.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0128: Admin toggles sponsor visibility on the leaderboard
Related Story: US-0035
Related Task: N/A
Related AC: AC-0120
Type: Functional
Preconditions: Same as TC-0127.
Steps:
  1. Toggle a sponsor's "Show on TV"/visibility switch off
  2. View the leaderboard
Expected Result: The hidden sponsor's logo no longer appears on the leaderboard/TV footer; toggling back on restores it.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0129: Environment precheck script validates infra ACs against the running environment
Related Story: US-0047
Related Task: TASK-0046
Related AC: AC-0153, AC-0154
Type: Integration
Preconditions: .env.local populated; local Supabase running (or a real Supabase project reachable) with migrations applied and seed data loaded.
Steps:
  1. Run `npm run precheck` (or `npx tsx scripts/precheck-env.ts`)
  2. Review the printed PASS/FAIL list
Expected Result: All infra checks print PASS and the script exits 0: env vars present, .env.local.example documents them, Supabase browser/server clients connect, all 9 tables exist, RLS blocks unauthenticated score reads, and clubs/holes/tournament seed data counts meet the expected minimums. AC-0009 (realtime) and AC-0011/AC-0012 (Vercel prod env vars) print as needing manual verification rather than a fabricated pass. If any table is missing, seed data is absent, or Supabase env vars are wrong, the corresponding line prints FAIL with a detail message and the script exits 1.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

## EPIC-0011 — Multi-Tournament Administration, Venues & Courses

TC-0168: New venue can be created via a form and appears in the venue list
Related Story: US-0042
Related Task: N/A
Related AC: AC-0144
Type: Functional
Preconditions: Signed in as system_admin; on /admin/venues.
Steps:
  1. Click "+ Add Venue" (`venue-manager.tsx:179`)
  2. Fill in the venue form revealed by the `showAdd` toggle (`venue-manager.tsx:264`)
  3. Submit
Expected Result: `supabase.from('venues').insert(...).select().single()` (`venue-manager.tsx:112`) succeeds and the new venue card appears in the venue list immediately, without a page reload.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0169: Course holes editor supports "Generate Holes" and CSV import
Related Story: US-0043
Related Task: N/A
Related AC: AC-0147
Type: Functional
Preconditions: Signed in as system_admin; on a course's holes page (`src/app/(admin)/admin/courses/[courseId]/holes/course-holes-editor.tsx`).
Steps:
  1. Open the holes-generator panel (`holes-generator-panel.tsx`) and use "Generate Holes" to create 18 holes with default par
  2. Separately, import a CSV of `hole_number,par,handicap` rows
Expected Result: "Generate Holes" creates the requested number of hole rows with sensible default par values; CSV import parses `hole_number`/`par`/`handicap` columns and upserts matching hole rows for the course.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0170: Tee box editor supports multiple tee sets per course with optional GPS
Related Story: US-0043
Related Task: N/A
Related AC: AC-0148
Type: Functional
Preconditions: Signed in as system_admin; on a course's holes/tee-box editor.
Steps:
  1. Call `startAdd()` on the tee-box editor and fill in a `TeeBoxForm` (`{name, lat, lng, distanceYards}`) leaving `lat`/`lng` empty
  2. Save
  3. Call `startAdd()` again and add a second tee set with `lat`/`lng` populated
  4. Call `startEdit()` on an existing tee set, change a field, and save; also verify `cancelForm()` discards in-progress edits
Expected Result: Both tee sets save successfully — `lat`/`lng` are nullable (GPS is informational only; no scoring logic reads it, per AC-0148) and `validateForm()` does not require them. `startEdit()`/`cancelForm()` behave correctly (edit persists on save, discards on cancel).
Actual Result:
Status: [ ] Not Run
Defect Raised: None
