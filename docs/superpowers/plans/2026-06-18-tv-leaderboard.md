# TV Leaderboard Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/live/[slug]/tv` — a full-screen 1920×1080 TV leaderboard display with a persistent left-panel leaderboard and a right panel that rotates every 15s through: Panel A (birdie leaders + momentum sparklines), Panel B (18-hole difficulty heatmap + best achievement callout), Panel C (shot stats: longest drive, club of day, cleanest teams). No auth. Data polled every 30s.

**Spec:** `docs/superpowers/specs/2026-06-18-tv-leaderboard-design.md` — read this first for exact stat definitions, visual tokens, empty states, and constraints.

**Architecture:** Server component `page.tsx` fetches initial leaderboard + tournament via existing `get_leaderboard()` RPC and Supabase server client. Passes initial data to client component `TvDisplay`. Client handles 30s polling loop (leaderboard + stats in parallel), 15s panel rotation via `setInterval`, and CSS fade transitions. Stats computed in `src/lib/tv-stats.ts` via browser Supabase client. No new DB migrations required — all data already exists in `scores`, `shots`, `holes`, `teams`, `tee_boxes`, `clubs`.

## Global Constraints

- Route `/live/[slug]/tv` — public, no session check
- Do NOT modify `get_leaderboard()` RPC or any existing migrations
- Do NOT modify `/live/[slug]/page.tsx` or any existing live leaderboard components
- TypeScript strict — no `any` types
- `tv-stats.ts` functions use browser Supabase client only
- `page.tsx` uses server Supabase client only for initial load
- Longest drive uses `distanceMeters()` from `src/lib/gps.ts`; guard: skip if tee_box lat=0/lng=0 or null
- All stats must gracefully handle 0 scores / 0 shots (empty state text defined in spec)
- Visual constants (colours, sizing) defined in spec — implement exactly as described
- No new npm packages — use existing Tailwind, shadcn, Supabase client

---

### Task 1: `src/lib/tv-stats.ts` — stats query functions

**Files:**
- Create: `src/lib/tv-stats.ts`

**Interfaces:**
- Input: `supabase: SupabaseClient`, `tournamentId: string`
- Output types exported from the file:

```typescript
export interface BirdieStats {
  teamId: string
  teamName: string
  birdies: number
  eagles: number
}

export interface MomentumEntry {
  teamId: string
  teamName: string
  lastThreeHoles: { holeNumber: number; vspar: number }[]  // up to 3, ordered asc by hole_number
}

export interface HoleDifficulty {
  holeNumber: number
  avgVsPar: number | null  // null = no scores yet for this hole
}

export interface ShotStats {
  longestDriveMeters: number | null
  longestDriveTeam: string | null
  clubOfDay: string | null          // club name string
  clubOfDayPct: number | null       // percentage of best-ball shots (0–100)
  cleanestTeams: { teamName: string; badShots: number }[]  // top 3, ascending badShots
}

export interface BestAchievement {
  teamName: string
  holeNumber: number
  vspar: number   // e.g. -2 = eagle, -1 = birdie
}
```

**Functions to implement** (all `async`, all accept `supabase: SupabaseClient` + `tournamentId: string`):

