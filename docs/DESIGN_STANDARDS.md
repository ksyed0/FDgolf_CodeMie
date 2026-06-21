# FDgolf-CM Admin Design Standards

These standards apply to all admin pages under `src/app/(admin)/admin/`. Follow them when creating new pages or modifying existing ones.

---

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| Dark text | `#15241c` | Headings, card titles, primary labels |
| Primary green | `#1a472a` | Primary buttons, active nav, links |
| Secondary text | `#6b7a70` | Subtitles, field labels, meta info |
| Light green bg | `#eef2ea` | Icon tiles, secondary buttons, hover states |
| Border | `#e2e8df` | Card borders, dividers |
| Muted label | `#90a094` | Eyebrow text, placeholder labels |
| Danger text | `#a8513f` | Delete button text, destructive actions |
| Danger bg | `#f7ece9` | Delete button background |
| Page bg | `#f4f7f1` | Admin shell background |

**Never use Tailwind generic grays** (`gray-100`, `gray-500`, etc.) in admin pages — always use the hex tokens above.

---

## Page Header

Every admin page component must start with `<AdminTopBar>`:

```tsx
import { AdminTopBar } from '@/components/admin-top-bar';

<AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Venues">
  <button className="rounded-xl px-4 py-2 text-[13px] font-semibold bg-[#1a472a] text-white">
    + Add Venue
  </button>
</AdminTopBar>
```

- `eyebrow`: ALL CAPS category label (e.g. `"TOURNAMENT MANAGEMENT"`, `"GLOBAL"`)
- `title`: Page name in title case, rendered Barlow Condensed ExtraBold 28px
- `children`: right-side action buttons (optional)

---

## Cards

```tsx
<div className="bg-white rounded-2xl border border-[#e2e8df] p-5 flex items-start gap-4">
  {/* Icon tile */}
  <div
    className="rounded-[13px] bg-[#eef2ea] flex items-center justify-center shrink-0"
    style={{ width: 52, height: 52 }}
  >
    <span style={{ fontSize: 22 }}>📍</span>
  </div>

  {/* Content */}
  <div className="flex-1 min-w-0">
    <p className="font-semibold text-[17px] text-[#15241c]">Card Title</p>
    <p className="text-[13px] text-[#6b7a70] mt-0.5">Subtitle / meta info</p>
    <div className="flex gap-2 mt-2">
      {/* Status badges */}
    </div>
  </div>

  {/* Actions */}
  <div className="flex gap-2 shrink-0">
    <button className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#eef2ea] text-[#1a472a]">Edit</button>
    <button className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#f7ece9] text-[#a8513f]">Delete</button>
  </div>
</div>
```

---

## Buttons

| Variant | Classes |
|---|---|
| Primary | `rounded-xl px-4 py-2 text-[13px] font-semibold bg-[#1a472a] text-white` |
| Secondary / Cancel | `rounded-xl px-3 py-2 text-[13px] font-semibold bg-[#eef2ea] text-[#15241c]` |
| Edit (card action) | `rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#eef2ea] text-[#1a472a]` |
| Delete (card action) | `rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#f7ece9] text-[#a8513f]` |
| Disabled state | Add `disabled:opacity-50` to any button |

**Never use `rounded-lg`** in admin pages — always `rounded-xl` for buttons, `rounded-2xl` for cards.

---

## Status Badges

```tsx
<span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#e9f3ec] text-[#1a472a]">
  Active
</span>
```

Common badge backgrounds:
- Green (active): `bg-[#e9f3ec] text-[#1a472a]`
- Yellow (paused): `bg-[#fef9c3] text-[#854d0e]`
- Blue (complete): `bg-[#e0eeff] text-[#1e4fa0]`
- Gray (setup/inactive): `bg-[#eef2ea] text-[#6b7a70]`

---

## Form Inputs

