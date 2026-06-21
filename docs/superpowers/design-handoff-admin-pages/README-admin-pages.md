# Handoff: FDgolf Admin Pages Redesign

## Overview
Visual redesign for all 7 admin sidebar pages. Implemented on top of the existing Next.js + Tailwind + shadcn/ui codebase. All design tokens (colors, typography, spacing, radius) are identical to those defined in `README.md` — this file covers layout and interaction specifics for each page only.

**Design file:** `FDgolf Admin Pages.dc.html` (open in a browser to inspect each frame)
**Screenshots:** `screenshots/admin-1-venues.png` through `screenshots/admin-7-sponsors.png`

---

## Shared chrome (all pages)

Every admin page shares:

- **Sidebar** (`212px`, `#1a472a`) — identical to what's already in `admin-sidebar.tsx`. Active item gets `rgba(255,255,255,.14)` background + white text; inactive items `#bfe0c8`. Signed-in card pinned to bottom with `rgba(255,255,255,.07)` bg.
- **Top bar** (`background:#fff`, `border-bottom:1px solid #e2e8df`, `padding:18px 28px`) — two zones: left has an eyebrow label (11px, 700, uppercase, `#90a094`) + page title (Barlow Condensed 800, 28px, `#15241c`); right has action buttons.
- **Body** — `background:#f4f7f1`, `padding:24px 28px`.

---

## Page 1 — Venues (`/admin/venues`)

**Target:** `src/app/(admin)/admin/venues/`

### Layout
Two-column: a **list column** (flex: 1) of venue cards, and a fixed **Add Venue form** (width `320px`) on the right.

### Venue cards
White card (`border-radius:16px`, `border:1px solid #e2e8df`, `padding:20px 22px`), flex row:
- Left: `52px` tile (`border-radius:13px`, `background:#eef2ea`) with 📍 glyph
- Middle: name (`font-weight:700`, `font-size:17px`), address (`13px`, `#6b7a70`), then a row of status pills:
  - **Courses count** — green `#e9f3ec`/`#1a472a` pill
  - **GPS status** — green when all pins set; amber `#fbf1df`/`#b3741b` when not configured
- Right: Edit + Delete buttons (Edit = `#eef2ea`/`#1a472a`; Delete = `#f7ece9`/`#a8513f`)

### Add Venue form (right panel)
White card, fields: Venue Name, Address, City + Province (2-col), Contact. Save button = full-width green primary.

### Behaviours to preserve
- Saving creates a `venues` row + redirects to the Courses page for that venue.
- Deleting is blocked if the venue has an active tournament assigned.

---

## Page 2 — Courses (`/admin/courses`)

**Target:** `src/app/(admin)/admin/courses/`

### Layout
Single column. Top bar includes a **venue selector dropdown** (white outline style, `border:1px solid #d6ddd2`, `border-radius:10px`) so directors can switch between venues without leaving the page.

### Course card (expanded)
White card with:
- Header row: course name + status pills (holes count, par, `GPS: N/18` with ✓ when complete) + Edit Course button
- **18-hole grid** inside: two rows of 9 (`display:grid; grid-template-columns:repeat(9,1fr); gap:8px`). Each hole tile (`background:#f4f7f1; border-radius:10px; padding:10px 6px; text-align:center`):
  - Hole number (Barlow Condensed 700, 20px)
  - Par (`font-size:11px`, `#6b7a70`)
  - Distance in yards (`10px`, `#90a094`)
  - Stroke Index (`10px`, `#90a094`)
  - GPS dot: `8px` circle, `#2f8f4e` = pin set, `#e9b73a` = not set

**Click a hole tile** → opens an inline edit panel or modal: par, distance, stroke index, and a "Re-drop GPS pin" action (triggers the map view on mobile).

### Behaviours to preserve
- GPS pin dropping is done from the player's mobile device or a separate map view — this page shows read-only GPS status per hole.
- A "Front 9" / "Back 9" label divides the two rows (use a thin header spanning the full 9 columns).

---

## Page 3 — Players (`/admin/players`)

**Target:** `src/app/(admin)/admin/players/`

### Layout
Full-width data table below a filter/action bar.

### Filter bar (below top bar)
Thin secondary bar (`background:#fff; border-bottom:1px solid #eef2ea; padding:10px 28px`):
- Left: "All players" label + three status pills — **✓ Linked N** (green), **⏳ Pending N** (amber), **Not sent N** (grey)
- Right: "Send all links →" green primary button

### Table columns
`grid-template-columns: 28px 1fr 160px 120px 80px 140px 120px 80px`