- `fetchBirdieStats(supabase, tournamentId): Promise<BirdieStats[]>` — query `scores` WHERE `tournament_id = tournamentId` AND `is_best_ball = true`, join `holes` for par, compute `birdies` (strokes - par <= -1) and `eagles` (strokes - par <= -2) per team, join `teams` for name, sort descending by birdies
- `fetchMomentumStats(supabase, tournamentId): Promise<MomentumEntry[]>` — for each team with scores, get up to 3 most recently played holes (highest `hole_number` where `is_best_ball = true`), compute vspar per hole, return ordered ascending by hole_number
- `fetchHoleDifficulty(supabase, tournamentId): Promise<HoleDifficulty[]>` — compute `AVG(strokes - par)` per hole across all teams where `is_best_ball = true`, return 18 entries (holeNumber 1–18), `avgVsPar = null` if no scores for that hole
- `fetchShotStats(supabase, tournamentId): Promise<ShotStats>` — longest drive: join `shots` to `tee_boxes` via hole/course, compute `distanceMeters()` from tee box lat/lng to shot lat/lng, max across all shots (guard: skip if tee_box lat=0/lng=0 or null, or shot lat=0/lng=0); club of day: join `shots` to `scores` (is_best_ball=true, same tournament+team+hole), group by `clubs.name`, pick top; cleanest teams: count `shots` WHERE `outcome IN ('OB', 'Water')` grouped by team, join team names, return top 3 ascending
- `fetchBestAchievement(supabase, tournamentId): Promise<BestAchievement | null>` — scores WHERE `is_best_ball = true` AND `tournament_id = tournamentId`, join holes for par, join teams for name, ORDER BY `(strokes - par) ASC` LIMIT 1; return null if no scores or lowest vspar >= 0

- [ ] Create `src/lib/tv-stats.ts` with all 5 exported interfaces and 5 exported async functions
- [ ] Each function catches all errors: `console.warn` the error message, return `[]` / `null` / empty `ShotStats` — never throw
- [ ] `fetchShotStats` imports and uses `distanceMeters` from `src/lib/gps.ts`

---

### Task 2: `/live/[slug]/tv/page.tsx` — server component shell

**Files:**
- Create: `src/app/live/[slug]/tv/page.tsx`

**Interfaces:**
- Props: `{ params: Promise<{ slug: string }> }` (Next.js 16 async params)
- Uses: `createClient()` from `src/lib/supabase/server.ts`
- Renders: `<TvDisplay tournament={...} initialLeaderboard={...} />`

**Reference:** `src/app/live/[slug]/page.tsx` — follow the same tournament lookup and leaderboard RPC pattern exactly.

- [ ] Create `src/app/live/[slug]/tv/page.tsx` as a server component (no `'use client'`)
- [ ] Await `params`, query tournament by slug from `tournaments` table
- [ ] Return `notFound()` (from `next/navigation`) if no tournament found
- [ ] Call `get_leaderboard(p_tournament_id)` RPC for initial leaderboard data
- [ ] Wrap output in a full-bleed div: `className="bg-[#0f172a] h-screen w-screen overflow-hidden"`
- [ ] Render `<TvDisplay tournament={tournament} initialLeaderboard={leaderboard ?? []} />`
- [ ] Export viewport metadata object: `export const viewport = { width: '1920', initialScale: 1 }`

---

### Task 3: `TvDisplay.tsx` — root client component

**Files:**
- Create: `src/components/tv/TvDisplay.tsx`

**Interfaces:**
- Props:
  ```typescript
  interface TvDisplayProps {
    tournament: Tournament
    initialLeaderboard: LeaderboardRow[]
  }
  ```
  (`LeaderboardRow` = whatever type `get_leaderboard()` returns; infer from existing `/live/[slug]` usage)
- Internal state: `leaderboard`, `birdieStats`, `momentumStats`, `holeDifficulty`, `shotStats`, `bestAchievement`, `activePanelIndex: 0 | 1 | 2`
- Uses: browser Supabase client from `src/lib/supabase/client.ts`
- Uses: all 5 fetch functions from `src/lib/tv-stats.ts`

- [ ] Create `src/components/tv/TvDisplay.tsx` with `'use client'` directive
- [ ] Layout: `flex flex-col h-screen w-screen` — header bar (fixed ~80px), main row (`flex flex-1 overflow-hidden`), footer bar (~60px)
  - Header: full-width, contains tournament name + venue + format + `● LIVE` pulse indicator
  - Main row: left `w-[45%] h-full` → `<TvLeaderboard>`, right `w-[55%] h-full` → `<TvStatsRotator>`
  - Footer: full-width, contains `CIBC Capital Markets · Granite Ridge · June 22 2026` on left, 3 panel indicator dots on right
