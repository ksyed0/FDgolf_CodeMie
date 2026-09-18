# Lessons Learned

## L-0019 — Stat-rotator-style components need test waits or panel-targeting, not `.first()` on shared text

@session: 40 — 2026-06-30

**Symptom**: BUG-0008 — TC-0067 asserted
`page.getByText(fakeLeaderboard[0].team_name).first().toBeVisible()` on the TV
leaderboard route and the locator resolved to **14 matched elements, all hidden**.
PR #43 had already renamed team fixtures away from stat-panel-label collisions
(Eagles→Hawks etc.), but the failure persisted.

**Root cause**: `TvStatsRotator` (`src/components/tv/TvStatsRotator.tsx`) mounts
all 5 of its panels simultaneously and hides inactive ones via
`opacity-0 pointer-events-none` (not `display:none`) — the parent `TvDisplay.tsx`
owns a controlled `activePanelIndex` prop, rotated by `setInterval(..., 15_000)`.
One of those panels (`TvTeamSpotlightPanel`, index 4) independently renders the
leader's team name. An unscoped `page.getByText(team_name)` therefore matches
*both* the always-visible `TvLeaderboard` sidebar row *and* the hidden rotator
copy — and `.first()` resolves by DOM order, not visibility, so it can land on
the hidden one. The rotator's 15s interval makes this look like a timing bug
("the test asserts before rotation completes"), but the panel never needed to be
the active one — the assertion target lives in an entirely different, always-on
component.

**Rules**:

- For any component that mounts multiple state-toggled "panels"/"slides"/"steps"
  simultaneously and hides inactive ones with CSS (opacity, visibility, or
  `pointer-events`) rather than unmounting them, **never assert on bare,
  page-wide `getByText(...)` for content that could plausibly also appear in
  another panel.** Scope the locator to the specific panel/container you intend
  to test, via a `data-testid` on that panel's root element.
- Prefer a dedicated `data-testid` over a CSS-class-based locator for this kind
  of scoping. Tailwind utility classes are reused broadly across a component
  tree (e.g. `flex flex-col h-full overflow-hidden` matched both the intended
  sidebar root *and* the page's outer scaled wrapper that contains everything,
  including the rotator) — a class subset match is not guaranteed unique even
  when it looks distinctive while reading the source.
- Don't reach for `waitForTimeout(rotatorIntervalMs)` to "wait for the right
  panel to rotate in" as the first fix — it's slow (multiplies by however many
  panels deep the target is), brittle to future interval/panel-count changes,
  and often unnecessary: check whether the assertion target actually lives in
  an always-visible sibling component first, the way `TvLeaderboard` does here.
- A second, independent bug can hide behind the first: after fixing the locator
  scoping, TC-0067 still failed because the leaderboard fixture
  (`tests/e2e/helpers/fixtures.ts`) was missing `par_total` (required by
  `LeaderboardRow`), producing `"+NaN"` text that overflowed its grid column and
  squeezed the adjacent `1fr` Team-name track down to ~4px — effectively
  zero-width and correctly reported as not visible. Don't stop investigating
  once the obvious/documented cause is fixed if the assertion still fails for a
  different reason; re-measure (`getBoundingClientRect()`, computed styles) the
  actual DOM rather than re-guessing from the component source.

**Applies to**: Any E2E test against a tab/carousel/rotator/wizard-step
component where multiple "views" are kept mounted and toggled via CSS rather
than conditional rendering — common in TV/kiosk displays, onboarding flows, and
tabbed admin panels in this codebase.

---

## L-0018 — A failing selector against an SSR card grid may mean "no data", not "wrong text"
@session: 39 — 2026-06-30

**Symptom**: TC-0086 asserted `getByText(/^H\d+$/).first()` for the starting-hole
badge on `/admin/teams` team cards and found zero elements. BUG-0009's writeup
assumed (reasonably, per L-0009/L-0013 precedent) that the badge text format had
drifted during a redesign — "Hole 7" instead of "H7", or moved off visible text.

**Root cause**: none of that. `teams-manager.tsx` renders `H{team.starting_hole ?? 1}`
exactly as the test expects. The actual problem: `/admin/teams` is an SSR page
(`page.tsx` fetches `supabase.from('teams')` server-side, passes rows as props), and
`supabase/seed.sql` never inserts any `teams` rows. After a clean `supabase db reset`
the table is empty — zero cards render, so the regex correctly matches nothing. The
test had silently depended on leftover teams from manual/demo sessions that no
longer existed once the DB was reset to a clean baseline.

