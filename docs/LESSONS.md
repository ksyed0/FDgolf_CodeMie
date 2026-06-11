# Lessons Learned

## L-0001 — Initial project setup
@agent: Conductor

PlanVisualizer installed and configured for CodeMie. All tooling bootstrapped from the canonical install script.

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
