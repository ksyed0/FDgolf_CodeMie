# Handoff: FDgolf Tournament Screens Redesign

## Overview
A light-mode visual redesign of the three key surfaces of the FDgolf tournament app:

1. **TV Leaderboard** (large-format / 1080p) — a persistent **25% leaderboard** column with live momentum sparklines, beside a **75% panel** that auto-rotates through five stat screens.
2. **Admin / Setup** (tablet & laptop) — a "Tournament Control" dashboard with live status, a setup-readiness checklist, and team monitoring.
3. **Player Shots** (mobile) — a redesigned shot tracker.

The redesign keeps the existing **course-green** brand and is **light-mode only** (daytime clubhouse / on-course use — no dark/night mode).

## About the Design Files
The bundled file **`FDgolf Screen Review.dc.html`** is a **design reference created in HTML** — a prototype showing the intended look, layout, and behavior. **It is not production code to copy directly.** It is a single self-contained "review canvas" that lays out every screen/panel as labeled frames side-by-side.

Your task is to **recreate these designs inside the existing Next.js + TypeScript + Tailwind + shadcn/ui codebase**, using its established patterns. Most of the structure and data already exists — this redesign is largely a **restyle + restructure** of existing components, not a greenfield build. Specific file targets are listed under each screen below.

> The HTML uses inline styles and a small mock-data class purely so the prototype renders standalone. Do **not** port the inline styles literally — translate the documented tokens into the codebase's Tailwind theme / CSS variables.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and layout proportions are specified. Recreate the UI to match, using the codebase's existing component library where one fits (shadcn `Card`, `Badge`, `Button`, `Table`, etc.).

---

## Design Tokens

### Colors
| Token | Hex | Usage |
|---|---|---|
| Course green (brand) | `#1a472a` | Primary: headers, sidebar, primary buttons, leader accents. Already used in app. |
| Course green (hover) | `#143820` | Button hover (existing). |
| Green ink | `#15241c` | Headings / darkest text & footer bar. |
| Fairway green | `#2f8f4e` | Live status dot, "easy hole" positive accents. |
| Mint | `#bff0c8` / `#9fd6ad` / `#bfe6c9` | On-green secondary text & accents (header subtitles). |
| Under-par red | `#c0392b` | Scores under par, birdie bars, "tough hole", LIVE pill. *(Golf convention: red = under par = good.)* |
| Over-par ink | `#33413a` | Scores over par. |
| Penalty rust | `#a8513f` | OOB / penalty text. |
| Gold (leader/eagle) | `#e7c66b` / `#c79a2e` | 1st-place crest, eagle highlights. |
| Amber (warning/pause) | `#b3741b` on `#fbf1df` | Pause controls, "player missing" status. |
| Hole-difficulty avg | `#e9b73a` | "Around par" amber. |
| Panel surface | `#f4f7f1` | Light green-tinted surface (leaderboard column, cards, mobile bg). |
| Card white | `#ffffff` | Cards, sponsor chips. |
| Border | `#e2e8df` / `#e8eee4` / `#eef2ea` | 1px borders / dividers. |
| Muted text | `#46554c` (body), `#6b7a70` (secondary), `#90a094` (labels). |
| Sponsor footer bar | `#15241c` | Dark green-ink band. |

> Crest/podium colors: 1st `#e7c66b`/`#5c4710`, 2nd `#cfd6cf`/`#3a443c`, 3rd `#d8a772`/`#4a2f12`, rest `#dfe7df`/`#46554c` (bg/fg).

### Typography
- **Display / numerals: `Barlow Condensed`** (weights 600/700/800) — scoreboard numbers, big stats, titles, tournament name, FDGOLF wordmark. This is the "broadcast" voice; use it for everything numeric and for headline-scale type.
- **UI / body: `Inter`** (400/500/600/700) — labels, names, body, buttons.
- Google Fonts import:
  `https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap`
- All numeric columns use tabular alignment; scores/stats are `font-weight:800` Barlow Condensed.
- Eyebrow labels: 10–13px, `font-weight:700`, `text-transform:uppercase`, `letter-spacing:0.1–0.18em`, color `#90a094`.