**Why this is sneaky**: a `getByText(regex)` selector that resolves to zero elements
*looks* exactly the same whether the text format changed or the underlying list is
simply empty. Both produce "0 elements" — Playwright gives no signal to distinguish
"text doesn't match anything that exists" from "nothing exists to match".

**Rules**:
- Before assuming a UI text/selector drift, check whether the page actually has data
  to render at all — query the table directly (`curl .../rest/v1/<table>` against the
  local Supabase REST API, or `supabase db reset` then re-check) rather than reading
  only the component source.
- For any **SSR** admin page (no `'use client'` directive in `page.tsx`) whose E2E
  test asserts on real rendered rows, the row data must come from either `seed.sql`
  or `tests/e2e/global-setup.ts` — `page.route()` / `mockSupabaseTable` mocks never
  reach a server-side fetch (L-0006 already covers this; this lesson adds the
  failure-mode-looks-identical corollary).
- When adding fixture seed data (team/player/club names) to `global-setup.ts`, avoid
  words that collide with other tests' text assertions in the same spec file — e.g.
  "Eagles"/"Birdies" as team names collide with the Eagle/Birdie/Par/Bogey score
  legend chips on `/admin/scores` (TC-0088). Grep the spec file for the candidate
  name before picking it.

**Applies to**: Any E2E test for an SSR Server Component page that asserts on
rendered list/grid content backed by a table `seed.sql` doesn't populate.

---

## L-0017 — Cost-log hook dirties the worktree; commit it BEFORE `gh pr merge`
@session: 38 — 2026-06-30

**Symptom**: `gh pr merge 45 --squash --delete-branch` exited 1 with `error: Your local changes to the following files would be overwritten by checkout: docs/AI_COST_LOG.md`. Crucially, the **server-side merge actually succeeded** — only the local branch-delete step failed. The error message was misleading: it looked like the whole merge had aborted, but the PR was already merged. Later, a cost-log row I pushed to the branch *after* that point never reached `develop` because the PR had already squashed without it.

**Root cause**: The cost accumulator hook writes to `docs/AI_COST_LOG.md` continuously during a session. `gh pr merge --delete-branch` checks out the default branch locally so it can delete the head branch — and that checkout aborts on a dirty working tree. Even when the merge succeeds, any commits pushed to the head branch *after* `gh pr merge` returned are orphaned: the PR squash already locked in a base SHA.