- [ ] `useEffect` on mount: `setInterval(refreshAll, 30_000)` — calls `Promise.all([supabase.rpc('get_leaderboard', ...), fetchBirdieStats(...), fetchMomentumStats(...), fetchHoleDifficulty(...), fetchShotStats(...), fetchBestAchievement(...)])` and updates all state
- [ ] `useEffect` on mount: `setInterval(() => setActivePanelIndex(p => ((p + 1) % 3) as 0|1|2), 15_000)`
- [ ] Both intervals cleared in `useEffect` cleanup (return function)
- [ ] Pass `activePanelIndex`, `birdieStats`, `momentumStats`, `holeDifficulty`, `shotStats`, `bestAchievement` to `<TvStatsRotator>`
- [ ] Panel indicator dots in footer: 3 circles, `bg-white` for active index, `bg-slate-600` for inactive

---

### Task 4: `TvLeaderboard.tsx` — left panel

**Files:**
- Create: `src/components/tv/TvLeaderboard.tsx`

**Interfaces:**
- Props: `{ leaderboard: LeaderboardRow[] }`
- Uses: `formatVsPar()` from `src/lib/scoring.ts`

- [ ] Create `src/components/tv/TvLeaderboard.tsx`
- [ ] Header row: "LEADERBOARD" in `text-slate-400 uppercase tracking-widest text-sm` + green `animate-pulse` dot
- [ ] Column headers: `#`, `TEAM`, `SCR`, `THRU` — `text-slate-500 text-xs uppercase`
- [ ] Render top 18 rows. Each row: rank, team name (truncate at 22 chars with `…`), score vs par (formatted via `formatVsPar()`), holes played
- [ ] Score colour: `text-red-400` if under par (negative), `text-white` if even, `text-slate-400` if over par
- [ ] Even rows: `bg-slate-800/30` background
- [ ] Rank 1 row: `border-l-4 border-green-600 pl-2`, slightly larger team name (`text-lg` vs `text-base`)
- [ ] If `leaderboard.length > 18`: footer line `text-slate-500 text-sm` — `… and {N} more teams`

---

### Task 5: `TvStatsRotator.tsx` + Panel A (`TvBirdiesPanel.tsx`)

**Files:**
- Create: `src/components/tv/TvStatsRotator.tsx`
- Create: `src/components/tv/panels/TvBirdiesPanel.tsx`

**Interfaces (TvStatsRotator):**
```typescript
interface TvStatsRotatorProps {
  activePanelIndex: 0 | 1 | 2
  birdieStats: BirdieStats[]
  momentumStats: MomentumEntry[]
  holeDifficulty: HoleDifficulty[]
  shotStats: ShotStats
  bestAchievement: BestAchievement | null
}
```

**Interfaces (TvBirdiesPanel):**
```typescript
interface TvBirdiesPanelProps {
  birdieStats: BirdieStats[]
  momentumStats: MomentumEntry[]
}
```

- [ ] Create `TvStatsRotator.tsx`:
  - `relative h-full w-full overflow-hidden`
  - Render all 3 panels as `absolute inset-0` children
  - Each panel: `transition-opacity duration-400` — `opacity-100` when its index matches `activePanelIndex`, `opacity-0` otherwise
  - Pass relevant props to each panel

