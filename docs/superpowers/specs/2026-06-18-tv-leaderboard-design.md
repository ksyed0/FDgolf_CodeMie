# TV Leaderboard Display — Design Spec

**Date:** 2026-06-18
**Status:** Approved
**Author:** Kamal Syed + Claude Code

---

## Overview

A new full-screen TV display route `/live/[slug]/tv` targeting 1920×1080 kiosk/projector screens. Shows a persistent leaderboard on the left (45% width) with a rotating stats panel on the right (55% width). The right panel cycles through 3 panels every 15 seconds: Panel A (team birdie/momentum highlights), Panel B (18-hole difficulty map + best achievement callout), Panel C (shot stats: longest drive, club of day, cleanest teams). No browser chrome — designed to run in full-screen mode with `F11`. No auth required (public route like `/live/[slug]`).

---

## Goals

- Provide a visually engaging display for the clubhouse projector during the tournament
- Surface real-time team rankings always visible on the left
- Rotate through stats panels that reward watching: birdies, eagles, hole difficulty, shot records
- Refresh stats every 30s without page reload

---

## Out of Scope

- Shot replay / hole flyover animation
- Player headshots or photos
- Sound/audio alerts
- Mobile-responsive layout (TV-only, 1920×1080 fixed)
- Historical stats across multiple tournaments

---

## Route

`src/app/live/[slug]/tv/page.tsx` — public, no auth, server component shell + client `TvDisplay` component

---

## Layout

Target resolution: 1920×1080, full-screen (no browser chrome).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  FDgolf  CIBC Capital Markets Golf 2026 · Granite Ridge · Best Ball · Shotgun Start   ● LIVE │
├─────────────────────────────────────┬────────────────────────────────────────────────────────┤
│  LEADERBOARD                        │  [RIGHT PANEL — rotates A→B→C every 15s]               │
│                                     │                                                         │
│  #   TEAM              SCR  THRU    │  PANEL A: TEAM HIGHLIGHTS                              │
│  ─────────────────────────────────  │  ┌──────────────────────┬──────────────────────────┐  │
│  1   Chen / Park        -8   16     │  │  🐦 BIRDIE LEADERS   │  ⚡ LAST 3 HOLES          │  │
│  2   Griffith / Lee     -6   14     │  │                      │                           │  │
│  3   Syed / Ahmad       -5   12     │  │  Chen/Park      7    │  Chen   ▄▄▄███  -3       │  │
│  4   Williams / Torres  -4   18     │  │  Griffith/Lee   6    │  Griff  ▄▄▄▄██  -2       │  │
│  5   Kumar / Osei       -3   10     │  │  Syed/Ahmad     5    │  Syed   ██▄▄▄▄  +1       │  │
│  6   Park / Choi        -2   15     │  │  Williams       4    │  Willms ▄▄▄███  -1       │  │
│  7   Brown / Kim        -1   17     │  │  Kumar/Osei     3    │  Kumar  ▄▄▄▄▄█  E        │  │
│  8   Ali / Jones        +1    9     │  └──────────────────────┴──────────────────────────┘  │
│  9   Davis / Wu         +2   11     │                                                         │
│  10  Mehta / Singh      +3   13     │  PANEL B: HOLE DIFFICULTY MAP                          │
│  ...                                │   1   2   3   4   5   6   7   8   9                   │
│  ─────────────────────────────────  │  🟢  🟡  🔴  🟢  🟡  🟢  🔴  🟢  🟡                 │
│  Showing 10 of 32 teams             │  10  11  12  13  14  15  16  17  18                   │
│                                     │  🟡  🔴  🟢  🟢  🟡  🟡  🔴  🟢  🟢                 │
│                                     │  ──────────────────────────────────────────────────    │
│                                     │  🦅 EAGLE ALERT  Hole #7 · Griffith / Lee             │
├─────────────────────────────────────┤                                                         │
│  CIBC Capital Markets               │  PANEL C: SHOT STATS                                   │
│  Granite Ridge · June 22 2026       │  ┌────────────────┬───────────────┬────────────────┐  │
│  ● ● ●  (panel indicator dots)      │  │ 📏 LONGEST     │ 🏌️ CLUB OF   │ 🚫 CLEANEST    │  │
└─────────────────────────────────────┤  │    DRIVE       │    THE DAY    │    TEAM         │  │
                                      │  │   287m         │   7 Iron      │ Chen / Park    │  │
                                      │  │ Williams/Torres│ 34% of scoring│ 0 OB / Water   │  │
                                      │  └────────────────┴───────────────┴────────────────┘  │
                                      └─────────────────────────────────────────────────────────┘