**Rules**:
- Before any `gh pr merge` (any flavor), run `git status` and commit `docs/AI_COST_LOG.md` if it's dirty. Same rule that already applied to `git stash` / branch-switch — extend it to PR merges.
- After `gh pr merge` returns success, *do not* push further commits to that branch expecting them to land. The squash is final; new commits are orphans even if the remote branch still exists for a moment.
- If `gh pr merge` errors with the dirty-working-tree message, re-check the PR state on GitHub before assuming the merge failed. It almost certainly succeeded server-side; the local cleanup is what errored. Use `gh pr view <n> --json state,mergedAt` to confirm.
- If a cost-log row is stranded post-merge, the recovery is a tiny new PR appending it to develop — already a well-trodden pattern (PR #48, PR #51). It's not catastrophic, just noise.

---

## L-0016 — E2E test fixtures rot when migrations change column shape
@session: 37 — 2026-06-29

**Symptom**: After Supabase grants were restored, e2e globalSetup logged `Could not find the 'venue' column of 'tournaments' in the schema cache` and the lifecycle test logged `Could not find the 'team_id' column of 'players'`. Both: tests insert columns the schema no longer has.

**Root cause**: Schema migrations land cleanly with CI green (Jest doesn't touch the DB), but the E2E fixture code that hand-rolls `admin.from('x').insert(...)` was never updated. The bug stays latent for months — only surfaces when someone actually runs the E2E suite locally.

- Migration 007 (2026-06-11) replaced `tournaments.venue` text → `venue_id`/`course_id` NOT NULL FKs. `tests/e2e/global-setup.ts` kept inserting `venue: '...'`.
- Migration 011 (2026-06-20) dropped `players.team_id` (moved to `tournament_players` join table). `tests/e2e/tournament-lifecycle.spec.ts` kept inserting `team_id: null`.

**Rules**:
- When a migration drops/renames a column, `grep -r "<column-name>" tests/` (e2e folder especially) in the same PR. Update the inserts or the test will fail the moment the e2e suite runs.
- When a migration introduces a new required-for-flow join table (like `tournament_players`), audit the test mocks for any spec that calls the affected pages — see L-0014's tournament_players fix touching round-scoring + leaderboard.
- Don't treat "CI green" as "tests can run against current schema" — if E2E isn't in CI, it can rot for weeks. Either add it to CI (with a hosted test project or service container) or run it as a pre-release gate every Nth PR.

---

## L-0015 — Next.js 16 forbids cookie writes from Server Components
@session: 37 — 2026-06-29

**Symptom**: `Error: Cookies can only be modified in a Server Action or Route Handler` in dev console + Next.js error overlay; admin layout cookie didn't persist between renders; 26 admin E2E tests failed because admin pages crashed.

**Root cause**: Next.js 16 tightened the rule — `cookies().set()` from a Server Component (page or layout render) throws synchronously. The `@supabase/ssr` server client wrapper already handles this for auth refresh cookies via try/catch, but other ad-hoc cookies (like `(admin)/layout.tsx`'s `ACTIVE_TOURNAMENT_COOKIE`) need the same treatment.

**The pattern**:
```ts
try {
  const store = await cookies();
  store.set(NAME, value, options);
} catch {
  // Server Component context — cookie will land on the next request that
  // hits a Server Action or Route Handler. The in-memory state still
  // renders correctly this pass.
}
```

**Rules**:
- Any `cookies().set()` outside `app/api/**/route.ts` or `'use server'` action handlers needs the try/catch wrapper.
- This bug class doesn't show up in Jest unit tests — it requires the actual Next.js render pipeline. Add at least one E2E smoke test that hits each layout's route to catch these in CI.
- When upgrading Next.js major versions, grep for `cookies()` callsites and review each — semantic changes are common in the cookies/headers/auth API surface.

---

## L-0014 — Supabase CLI default flips silently lock the Data API
@session: 37 — 2026-06-29

**Symptom**: Fresh `supabase start` on 2026-06-29 left every public-schema table inaccessible to anon/authenticated/service_role. Tests failed with `permission denied for table players` (a GRANT-level error, not RLS — RLS would say "violates row-level security policy"). Verified via:
```sql
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='players';
```
Only `postgres` had DML privileges.

**Root cause**: The Supabase CLI's `api.auto_expose_new_tables` config field's implicit default **flipped from `true` to `false` on 2026-05-30** to match the new hosted-cloud default. Migrations 001–013 were authored under the old default, so none of them include explicit GRANTs. The moment the flag flipped, every table created since migration 001 became inaccessible to API roles on a fresh `db reset`.

**Three more sneaky aspects**:
1. **No app code or migrations changed** — failure mode appears only on a fresh local stack, not hosted.
2. **CI didn't catch it** because Jest doesn't exercise PostgREST. CI was green throughout.
3. **The flag is REMOVED entirely on 2026-10-30**, so setting it to `true` is a stopgap, not a fix. The deprecation warning from the CLI is the only nudge.

**Rules**:
- Treat platform-side default flips as P1 platform debt — schedule the migration before the hard deadline (here: explicit GRANTs in a new migration before 2026-10-30).
- When `permission denied for table` shows up with service_role, check `information_schema.role_table_grants` BEFORE assuming an RLS misconfig. The two error classes look similar but have different fixes.
- For any platform you depend on (Supabase, Vercel, Next.js), skim deprecation notices on the upgrade path — especially "implicit default flips" with a calendar date attached.

---

## L-0013 — Admin page redesigns from `<table>` to cards silently break E2E role-based locators
@session: 36 — 2026-06-29

**Symptom**: Lifecycle E2E step-02 (`admin creates Lionhead Golf Club venue`) times out at 30s. `await adminPage.getByRole('button', { name: /^add venue$/i }).last().click()` resolves to zero elements.

**Root cause #1 — submit button label**: The form's submit button reads **"Save Venue"** (or "Update Venue" when editing) — never "Add Venue". The "+ Add Venue" header button doesn't match `^add venue$` either (the `+` prefix breaks the anchor). The test was written when the button presumably said "Add Venue" — a later UI redesign changed the label without updating the test.

**Root cause #2 — cells vs paragraphs**: A separate but related issue in the same step: the post-toast assertion used `getByRole('cell', { name: 'Lionhead Golf Club' })`. The page was redesigned from a `<table>` to cards (`<p>` inside a div), so no `cell` role ever appears.

**Why this is sneaky**: Both failures look like the form/page just hangs. Reading the trace's `page snapshot` makes the mismatch obvious — the form was open and filled, with buttons labelled `Cancel` + `Save Venue`. Without the snapshot, you'd waste time on timing/race-condition hypotheses.

**Rules**:
- When porting an admin page from `<table>` to cards (or vice-versa), grep `tests/e2e/` for `getByRole('cell'...)`, `getByRole('row'...)`, and `tr.filter(...)` against that page's keywords. These selectors silently stop matching when the underlying DOM changes role.
- Prefer `getByText(name).first()` for venue/team/course names rendered as cards — robust across `<p>`, `<span>`, `<h*>` redesigns. Only use `getByRole('cell', ...)` when the table semantic is intentional.
- For form submit buttons, look at the source (`venue-manager.tsx:162`) rather than guessing — Save/Update/Add labels are NOT interchangeable, and a regex like `/^add venue$/i` won't match "Save Venue".
- **First debugging step for E2E timeouts**: read `tests/e2e/screenshots/<test-id>/error-context.md`. It contains the page snapshot at the moment of failure with refs and labels — usually reveals the mismatch in one read.

---

## L-0012 — GPS `start_lat/lng` records WHERE the player IS (before the shot), not where the ball lands
@session: 35 — 2026-06-26

**Symptom**: TV "Longest Drive" showed 40,000 yards during kiosk demo.

**Root cause**: The foreground Playwright browser reported downtown Toronto GPS (lng ≈ -79.38) while Lionhead tee boxes are in Brampton (lng ≈ -79.84). The calculation `distance(shot_1.start, tee)` was intended to measure drive distance but is architecturally wrong: shot_1.start IS the tee position, so this is always ~0 for correctly recorded shots.

**GPS model**: `shots.start_lat/lng` = where the player stands to take the shot = ball's resting spot. Shot_1 starts at the tee; shot_2 starts where the ball landed after the drive. Longest drive = `distance(tee, shot_2.start)`.

**Rules**:
- When computing GPS-based stats, always check: "what does start_lat/lng actually represent?" — it's the player's position BEFORE the shot, not after.
- Mock browser geolocation in Playwright test/demo contexts via `browser.newContext({ geolocation, permissions })` + `context.setGeolocation()` per location change.
- Add a sanity cap (e.g. 550m for longest drive) to filter GPS outliers from wrong-location readings.

**Applies to**: Any stat derived from `shots.start_lat/lng` (distance, closest-to-pin, GPS heatmaps).

---

## L-0011 — When intentionally widening score distribution, update test bounds immediately
@session: 32 — 2026-06-23

**Symptom**: 3 Jest tests failed on `generateScore` — all asserting `score >= par`. They were correct for the original bogey-only implementation, but broke after birdies/eagles were added.

**Root cause**: Tests encoded the old contract (`[par, par+4]`) rather than the invariants of the underlying function (`max(1, par+vspar)` with a defined probability table). When the implementation changed intentionally, the tests became incorrect regressions.

**Rules**:
- When you change a function's output distribution intentionally, update the tests in the same commit.
- Test the structural invariant (`max(1, par-2)` to `par+2`) rather than the specific old behavior.
- Add a statistical test (e.g. "at least 1 sub-par score in 200 trials") to verify the new behavior is reachable — probability-based assertions catch silent fallbacks.

**Applies to**: Any function with probabilistic output (score generators, random samplers, weighted selectors).

---

## L-0010 — Admin pages have a strict design system — always check DESIGN_STANDARDS.md
@session: 29 — 2026-06-21

**Symptom**: New page components written with generic Tailwind classes (`rounded-lg`, `border-gray-200`, `text-sm`, `text-gray-500`, raw `<input>` elements) that don't match the existing admin design language.

**Root cause**: AI agents default to generic Tailwind patterns when design tokens aren't explicitly specified. The existing admin pages use a strict custom palette (`#15241c`, `#e2e8df`, etc.), `rounded-2xl` cards, `AdminTopBar`, shadcn `Input`/`Label`, and `sonner` toasts — none of which are defaults.

**Rule**: Before writing any admin UI, read `docs/DESIGN_STANDARDS.md`. Implementer agents must be explicitly told to read it — include it in every admin implementation task brief.

**Applies to**: Any new admin page or component under `src/app/(admin)/admin/`.

---

## L-0009 — E2E test selectors must track UI text exactly — not spec intent
@session: 27 — 2026-06-20

**Symptom**: 13 Playwright tests failed after session-25 UI redesign: button labels changed ("Send Invite" → "Send", "OOB" → "Out of Bounds"), column headers changed ("Scr" → "Sc"), page sections replaced (`TournamentManager` → `TournamentControlDashboard`), and subtitle text removed ("Live Leaderboard" → absent).

**Root cause**: Tests were written against the old UI text and structure. When the UI was redesigned, the tests weren't updated alongside the components.

**Rules**:
- When redesigning a page, always audit existing E2E tests for that route in the same PR — treat failing selectors as regressions to fix before merging.
- Read the actual rendered component source (not the spec/plan) to confirm button text, heading levels, and CSS classes before writing a selector. `/^OOB$/i` looks plausible but the component says "Out of Bounds".
- Emoji prefixes break `^` regex anchors: `/^sunk!?$/i` fails against "⛳ Sunk". Always test selectors with `/word/i` (no anchors) when the label might have leading decoration.
- `data-active` attributes on interactive elements are valuable for testability — document them as a contract in the component if you add them; removing them silently breaks tests.

**Applies to**: Any E2E test suite — run Playwright on the branch before opening a PR whenever page-level UI has changed.

---

## L-0008 — Admin UI: avoid static hardcoded status values that will never be true
@session: 26 — 2026-06-19

**Symptom**: Final branch reviewer flagged "Pending 0" pill in the players filter bar and "GPS not configured" pill on venues page as showing incorrect information.

**Root cause**: Both were rendered unconditionally without any real computed state — the pending count was hardcoded `0` and GPS status had no underlying data source.

**Rule**: Any status indicator (pill, badge, count) in admin UI must either (a) derive its value from real DB data, or (b) be omitted entirely. A pill that shows a hardcoded value that is never true is worse than no pill — it misleads operators making real decisions.

**Fix pattern**:
- If the state doesn't exist in the DB yet, either remove the pill or show `—` (en-dash) as the value: `⏳ Pending —`
- If the data source is on a different page/entity, move the indicator there (GPS per-hole status belongs on Courses, not Venues)

**Applies to**: Any admin status indicator, count badge, or warning pill.

---

## L-0007 — PostgREST joins require a database FK constraint
@session: 24 — 2026-06-19

**Symptom**: TV stats panels (birdies, momentum, hole difficulty, best achievement) silently returned
empty results. No error visible — the catch block consumed the PostgREST error.

**Root cause**: `scores.hole_number` is a plain `integer` column — there is no FK to `holes.id`.
PostgREST requires an actual database FK constraint to resolve `table!inner(...)` joins. Without one,
the query fails with `PGRST200 — Could not find a relationship between 'scores' and 'holes'`.

**Fix pattern**: When no FK exists (and adding one would require a schema migration), fetch the related
table separately and join in TypeScript:
```typescript
const parMap = new Map<number, number>();
const { data } = await supabase.from('holes').select('hole_number, par').eq('course_id', courseId);
for (const h of data ?? []) parMap.set(h.hole_number, h.par);
// Then: const par = parMap.get(row.hole_number)
```

**PostgREST schema cache**: After adding a policy via raw `psql` (not `supabase db push`), run
`psql ... -c "NOTIFY pgrst, 'reload schema';"` — the REST API caches the schema at startup and won't
see manual DDL until notified.

**Applies to**: Any Supabase query using `relatedTable!inner(...)` or `relatedTable(...)` syntax —
verify a FK exists in the migration before using join syntax.

---

## L-0006 — Playwright `page.route()` cannot mock SSR Server Component fetches
@session: 24 — 2026-06-18

**Symptom**: E2E tests for `/dashboard` and `/scorecard` return stale or real DB data even though `mockSupabaseTable(page, 'tournaments', [...])` is set up in `beforeEach`.

**Root cause**: Next.js App Router Server Components fetch data on the server (Node.js process), not in the browser. `page.route()` intercepts browser-side network requests only — it has no visibility into the server-side `supabase.from(...)` calls that run during SSR.

**Rules**:
- Pages rendered by **Server Components** (no `'use client'` at the top) → must use `hasRealSupabase` guard and assert against actual seeded DB data
- Pages with **Client Components** that fetch on mount (TV display, round scoring) → fully mockable via `page.route()`
- A Server Component page that passes initial data to a Client Component → only the client-side refetch leg is mockable; initial SSR data comes from the real DB

**Fix pattern**: Gate SSR-dependent tests behind `test.skip(!hasRealSupabase, 'requires local Supabase')` and assert on known-seeded values (e.g. `e2e-admin@fdgolf.test` session, CIBC tournament name) rather than fixture strings.

**Applies to**: Any Next.js App Router page that uses `await createClient()` / `supabase.from()` outside of a `useEffect` or event handler.

---

## L-0001 — Initial project setup
@agent: Conductor

PlanVisualizer installed and configured for CodeMie. All tooling bootstrapped from the canonical install script.

---

## L-0003 — Playwright: use `xpath=..` for robust label→input traversal
@session: 22 — 2026-06-18

**Symptom**: `page.locator('div').filter({ has: labelLocator }).locator('input').first()` fills the wrong field — it returns the outermost ancestor div, so `.first()` picks the first input in the entire form.

**Root cause**: `.filter({ has: ... })` accumulates every ancestor that contains the target — the result set may have 12+ divs. `.first()` resolves to the outermost one, not the immediate parent.

**Fix pattern**:
```typescript
async function fillByLabel(page: Page, labelText: string, value: string) {
  await page
    .locator('label', { hasText: labelText })
    .first()
    .locator('xpath=..')   // walk up exactly one DOM level
    .locator('input')
    .first()
    .fill(value)
}
```
Same pattern applies to `[role="combobox"]` and any control that lives next to a label in a form row.

**Applies to**: Any Playwright test where `htmlFor`/`id` associations are not set on form fields.

---

## L-0004 — Migrated DBs can drift from repo migration history
@session: 22 — 2026-06-18

**Symptom**: E2E test clicks `"Driver"` club option but selector finds nothing; actual DB has `"Driver (1W)"`.

**Root cause**: `pg_dump | ssh pg_restore` copies rows verbatim. If seed data was edited in an earlier session before the repo's `seed.sql` was updated, the live DB contains old values. Test briefs and code comments both said `"Driver"`, but actual DB rows said `"Driver (1W)"`.

**Fix pattern**: Before writing E2E selectors for seeded data, query the actual DB:
```sql
SELECT name FROM clubs ORDER BY name LIMIT 5;
```
Do NOT rely on seed files, code comments, or plan briefs — always verify against the running instance.

**Applies to**: Any E2E test against a long-lived local Supabase instance that was migrated from another machine or seeded in an earlier session.

---

## L-0005 — Tailwind arbitrary values: `duration-[400ms]` not `duration-400`
@session: 23 — 2026-06-18

**Symptom**: Code reviewer flags `duration-[400ms]` as "non-standard" and suggests changing to `duration-400`.

**Root cause**: Tailwind's default `transitionDuration` scale contains only: 75, 100, 150, 200, 300, 500, 700, 1000. There is **no** `duration-400`. Using `duration-400` without extending `tailwind.config` produces no CSS at all.

**Correct pattern**: For any duration not in the default scale, use JIT arbitrary value syntax:
```
duration-[400ms]   ✅ correct — generates transition-duration: 400ms
duration-400       ❌ generates nothing (no class match, silently ignored)
```

**Applies to**: Any Tailwind transition/animation class using a non-default value.

---

## L-0002 — Radix Select: never use `value=""` on `<SelectItem>`
@session: 15 — 2026-06-11

**Symptom**: Runtime crash — `"A <Select.Item /> must have a value prop that is not an empty string"` when rendering a `<SelectItem value="">` sentinel option.

**Root cause**: Radix UI's Select component explicitly rejects an empty string as an item value.

**Fix pattern**:
```tsx
// In EMPTY_FORM initializer — use a non-empty sentinel
const EMPTY_FORM = { importFromId: '__none__', ... };

// In JSX — use the same sentinel as the value
<SelectItem value="__none__">Don't import — set up manually</SelectItem>

// In submit / effect handlers — guard against the sentinel
if (form.importFromId && form.importFromId !== '__none__') {
  // perform import
}
```

**Applies to**: Any Radix Select (shadcn `<Select>`) where you want a "none selected" option.