| Col | Content |
|---|---|
| Checkbox | Bulk-select |
| Player | `32px` green avatar (initials) + name (`font-weight:600`, `14px`) + email (`11px`, `#90a094`) |
| Company | `13px`, `#46554c`, truncate |
| Title | `12px`, `#6b7a70`, truncate |
| HCP | Handicap, centered, `font-weight:600` |
| Team | Green pill with team name |
| Magic Link | Status pill: Active (green), Pending (amber), Not sent (grey) |
| Actions | "Edit" chip (green) |

Row height `~52px`, `border-bottom:1px solid #f0f4ee`, hover `background:#fafcf9`.
First row (leader) may get `background:linear-gradient(90deg,#fdf9ec,#fff)` if desired.

### Import CSV
Button triggers a file picker; parses name, email, company, title, handicap columns. Map to existing `players` table.

### Behaviours to preserve
- "Send all links" fires the existing magic-link edge function for all players with status `not_sent`.
- Inline "Edit" opens a slide-over or modal (name, email, company, title, handicap, team assignment).

---

## Page 4 — Teams (`/admin/teams`)

**Target:** `src/app/(admin)/admin/teams/`

### Layout
`display:grid; grid-template-columns:repeat(3,1fr); gap:18px` card grid.

### Team card
White card (`border-radius:16px; overflow:hidden`):

**Card header** (`padding:13px 18px`, flex row):
- Team name (Barlow Condensed 800, 22px)
- Starting hole badge (`H{N}`, Barlow Condensed 700, 18px) in a `rgba(255,255,255,.18)` pill
- Header background = `#1a472a` for the leading team; `#f4f7f1` for all others (or derive from tournament position)

**Member list** (`padding:12px 18px`, gap `8px` per row):
- `28px` avatar tile (`#eef2ea`/`#1a472a`, initials, `border-radius:7px`)
- Name (`13px`, `font-weight:600`) + company (`11px`, `#90a094`), truncated
- HCP right-aligned (`11px`, `#90a094`)
- Unassigned slots shown as `— Unassigned —` with no company/HCP

**Card footer** (`padding:10px 18px 14px; border-top:1px solid #f0f4ee`):
- "Edit team" (`#eef2ea`) + "Manage players" (`#f4f7f1`) buttons, each `flex:1`

### Warning state
If a team has < 4 players: amber header (`#fbf1df`/`#7a500a`), amber border `1px solid #ecd9b4`.

### Top bar additions
- "⚡ Auto-assign starting holes" outline button — distributes teams shotgun-style across holes 1–16 (or 1–18), respecting any manually pinned assignments.

### Behaviours to preserve
- Drag-and-drop players between teams (existing).
- Starting hole assignment persists to `team_rounds.starting_hole`.

---

## Page 5 — Clubs (`/admin/clubs`)

**Target:** `src/app/(admin)/admin/clubs/`

### Layout
Two columns: **club list** (flex: 1) + **right rail** (width `260px`).

### Club list (white card)
Header note: "shown on player device in this order".
Grid: `grid-template-columns: 32px 1fr 80px 120px 100px 80px`

| Col | Content |
|---|---|
| Drag handle | `⠿` glyph (`#90a094`, `cursor:grab`) |
| Club | `30px` icon tile + name (`font-weight:600`, `14px`) |
| Type | Type chip (`#f4f7f1` bg, `#6b7a70` text: Wood / Iron / Wedge / Putter) |
| Usage bar | Thin `6px` bar, `#eef2ea` track, `#1a472a` fill, width = shots / max shots × 100%. Animate with `fdGrow` on mount. |
| Shots | Shot count (Barlow Condensed 700, 20px) |
| Actions | "Edit" chip |

Drag-to-reorder updates `display_order` on the `clubs` table — this order controls the player-device club selector sequence.

### Right rail
- **Today's top clubs** card — name + shot count (Barlow 700, 20px `#1a472a`), sorted descending
- **Add Club** inline form — Name, Type (Wood / Iron / Wedge / Putter dropdown), Save button

### Behaviours to preserve
- Clubs are per-tournament (or global to the venue, depending on current schema). Confirm and document which.
- The player shot-tracker club selector reflects this ordered list live.

---

## Page 6 — Scores (`/admin/scores`)

**Target:** `src/app/(admin)/admin/scores/` (or extend the existing tournament manager)

### Layout
Full-width **colour-coded scoring matrix** inside a scrollable white card.