```

---

## Stats Definitions

| Stat | Definition | DB source |
|------|-----------|-----------|
| Birdies | Count of `scores` rows where `(strokes - holes.par) <= -1` and `is_best_ball = true`, grouped by team | `scores` JOIN `holes` |
| Eagles | Count of `scores` rows where `(strokes - holes.par) <= -2` and `is_best_ball = true`, grouped by team | `scores` JOIN `holes` |
| Momentum — last 3 holes | For each team: the 3 most recently played holes (highest `hole_number` with a score), sum of `(strokes - par)` for those 3. Display as mini sparkline (one bar per hole: green=under, grey=par, red=over) | `scores` JOIN `holes` ORDER BY hole_number DESC LIMIT 3 per team |
| Hole difficulty | For each hole: `AVG(strokes - par)` across all teams that have played it with `is_best_ball = true`. < -0.5 = easy (🟢), -0.5 to +0.5 = average (🟡), > +0.5 = hard (🔴). Holes with 0 teams = grey | `scores` JOIN `holes` GROUP BY hole_number |
| Best achievement | Most extreme single-hole score: lowest `(strokes - par)` with `is_best_ball = true`. Label: ≤ -2 = "Eagle", -1 = "Birdie". Show hole number and team name | `scores` JOIN `holes` JOIN `teams` ORDER BY (strokes-par) ASC LIMIT 1 |
| Longest drive | Max Haversine distance between tee box GPS and first shot GPS per hole, across all shots. Only shown if distance > 0 (guard: skip if tee box lat/lng is 0 or null) | `shots` JOIN `tee_boxes` on course/hole |
| Club of the day | Most-used `club_id` among shots where the associated score has `is_best_ball = true` | `shots` JOIN `scores` on tournament+team+hole, GROUP BY club_id |
| Cleanest teams | Teams with the fewest shots where `outcome IN ('OB', 'Water')`. Top 3 shown. Ties broken by team rank | `shots` GROUP BY team (via player/team join) |

---

## Component Structure

```
src/
  app/live/[slug]/tv/
    page.tsx                    # server component — fetches tournament, initial leaderboard
  components/tv/
    TvDisplay.tsx               # root client component — layout shell, polling, panel rotation
    TvLeaderboard.tsx           # left 45% — rank list
    TvStatsRotator.tsx          # right 55% — manages A/B/C rotation + transition
    panels/
      TvBirdiesPanel.tsx        # Panel A
      TvHoleMapPanel.tsx        # Panel B
      TvShotStatsPanel.tsx      # Panel C
  lib/
    tv-stats.ts                 # fetchBirdieStats, fetchMomentumStats, fetchHoleDifficulty, fetchShotStats, fetchBestAchievement
```

---

## Data Refresh Strategy

- **Leaderboard**: reuse existing `get_leaderboard()` RPC, polled every 30s via `setInterval` inside `TvDisplay`
- **Stats**: all 5 `tv-stats.ts` functions called in parallel via `Promise.all` every 30s
- **No Supabase Realtime subscription** — avoids channel storm; TV is a read-only display
- **First load**: data fetched server-side in `page.tsx`, passed as initial props; client takes over polling

---

## Rotation Timing

- Panel cycle: A → B → C → A, 15s each
- Transition: CSS `opacity` 0→1 fade, 400ms duration, `transition-opacity`
- Progress dots at bottom-left of left panel: 3 dots, active = white, inactive = slate-600
- Timer resets from A on page load

---

## Empty State Handling

| Stat | Empty state |
|------|------------|
| Longest drive | "GPS data pending" if no shots with GPS or all tee boxes have lat=0/lng=0 |
| Hole difficulty | Holes with no scores rendered as grey circle, no label |
| Birdies | "No birdies yet — keep swinging!" centred in Panel A |
| Best achievement | Omit callout row entirely if no birdies or eagles exist |
| Club of day | "–" if no shots |
| Cleanest teams | "All teams playing clean!" if all teams have 0 OB/Water |

---

## Visual Design

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0f172a` (slate-900) | Full screen |
| Brand green | `#16a34a` (green-600) | Left panel accent, live dot |
| Under par | `text-red-400` | Score column |
| Even par | `text-white` | Score column |
| Over par | `text-slate-400` | Score column |
| Panel header | `text-slate-400 uppercase tracking-widest text-sm` | Section labels |
| Stat number | `text-5xl` or `text-6xl font-bold text-white` | Hero numbers |
| Hole easy | `bg-green-500` | Hole map circle |
| Hole average | `bg-yellow-400` | Hole map circle |
| Hole hard | `bg-red-500` | Hole map circle |
| Hole no data | `bg-slate-700` | Hole map circle |
| Hole circle size | 48×48px | Hole map |

---

## Constraints

- Route must be public (no session check) — same as existing `/live/[slug]`
- `viewport` meta: `width=1920, initial-scale=1` — prevents mobile browser scaling
- No `<nav>` or `<header>` — full bleed layout only
- TypeScript strict — no `any` types
- Do NOT modify `get_leaderboard()` RPC or any existing migrations
- Do NOT modify `/live/[slug]/page.tsx` or any existing live leaderboard components
- `tv-stats.ts` functions must use the **browser Supabase client** (called from client components)
- `page.tsx` uses the server Supabase client only for initial load
- Longest drive calculation: use the existing `distanceMeters(a, b)` Haversine function from `src/lib/gps.ts`
- No new npm packages — use existing Tailwind, shadcn, Supabase client