### Spacing, radius, shadow
- Card radius: `16px` (panels/cards), `14px` (smaller cards/buttons), `10–11px` (chips/list rows), `999px` (pills), `44px` outer phone bezel / `32px` inner.
- Card shadow (light surfaces): `0 8px 30px rgba(0,0,0,.14)` for frames; `0 3px 10px rgba(0,0,0,.22)` for sponsor chips on dark.
- Borders: `1px solid #e2e8df`.
- Standard padding inside panels: `26–32px`.

### Motion (already aligns with FS-brand guidance: predictable, no bounce)
- Live dots: gentle pulse, ~1.4–1.6s ease-in-out (opacity 1→.35, scale 1→.8).
- Bar grows: `scaleX(0)→1`, `0.9s cubic-bezier(.2,.7,.2,1)`, transform-origin left (birdie-leader bars).
- Panel rotation: cross-fade ~400ms (already implemented in `TvStatsRotator`).
- Keep existing 200ms ease-out / 120ms hover conventions for interactive elements.

---

## Screen 1 — TV Leaderboard

**Target files:**
- `src/components/tv/TvDisplay.tsx` — change the body split from `38% / 62%` to **`25% / 75%`**.
- `src/components/tv/TvLeaderboard.tsx` — restyle to light + **add a momentum sparkline column**.
- `src/components/tv/TvStatsRotator.tsx` + `src/components/tv/panels/*` — restyle panels to light and to fit the 75% region.
- `src/components/tv/panels/` — add a **Team Spotlight** panel (new) and a **Moment of the Day** panel (the existing `TvHoleMapPanel` already renders `bestAchievement`; this design promotes it to its own full panel + adds a shot diagram).
- `src/lib/tv-stats.ts` — already provides birdies, momentum, hole difficulty, shot stats, best achievement. **Add** a per-team cumulative-vs-par track for sparklines (see below) and team-roster/head-to-head data for the spotlight.
- `src/app/live/[slug]/tv/page.tsx` — page background becomes light (`#f4f7f1` / white) instead of `#0f172a`.

### Overall frame layout (1920×1080)
- **Header bar** — height `108px`, bg `#1a472a`, white text. Three zones:
  - Left: FDGOLF wordmark — a `54px` rounded tile (`rgba(255,255,255,.12)`, ⛳ glyph) + "FDGOLF" (Barlow Condensed 800, 28px) over "LIVE SCORING" (11px, letter-spacing 0.22em, `#9fd6ad`).
  - Center (absolutely positioned, `left:50%; transform:translateX(-50%)`, `white-space:nowrap` — required so the long name never wraps or gets squeezed by the flex side zones): tournament name (Barlow Condensed 700, **44px**) over venue/format/date line (18px, `#bfe6c9`).
  - Right: LIVE pill — `#c0392b` bg, white pulsing dot + "LIVE" (14px, 700, letter-spacing 0.12em). *(On the primary panel, a weather + clock cluster may sit left of the pill.)*
- **Body** — `flex:1`, a flex row: **left 25%** leaderboard + **right 75%** rotating panel (`flex:1`).
- **Footer sponsor bar** — height `160px` (deliberately tall), bg `#15241c`. See "Sponsor bar" below.

### Leaderboard column (left 25%, persistent on every panel)
- Background `#f4f7f1`, `border-right:1px solid #e2e8df`, full height, vertical flex.
- Header: pulsing `#2f8f4e` dot + "LEADERBOARD" (Barlow Condensed 700, 23px, uppercase, letter-spacing 0.05em).
- Column heads (10px, 700, uppercase, `#90a094`): `#  ·  Team  ·  Trend  ·  Thru  ·  Sc`.
- Rows — CSS grid `grid-template-columns: 20px 1fr 80px 28px 46px; gap:6px;`, height `52px`, radius `9px`. Per row:
  - **Pos**: Barlow Condensed 700, 19px. Top-3 colored `#1a472a`, rest `#8a988e`.
  - **Team**: 26px rounded crest (2-letter initials, crest colors above) + name (Inter 600, 15px, truncate).
  - **Trend (sparkline)**: inline SVG, `viewBox="0 0 120 34"`, width 80 / height 24, `preserveAspectRatio="none"`. A `polyline` of the team's cumulative-vs-par track + a small end dot. Stroke = `#c0392b` if under par, `#1a472a` if even, `#9aa89e` if over par.
  - **Thru**: 12px, `#6b7a70`.
  - **Score**: Barlow Condensed 800, 23px. Under par `#c0392b`, even `#1a472a`, over `#33413a`. Formatted `−8 / E / +3` (use a true minus `−`, U+2212).
  - Row backgrounds: 1st place `linear-gradient(90deg,#fbf3d8,#f4f7f1)` + `1px solid #ecd58a`; ranks 2–3 white + `1px solid #e8eee4`; rest transparent.
