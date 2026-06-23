# Lessons Learned

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