- [ ] Create `TvBirdiesPanel.tsx` — Panel A:
  - Full-height, two-column layout (`flex gap-8 p-8 h-full`)
  - **Left column — "🐦 BIRDIE LEADERS":**
    - Section header in slate-400 uppercase style
    - Top 5 teams (or fewer if < 5): each row shows team name + birdie count as large number (`text-5xl font-bold`)
    - Up to 5 birdie emoji icons beside the count; if count > 5 show `🐦×{N}`
  - **Right column — "⚡ LAST 3 HOLES":**
    - Section header in slate-400 uppercase style
    - Top 5 teams from `momentumStats`: team name + 3 mini bar cells (one per hole in ascending order)
    - Each mini bar: `w-6 rounded` with height `h-3` (even par), `h-6 bg-green-500` (under par), `h-6 bg-red-500` (over par), `h-3 bg-slate-600` (even)
    - Vspar sum label beside bars: red if negative, slate if positive, white if 0
  - **Empty state:** if `birdieStats.length === 0` or all have 0 birdies: centred `text-slate-400 text-2xl` — "No birdies yet — keep swinging! 🏌️"

---

### Task 6: Panel B (`TvHoleMapPanel.tsx`)

**Files:**
- Create: `src/components/tv/panels/TvHoleMapPanel.tsx`

**Interfaces:**
```typescript
interface TvHoleMapPanelProps {
  holeDifficulty: HoleDifficulty[]
  bestAchievement: BestAchievement | null
}
```

- [ ] Create `TvHoleMapPanel.tsx` — Panel B:
  - Title: "HOLE DIFFICULTY" in slate-400 uppercase style
  - Two rows of 9 circles: holes 1–9 top row, holes 10–18 bottom row
  - Each circle: `w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white`
    - `bg-slate-700` if `avgVsPar === null` (no data)
    - `bg-green-500` if `avgVsPar < -0.5` (easy)
    - `bg-yellow-400 text-slate-900` if `avgVsPar >= -0.5 && avgVsPar <= 0.5` (average)
    - `bg-red-500` if `avgVsPar > 0.5` (hard)
  - Legend below grid: `🟢 Easy · 🟡 Average · 🔴 Playing tough` in `text-slate-400 text-sm`
  - Best achievement callout (conditional — only if `bestAchievement !== null`):
    - `vspar <= -2`: `🦅 EAGLE — Hole #N · [Team Name]` in `text-amber-400 text-2xl font-bold`
    - `vspar === -1`: `🐦 BIRDIE LEADER — Hole #N · [Team Name]` in `text-green-400 text-2xl font-bold`
  - Build `holeDifficulty` lookup by `holeNumber` (1–18); if a hole number is missing from the array, treat as null

---

### Task 7: Panel C (`TvShotStatsPanel.tsx`)

**Files:**
- Create: `src/components/tv/panels/TvShotStatsPanel.tsx`

**Interfaces:**
```typescript
interface TvShotStatsPanelProps {
  shotStats: ShotStats
}
```

- [ ] Create `TvShotStatsPanel.tsx` — Panel C:
  - Title: "SHOT STATS" in slate-400 uppercase style
  - Three equal-width stat cards in a row: `flex gap-6 p-8`
  - Each card: `bg-slate-800 rounded-2xl p-8 flex-1 flex flex-col`

  **Card 1 — Longest Drive:**
  - Icon `📏` at top-left (`text-4xl`)
  - Stat: `{longestDriveMeters}m` or `"GPS pending"` if null — `text-6xl font-bold text-white mt-4`
  - Sub-label: team name (or `"–"` if null) — `text-slate-400 text-lg mt-2`

  **Card 2 — Club of the Day:**
  - Icon `🏌️` at top-left (`text-4xl`)
  - Stat: club name or `"–"` if null — `text-5xl font-bold text-white mt-4`
  - Sub-label: `"{pct}% of scoring shots"` or `""` if null — `text-slate-400 text-lg mt-2`

  **Card 3 — Cleanest Teams:**
  - Icon `🚫` at top-left (`text-4xl`)
  - If all teams have 0 bad shots: centred `text-green-400 text-xl` — "All teams playing clean!"
  - Otherwise:
    - Top team name — `text-3xl font-bold text-white mt-4`
    - `{badShots} OB / Water` — `text-slate-400 text-lg mt-1`
    - 2nd and 3rd place teams in `text-slate-500 text-sm mt-3`, one per line