- Show ~12–16 rows; trailing "+ N more teams" line if truncated (matches existing `displayRows.slice(0,16)` logic).

#### Sparkline data (new, add to `tv-stats.ts`)
For each team, build an array of **cumulative vs-par after each completed hole** (e.g. `[0,-1,-1,-2,…]`), from the same best-ball `scores` you already query. Map to SVG points across a fixed viewBox using a **global** min/max across all teams' tracks so every sparkline shares one vertical scale:
```
const yAt = v => SH - ((v - sMin) / ((sMax - sMin) || 1)) * SH;   // SH=34
const xAt = (i, n) => n === 1 ? 0 : (i / (n - 1)) * SW;           // SW=120
points = track.map((v,i) => `${xAt(i,track.length)},${yAt(v)}`).join(' ');
```
End dot at the last point. (The prototype hardcodes tracks; in the app derive them from `scores` ordered by hole.)

### Rotating panels (right 75%) — 5 panels, ~15s each (interval already in `TvDisplay`)
The footer's right side shows the current panel name + 5 progress dots (active dot is a `22×8` pill, others `8×8`, colors `#fff` / `#3c5246`).

**Panel 1 — Birdies & Momentum** (restyle of `TvBirdiesPanel`)
- Top strip: 4 stat cards (Birdies Today `128`, Eagles `6`, Avg Score `73.4`, Teams Out `16`) — `#f4f7f1` cards, label (11px uppercase `#90a094`) + value (Barlow 800, 44px; eagles in gold `#c79a2e`).
- Below, two columns split by a 1px divider:
  - **Birdie Leaders**: per team, name + (optional `🦅 ×n` gold) + count (Barlow 800, 32px; leader red), and a `13px` rounded progress bar (`#eef2ea` track; leader fill `linear-gradient(90deg,#c0392b,#e0654f)` with grow animation, others `#1a472a`), width = birdies / max.
  - **Last 3 Holes (momentum)**: per team, name + three `40×40` rounded hole chips (H#, value) colored by result (eagle `#1a472a`/white, birdie `#c0392b`/white, par `#eef2ea`/`#46554c`, bogey+ `#f0e4e0`/`#a8513f`) + a 3-hole sum (Barlow 800, 26px).

**Panel 2 — Hole Difficulty** (restyle of `TvHoleMapPanel`, as a bar chart)
- Title "Hole Difficulty" + legend (Easy `#1a472a` / Par `#e9b73a` / Tough `#c0392b`) + "16 of 18 played".
- A **diverging bar chart**: 18 columns (Front 9 | dashed divider | Back 9). Each hole has a center baseline; bars grow **up** (tough, height ∝ +avg, color by tier) or **down** (easy, ∝ −avg). Bar width `42px`, height `12 + |avg|/1.2 * 150 px`. Label the magnitude above/below, hole number + "P{par}" beneath.
- Two callout cards: **Toughest** (`+1.1`, Hole 12, red-tinted `#fbecea`) and **Easiest** (`−0.8`, Hole 7, green-tinted `#e9f3ec`).

**Panel 3 — Shot Stats** (restyle of `TvShotStatsPanel`)
- Three cards in a row:
  - **Longest Drive** (hero, 42% width) — dark green gradient `linear-gradient(150deg,#1a472a,#0f2e1b)`, big number `327 yds` (Barlow 800, ~120px), team + player, and a dotted **trajectory arc** SVG along the bottom. *(Data already in `fetchShotStats`; the prototype shows yards — the app currently stores meters. Decide on a unit and label it; if showing yards, convert from the stored meters.)*
  - **Club of the Day** — `#f4f7f1` card, a donut ring (`#1a472a` on `#e3eadf`) with the % in the center + club name (Barlow 800, 42px).
  - **Cleanest Round** — `#f4f7f1` card, a check medallion, team + "0 penalties · 0 OB", and a small list of runner-up teams with penalty counts.

**Panel 4 — Moment of the Day** (new panel; data = existing `fetchBestAchievement`)
- Split: left ~52% celebratory dark-green gradient with a 🦅, "EAGLE" (Barlow 800, ~104px), `−2`, hole + meta, team + player, and a one-line quote. Right ~48% light: an SVG "the shot" diagram (green, tee box, dotted approach arc to pin, ball near cup) + three stat chips (e.g. `215` yd approach, `4` ft, `3` strokes).

**Panel 5 — Team Spotlight + Head-to-Head** (new panel)
- Left ~54%: spotlight team name + score, a 4-up stat chip row (Birdies / Eagle / Pars / Penalties), a **roster** (each player: 44px avatar, name, **title + company**, and best-ball-holes contributed), and an 18-cell **best-ball scorecard strip** (per-hole vs-par chips).
- Right ~46% (`#f4f7f1`): "Race for the Lead" head-to-head — two team cards (leader in green, chaser in white) with big scores and a "VS", then a comparison table (Score, Birdies, Eagles, Fairways hit, Putts/hole).
- New data needed in `tv-stats.ts`: team roster (join `players` for the spotlight team — name/title/company), per-player best-ball-holes count, and the two-team comparison aggregates.

### Sponsor bar (footer, all panels)
- Height **160px**, bg `#15241c`. Left: "PROUDLY SPONSORED BY" (11px, 700, uppercase, `#7d9486`) + a row of **logo lockups**. Each lockup is a white `100px`-tall rounded card (`radius 16px`, shadow `0 3px 10px rgba(0,0,0,.22)`) containing a `58px` colored monogram tile + the sponsor name (Barlow 800, 30px) over a tier label (11px uppercase `#9aa89e`).
- **Wire this to the existing Sponsors feature** (`sponsors` table: `name`, `logo_url`, `display_order`, `is_active`). Render the real `logo_url` image inside the white card; the monogram tile in the prototype is a **placeholder** for that logo. Rotate/scroll if more sponsors than fit.

---

## Screen 2 — Admin / Setup ("Tournament Control")

**Target files:** `src/app/(admin)/layout.tsx`, `src/components/admin-sidebar.tsx` (already `#1a472a`), and a tournament dashboard view (extend `src/app/(admin)/admin/tournament/`). Built for **tablet/laptop** widths (prototype frame 1280×860).

- **Sidebar** (212px, `#1a472a`): FDGOLF/ADMIN wordmark + nav (Tournament, Venues, Courses, Players, Teams, Clubs, Scores, Sponsors) — matches existing `admin-sidebar.tsx` (active item `rgba(255,255,255,.14)`, others `#bfe0c8`). A "Signed in · Tournament Director" card pinned to the bottom.
- **Top bar** (white, 1px bottom border): "TOURNAMENT CONTROL" eyebrow + tournament name (Barlow 800, 30px) + an **Active** status pill (green, pulsing dot). Right: "Open TV Leaderboard ↗" (outline) and "⏸ Pause Round" (amber `#b3741b`) buttons.
- **Stat row**: 4 white cards — Teams `16`, Players `64`, Holes set `18/18`, Shots logged `1,284` (Barlow 800, 34px + label + sub-label).
- **Two columns**:
  - **Teams on course** (white card, scrolly list): per team — number chip, name, "Start H# · 4/4 players · thru N", and a status pill (On course = green `#e9f3ec`/`#1a472a`, Player missing = amber `#fbf1df`/`#b3741b`, Finished = grey `#eef2ea`/`#5a6b60`).
  - **Right rail**: a **Setup checklist** card (checkmark rows; done = filled green circle ✓, pending = hollow `2px #cdd9cf`) + a "Send magic links →" primary button; and a **Round control** card with "⏸ Pause round" (amber) and "✓ Mark tournament complete" (`#15241c`) buttons.
- Maps to existing tournament status flow (`setup`/`active`/`paused`/`completed`) and the magic-link / best-ball plumbing already in the app.

---

## Screen 3 — Player Shots (mobile shot tracker)

**Target file:** `src/app/(player)/round/page.tsx` and its components (`PlayerPills`, `ClubSelector`, `ShotOutcomeButtons`, `HoleMap`). Built for **mobile** (prototype frame 390×844).

- **Header** (`#1a472a`): "NOW PLAYING" eyebrow, "Hole 14" (Barlow 800, 46px, `white-space:nowrap`) + "Par 4", right side "Stroke Idx 7" + a "GPS" pill with a pulsing dot.
- **Who's hitting?**: a row of 4 player pills (active = filled green `#1a472a` with avatar + name; inactive = white card) — maps to `PlayerPills` + `activePlayerId`.
- **Hole map**: rounded card (`HoleMap`) with the satellite/fairway view, the pin, tee, and **shot markers** along a dotted shot path; a "147 yds to pin" GPS chip overlaid bottom-left (`rgba(13,41,22,.82)`). Driven by `useGps` + the hole `pin_lat/lng` (only render when pins set — existing logic).
- **This hole**: a compact list of recorded shots (shot # · who · club · outcome pill) — maps to `dbShots` (In Play green, OOB rust `#a8513f`).
- **Club selector**: "Club · shot N" + wrap of club chips; selected chip filled green — maps to `ClubSelector` + active `clubs`.
- **Outcome buttons** (sticky bottom, white, 1px top border): 2×2 grid — **In Play** (green primary), **Out of Bounds** (rust outline `#f7ece9`), **Mulligan** (amber `#fbf1df`), **⛳ Sunk** (gold `#f3e7c4`). Min tap target ≥ 44px. Maps to `ShotOutcomeButtons` → `recordShot`/`syncEngine`.
- Preserve existing behaviors: offline `SyncEngine` queue, optimistic markers, best-ball edge-function trigger + hole summary on "Sunk", paused-tournament overlay.

---

## Interactions & Behavior (summary)
- **TV** auto-refreshes data every 30s and rotates the right panel every 15s with a ~400ms cross-fade (both already implemented in `TvDisplay`/`TvStatsRotator`). Live dots pulse; birdie bars grow on appear.
- **Admin** pause/resume sets tournament `status` (suspends player scoring); "mark complete" archives. Magic-link send per existing API.
- **Player** records shots offline-first; "Sunk" writes the score, fires `calculate-best-ball`, and shows the hole summary; advancing past hole 18 completes the round.

## State Management
Largely **unchanged** — reuse existing hooks (`use-realtime-scores`, `use-gps`, `use-sync-engine`) and the `get_leaderboard` RPC. New state is read-only display data added to `lib/tv-stats.ts` (sparkline tracks, team roster + head-to-head aggregates for the spotlight panel).

## Assets
- **Fonts**: Barlow Condensed + Inter (Google Fonts link above). Add to the Next.js font setup.
- **Sponsor logos**: come from the existing `sponsors.logo_url`. The monogram tiles in the prototype are placeholders for real logos.
- **No icon library required** — the few glyphs are emoji/Unicode in the prototype; substitute the codebase's icon set (the app already uses `lucide-react`) where appropriate.
- No other external image assets.

## Screenshots
PNG references in `screenshots/` (rendered from the prototype):
- `tv-1-birdies-momentum.png` — TV: leaderboard + Birdies & Momentum panel
- `tv-2-hole-difficulty.png` — TV: Hole Difficulty diverging bar chart
- `tv-3-shot-stats.png` — TV: Longest Drive / Club of the Day / Cleanest Round
- `tv-4-moment-of-the-day.png` — TV: Eagle spotlight + shot diagram
- `tv-5-team-spotlight.png` — TV: roster + best-ball scorecard + head-to-head
- `admin-tournament-control.png` — Admin / Setup dashboard
- `player-shot-tracker.png` — Mobile shot tracker

> Note: screenshots were rendered with a font fallback, so a few condensed-type labels look slightly tighter/overlapped than in a real browser (where Barlow Condensed is narrower). Treat the README tokens — not the PNG pixels — as the source of truth.

## Files
- `FDgolf Screen Review.dc.html` — the full design reference (open in a browser). All five TV panels, plus Admin and Player frames, are laid out as labeled frames on one scrolling canvas. Inspect it for exact proportions/colors; this README is the source of truth for tokens.
