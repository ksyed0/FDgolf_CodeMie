# FDgolf — Bug Tracker

BUG-0014: Score relative to par (birdie/bogey/etc.) not shown on hole-summary screen
Severity: Medium
Related Story: US-0023 (AC-0076)
Status: Fixed
Fix Branch: bugfix/BUG-0014-vs-par-hole-summary
Lesson Encoded: No

`src/app/(player)/round/page.tsx` held a `holeSummaryScores` state variable but never
rendered a vs-par label (birdie, bogey, par, etc.) alongside it — the hole-summary screen
showed raw strokes only.

`formatVsPar()` already existed in `src/lib/scoring.ts` and was already wired into
`src/app/(player)/scorecard/page.tsx` and
`src/app/(admin)/admin/scores/scores-table.tsx`, so this was not a missing capability —
it was just never called from the hole-summary flow.

Fix approach: imported `formatVsPar()` into `round/page.tsx`. Replaced the best-ball
line's ad-hoc `+`-prefix formatting with `formatVsPar(bestBallPar)`, and added a
per-teammate vs-par badge next to each player's stroke count in the hole-summary list,
computed as `score.strokes - currentHole.par` and color-coded (green under par, red over
par, gray at par) matching the existing convention in `scorecard/page.tsx`. Checked off
AC-0076 in `docs/RELEASE_PLAN.md`.

Verified: `npx tsc --noEmit` clean, `npm run lint` clean at error level, `npm run test:ci`
173/173 passing (coverage 90.63%/82.59%/85.29%/96.25%, all above the ≥80%/≥70%/≥80%/≥80%
thresholds — `round/page.tsx` is outside the enforced coverage gate, so verification for
this page used a targeted E2E check instead). Extended `TC-0076` in
`tests/e2e/round-scoring.spec.ts` to mock a real `scores` GET response and assert the
new vs-par text renders; full `round-scoring.spec.ts` suite (13/13) passes.

PR: https://github.com/ksyed0/FDgolf_CodeMie/pull/75

---

BUG-0013: Shot edit/re-enter does not persist or recalculate sequence
Severity: Medium
Related Story: US-0021 (AC-0070)
Status: Fixed
Fix Branch: bugfix/BUG-0013-shot-edit-persistence
Lesson Encoded: No

There is no `editShot` / `edit-shot` / `EditShot` code anywhere under `src/` — grepping
the codebase turns up nothing. AC-0068 and AC-0069 (shot history list + entering edit
mode in the UI) are implemented and checked off, but there is no wired-up save path:
editing a shot has no persistence and no shot-sequence recalculation.

`TASK-0035 (US-0021): Implement shot edit/re-enter functionality` in
`docs/RELEASE_PLAN.md` remains `Status: To Do` on the never-merged branch
`feature/US-0021-edit-shot`. AC-0070 was left unchecked for this reason. Likely fix:
resume/complete that branch — wire the existing edit-mode UI to an update call against
the shot record and recompute subsequent shot sequence numbers for that hole.

