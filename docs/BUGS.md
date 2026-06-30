# FDgolf — Bug Tracker

BUG-0011: E2E Lifecycle step-08 — player-to-team assignment PATCH never observed, timeout
Severity: Medium (cascades to steps 10, 11, 12)
Related Story: N/A (E2E test infra)
Status: Open
Fix Branch: TBD
Lesson Encoded: No

`tests/e2e/tournament-lifecycle.spec.ts:420` step-08 ("admin assigns Alex → Team Alpha
and Blake → Team Beta") times out after 30s on:

```
adminPage.waitForResponse(
  (r) => r.url().includes('/rest/v1/players') && r.request().method() === 'PATCH'
)
```

This step was unreachable before BUG-0010 was fixed (the whole spec failed earlier, at
step-05), so this is a newly-exposed, previously-undiagnosed failure — not a regression
introduced by the BUG-0010 fix.

Likely the same defect class as L-0016 (schema drift after migration 011): per Lens's
review of BUG-0010, `assignPlayer()` in `teams-manager.tsx:84-90` upserts into
`tournament_players`, not `players`, and migration `011_tournament_players.sql:122`
dropped `players.team_id` entirely. The test is waiting for a `/rest/v1/players` PATCH
that the app no longer issues — assignment now goes through `tournament_players`
instead. Likely fix: update the test's `waitForResponse` predicate to match the
`tournament_players` table/method actually used by `assignPlayer()`, after confirming
the runtime request shape (PATCH vs POST/upsert) in a trace.

Cascades: steps 10, 11, 12 are skipped due to declared serial dependency on step-08.

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
Status: Open
Fix Branch: TBD
Lesson Encoded: No

`tests/e2e/tv-leaderboard.spec.ts:97` asserts `getByText(fakeLeaderboard[0].team_name).first().toBeVisible()`.
Locator resolves to **14 elements** all of which are hidden. PR #43 renamed the team
fixtures away from stat-panel collisions (Eagles→Hawks etc.), but the failure persists
— suggesting the leaderboard panel itself is hidden when the assertion runs, not a
name collision. The TvStatsRotator likely starts on a different panel and rotates in;
the test asserts before the leaderboard becomes the active panel.

Two viable fixes:

- Wait for the leaderboard panel to become active before asserting (look for the
  panel's wrapping element with `visible: true`, or force the rotator to a specific
  panel via a query param if the component supports it).
- Tighten the locator to "leaderboard panel container .first()" so we don't match the
  team name rendered as a hidden card in another panel.

See `tests/e2e/screenshots/tv-leaderboard-TC-0067-lea-5e72c-eam-rows-and-column-headers-chromium-tv/`
for the trace.

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
