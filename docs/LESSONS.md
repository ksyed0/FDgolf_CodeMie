# Lessons Learned

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