Fix approach: extended `SyncEngine` (`src/lib/sync-engine.ts`) beyond insert-only —
`QueueEntry` gained optional `op: 'insert' | 'update'` and `match` fields (missing `op`
defaults to `'insert'` for backward compatibility with anything already queued),
`flush()` branches to `.update(payload).match(match)` for update entries, and a new
`enqueueUpdate(table, payload, match)` method mirrors `enqueue()`. Extracted the
sunk/un-sunk cascade decision into a pure, unit-tested helper,
`computeShotEditCascade()` in the new `src/lib/shot-edit.ts`, which decides — from the
shot's previous outcome, new outcome, and shot number — whether to upsert or delete the
player's `scores` row, which trailing shots to delete, whether to re-invoke
`calculate-best-ball`, and the new `holeSunk` value. Wired the shot-edit Save button in
`round/page.tsx` to call `syncEngine.enqueueUpdate('shots', ...)` (offline-safe, matching
`recordShot`'s existing pattern for the shots write) and to apply the cascade's
side-effects via the same direct/awaited Supabase calls `recordShot` already uses for
scores/best-ball (which require connectivity anyway), then update `dbShots`/`holeSunk`
locally rather than re-fetching, to avoid racing the async `SyncEngine.flush()`. Checked
off AC-0070 and flipped `TASK-0035` to `Status: Done` in `docs/RELEASE_PLAN.md`.

Verified: `npx tsc --noEmit` clean, `npm run lint` clean at error level, `npm run test:ci`
187/187 passing (coverage 90.81%/82.83%/85.71%/96.34%, all above the ≥80%/≥70%/≥80%/≥80%
thresholds — `shot-edit.ts` is at 100% across the board, `sync-engine.ts`'s new update
path is covered by new `src/__tests__/sync-engine.test.ts` cases including a
backward-compatibility test for legacy insert-only queue entries with no `op` field).
Added a new E2E test to `tests/e2e/round-scoring.spec.ts` (`BUG-0013: editing a shot
outcome sends a PATCH and updates the shot list`) asserting the edit Save button now
sends a real PATCH and the shot list reflects the change; full `round-scoring.spec.ts`
suite (14/14) passes.

PR: https://github.com/ksyed0/FDgolf_CodeMie/pull/76

---

BUG-0012: react-hooks v7 "React Compiler" rules flag pre-existing hook idioms
Severity: Low
Related Story: N/A (lint tooling)
Status: Fixed
Fix Branch: bugfix/BUG-0012-react-hooks-lint-fixes
Lesson Encoded: Yes (see docs/LESSONS.md)

Fixing `eslint.config.js` (flat config had been silently shadowing
`.eslintrc.json`, so `src/` had no real Next.js lint coverage) pulled in
`eslint-config-next@16.2.9`'s bundled `eslint-plugin-react-hooks@7`, which adds
stricter "React Compiler" rules. Two fire as errors against long-standing,
intentional patterns:

- `react-hooks/set-state-in-effect` — `setSearchResults([])` /
  `setResults([])` synchronously clearing stale results inside a `useEffect`
  before a debounce timer fires
  (`src/app/(admin)/admin/roster/roster-manager.tsx:50`,
  `src/app/(admin)/admin/tournament/tournament-admins.tsx:48`), and a
  mount-time `refresh()` call (`src/hooks/use-gps.ts:25`).
- `react-hooks/refs` — updating a tracking `ref.current` during render
  (`src/app/(admin)/admin/roster/roster-manager.tsx:45`).

Fix approach:

Rather than re-downgrading the rules, restructured each flagged call site so
the underlying race the rule protects against is actually closed:

- `roster-manager.tsx` — moved the `enrolledIdsRef.current = new Set(...)`
  mutation out of the render body into its own `useEffect` keyed on
  `players`. The search debounce effect now folds the empty-query
  `setSearchResults([])` clear into the same `setTimeout` used for the
  query (delay `0` when the trimmed query is empty, `250`ms otherwise), and
  tracks a `cancelled` flag set in the effect's cleanup and checked before
  every `setSearchResults` call — so a stale in-flight query can no longer
  update state after a newer query started or the component unmounted.
- `tournament-admins.tsx` — identical fix applied to its search-debounce
  effect (the initial `load()` effect was untouched — it wasn't flagged).
- `use-gps.ts` — added a `cancelledRef` set at effect start and flipped in
  the cleanup, checked before every `setPosition`/`setError`/`setLoading`
  call inside `refresh()`. The mount-time `refresh()` invocation is now
  deferred via `void Promise.resolve().then(refresh)` so the effect body
  itself contains no synchronous state-setting call (`refresh()`'s first
  statement is `setLoading(true)`, which is what the rule was actually
  flagging even though it's one function call removed from the effect).
- Restored `react-hooks/set-state-in-effect` and `react-hooks/refs` to
  `error` level in `eslint.config.js`.
- Added Jest coverage exercising the exact race each fix closes:
  `src/__tests__/use-gps.test.tsx`, `src/__tests__/roster-manager.test.tsx`,
  `src/__tests__/tournament-admins.test.tsx` — each asserts no "set state
  after unmount" console error when a debounced/async result resolves after
  unmount, plus the normal mounted-resolve path still renders correctly.

Verified: `npm run lint` clean at error level, `npx tsc --noEmit` clean,
`npm run test:ci` 181/181 passing (coverage 90.63%/82.59%/85.29%/96.25%,
all above the ≥80%/≥70%/≥80%/≥80% thresholds).

PR: https://github.com/ksyed0/FDgolf_CodeMie/pull/74

---

BUG-0011: E2E Lifecycle step-08 — player-to-team assignment PATCH never observed, timeout
Severity: Medium (cascades to steps 10, 11, 12)
Related Story: N/A (E2E test infra)
Status: Fixed
Fix Branch: bugfix/BUG-0011-e2e-tournament-players-wait
Lesson Encoded: No

`tests/e2e/tournament-lifecycle.spec.ts:420` step-08 ("admin assigns Alex → Team Alpha
and Blake → Team Beta") timed out after 30s on:

```
adminPage.waitForResponse(
  (r) => r.url().includes('/rest/v1/players') && r.request().method() === 'PATCH'
)
```

This step was unreachable before BUG-0010 was fixed (the whole spec failed earlier, at
step-05), so this was a newly-exposed, previously-undiagnosed failure — not a regression
introduced by the BUG-0010 fix. Confirmed root cause: same defect class as L-0016
(schema drift after migration 011) — `assignPlayer()` in `teams-manager.tsx:84-90`
upserts into `tournament_players` (a `POST` with `Prefer: resolution=merge-duplicates`),
not a `PATCH` against `players.team_id`, which migration `011_tournament_players.sql:122`
dropped entirely.

Cascades: steps 10, 11, 12 were skipped due to declared serial dependency on step-08.

Fix approach: unblocking step-08 exposed three further, previously-unreachable issues
that were fixed in the same branch (same discovery-cascade pattern as BUG-0010):

1. **Test**: updated step-08's `waitForResponse` predicate to match
   `/rest/v1/tournament_players` + `POST` (the actual request `assignPlayer()`'s upsert
   issues), confirmed via a Playwright trace of the real request.
2. **App** (`src/app/(player)/round/page.tsx`): the round page's `tpData` query for
   teammates (used to build the "Who's hitting?" `PlayerPills` selector) did not exclude
   the current player, so the logged-in player's own pill rendered twice (a duplicate-key
   React warning, confirmed via screenshot). Added `.neq('player_id', playerData.id)`.
   This in turn meant `teammates` no longer contained the current player, so the "This
   hole" shot-history list's `shooter?.name ?? 'Unknown'` lookup showed "Unknown" for the
   player's own shots — fixed by special-casing `shot.player_id === player?.id` to use
   `player` directly.
3. **Test**: `scoreHole()`'s outcome-button matcher used an anchored
   `` new RegExp(`^${outcome}$`, 'i') `` pattern with the literal outcome string
   `'Sunk!'`, but the actual button's accessible name is `⛳ Sunk` (see
   `shot-outcome-buttons.tsx:24`) — never a match. Playwright's `.click()` auto-waits
   for the locator to resolve, so this caused an indefinite retry/hang (confirmed via
   trace: a `before` call record for the click with no matching `after` record, and no
   corresponding network request ever fired). Fixed by matching on substring (`'Sunk'`)
   instead of an anchored exact pattern.
4. **Test**: steps 10/11 asserted the current player's own pill by first name
   (`/^alex$/i` / `/^blake$/i`), but `PlayerPills` always renders `'You'` for the
   current user's own pill, never their first name. Fixed both assertions to `/you/i`.

Verified: full `chromium-lifecycle` E2E spec (11/11) passes; `tsc --noEmit` clean;
`npm run lint` clean at error level; `npm run test:ci` green (173/173).

---

BUG-0010: E2E Lifecycle step-05 — "Add Tournament" button never found at /admin/tournament
Severity: Medium (cascades to 6 downstream steps)
Related Story: N/A (E2E test infra)
Status: Fixed
Fix Branch: fix/BUG-0010-lifecycle-add-tournament
Lesson Encoded: No

`tests/e2e/tournament-lifecycle.spec.ts:235` navigated to `/admin/tournament` (singular)
and called `getByRole('button', { name: /add tournament/i }).click()`. The button never
became available — test timed out at 30s with "Target page, context or browser has
been closed". The failure cascaded: steps 06, 07, 08, 10, 11, 12 were skipped due to
declared serial dependencies.

Confirmed root cause: `/admin/tournament` (singular) is the scoped operational
dashboard for whichever tournament is "active" per the active-tournament cookie. It
only renders TournamentManager's create/edit form when no tournament is currently
active/paused. `global-setup.ts` deliberately activates the seeded CIBC tournament
before the whole suite runs (so round-scoring/leaderboard specs have an active
tournament to exercise), so by the time this spec ran, `/admin/tournament` always
showed the read-only TournamentControlDashboard — it never had an "Add Tournament"
button to find. Tournament _creation_ lives at `/admin/tournaments` (plural) — the
system_admin-only global list (TournamentsList).

Fix: step-05 now navigates to `/admin/tournaments` and creates the tournament via
TournamentsList's Add form (a native `<select>`-based form, unlike
VenueManager/CourseManager/TournamentManager's Radix comboboxes — added a
`selectNativeByLabel()` helper for it, and the slug must be filled explicitly since
this form doesn't auto-fill it from the name). Step-06 then clicks "Manage" on the
Lionhead card to set the active-tournament cookie and route to `/admin/tournament`,
where it exercises the existing edit/activate flow.

While verifying the cascade, two more pre-existing, previously-unreached test bugs
were exposed and fixed in this branch since they directly blocked confirming steps
06/07 pass: (1) step-06's `getByText('Lionhead Spring Classic 2026')` hit Playwright
strict-mode because the name also appears in the nav's active-tournament switcher —
scoped to the table row instead; (2) step-07 asserted team names render as
`input[value=...]`, but `teams-manager.tsx:240` renders them as a plain `<span>` in
the list view — switched to `getByText(..., { exact: true })`.

Step-08 onward still fails — this was never reachable before BUG-0010 was fixed and is
a distinct issue, filed separately as **BUG-0011** rather than folded into this fix to
keep the BUG-0010 change scoped to the tournament-creation routing problem.

Read the original trace at
`tests/e2e/screenshots/tournament-lifecycle-Tourn-1f177-ionhead-Spring-Classic-2026-chromium-lifecycle/error-context.md`
for the page snapshot at the original failure.

---

BUG-0009: E2E TC-0086 — admin teams page "H{n}" starting-hole badge selector misses
Severity: Low
Related Story: N/A (E2E test infra)
Status: Fixed
Fix Branch: fix/BUG-0009-admin-teams-hole-badge
Lesson Encoded: Yes

`tests/e2e/admin.spec.ts:408` asserts `getByText(/^H\d+$/).first()` for the starting-
hole badge on each team card. Selector found zero elements.

**Root cause (confirmed)**: the badge format was never wrong. `teams-manager.tsx:249`
renders `H{team.starting_hole ?? 1}` exactly, which matches `^H\d+$` perfectly. The
real problem is that `/admin/teams` is an SSR page (`page.tsx` fetches
`supabase.from('teams')` server-side and passes the rows to `TeamsManager` as props),
and `supabase/seed.sql` never inserts any `teams` rows. After a clean
`supabase db reset`, the `teams` table is empty, so zero cards render and the regex
correctly finds nothing — not a text/format mismatch, a missing-fixture-data bug.
`page.route()` mocks in the spec (`mockSupabaseTable`) cannot fix this because they
only intercept browser-side requests, not the server-side SSR fetch (see L-0006).

**Fix**: added `seedTeams()` to `tests/e2e/global-setup.ts`, called from the main
`globalSetup()` flow after `seedTournament()`. It upserts two fixture teams
(`onConflict: 'tournament_id,team_number'`, idempotent) into the active E2E
tournament. Fixture team names ("Foxes", "Hawks") were deliberately chosen to avoid
the words Eagle/Birdie/Par/Bogey, which collide with the score-legend chip text
asserted by TC-0088 (`getByText('Eagle')` would otherwise also match a team named
"Eagles" in the scores table). No changes to `teams-manager.tsx` — the component and
the original `^H\d+$` selector were both already correct.

---

BUG-0008: E2E TC-0067 — TV leaderboard first team name reported as hidden across 14 matches
Severity: Low
Related Story: N/A (E2E test infra)
Status: Fixed
Fix Branch: fix/BUG-0008-tv-leaderboard-rotator-wait
Lesson Encoded: Yes

`tests/e2e/tv-leaderboard.spec.ts:97` asserted `getByText(fakeLeaderboard[0].team_name).first().toBeVisible()`.
Locator resolved to **14 elements** all of which were hidden.

**Confirmed root cause (two distinct bugs, both required for TC-0067 to pass):**

1. **Locator collision, not rotator timing.** `TvStatsRotator` (`src/components/tv/TvStatsRotator.tsx`)
   is purely state-driven: it takes a controlled `activePanelIndex` prop and renders
   all 5 panels simultaneously, hiding inactive ones via `opacity-0 pointer-events-none`
   (not `display:none`). The parent `TvDisplay.tsx` owns `activePanelIndex` (default
   `0`) and rotates it via `setInterval(..., 15_000)` — panel index 4 ("Team Spotlight",
   `TvTeamSpotlightPanel`) is only reached 60s after mount, long after the test's 5s
   assertion window. `TvTeamSpotlightPanel` also renders the leader's team name
   (`teamSpotlight.teamName`), so the original unscoped `page.getByText(...)` could
   resolve `.first()` to that hidden rotator copy instead of the always-visible
   `TvLeaderboard` sidebar row. Fix: added `data-testid="tv-leaderboard-panel"` to
   `TvLeaderboard`'s root element and scoped all TC-0067 assertions to
   `page.getByTestId('tv-leaderboard-panel')`. A Tailwind-class-based locator was
   tried first (`div.h-full.flex.flex-col.overflow-hidden`) but Tailwind's utility
   classes are reused broadly enough — including on `TvDisplay`'s outer scaled
   wrapper, which contains both the sidebar and the rotator — that it failed to
   disambiguate; a dedicated `data-testid` is the robust fix per the "stat-rotator
   needs panel-targeting, not `.first()` on shared text" lesson (see LESSONS.md).
2. **Separate, pre-existing fixture/layout bug that also blocked the assertion.**
   `tests/e2e/helpers/fixtures.ts`'s `fakeLeaderboard` was missing `par_total`
   (required by `LeaderboardRow` in `src/lib/types.ts`). `TvLeaderboard.tsx` computes
   `vsParVal = row.total_score - row.par_total`, so the missing field produced `NaN`,
   rendered as `"+NaN"` in the Sc column. That overflow, combined with the
   leaderboard sidebar's width (`25%` of the 980px TV design width in
   `TvDisplay.tsx`, ≈204px of usable row content after padding/margin), squeezed the
   row's `1fr` Team-name grid track down to ~4px — `truncate` rendered the team-name
   span at effectively zero width, which Playwright correctly reports as not
   visible. Fixed the fixture to provide realistic `par_total`/`total_score` values,
   and widened the sidebar from `25%` to `34%` (TvDisplay.tsx) — the minimum that
   keeps the Team column's `1fr` track legible (~90px) without reflowing the
   rotator panels on the right. (The original UI spec called for a 45% sidebar;
   this is a partial restoration, not a full redesign — out of scope for this fix.)

Verified via `npx playwright test tests/e2e/tv-leaderboard.spec.ts --project=chromium-tv`
across 7+ full-suite runs (cold start + warm cache), all 8 tests passing every time.

See `tests/e2e/screenshots/tv-leaderboard-TC-0067-lea-5e72c-eam-rows-and-column-headers-chromium-tv/`
for the original trace.

---

BUG-0001: E2E TC-0049 selector matched pencil button instead of name input
Severity: Low
Related Story: US-0023
Status: Fixed
Fix Branch: develop (direct commit f4ca356)
Lesson Encoded: No

The TC-0049 test used `getByLabel(/tournament name|name/i)` which resolved to the
`<button aria-label="Edit tournament name">` pencil icon rather than the text input.
Fix: click the pencil button first to enter edit mode, then target `getByRole('textbox')`.
The component's `<Input>` has no associated label — tests must follow the two-step
click-to-edit interaction pattern.

BUG-0002: E2E TC-0056 referenced non-existent "team number" form field
Severity: Low
Related Story: US-0021
Status: Fixed
Fix Branch: develop (direct commit f4ca356)
Lesson Encoded: No

The TC-0056 test called `getByLabel(/team number/i)` but `team_number` is auto-generated
(max existing + 1) and has no input in the Add Team form. The form uses a `placeholder`
attribute (not `htmlFor` label association) for team name, and a bare `<label>` without
`htmlFor` for starting hole. Fix: use `getByPlaceholder(/team name/i)` and
`locator('input[type="number"]')`.

BUG-0003: Sunk shot written twice — SyncEngine queue + direct Supabase upsert
Severity: Medium
Related Story: US-0021
Status: Fixed
Fix Branch: develop (direct commit 251c366)
Lesson Encoded: No

In `src/app/(player)/round/page.tsx`, when `outcome === 'sunk'` is recorded, the score
row is (1) enqueued to the SyncEngine offline write queue AND (2) immediately upserted
directly via `supabase.from('scores').upsert(...)`. The direct upsert is idempotent
(ON CONFLICT on player_id + tournament_id + hole_number), so the database result is
correct. However the SyncEngine will also flush the same row on its next retry cycle,
causing a redundant write. In a network-degraded environment this means two inflight
requests for the same row. Fix: skip the SyncEngine enqueue when `outcome === 'sunk'`
(since the direct upsert is already the canonical path for score submission), or
remove the direct upsert and rely solely on the SyncEngine.

BUG-0004: glob HIGH CVE (GHSA-5j98-mcp5-4vw2) via eslint-config-next dev dependency
Severity: High
Related Story: N/A (CI security scan)
Status: Fixed — resolved by upgrading eslint-config-next to 16.2.9 (PR #14)
Fix Branch: feature/upgrade-nextjs-16 (squash-merged to develop)
Lesson Encoded: No

`glob@10.2.0 - 10.4.5` bundled inside `@next/eslint-plugin-next` (a transitive dep of
`eslint-config-next@14.x`) contains a CLI command injection vulnerability: when the
`-c/--cmd` flag is used with shell:true, an attacker can inject arbitrary shell commands
via glob pattern input. The affected code path only runs in the ESLint toolchain during
development builds — it is never present in the production bundle and is not reachable
at runtime on Vercel.

Fixed by upgrading `eslint-config-next` from 14.x to 16.2.9 in PR #14.

Advisory: https://github.com/advisories/GHSA-5j98-mcp5-4vw2

BUG-0005: next@14.x — 14 HIGH-severity CVEs with no non-breaking patch
Severity: High
Related Story: N/A (CI security scan)
Status: Fixed — resolved by upgrading next to 16.2.9 (PR #14)
Fix Branch: feature/upgrade-nextjs-16 (squash-merged to develop)
Lesson Encoded: No

`next@14.2.35` (latest 14.x) contained 14 HIGH-severity advisories. All are fixed in
`next@16.2.9`. The resolved CVEs:

- GHSA-9g9p-9gw9-jx7f DoS via Image Optimizer remotePatterns (self-hosted)
- GHSA-h25m-26qc-wcjf HTTP request deserialization DoS via RSC (self-hosted)
- GHSA-ggv3-7p47-pfv8 HTTP request smuggling in rewrites (self-hosted)
- GHSA-3x4c-7xq6-9pq8 Unbounded next/image disk cache growth (self-hosted)
- GHSA-q4gf-8mx6-v5v3 DoS via Server Components (self-hosted)
- GHSA-8h8q-6873-q5fj DoS via Server Components (self-hosted)
- GHSA-3g8h-86w9-wvmq Middleware/Proxy redirect cache-poisoning
- GHSA-ffhc-5mcf-pf4q XSS in App Router apps using CSP nonces
- GHSA-vfv6-92ff-j949 Cache poisoning via RSC cache-busting collisions
- GHSA-gx5p-jg67-6x7h XSS in beforeInteractive scripts with untrusted input
- GHSA-h64f-5h5j-jqjh DoS in Image Optimization API
- GHSA-c4j6-fc7j-m34r SSRF via WebSocket upgrades
- GHSA-wfc6-r584-vfw7 Cache poisoning in RSC responses
- GHSA-36qx-fr4f-26g5 Middleware/Proxy bypass in Pages Router i18n

Fixed by upgrading `next` from 14.2.35 to 16.2.9 and `eslint-config-next` from 14.2.35
to 16.2.9 in PR #14. `npm audit --audit-level=high` now exits 0 (only 2 moderate remain).

BUG-0006: CodeQL SARIF upload fails — Advanced Security requires GitHub Organization account
Severity: Low
Related Story: N/A (CI setup)
Status: Fixed — repo made public; continue-on-error removed; CodeQL now blocks PRs
Fix Branch: develop (direct commit)
Lesson Encoded: No

The `codeql.yml` workflow fails with:
"Code scanning is not enabled for this repository. Please enable code scanning in
the repository settings."

Root cause: GitHub Code Scanning / Advanced Security is only available on Organization
accounts (Team or Enterprise plan). The repo is on a personal GitHub Pro account —
the Security Overview page shows "Advanced Security is only available for Organizations"
with no enable option. This is a billing tier restriction, not a configuration gap.

The CodeQL analysis steps run successfully and surface findings in the workflow logs,
but cannot POST SARIF results to the GitHub Security tab without an org-level GHAS license.

Resolution: `continue-on-error: true` on the `analyze` job is the correct permanent state.
CodeQL runs as a best-effort scan on every PR; PRs are not blocked. Dependabot alerts
(free on all plans) enabled separately to cover the same CVE surface in the Security tab.

Options if full SARIF dashboard is needed in future:

1. Transfer repo to a GitHub Organization + upgrade to Team plan
2. Make repo public — unlocks Code Scanning at no cost
3. Use a third-party SAST tool (Semgrep, Snyk) that reports outside GitHub Security tab

BUG-0007: E2E shot-queue tests fail because they assert on the wrong localStorage key
Severity: Medium
Related Story: N/A (test infrastructure)
Steps to Reproduce:

1. Run `npx playwright test tests/e2e/round-scoring.spec.ts --project=chromium-mobile`
2. Observe TC-0030, TC-0031, TC-0026, TC-0064 fail.
   Expected: All four tests pass.
   Actual:

- TC-0030/0031/0026 read `localStorage.getItem('fdgolf_sync_queue')` and receive null;
  the actual SyncEngine key is `fdgolf-cm_sync_queue` (post-rebrand). Even if the key
  matched, the queue drains on first flush because the in-test Supabase mock makes
  the outbound POST succeed instantly.
- TC-0064 seeds three queue entries via `addInitScript` under the same wrong key,
  so the offline indicator never sees them.
  Status: Fixed
  Fix Branch: bugfix/BUG-0007-flaky-shot-queue-e2e-tests
  Lesson Encoded: No

Fix approach:

- TC-0030/0031: replace post-hoc localStorage read with `page.waitForRequest` against
  the Supabase REST POST (the pattern TC-0029 already uses); assert the parsed POST
  body's `outcome` field.
- TC-0026: same `waitForRequest` pattern, but force the POST to fail via the new
  `mockShotsApi(page, { fail: true })` option so the queue persists, then read the
  correct localStorage key.
- TC-0064: write the seed payload under the correct key (`fdgolf-cm_sync_queue`)
  with the matching `created_at` field, and fail the POST so the seeded entries
  don't drain before the indicator renders.
- `mockShotsApi` now also intercepts `${SB_URL}/rest/v1/shots` (where SyncEngine
  actually writes) and accepts a `{ fail }` flag.