Use shadcn components — never raw `<input>` or `<label>`:

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<div className="flex flex-col gap-1">
  <Label className="text-xs text-[#6b7a70]">Field Name *</Label>
  <Input value={form.field} onChange={...} className="h-8 text-sm" />
</div>
```

For `<select>` (not in shadcn):
```tsx
<select className="h-8 rounded-md border border-input px-3 text-sm focus:border-[#1a472a] focus:outline-none">
```

---

## Form Placement

- **Add form**: right-side panel, `w-80 shrink-0 bg-white rounded-2xl border border-[#e2e8df] p-6`
- **Edit form**: inline below the card being edited (same card style)
- **Form section title**: `font-barlow font-bold text-[18px] text-[#15241c] mb-4`

```tsx
{/* Page layout */}
<div className="px-7 py-6 flex gap-6">
  {/* Left: card list */}
  <div className="flex-1 flex flex-col gap-4">
    {items.map(item => <Card key={item.id} />)}
  </div>

  {/* Right: add form (shown when adding) */}
  {isAdding && (
    <div className="w-80 shrink-0 bg-white rounded-2xl border border-[#e2e8df] p-6 self-start">
      <p className="font-barlow font-bold text-[18px] text-[#15241c] mb-4">Add Item</p>
      {/* form fields */}
    </div>
  )}
</div>
```

---

## Feedback (Toasts)

Use `sonner` — never `setError` state for network errors:

```tsx
import { toast } from 'sonner';

// On success:
toast.success('Venue updated.');

// On error:
toast.error(error.message);
```

---

## Confirm Delete

Inline "Delete? Yes / No" in the card — no modal:

```tsx
{confirmDelete === item.id ? (
  <div className="flex items-center gap-2 shrink-0 text-[13px]">
    <span className="text-[#6b7a70]">Delete?</span>
    <button onClick={() => deleteItem(item.id)} className="font-semibold text-[#a8513f] hover:underline">Yes</button>
    <button onClick={() => setConfirmDelete(null)} className="text-[#6b7a70] hover:underline">No</button>
  </div>
) : (
  <button onClick={() => setConfirmDelete(item.id)}
    className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#f7ece9] text-[#a8513f]">
    Delete
  </button>
)}
```

---

## Typography

| Element | Classes |
|---|---|
| Eyebrow (AdminTopBar) | `text-[11px] font-bold uppercase tracking-[0.18em] text-[#90a094]` |
| Page title (AdminTopBar) | `font-barlow font-extrabold text-[28px] leading-none text-[#15241c]` |
| Card title | `font-semibold text-[17px] text-[#15241c]` |
| Card subtitle | `text-[13px] text-[#6b7a70]` |
| Form section title | `font-barlow font-bold text-[18px] text-[#15241c]` |
| Body / form text | `text-[13px]` or `text-[14px]` |
| Badge / tag | `text-[12px] font-semibold` |

**Never use `text-sm`, `text-xs`, `text-lg`, `text-2xl`** in admin pages — always use explicit pixel sizes.

---

## Page Content Wrapper

```tsx
<div className="flex flex-col">
  <AdminTopBar eyebrow="..." title="..." />
  <div className="px-7 py-6 flex gap-6">
    {/* content */}
  </div>
</div>
```

---

## Supabase Client

- Server components: `import { createClient } from '@/lib/supabase/server'`
- Client components: `import { createClient } from '@/lib/supabase/client'`

Initialize in the component body (not at module scope) for client components:
```tsx
const supabase = createClient();
```

---

## Existing Admin Pages to Reference

When in doubt, read these files for patterns:

| Page | Component |
|---|---|
| Venues | `src/app/(admin)/admin/venues/venue-manager.tsx` |
| Sponsors | `src/app/(admin)/admin/sponsors/sponsors-manager.tsx` |
| Teams | `src/app/(admin)/admin/teams/teams-manager.tsx` |
| Players | `src/app/(admin)/admin/players/players-table.tsx` |