### Matrix structure
- **Header row** (`background:#f4f7f1`): fixed `160px` "Team" column + one flex column per hole (`font-family:Barlow Condensed; font-weight:700; font-size:16px`) + fixed `72px` "Tot" column (bold divider `border-left:2px solid #d6ddd2`)
- **Score rows**: fixed team name column + one `28×28` rounded cell per hole + total

### Cell colour coding (best-ball score vs par)
| Result | Background | Foreground |
|---|---|---|
| Eagle (−2 or better) | `#1a472a` | `#fff` |
| Birdie (−1) | `#c0392b` | `#fff` |
| Par (E) | `#e8eee4` | `#46554c` |
| Bogey+ (+1 or more) | `#f0e4e0` | `#a8513f` |
| Not yet played | `#f9faf8` · shown as `·` | `#c2ccc4` |

Cell: `width:28px; height:28px; border-radius:7px; margin:0 auto`. Displays the raw stroke count (not vs-par — consistent with golf scorecards).

### Totals column
Barlow Condensed 800, 22px. Under par = `#c0392b`, even = `#1a472a`, over = `#33413a`. Formatted `−8 / E / +3`.

### Top bar
- Live dot + "auto-refreshing" label (uses the existing realtime subscription)
- Legend chips (Eagle / Birdie / Par / Bogey+)
- Optional: "Export CSV" button (triggers Supabase RPC or client-side download)

### Behaviours to preserve
- Realtime subscription: when a score is written, the matrix cell updates without a page reload (existing `use-realtime-scores` hook).
- Admins can click a cell to override a score (opens a small popover with a stroke-count input).

---

## Page 7 — Sponsors (`/admin/sponsors`)

**Target:** `src/app/(admin)/admin/sponsors/`

### Layout
Two columns: **sponsor card list** (flex: 1) + **right rail** (width `300px`).

### Sponsor cards
White card (`border-radius:16px; padding:18px 22px`), flex row:

- **Drag handle** (`⠿`, `cursor:grab`) — controls `display_order` for TV footer
- **72px monogram tile** (`border-radius:14px`) — shows the sponsor's brand colour + initials until a real logo is uploaded; replace with `<img src={logo_url}>` when available
- **Info block** (flex:1):
  - Name (`font-weight:700`, `17px`) + tier pill
  - Website URL (`13px`, `#6b7a70`)
  - "Logo uploaded: ✓ Uploaded" (green) or "⚠ Missing" (amber)
- **Right controls**:
  - **Show on TV toggle** — pill toggle (`44×24px`): active = `#1a472a`, inactive = `#cdd9cf`. Writes `is_active` to `sponsors` table. Controls whether this sponsor appears in the TV footer bar.
  - Edit + Remove buttons

### Right rail

**TV Footer Preview** (dark card `#15241c`, `border-radius:16px`):
A live miniature of the TV sponsor bar — renders the same logo lockups in the same order as the full TV footer. Updates immediately when toggles or order changes. This gives the director instant visual feedback without opening the TV leaderboard.

**Add Sponsor form**:
- Name, Website, Tier (dropdown: Title Sponsor / Host Venue / Equipment / Technology / Other)
- **Logo drop zone** — `border:2px dashed #cdd9cf; border-radius:12px; padding:18px; text-align:center`. On drop/select: upload to Supabase Storage, write `logo_url` back to the `sponsors` row. Accepted: PNG, SVG, max 2 MB.
- Save button (green primary, full width)

### Tier pill colours
| Tier | Text | Background |
|---|---|---|
| Title Sponsor | `#7a3020` | `#fbecea` |
| Host Venue | `#1a472a` | `#e9f3ec` |
| Equipment | `#333` | `#eef2ea` |
| Technology | `#1b3a6b` | `#e6edf8` |
| Other | `#46554c` | `#f0f4ee` |

### Behaviours to preserve
- `display_order` drag updates persist immediately (optimistic update + Supabase write).
- `is_active` toggle controls the TV footer bar in real time (the `TvDisplay` component queries `is_active = true` sponsors ordered by `display_order`).
- Logo upload: store in Supabase Storage bucket `sponsor-logos`; write public URL to `sponsors.logo_url`. Show a loading spinner on the monogram tile while uploading.

---

## Screenshots
All pages at 1280px width (tablet/laptop target):
- `admin-1-venues.png`
- `admin-2-courses.png`
- `admin-3-players.png`
- `admin-4-teams.png`
- `admin-5-clubs.png`
- `admin-6-scores.png`
- `admin-7-sponsors.png`

## Design reference
Open `FDgolf Admin Pages.dc.html` in a browser for the full interactive canvas with all 7 pages side by side.
All design tokens (colors, fonts, spacing, radius, shadow) are in `README.md`.
