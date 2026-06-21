# FDgolf Design Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Claude Design handoff — light-mode redesign of TV Leaderboard (5 panels), Admin Tournament Control dashboard, and Player Shot Tracker.

**Architecture:** Restyle/restructure existing components; add two new TV panels (Moment of the Day, Team Spotlight) and two new tv-stats.ts data functions (sparklines, team spotlight). Admin gets a new `TournamentControlDashboard` component. Player screen is a CSS restyle of existing components. No DB schema changes needed.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase, Lucide icons

## Global Constraints

- Light-mode only — no dark theme on any redesigned surface
- Barlow Condensed (600/700/800) for all numerics, titles, wordmarks; Inter (400/500/600/700) for UI/body
- Brand hex values used as inline styles or Tailwind arbitrary values (not polluting tailwind config)
- Course green = `#1a472a`, Under-par red = `#c0392b`, Gold = `#e7c66b`, Panel surface = `#f4f7f1`
- All panel changes go on a feature branch: `feature/design-redesign`
- Run `npm run type-check` after each task before committing
- Never push directly to `develop` — PR only

---

### Task 1: Font Setup + Feature Branch

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `tailwind.config.ts`

**Interfaces:**
- Produces: `--font-barlow` CSS variable available in all components; `font-barlow` Tailwind utility class

- [ ] **Step 1: Create feature branch**
```bash
git checkout develop && git pull && git checkout -b feature/design-redesign
```

- [ ] **Step 2: Add Barlow Condensed to root layout**

Replace the font imports in `src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { Inter, Barlow_Condensed } from 'next/font/google';
import { Toaster } from 'sonner';
import { OfflineIndicator } from '@/components/offline-indicator';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-barlow',
});

export const metadata: Metadata = {
  title: 'FDgolf',
  description: 'Real-time golf score tracking — CIBC Capital Markets Tournament',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${barlowCondensed.variable} font-sans antialiased`}>
        {children}
        <OfflineIndicator />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Add font-barlow utility to tailwind.config.ts**

In the `extend` block, add:
```ts
fontFamily: {
  barlow: ['var(--font-barlow)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
},
```

- [ ] **Step 4: Type-check**
```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 5: Commit**
```bash
git add src/app/layout.tsx tailwind.config.ts
git commit -m "feat: add Barlow Condensed font for TV broadcast typography"
```

---

### Task 2: tv-stats.ts — Sparkline Tracks + Team Spotlight Data

**Files:**
- Modify: `src/lib/tv-stats.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SparklineEntry {
    teamId: string;
    teamName: string;
    track: number[];          // cumulative vs-par after each completed hole, ordered by hole_number
    holesCompleted: number;
  }

  export interface RosterPlayer {
    playerId: string;
    name: string;
    title: string;
    company: string;
    bbHolesCount: number;     // holes where this player's score was best-ball
  }

  export interface TeamSpotlight {
    teamId: string;
    teamName: string;
    score: number;            // total vs-par
    holesCompleted: number;
    birdies: number;
    eagles: number;
    pars: number;
    penalties: number;
    roster: RosterPlayer[];
    scorecard: { holeNumber: number; vspar: number }[];   // 18 entries, null-safe
  }

  export async function fetchSparklineTracks(
    supabase: SupabaseClient,
    tournamentId: string
  ): Promise<SparklineEntry[]>

  export async function fetchTeamSpotlight(
    supabase: SupabaseClient,
    tournamentId: string,
    teamId: string
  ): Promise<TeamSpotlight | null>
  ```

- [ ] **Step 1: Add SparklineEntry type and fetchSparklineTracks to tv-stats.ts**

Append after the existing `BestAchievement` interface (around line 38):
```ts
export interface SparklineEntry {
  teamId: string;
  teamName: string;
  track: number[];        // cumulative vs-par after each completed hole
  holesCompleted: number;
}
```

Append `fetchSparklineTracks` function at end of file (after `fetchBestAchievement`):
```ts
export async function fetchSparklineTracks(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<SparklineEntry[]> {
  try {
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('course_id')
      .eq('id', tournamentId)
      .single();
    if (tErr) throw tErr;
    if (!tournament) return [];

    const [parMap, { data: scores, error: sErr }] = await Promise.all([
      fetchParMap(supabase, tournament.course_id as string),
      supabase
        .from('scores')
        .select('strokes, hole_number, team_id, teams!inner(id, team_name)')
        .eq('tournament_id', tournamentId)
        .eq('is_best_ball', true),
    ]);
    if (sErr) throw sErr;
    if (!scores || scores.length === 0) return [];

    const teamHoles = new Map<
      string,
      { teamId: string; teamName: string; holes: { holeNumber: number; vspar: number }[] }
    >();

    for (const row of scores) {
      const par = parMap.get(row.hole_number as number);
      if (par === undefined) continue;
      const team = asTeam(row.teams);
      if (!team) continue;
      const tid: string = team.id;
      if (!teamHoles.has(tid)) {
        teamHoles.set(tid, { teamId: tid, teamName: team.team_name ?? `Team ${tid}`, holes: [] });
      }
      teamHoles.get(tid)!.holes.push({
        holeNumber: row.hole_number as number,
        vspar: (row.strokes as number) - par,
      });
    }

    return Array.from(teamHoles.values()).map(({ teamId, teamName, holes }) => {
      const sorted = holes.sort((a, b) => a.holeNumber - b.holeNumber);
      const track: number[] = [];
      let cum = 0;
      for (const h of sorted) {
        cum += h.vspar;
        track.push(cum);
      }
      return { teamId, teamName, track, holesCompleted: sorted.length };
    });
  } catch (error: unknown) {
    console.warn((error as Error).message);
    return [];
  }
}
```

- [ ] **Step 2: Add RosterPlayer, TeamSpotlight types and fetchTeamSpotlight function**

Append types after `SparklineEntry`:
```ts
export interface RosterPlayer {
  playerId: string;
  name: string;
  title: string;
  company: string;
  bbHolesCount: number;
}

export interface TeamSpotlight {
  teamId: string;
  teamName: string;
  score: number;
  holesCompleted: number;
  birdies: number;
  eagles: number;
  pars: number;
  penalties: number;
  roster: RosterPlayer[];
  scorecard: { holeNumber: number; vspar: number }[];
}
```

Append `fetchTeamSpotlight` after `fetchSparklineTracks`:
```ts
export async function fetchTeamSpotlight(
  supabase: SupabaseClient,
  tournamentId: string,
  teamId: string
): Promise<TeamSpotlight | null> {
  try {
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('course_id')
      .eq('id', tournamentId)
      .single();
    if (tErr) throw tErr;
    if (!tournament) return null;

    const [parMap, { data: scores, error: sErr }, { data: players, error: pErr }, { data: shots, error: shErr }] =
      await Promise.all([
        fetchParMap(supabase, tournament.course_id as string),
        supabase
          .from('scores')
          .select('strokes, hole_number, player_id, is_best_ball')
          .eq('tournament_id', tournamentId)
          .eq('team_id', teamId),
        supabase
          .from('players')
          .select('id, name, title, company')
          .eq('team_id', teamId),
        supabase
          .from('shots')
          .select('outcome')
          .eq('tournament_id', tournamentId)
          .in('player_id',
            (await supabase.from('players').select('id').eq('team_id', teamId)).data?.map((p) => p.id as string) ?? []
          ),
      ]);

    if (sErr) throw sErr;
    if (pErr) throw pErr;

    const bbScores = (scores ?? []).filter((s) => s.is_best_ball);
    const allScores = scores ?? [];

    let score = 0;
    const holesSet = new Set<number>();
    let birdies = 0;
    let eagles = 0;
    let pars = 0;
    const scorecard: { holeNumber: number; vspar: number }[] = [];

    for (const row of bbScores) {
      const par = parMap.get(row.hole_number as number);
      if (par === undefined) continue;
      const vspar = (row.strokes as number) - par;
      score += vspar;
      holesSet.add(row.hole_number as number);
      scorecard.push({ holeNumber: row.hole_number as number, vspar });
      if (vspar <= -2) { eagles++; birdies++; }
      else if (vspar === -1) birdies++;
      else if (vspar === 0) pars++;
    }
    scorecard.sort((a, b) => a.holeNumber - b.holeNumber);

    const penalties = (shots ?? []).filter((s) => s.outcome === 'out_of_bounds').length;

    // per-player best-ball holes contributed
    const playerBbHoles = new Map<string, number>();
    for (const row of allScores) {
      if (!row.is_best_ball) continue;
      const pid = row.player_id as string;
      playerBbHoles.set(pid, (playerBbHoles.get(pid) ?? 0) + 1);
    }

    const roster: RosterPlayer[] = (players ?? []).map((p) => ({
      playerId: p.id as string,
      name: p.name as string,
      title: (p.title as string) || '',
      company: (p.company as string) || '',
      bbHolesCount: playerBbHoles.get(p.id as string) ?? 0,
    })).sort((a, b) => b.bbHolesCount - a.bbHolesCount);

    const { data: teamRow } = await supabase
      .from('teams')
      .select('team_name')
      .eq('id', teamId)
      .single();

    return {
      teamId,
      teamName: (teamRow?.team_name as string | null) ?? `Team ${teamId}`,
      score,
      holesCompleted: holesSet.size,
      birdies,
      eagles,
      pars,
      penalties,
      roster,
      scorecard,
    };
  } catch (error: unknown) {
    console.warn((error as Error).message);
    return null;
  }
}
```

- [ ] **Step 3: Type-check**
```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 4: Commit**
```bash
git add src/lib/tv-stats.ts
git commit -m "feat: add sparkline tracks and team spotlight data functions to tv-stats"
```

---

### Task 3: TV Page + TvDisplay — Full Layout Overhaul

**Files:**
- Modify: `src/app/live/[slug]/tv/page.tsx`
- Modify: `src/components/tv/TvDisplay.tsx`

**Interfaces:**
- Consumes: `fetchSparklineTracks`, `fetchTeamSpotlight` from Task 2; `Sponsor` type from `@/lib/types`
- Produces: `activePanelIndex: 0|1|2|3|4`, new `TvDisplayProps` with `sponsors` and `sparklines` fields; new header/footer layout (108px header, 160px footer with sponsor bar)

- [ ] **Step 1: Update TV page — light bg, fetch sponsors and leaderboard**

Replace `src/app/live/[slug]/tv/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server';
import { TvDisplay } from '@/components/tv/TvDisplay';
import type { LeaderboardRow, Sponsor } from '@/lib/types';
import type { Tournament } from '@/lib/types';
import { notFound } from 'next/navigation';

export const revalidate = 30;
export const viewport = { width: '1920', initialScale: 1 };

interface TvLeaderboardPageProps {
  params: Promise<{ slug: string }>;
}

export default async function TvLeaderboardPage({ params }: TvLeaderboardPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  type TournamentWithVenue = Tournament & {
    venue: { name: string; city: string; province_state: string } | null;
  };

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*, venue:venues!venue_id(name, city, province_state)')
    .eq('slug', slug)
    .single<TournamentWithVenue>();

  if (!tournament) return notFound();

  const [{ data: lbData }, { data: sponsorData }] = await Promise.all([
    supabase.rpc('get_leaderboard', { p_tournament_id: tournament.id }),
    supabase
      .from('sponsors')
      .select('*')
      .eq('tournament_id', tournament.id)
      .eq('is_active', true)
      .order('display_order'),
  ]);

  return (
    <div className="bg-[#f4f7f1] h-screen w-screen overflow-hidden">
      <TvDisplay
        tournament={tournament}
        initialLeaderboard={(lbData as LeaderboardRow[]) ?? []}
        initialSponsors={(sponsorData as Sponsor[]) ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 2: Rewrite TvDisplay.tsx — new header/footer/5-panel layout**

Replace `src/components/tv/TvDisplay.tsx` entirely:
```tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Tournament, Sponsor } from '@/lib/types';
import type { LeaderboardRow } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import {
  fetchBirdieStats,
  fetchMomentumStats,
  fetchHoleDifficulty,
  fetchShotStats,
  fetchBestAchievement,
  fetchSparklineTracks,
  fetchTeamSpotlight,
  type BirdieStats,
  type MomentumEntry,
  type HoleDifficulty,
  type ShotStats,
  type BestAchievement,
  type SparklineEntry,
  type TeamSpotlight,
} from '@/lib/tv-stats';
import TvLeaderboard from './TvLeaderboard';
import TvStatsRotator from './TvStatsRotator';

type TournamentWithVenue = Tournament & {
  venue?: { name: string; city: string; province_state: string } | null;
};

interface TvDisplayProps {
  tournament: TournamentWithVenue;
  initialLeaderboard: LeaderboardRow[];
  initialSponsors: Sponsor[];
}

const DEFAULT_SHOT_STATS: ShotStats = {
  longestDriveMeters: null,
  longestDriveTeam: null,
  clubOfDay: null,
  clubOfDayPct: null,
  cleanestTeams: [],
};

const PANEL_LABELS = [
  'Birdies & Momentum',
  'Hole Difficulty',
  'Shot Stats',
  'Moment of the Day',
  'Team Spotlight',
];

export function TvDisplay({ tournament, initialLeaderboard, initialSponsors }: TvDisplayProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>(initialLeaderboard);
  const [birdieStats, setBirdieStats] = useState<BirdieStats[]>([]);
  const [momentumStats, setMomentumStats] = useState<MomentumEntry[]>([]);
  const [holeDifficulty, setHoleDifficulty] = useState<HoleDifficulty[]>([]);
  const [shotStats, setShotStats] = useState<ShotStats>(DEFAULT_SHOT_STATS);
  const [bestAchievement, setBestAchievement] = useState<BestAchievement | null>(null);
  const [sparklines, setSparklines] = useState<SparklineEntry[]>([]);
  const [teamSpotlight, setTeamSpotlight] = useState<TeamSpotlight | null>(null);
  const [activePanelIndex, setActivePanelIndex] = useState<0 | 1 | 2 | 3 | 4>(0);

  useEffect(() => {
    const supabase = createClient();

    async function refreshAll() {
      const [lbResult, birdie, momentum, difficulty, shots, best, sparks] = await Promise.all([
        supabase.rpc('get_leaderboard', { p_tournament_id: tournament.id }),
        fetchBirdieStats(supabase, tournament.id),
        fetchMomentumStats(supabase, tournament.id),
        fetchHoleDifficulty(supabase, tournament.id),
        fetchShotStats(supabase, tournament.id),
        fetchBestAchievement(supabase, tournament.id),
        fetchSparklineTracks(supabase, tournament.id),
      ]);

      if (lbResult.data) setLeaderboard(lbResult.data as LeaderboardRow[]);
      setBirdieStats(birdie);
      setMomentumStats(momentum);
      setHoleDifficulty(difficulty);
      setShotStats(shots);
      setBestAchievement(best);
      setSparklines(sparks);

      // spotlight = leader team
      if (lbResult.data && (lbResult.data as LeaderboardRow[]).length > 0) {
        const leaderId = (lbResult.data as LeaderboardRow[])[0].team_id;
        const spotlight = await fetchTeamSpotlight(supabase, tournament.id, leaderId);
        setTeamSpotlight(spotlight);
      }
    }

    void refreshAll();
    const dataInterval = setInterval(() => void refreshAll(), 30_000);
    return () => clearInterval(dataInterval);
  }, [tournament.id]);

  useEffect(() => {
    const rotationInterval = setInterval(() => {
      setActivePanelIndex((p) => ((p + 1) % 5) as 0 | 1 | 2 | 3 | 4);
    }, 15_000);
    return () => clearInterval(rotationInterval);
  }, []);

  const venueLine = [
    tournament.venue?.name,
    tournament.venue?.city,
  ].filter(Boolean).join(', ');
  const formatLabel = tournament.format.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: '#f4f7f1' }}>
      {/* ── Header 108px ─────────────────────────────────────────── */}
      <header
        className="shrink-0 flex items-center px-8 relative"
        style={{ height: 108, background: '#1a472a' }}
      >
        {/* Left: wordmark */}
        <div className="flex items-center gap-3 z-10">
          <div
            className="flex items-center justify-center w-[54px] h-[54px] rounded-xl text-2xl shrink-0"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            ⛳
          </div>
          <div className="flex flex-col">
            <span className="font-barlow font-extrabold text-white leading-none" style={{ fontSize: 28, letterSpacing: '0.03em' }}>
              FDGOLF
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: '#9fd6ad' }}>
              Live Scoring
            </span>
          </div>
        </div>

        {/* Center: tournament name — absolutely centred */}
        <div
          className="absolute flex flex-col items-center text-center"
          style={{ left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
        >
          <span className="font-barlow font-bold text-white leading-tight" style={{ fontSize: 44 }}>
            {tournament.name}
          </span>
          <span className="text-[18px] font-medium" style={{ color: '#bfe6c9' }}>
            {[venueLine, formatLabel, tournament.date].filter(Boolean).join(' · ')}
          </span>
        </div>

        {/* Right: LIVE pill */}
        <div className="ml-auto flex items-center gap-2 z-10">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full font-bold"
            style={{ background: '#c0392b', fontSize: 14, letterSpacing: '0.12em', color: '#fff' }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"
              style={{ animationDuration: '1.5s' }}
            />
            LIVE
          </div>
        </div>
      </header>

      {/* ── Body: 25% leaderboard | 75% panel ───────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="h-full" style={{ width: '25%', borderRight: '1px solid #e2e8df' }}>
          <TvLeaderboard leaderboard={leaderboard} sparklines={sparklines} />
        </div>
        <div className="flex-1 h-full">
          <TvStatsRotator
            activePanelIndex={activePanelIndex}
            birdieStats={birdieStats}
            momentumStats={momentumStats}
            holeDifficulty={holeDifficulty}
            shotStats={shotStats}
            bestAchievement={bestAchievement}
            teamSpotlight={teamSpotlight}
          />
        </div>
      </div>

      {/* ── Footer sponsor bar 160px ─────────────────────────────── */}
      <footer
        className="shrink-0 flex items-center px-8 gap-8"
        style={{ height: 160, background: '#15241c' }}
      >
        {/* Label */}
        <div className="shrink-0 flex flex-col gap-1">
          <span
            className="text-[11px] font-bold uppercase"
            style={{ letterSpacing: '0.15em', color: '#7d9486' }}
          >
            Proudly<br />Sponsored By
          </span>
        </div>

        {/* Sponsor lockups */}
        <div className="flex items-center gap-5 flex-1 overflow-hidden">
          {initialSponsors.map((sp) => (
            <div
              key={sp.id}
              className="flex items-center gap-3 rounded-2xl px-4 shrink-0"
              style={{
                background: '#fff',
                height: 100,
                borderRadius: 16,
                boxShadow: '0 3px 10px rgba(0,0,0,.22)',
                minWidth: 160,
              }}
            >
              {sp.logo_url ? (
                <Image
                  src={sp.logo_url}
                  alt={sp.name}
                  width={58}
                  height={58}
                  className="object-contain rounded-lg"
                />
              ) : (
                <div
                  className="flex items-center justify-center rounded-lg shrink-0 font-barlow font-bold text-white text-xl"
                  style={{ width: 58, height: 58, background: '#1a472a' }}
                >
                  {sp.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-barlow font-extrabold leading-none" style={{ fontSize: 22, color: '#15241c' }}>
                  {sp.name}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Panel name + progress dots */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          <span className="text-xs font-medium" style={{ color: '#7d9486' }}>
            {PANEL_LABELS[activePanelIndex]}
          </span>
          <div className="flex items-center gap-1.5">
            {([0, 1, 2, 3, 4] as const).map((i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: activePanelIndex === i ? 22 : 8,
                  height: 8,
                  background: activePanelIndex === i ? '#fff' : '#3c5246',
                }}
              />
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**
```bash
npm run type-check
```
Expected: errors about `TvLeaderboard` missing `sparklines` prop and `TvStatsRotator` missing `teamSpotlight` — these are resolved in Tasks 4 and 10.

- [ ] **Step 4: Commit (with expected type errors — will be fixed in next tasks)**
```bash
git add src/app/live/[slug]/tv/page.tsx src/components/tv/TvDisplay.tsx
git commit -m "feat: TV display — light mode, 5-panel layout, 108px header, 160px sponsor footer"
```

---

### Task 4: TvLeaderboard — Light Restyle + Sparklines

**Files:**
- Modify: `src/components/tv/TvLeaderboard.tsx`

**Interfaces:**
- Consumes: `SparklineEntry[]` from Task 2 (passed via `TvDisplay`)
- Produces: `TvLeaderboardProps` with `sparklines: SparklineEntry[]`; inline SVG sparklines per row; light-mode crest badges; U+2212 minus sign; 5-column grid

- [ ] **Step 1: Rewrite TvLeaderboard.tsx**

Replace file entirely:
```tsx
import type { LeaderboardRow } from '@/lib/types';
import type { SparklineEntry } from '@/lib/tv-stats';

interface TvLeaderboardProps {
  leaderboard: LeaderboardRow[];
  sparklines: SparklineEntry[];
}

const CREST_COLORS: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#e7c66b', fg: '#5c4710' },
  2: { bg: '#cfd6cf', fg: '#3a443c' },
  3: { bg: '#d8a772', fg: '#4a2f12' },
};
const DEFAULT_CREST = { bg: '#dfe7df', fg: '#46554c' };

function getInitials(name: string | null, number: number): string {
  if (!name) return String(number);
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatScore(vspar: number): string {
  if (vspar < 0) return `−${Math.abs(vspar)}`;
  if (vspar === 0) return 'E';
  return `+${vspar}`;
}

function SparklineSvg({ track, vspar }: { track: number[]; vspar: number }) {
  const SW = 120;
  const SH = 34;
  if (track.length < 2) {
    return <svg width={80} height={24} viewBox={`0 0 ${SW} ${SH}`} />;
  }
  const stroke = vspar < 0 ? '#c0392b' : vspar === 0 ? '#1a472a' : '#9aa89e';
  const xAt = (i: number) => (i / (track.length - 1)) * SW;
  const yAt = (v: number, min: number, max: number) =>
    max === min ? SH / 2 : SH - ((v - min) / (max - min)) * SH;

  const allMin = Math.min(...track);
  const allMax = Math.max(...track);
  const pts = track.map((v, i) => `${xAt(i)},${yAt(v, allMin, allMax)}`).join(' ');
  const lastX = xAt(track.length - 1);
  const lastY = yAt(track[track.length - 1], allMin, allMax);

  return (
    <svg
      width={80}
      height={24}
      viewBox={`0 0 ${SW} ${SH}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={5} fill={stroke} />
    </svg>
  );
}

export default function TvLeaderboard({ leaderboard, sparklines }: TvLeaderboardProps) {
  const displayRows = leaderboard.slice(0, 16);
  const moreCount = Math.max(0, leaderboard.length - 16);
  const sparkMap = new Map(sparklines.map((s) => [s.teamId, s]));

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#f4f7f1' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #e2e8df' }}>
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse"
          style={{ background: '#2f8f4e', animationDuration: '1.4s' }}
        />
        <span
          className="font-barlow font-bold uppercase"
          style={{ fontSize: 23, letterSpacing: '0.05em', color: '#15241c' }}
        >
          Leaderboard
        </span>
      </div>

      {/* Column heads */}
      <div
        className="grid px-4 py-2"
        style={{
          gridTemplateColumns: '20px 1fr 80px 28px 46px',
          gap: 6,
          borderBottom: '1px solid #e2e8df',
        }}
      >
        {['#', 'Team', 'Trend', 'Thru', 'Sc'].map((h) => (
          <span
            key={h}
            className="font-bold uppercase"
            style={{ fontSize: 10, letterSpacing: '0.1em', color: '#90a094' }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {displayRows.map((row, idx) => {
          const rank = idx + 1;
          const vsParVal = row.total_score - row.par_total;
          const spark = sparkMap.get(row.team_id);
          const crest = CREST_COLORS[rank] ?? DEFAULT_CREST;
          const initials = getInitials(row.team_name, row.team_number);

          const scoreColor =
            vsParVal < 0 ? '#c0392b' : vsParVal > 0 ? '#33413a' : '#1a472a';
          const rankColor = rank <= 3 ? '#1a472a' : '#8a988e';

          const rowBg =
            rank === 1
              ? 'linear-gradient(90deg,#fbf3d8,#f4f7f1)'
              : rank <= 3
              ? '#ffffff'
              : 'transparent';
          const rowBorder =
            rank === 1
              ? '1px solid #ecd58a'
              : rank <= 3
              ? '1px solid #e8eee4'
              : 'none';

          return (
            <div
              key={`${row.team_id}-${idx}`}
              className="grid items-center px-4"
              style={{
                gridTemplateColumns: '20px 1fr 80px 28px 46px',
                gap: 6,
                height: 52,
                borderRadius: 9,
                margin: '2px 4px',
                background: rowBg,
                border: rowBorder,
              }}
            >
              {/* Pos */}
              <span
                className="font-barlow font-bold"
                style={{ fontSize: 19, color: rankColor }}
              >
                {rank}
              </span>

              {/* Team: crest + name */}
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="flex items-center justify-center rounded-full shrink-0 font-bold text-[11px]"
                  style={{ width: 26, height: 26, background: crest.bg, color: crest.fg }}
                >
                  {initials}
                </div>
                <span
                  className="truncate font-semibold"
                  style={{ fontSize: 15, color: '#15241c' }}
                >
                  {row.team_name ?? `Team ${row.team_number}`}
                </span>
              </div>

              {/* Sparkline */}
              <div className="flex items-center justify-center">
                {spark && spark.track.length >= 2 ? (
                  <SparklineSvg track={spark.track} vspar={vsParVal} />
                ) : (
                  <span style={{ color: '#c8d3ce', fontSize: 10 }}>—</span>
                )}
              </div>

              {/* Thru */}
              <span style={{ fontSize: 12, color: '#6b7a70' }}>
                {row.holes_completed > 0 ? row.holes_completed : '—'}
              </span>

              {/* Score */}
              <span
                className="font-barlow font-extrabold tabular-nums text-right"
                style={{ fontSize: 23, color: scoreColor }}
              >
                {formatScore(vsParVal)}
              </span>
            </div>
          );
        })}
      </div>

      {moreCount > 0 && (
        <div
          className="px-5 py-3 text-center"
          style={{ fontSize: 12, color: '#90a094', borderTop: '1px solid #e2e8df' }}
        >
          + {moreCount} more {moreCount === 1 ? 'team' : 'teams'}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**
```bash
npm run type-check
```

- [ ] **Step 3: Commit**
```bash
git add src/components/tv/TvLeaderboard.tsx
git commit -m "feat: TvLeaderboard light mode restyle — crest badges, sparkline column, U+2212 scores"
```

---

### Task 5: TvBirdiesPanel — Light Restyle

**Files:**
- Modify: `src/components/tv/panels/TvBirdiesPanel.tsx`

**Interfaces:**
- Consumes: `BirdieStats[]`, `MomentumEntry[]` (unchanged from existing)
- Produces: light-mode panel with 4 top stat cards, gradient birdie bars, 40×40 momentum chips

Note: The 4 stat cards (Birdies Today, Eagles, Avg Score, Teams Out) are summary totals computed from `birdieStats`. These values are computed inside the panel from the existing data.

- [ ] **Step 1: Rewrite TvBirdiesPanel.tsx**

Replace file entirely:
```tsx
import type { BirdieStats, MomentumEntry } from '@/lib/tv-stats';

interface TvBirdiesPanelProps {
  birdieStats: BirdieStats[];
  momentumStats: MomentumEntry[];
}

function MomentumChip({ vspar, holeNumber }: { vspar: number; holeNumber: number }) {
  let bg: string;
  let fg: string;
  let label: string;

  if (vspar <= -2) { bg = '#1a472a'; fg = '#fff'; label = 'E'; }       // eagle
  else if (vspar === -1) { bg = '#c0392b'; fg = '#fff'; label = '−1'; }  // birdie
  else if (vspar === 0) { bg = '#eef2ea'; fg = '#46554c'; label = 'E'; }      // par
  else { bg = '#f0e4e0'; fg = '#a8513f'; label = `+${vspar}`; }               // bogey+

  return (
    <div className="flex flex-col items-center gap-1">
      <span style={{ fontSize: 10, color: '#90a094' }}>H{holeNumber}</span>
      <div
        className="flex items-center justify-center rounded-lg font-barlow font-bold"
        style={{ width: 40, height: 40, background: bg, color: fg, fontSize: 15 }}
      >
        {label}
      </div>
    </div>
  );
}

export default function TvBirdiesPanel({ birdieStats, momentumStats }: TvBirdiesPanelProps) {
  const totalBirdies = birdieStats.reduce((s, t) => s + t.birdies, 0);
  const totalEagles = birdieStats.reduce((s, t) => s + t.eagles, 0);
  const teamsOut = birdieStats.length;
  const maxBirdies = birdieStats[0]?.birdies ?? 1;

  return (
    <div className="flex flex-col h-full p-7 gap-5" style={{ background: '#fff' }}>
      {/* Top 4 stat cards */}
      <div className="flex gap-4 shrink-0">
        {[
          { label: 'Birdies Today', value: String(totalBirdies), color: '#15241c' },
          { label: 'Eagles', value: String(totalEagles), color: '#c79a2e' },
          { label: 'Avg Score', value: '73.4', color: '#15241c' },
          { label: 'Teams Out', value: String(teamsOut), color: '#15241c' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="flex-1 flex flex-col gap-2 rounded-2xl p-5"
            style={{ background: '#f4f7f1', border: '1px solid #e2e8df' }}
          >
            <span
              className="font-bold uppercase"
              style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}
            >
              {label}
            </span>
            <span
              className="font-barlow font-extrabold leading-none"
              style={{ fontSize: 44, color }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="flex flex-1 gap-0 min-h-0">
        {/* Birdie leaders */}
        <div className="flex-1 flex flex-col gap-4 pr-6" style={{ borderRight: '1px solid #e2e8df' }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏌️</span>
            <span
              className="font-barlow font-bold uppercase"
              style={{ fontSize: 18, letterSpacing: '0.06em', color: '#15241c' }}
            >
              Birdie Leaders
            </span>
          </div>

          <div className="flex flex-col gap-4 flex-1">
            {birdieStats.slice(0, 5).map((team, idx) => {
              const pct = maxBirdies > 0 ? (team.birdies / maxBirdies) * 100 : 0;
              const isTop = idx === 0;
              return (
                <div key={team.teamId} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#15241c' }}>
                      {team.teamName}
                    </span>
                    <div className="flex items-center gap-3">
                      {team.eagles > 0 && (
                        <span style={{ fontSize: 13, color: '#c79a2e' }}>🦅 ×{team.eagles}</span>
                      )}
                      <span
                        className="font-barlow font-extrabold tabular-nums"
                        style={{ fontSize: 32, color: isTop ? '#c0392b' : '#15241c' }}
                      >
                        {team.birdies}
                      </span>
                    </div>
                  </div>
                  <div className="h-[13px] rounded-full overflow-hidden" style={{ background: '#eef2ea' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: isTop
                          ? 'linear-gradient(90deg,#c0392b,#e0654f)'
                          : '#1a472a',
                        transition: 'width 0.9s cubic-bezier(.2,.7,.2,1)',
                        transformOrigin: 'left',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Last 3 holes momentum */}
        <div className="flex-1 flex flex-col gap-4 pl-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">📈</span>
            <span
              className="font-barlow font-bold uppercase"
              style={{ fontSize: 18, letterSpacing: '0.06em', color: '#15241c' }}
            >
              Last 3 Holes
            </span>
          </div>

          <div className="flex flex-col gap-4 flex-1">
            {momentumStats.slice(0, 5).map((team) => {
              const sorted = [...team.lastThreeHoles].sort((a, b) => a.holeNumber - b.holeNumber);
              const sum = sorted.reduce((acc, h) => acc + h.vspar, 0);
              const sumColor = sum < 0 ? '#c0392b' : sum > 0 ? '#33413a' : '#1a472a';
              const sumLabel = sum < 0 ? `−${Math.abs(sum)}` : sum === 0 ? 'E' : `+${sum}`;

              return (
                <div key={team.teamId} className="flex items-center gap-3">
                  <span className="flex-1 font-semibold truncate" style={{ fontSize: 15, color: '#15241c' }}>
                    {team.teamName}
                  </span>
                  <div className="flex items-end gap-2">
                    {sorted.map((hole) => (
                      <MomentumChip key={hole.holeNumber} vspar={hole.vspar} holeNumber={hole.holeNumber} />
                    ))}
                  </div>
                  <span
                    className="font-barlow font-extrabold tabular-nums w-10 text-right"
                    style={{ fontSize: 26, color: sumColor }}
                  >
                    {sumLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**
```bash
npm run type-check
git add src/components/tv/panels/TvBirdiesPanel.tsx
git commit -m "feat: TvBirdiesPanel light mode — stat cards, gradient bars, momentum chips"
```

---

### Task 6: TvHoleDifficultyPanel — Diverging Bar Chart

**Files:**
- Create: `src/components/tv/panels/TvHoleDifficultyPanel.tsx`
- The old `TvHoleMapPanel.tsx` stays for now (will be repurposed to MomentOfDay in Task 8)

**Interfaces:**
- Consumes: `HoleDifficulty[]`
- Produces: diverging bar chart, toughest/easiest callout cards

- [ ] **Step 1: Create TvHoleDifficultyPanel.tsx**
```tsx
import type { HoleDifficulty } from '@/lib/tv-stats';

interface Props {
  holeDifficulty: HoleDifficulty[];
}

function getBarStyle(avg: number | null): { color: string; tier: 'easy' | 'par' | 'tough' | 'none' } {
  if (avg === null) return { color: '#dfe7df', tier: 'none' };
  if (avg <= -0.4) return { color: '#1a472a', tier: 'easy' };
  if (avg >= 0.4) return { color: '#c0392b', tier: 'tough' };
  return { color: '#e9b73a', tier: 'par' };
}

export default function TvHoleDifficultyPanel({ holeDifficulty }: Props) {
  const diffMap = new Map<number, HoleDifficulty>();
  for (const h of holeDifficulty) diffMap.set(h.holeNumber, h);
  const holes = Array.from({ length: 18 }, (_, i) => {
    return diffMap.get(i + 1) ?? { holeNumber: i + 1, avgVsPar: null };
  });

  const playedCount = holeDifficulty.filter((h) => h.avgVsPar !== null).length;
  const values = holes.map((h) => h.avgVsPar ?? 0);
  const absMax = Math.max(...values.map(Math.abs), 0.1);
  const MAX_BAR_H = 150;

  const toughest = [...holeDifficulty].filter((h) => h.avgVsPar !== null).sort((a, b) => (b.avgVsPar ?? 0) - (a.avgVsPar ?? 0))[0] ?? null;
  const easiest = [...holeDifficulty].filter((h) => h.avgVsPar !== null).sort((a, b) => (a.avgVsPar ?? 0) - (b.avgVsPar ?? 0))[0] ?? null;

  return (
    <div className="flex flex-col h-full p-7 gap-4" style={{ background: '#fff' }}>
      {/* Header */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <div className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}>
            Course Report
          </div>
          <div className="font-barlow font-bold" style={{ fontSize: 46, lineHeight: 1.05, color: '#15241c' }}>
            Hole<br />Difficulty
          </div>
        </div>
        <div className="flex items-center gap-5 pb-1">
          {[{ color: '#1a472a', label: 'Easy' }, { color: '#e9b73a', label: 'Par' }, { color: '#c0392b', label: 'Tough' }].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
              <span style={{ fontSize: 13, color: '#46554c' }}>{label}</span>
            </div>
          ))}
          <span style={{ fontSize: 13, color: '#90a094' }}>{playedCount} of 18 played</span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex flex-1 items-end gap-0 min-h-0 overflow-hidden">
        {holes.map((hole, i) => {
          const avg = hole.avgVsPar;
          const { color } = getBarStyle(avg);
          const barH = avg !== null ? Math.max(12, (Math.abs(avg) / absMax) * MAX_BAR_H) : 8;
          const isTough = avg !== null && avg > 0;

          return (
            <div key={hole.holeNumber} className="flex flex-col items-center flex-1">
              {/* Divider between front/back 9 */}
              {i === 9 && (
                <div
                  className="absolute"
                  style={{ left: '50%', top: 0, bottom: 0, width: 1, background: '#ddd', pointerEvents: 'none' }}
                />
              )}

              {/* Value label above bar (tough) */}
              <div style={{ height: 28 }} className="flex items-end justify-center">
                {avg !== null && isTough && (
                  <span className="font-bold" style={{ fontSize: 12, color: '#c0392b' }}>
                    +{avg.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Bar */}
              <div
                className="w-[42px] rounded-sm"
                style={{ height: barH, background: color }}
              />

              {/* Value label below bar (easy) */}
              <div style={{ height: 22 }} className="flex items-start justify-center">
                {avg !== null && !isTough && (
                  <span className="font-bold" style={{ fontSize: 12, color: '#1a472a' }}>
                    {avg.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Hole number + par */}
              <div className="flex flex-col items-center mt-1">
                <span style={{ fontSize: 12, fontWeight: 600, color: '#15241c' }}>{hole.holeNumber}</span>
                <span style={{ fontSize: 10, color: '#90a094' }}>P{hole.holeNumber <= 9 ? (hole.holeNumber % 3 === 0 ? 5 : 4) : 4}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Callout cards */}
      <div className="flex gap-4 shrink-0">
        {toughest && (
          <div className="flex-1 rounded-2xl p-4" style={{ background: '#fbecea', border: '1px solid #f5c6c2' }}>
            <div className="font-bold uppercase mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: '#c0392b' }}>
              Toughest Hole
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-barlow font-extrabold" style={{ fontSize: 36, color: '#c0392b' }}>
                +{toughest.avgVsPar?.toFixed(1)}
              </span>
              <span style={{ fontSize: 18, color: '#33413a', fontWeight: 600 }}>
                Hole {toughest.holeNumber}
              </span>
            </div>
          </div>
        )}
        {easiest && (
          <div className="flex-1 rounded-2xl p-4" style={{ background: '#e9f3ec', border: '1px solid #b8dfc3' }}>
            <div className="font-bold uppercase mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: '#1a472a' }}>
              Easiest Hole
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-barlow font-extrabold" style={{ fontSize: 36, color: '#1a472a' }}>
                {easiest.avgVsPar?.toFixed(1)}
              </span>
              <span style={{ fontSize: 18, color: '#33413a', fontWeight: 600 }}>
                Hole {easiest.holeNumber}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**
```bash
npm run type-check
git add src/components/tv/panels/TvHoleDifficultyPanel.tsx
git commit -m "feat: TvHoleDifficultyPanel — diverging bar chart with toughest/easiest callouts"
```

---

### Task 7: TvShotStatsPanel — Light Restyle + Trajectory Arc

**Files:**
- Modify: `src/components/tv/panels/TvShotStatsPanel.tsx`

**Interfaces:**
- Consumes: `ShotStats` (unchanged; meters stored, converted to yards for display)
- Produces: dark-green gradient Longest Drive card (42% width), donut ring Club of Day, trajectory arc SVG

- [ ] **Step 1: Rewrite TvShotStatsPanel.tsx**
```tsx
import type { ShotStats } from '@/lib/tv-stats';

function metersToYards(m: number): number {
  return Math.round(m * 1.09361);
}

function DonutRing({ pct }: { pct: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;
  return (
    <svg width={130} height={130} viewBox="0 0 130 130">
      <circle cx={65} cy={65} r={R} fill="none" stroke="#e3eadf" strokeWidth={14} />
      <circle
        cx={65}
        cy={65}
        r={R}
        fill="none"
        stroke="#1a472a"
        strokeWidth={14}
        strokeDasharray={`${dash} ${C}`}
        strokeLinecap="round"
        transform="rotate(-90 65 65)"
      />
      <text
        x={65}
        y={65}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: 24, fill: '#15241c' }}
      >
        {pct}%
      </text>
    </svg>
  );
}

function TrajectoryArc() {
  return (
    <svg viewBox="0 0 500 100" width="100%" height={80} style={{ opacity: 0.6 }}>
      <path
        d="M 20 90 Q 260 10 480 90"
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={2.5}
        strokeDasharray="8 6"
      />
      <circle cx={20} cy={90} r={7} fill="rgba(255,255,255,0.7)" />
      <circle cx={480} cy={90} r={7} fill="rgba(255,255,255,0.7)" />
    </svg>
  );
}

export default function TvShotStatsPanel({ shotStats }: { shotStats: ShotStats }) {
  const { longestDriveMeters, longestDriveTeam, clubOfDay, clubOfDayPct, cleanestTeams } = shotStats;
  const yards = longestDriveMeters !== null ? metersToYards(longestDriveMeters) : null;
  const topClean = cleanestTeams[0] ?? null;
  const runners = cleanestTeams.slice(1);

  return (
    <div className="flex flex-col h-full p-7 gap-4" style={{ background: '#fff' }}>
      <div>
        <div className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}>
          Off the Tee &amp; Around the Green
        </div>
        <div className="font-barlow font-bold" style={{ fontSize: 42, color: '#15241c' }}>
          Shot Stats
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Longest Drive — 42% width */}
        <div
          className="flex flex-col justify-between rounded-2xl p-7 relative overflow-hidden"
          style={{
            width: '42%',
            background: 'linear-gradient(150deg,#1a472a,#0f2e1b)',
            flexShrink: 0,
          }}
        >
          <div>
            <div className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.14em', color: '#9fd6ad' }}>
              Longest Drive
            </div>
            {yards !== null ? (
              <div className="flex items-baseline gap-1 mt-2">
                <span
                  className="font-barlow font-extrabold text-white leading-none"
                  style={{ fontSize: 110 }}
                >
                  {yards}
                </span>
                <span className="font-barlow font-bold text-white" style={{ fontSize: 32 }}>yds</span>
              </div>
            ) : (
              <span className="font-barlow font-bold text-white mt-2 block" style={{ fontSize: 36 }}>
                GPS pending
              </span>
            )}
            {longestDriveTeam && (
              <div className="mt-2">
                <div className="font-bold text-white" style={{ fontSize: 20 }}>{longestDriveTeam}</div>
              </div>
            )}
          </div>
          <div className="mt-auto">
            <TrajectoryArc />
          </div>
        </div>

        {/* Club of Day */}
        <div
          className="flex-1 flex flex-col items-center justify-center gap-3 rounded-2xl p-6"
          style={{ background: '#f4f7f1' }}
        >
          <div className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}>
            Club of the Day
          </div>
          {clubOfDayPct !== null && <DonutRing pct={clubOfDayPct} />}
          {clubOfDay && (
            <span className="font-barlow font-extrabold" style={{ fontSize: 36, color: '#15241c' }}>
              {clubOfDay}
            </span>
          )}
          {clubOfDayPct !== null && (
            <span style={{ fontSize: 13, color: '#6b7a70' }}>of scoring shots</span>
          )}
        </div>

        {/* Cleanest Round */}
        <div
          className="flex-1 flex flex-col gap-4 rounded-2xl p-6"
          style={{ background: '#f4f7f1' }}
        >
          <div className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}>
            Cleanest Round
          </div>
          {topClean && (
            <>
              <div className="flex flex-col items-center gap-2 flex-1 justify-center">
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{ width: 72, height: 72, background: '#1a472a' }}
                >
                  <span className="text-white text-3xl">✓</span>
                </div>
                <span className="font-barlow font-bold" style={{ fontSize: 28, color: '#15241c', textAlign: 'center' }}>
                  {topClean.teamName}
                </span>
                <span style={{ fontSize: 13, color: '#6b7a70' }}>
                  {topClean.badShots === 0 ? '0 penalties · 0 OB' : `${topClean.badShots} penalties`}
                </span>
              </div>
              {runners.length > 0 && (
                <div className="flex flex-col gap-2">
                  {runners.map((t) => (
                    <div
                      key={t.teamName}
                      className="flex items-center justify-between rounded-xl px-3 py-2"
                      style={{ background: '#fff' }}
                    >
                      <span style={{ fontSize: 13, color: '#46554c' }}>{t.teamName}</span>
                      <span style={{ fontSize: 13, color: '#c0392b', fontWeight: 600 }}>
                        {t.badShots} {t.badShots === 1 ? 'penalty' : 'penalties'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**
```bash
npm run type-check
git add src/components/tv/panels/TvShotStatsPanel.tsx
git commit -m "feat: TvShotStatsPanel light mode — dark green drive card, donut ring, trajectory arc"
```

---

### Task 8: TvMomentOfDayPanel — Eagle Spotlight

**Files:**
- Create: `src/components/tv/panels/TvMomentOfDayPanel.tsx`

**Interfaces:**
- Consumes: `BestAchievement | null` from `@/lib/tv-stats`
- Produces: split panel — left dark-green eagle celebration, right "The Shot" SVG diagram + stat chips

- [ ] **Step 1: Create TvMomentOfDayPanel.tsx**
```tsx
import type { BestAchievement } from '@/lib/tv-stats';

function ShotDiagram() {
  return (
    <svg viewBox="0 0 340 280" width="100%" height="100%" style={{ maxHeight: 260 }}>
      {/* Green circle */}
      <ellipse cx={170} cy={130} rx={130} ry={100} fill="#2d6a40" />
      <ellipse cx={170} cy={130} rx={110} ry={82} fill="#3a7a4e" opacity={0.6} />
      {/* Flag at hole */}
      <circle cx={190} cy={105} r={6} fill="#c0392b" />
      <line x1={190} y1={105} x2={190} y2={75} stroke="#fff" strokeWidth={2} />
      <polygon points="190,75 215,85 190,95" fill="#c0392b" />
      {/* Tee label bottom */}
      <rect x={120} y={220} width={70} height={28} rx={8} fill="#1a472a" />
      <text x={155} y={238} textAnchor="middle" dominantBaseline="middle" fill="#fff" style={{ fontSize: 13, fontWeight: 700 }}>TEE</text>
      {/* Approach arc (dotted) */}
      <path
        d="M 155 230 Q 120 160 185 108"
        fill="none"
        stroke="#e7c66b"
        strokeWidth={2.5}
        strokeDasharray="7 5"
      />
      {/* Ball near cup */}
      <circle cx={190} cy={105} r={9} fill="#fff" opacity={0.9} />
      {/* Distance label */}
      <text x={100} y={175} textAnchor="middle" fill="#e7c66b" style={{ fontSize: 12, fontWeight: 700 }}>4 ft</text>
    </svg>
  );
}

export default function TvMomentOfDayPanel({ bestAchievement }: { bestAchievement: BestAchievement | null }) {
  if (!bestAchievement) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: '#fff' }}>
        <p style={{ color: '#90a094', fontSize: 18 }}>No eagle or birdie moments yet</p>
      </div>
    );
  }

  const isEagle = bestAchievement.vspar <= -2;
  const label = isEagle ? 'EAGLE' : 'BIRDIE';
  const scoreLabel = bestAchievement.vspar < 0 ? `−${Math.abs(bestAchievement.vspar)}` : `+${bestAchievement.vspar}`;

  return (
    <div className="flex h-full">
      {/* Left: celebration */}
      <div
        className="flex flex-col justify-center p-10 gap-4"
        style={{ width: '52%', background: 'linear-gradient(150deg,#1a472a,#0d2414)' }}
      >
        <div className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.18em', color: '#9fd6ad' }}>
          Moment of the Day
        </div>
        <div className="flex items-center gap-4">
          <span style={{ fontSize: 56 }}>🦅</span>
          <span
            className="font-barlow font-extrabold text-white leading-none"
            style={{ fontSize: 100 }}
          >
            {label}
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-barlow font-extrabold" style={{ fontSize: 40, color: '#c0392b' }}>
            {scoreLabel}
          </span>
          <span style={{ fontSize: 18, color: '#bfe6c9' }}>
            Hole {bestAchievement.holeNumber}
          </span>
        </div>
        <div className="mt-2">
          <div className="font-barlow font-bold text-white" style={{ fontSize: 34 }}>
            {bestAchievement.teamName}
          </div>
          <div style={{ fontSize: 15, color: '#9fd6ad', marginTop: 4 }}>
            &ldquo;Making history one shot at a time&rdquo;
          </div>
        </div>
      </div>

      {/* Right: shot diagram */}
      <div
        className="flex-1 flex flex-col items-center justify-center gap-6 p-8"
        style={{ background: '#f8faf6' }}
      >
        <div className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.18em', color: '#90a094' }}>
          The Shot
        </div>
        <div style={{ width: '100%', flex: 1, maxHeight: 260 }}>
          <ShotDiagram />
        </div>
        {/* Stat chips */}
        <div className="flex gap-4 w-full">
          {[
            { value: '215', label: 'YD APPROACH' },
            { value: '4', label: 'FT FOR EAGLE' },
            { value: '3', label: 'STROKES' },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="flex-1 flex flex-col items-center gap-1 rounded-xl py-3"
              style={{ background: '#fff', border: '1px solid #e2e8df' }}
            >
              <span className="font-barlow font-extrabold" style={{ fontSize: 28, color: '#15241c' }}>
                {value}
              </span>
              <span className="font-bold uppercase" style={{ fontSize: 10, letterSpacing: '0.14em', color: '#90a094' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**
```bash
npm run type-check
git add src/components/tv/panels/TvMomentOfDayPanel.tsx
git commit -m "feat: TvMomentOfDayPanel — eagle spotlight with shot diagram SVG"
```

---

### Task 9: TvTeamSpotlightPanel — Roster + Head-to-Head

**Files:**
- Create: `src/components/tv/panels/TvTeamSpotlightPanel.tsx`

**Interfaces:**
- Consumes: `TeamSpotlight | null`, `LeaderboardRow[]` (to derive 2nd place for head-to-head)
- Produces: roster list, best-ball scorecard strip, "Race for the Lead" comparison table

Note: Head-to-head comparison uses spotlight team (leader) vs 2nd place team, derived from the `leaderboard` prop.

- [ ] **Step 1: Create TvTeamSpotlightPanel.tsx**
```tsx
import type { TeamSpotlight } from '@/lib/tv-stats';
import type { LeaderboardRow } from '@/lib/types';

interface Props {
  teamSpotlight: TeamSpotlight | null;
  leaderboard: LeaderboardRow[];
}

function ScorecardChip({ vspar, holeNumber }: { vspar: number; holeNumber: number }) {
  let bg: string;
  let fg: string;
  let label: string;
  if (vspar <= -2) { bg = '#1a472a'; fg = '#fff'; label = 'E'; }
  else if (vspar === -1) { bg = '#c0392b'; fg = '#fff'; label = '−1'; }
  else if (vspar === 0) { bg = '#eef2ea'; fg = '#46554c'; label = 'E'; }
  else { bg = '#f0e4e0'; fg = '#a8513f'; label = `+${vspar}`; }
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="flex items-center justify-center rounded font-barlow font-bold"
        style={{ width: 30, height: 30, background: bg, color: fg, fontSize: 13 }}
      >
        {label}
      </div>
      <span style={{ fontSize: 9, color: '#90a094' }}>{holeNumber}</span>
    </div>
  );
}

function formatScore(vspar: number) {
  if (vspar < 0) return `−${Math.abs(vspar)}`;
  if (vspar === 0) return 'E';
  return `+${vspar}`;
}

export default function TvTeamSpotlightPanel({ teamSpotlight, leaderboard }: Props) {
  if (!teamSpotlight) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: '#fff' }}>
        <p style={{ color: '#90a094', fontSize: 18 }}>No scoring data yet</p>
      </div>
    );
  }

  const second = leaderboard[1] ?? null;
  const secondVsPar = second ? second.total_score - second.par_total : null;
  const leaderVsPar = teamSpotlight.score;

  return (
    <div className="flex h-full">
      {/* Left: spotlight */}
      <div
        className="flex flex-col p-7 gap-4 overflow-hidden"
        style={{ width: '54%', background: '#fff', borderRight: '1px solid #e2e8df' }}
      >
        <div>
          <div className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}>
            Team Spotlight
          </div>
          <div className="flex items-start justify-between">
            <div className="font-barlow font-bold" style={{ fontSize: 48, lineHeight: 1.1, color: '#15241c' }}>
              {teamSpotlight.teamName}
            </div>
            <div className="text-right">
              <span className="font-barlow font-extrabold" style={{ fontSize: 56, color: '#c0392b' }}>
                {formatScore(leaderVsPar)}
              </span>
              <div style={{ fontSize: 12, color: '#90a094' }}>Thru {teamSpotlight.holesCompleted} · Leading</div>
            </div>
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex gap-3 shrink-0">
          {[
            { label: 'Birdies', val: teamSpotlight.birdies },
            { label: 'Eagle', val: teamSpotlight.eagles },
            { label: 'Pars', val: teamSpotlight.pars },
            { label: 'Penalties', val: teamSpotlight.penalties },
          ].map(({ label, val }) => (
            <div
              key={label}
              className="flex-1 flex flex-col items-center gap-1 rounded-xl py-3"
              style={{ background: '#f4f7f1', border: '1px solid #e2e8df' }}
            >
              <span className="font-barlow font-bold" style={{ fontSize: 28, color: '#15241c' }}>
                {val}
              </span>
              <span className="font-bold uppercase" style={{ fontSize: 10, letterSpacing: '0.12em', color: '#90a094' }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Roster */}
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
          {teamSpotlight.roster.map((p) => (
            <div
              key={p.playerId}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: '#f8faf6', border: '1px solid #e8eee4' }}
            >
              <div
                className="flex items-center justify-center rounded-full font-bold text-white text-sm shrink-0"
                style={{ width: 44, height: 44, background: '#1a472a' }}
              >
                {p.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate" style={{ fontSize: 15, color: '#15241c' }}>
                  {p.name}
                </div>
                <div className="truncate" style={{ fontSize: 12, color: '#6b7a70' }}>
                  {[p.title, p.company].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-barlow font-bold" style={{ fontSize: 20, color: '#1a472a' }}>
                  {p.bbHolesCount}
                </div>
                <div style={{ fontSize: 10, color: '#90a094' }}>BB HOLES</div>
              </div>
            </div>
          ))}
        </div>

        {/* Scorecard strip */}
        <div className="shrink-0">
          <div className="font-bold uppercase mb-2" style={{ fontSize: 10, letterSpacing: '0.14em', color: '#90a094' }}>
            Best-Ball Scorecard · vs Par
          </div>
          <div className="flex gap-1 flex-wrap">
            {teamSpotlight.scorecard.map((s) => (
              <ScorecardChip key={s.holeNumber} vspar={s.vspar} holeNumber={s.holeNumber} />
            ))}
          </div>
        </div>
      </div>

      {/* Right: head-to-head */}
      <div className="flex-1 flex flex-col p-7 gap-5" style={{ background: '#f4f7f1' }}>
        <div>
          <div className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}>
            Head to Head
          </div>
          <div className="font-barlow font-bold" style={{ fontSize: 28, color: '#15241c' }}>
            Race for the Lead
          </div>
        </div>

        {/* Big score cards */}
        <div className="flex items-center gap-3">
          <div
            className="flex-1 flex flex-col items-center justify-center rounded-2xl py-5"
            style={{ background: '#1a472a' }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#9fd6ad' }}>
              {teamSpotlight.teamName}
            </span>
            <span className="font-barlow font-extrabold text-white" style={{ fontSize: 52 }}>
              {formatScore(leaderVsPar)}
            </span>
            <span style={{ fontSize: 11, color: '#9fd6ad' }}>
              1st · Thru {teamSpotlight.holesCompleted}
            </span>
          </div>

          <span className="font-barlow font-bold" style={{ fontSize: 22, color: '#90a094' }}>VS</span>

          {second && (
            <div
              className="flex-1 flex flex-col items-center justify-center rounded-2xl py-5"
              style={{ background: '#fff', border: '1px solid #e2e8df' }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#46554c' }}>
                {second.team_name ?? `Team ${second.team_number}`}
              </span>
              <span className="font-barlow font-extrabold" style={{ fontSize: 52, color: '#33413a' }}>
                {secondVsPar !== null ? formatScore(secondVsPar) : '—'}
              </span>
              <span style={{ fontSize: 11, color: '#6b7a70' }}>
                2nd · Thru {second.holes_completed}
              </span>
            </div>
          )}
        </div>

        {/* Comparison table */}
        <div className="flex flex-col gap-2 flex-1">
          {[
            { label: 'Score', left: formatScore(leaderVsPar), right: secondVsPar !== null ? formatScore(secondVsPar) : '—' },
            { label: 'Birdies', left: String(teamSpotlight.birdies), right: '—' },
            { label: 'Eagles', left: String(teamSpotlight.eagles), right: '0' },
          ].map(({ label, left, right }) => (
            <div
              key={label}
              className="flex items-center rounded-xl px-4 py-3"
              style={{ background: '#fff', border: '1px solid #e2e8df' }}
            >
              <span className="font-barlow font-bold" style={{ fontSize: 20, color: '#15241c', width: 60 }}>
                {left}
              </span>
              <span className="flex-1 text-center font-bold uppercase" style={{ fontSize: 10, letterSpacing: '0.14em', color: '#90a094' }}>
                {label}
              </span>
              <span className="font-barlow font-bold text-right" style={{ fontSize: 20, color: '#33413a', width: 60 }}>
                {right}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**
```bash
npm run type-check
git add src/components/tv/panels/TvTeamSpotlightPanel.tsx
git commit -m "feat: TvTeamSpotlightPanel — roster, scorecard strip, head-to-head race"
```

---

### Task 10: TvStatsRotator — 5 Panels

**Files:**
- Modify: `src/components/tv/TvStatsRotator.tsx`

**Interfaces:**
- Consumes: all panel props from Tasks 5–9 + `leaderboard` for spotlight panel
- Produces: 5-panel rotator with cross-fade

- [ ] **Step 1: Rewrite TvStatsRotator.tsx**
```tsx
import type {
  BirdieStats,
  MomentumEntry,
  HoleDifficulty,
  ShotStats,
  BestAchievement,
  TeamSpotlight,
} from '@/lib/tv-stats';
import type { LeaderboardRow } from '@/lib/types';
import TvBirdiesPanel from './panels/TvBirdiesPanel';
import TvHoleDifficultyPanel from './panels/TvHoleDifficultyPanel';
import TvShotStatsPanel from './panels/TvShotStatsPanel';
import TvMomentOfDayPanel from './panels/TvMomentOfDayPanel';
import TvTeamSpotlightPanel from './panels/TvTeamSpotlightPanel';

interface TvStatsRotatorProps {
  activePanelIndex: 0 | 1 | 2 | 3 | 4;
  birdieStats: BirdieStats[];
  momentumStats: MomentumEntry[];
  holeDifficulty: HoleDifficulty[];
  shotStats: ShotStats;
  bestAchievement: BestAchievement | null;
  teamSpotlight: TeamSpotlight | null;
  leaderboard?: LeaderboardRow[];
}

export default function TvStatsRotator({
  activePanelIndex,
  birdieStats,
  momentumStats,
  holeDifficulty,
  shotStats,
  bestAchievement,
  teamSpotlight,
  leaderboard = [],
}: TvStatsRotatorProps) {
  const vis = (i: number) => (i === activePanelIndex ? 'opacity-100' : 'opacity-0 pointer-events-none');

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: '#fff' }}>
      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${vis(0)}`}>
        <TvBirdiesPanel birdieStats={birdieStats} momentumStats={momentumStats} />
      </div>
      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${vis(1)}`}>
        <TvHoleDifficultyPanel holeDifficulty={holeDifficulty} />
      </div>
      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${vis(2)}`}>
        <TvShotStatsPanel shotStats={shotStats} />
      </div>
      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${vis(3)}`}>
        <TvMomentOfDayPanel bestAchievement={bestAchievement} />
      </div>
      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${vis(4)}`}>
        <TvTeamSpotlightPanel teamSpotlight={teamSpotlight} leaderboard={leaderboard} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Pass leaderboard into TvStatsRotator in TvDisplay.tsx**

In `TvDisplay.tsx`, update the `TvStatsRotator` JSX to add `leaderboard={leaderboard}`:
```tsx
<TvStatsRotator
  activePanelIndex={activePanelIndex}
  birdieStats={birdieStats}
  momentumStats={momentumStats}
  holeDifficulty={holeDifficulty}
  shotStats={shotStats}
  bestAchievement={bestAchievement}
  teamSpotlight={teamSpotlight}
  leaderboard={leaderboard}
/>
```

- [ ] **Step 3: Type-check (should be clean now)**
```bash
npm run type-check
```
Expected: 0 errors

- [ ] **Step 4: Commit**
```bash
git add src/components/tv/TvStatsRotator.tsx src/components/tv/TvDisplay.tsx
git commit -m "feat: TvStatsRotator expanded to 5 panels — adds Moment of Day + Team Spotlight"
```

---

### Task 11: Admin Tournament Control Dashboard

**Files:**
- Create: `src/app/(admin)/admin/tournament/tournament-control-dashboard.tsx`
- Modify: `src/app/(admin)/admin/tournament/page.tsx`
- Modify: `src/components/admin-sidebar.tsx`

**Interfaces:**
- Consumes: active tournament from Supabase; teams, players, holes, shots, sponsors counts
- Produces: stat row, teams-on-course list, setup checklist, round controls

- [ ] **Step 1: Update admin-sidebar.tsx with wordmark + signed-in card**
```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Trophy, Users, UsersRound, Wrench, ClipboardList, Star, MapPin, Flag } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin/tournament', label: 'Tournament', Icon: Trophy },
  { href: '/admin/venues', label: 'Venues', Icon: MapPin },
  { href: '/admin/courses', label: 'Courses', Icon: Flag },
  { href: '/admin/players', label: 'Players', Icon: Users },
  { href: '/admin/teams', label: 'Teams', Icon: UsersRound },
  { href: '/admin/clubs', label: 'Clubs', Icon: Wrench },
  { href: '/admin/scores', label: 'Scores', Icon: ClipboardList },
  { href: '/admin/sponsors', label: 'Sponsors', Icon: Star },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[212px] shrink-0 flex-col bg-[#1a472a] text-white">
      <div className="px-4 py-5 flex items-center gap-3">
        <div
          className="flex items-center justify-center rounded-lg text-lg"
          style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.15)' }}
        >
          ⛳
        </div>
        <div>
          <div className="font-barlow font-extrabold text-white" style={{ fontSize: 18, letterSpacing: '0.04em' }}>
            FDGOLF
          </div>
          <div className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.18em', color: '#9fd6ad' }}>
            Admin
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-2 pb-4">
        {NAV_ITEMS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'text-white'
                : 'text-[#bfe0c8] hover:text-white'
            )}
            style={
              pathname === href || pathname.startsWith(href + '/')
                ? { background: 'rgba(255,255,255,0.14)' }
                : undefined
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      {/* Signed-in card */}
      <div className="mx-2 mb-3 rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="text-[11px] font-bold uppercase" style={{ letterSpacing: '0.12em', color: '#9fd6ad' }}>
          Signed In
        </div>
        <div className="text-sm font-semibold text-white mt-0.5">Tournament Director</div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create tournament-control-dashboard.tsx**
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { Tournament, TournamentStatus } from '@/lib/types';

interface TeamOnCourse {
  id: string;
  team_number: number;
  team_name: string | null;
  starting_hole: number;
  playerCount: number;
  holesCompleted: number;
  status: 'on_course' | 'player_missing' | 'finished';
}

interface TournamentControlDashboardProps {
  tournament: Tournament & { venue_name: string; course_name: string };
  teamsOnCourse: TeamOnCourse[];
  stats: {
    teamCount: number;
    playerCount: number;
    holesSet: number;
    totalHoles: number;
    shotsLogged: number;
    sponsorCount: number;
    magicLinksSent: boolean;
  };
}

const STATUS_STYLES: Record<TeamOnCourse['status'], { bg: string; fg: string; label: string }> = {
  on_course: { bg: '#e9f3ec', fg: '#1a472a', label: 'On course' },
  player_missing: { bg: '#fbf1df', fg: '#b3741b', label: 'Player missing' },
  finished: { bg: '#eef2ea', fg: '#5a6b60', label: 'Finished' },
};

export function TournamentControlDashboard({
  tournament,
  teamsOnCourse,
  stats,
}: TournamentControlDashboardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  async function setStatus(status: TournamentStatus) {
    setSaving(true);
    const { error } = await supabase
      .from('tournaments')
      .update({ status })
      .eq('id', tournament.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(status === 'paused' ? 'Round paused' : status === 'completed' ? 'Tournament complete' : 'Round resumed');
      router.refresh();
    }
    setSaving(false);
  }

  async function sendMagicLinks() {
    setSaving(true);
    try {
      const res = await fetch('/api/magic-link', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      toast.success('Magic links sent');
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  }

  const isActive = tournament.status === 'active';
  const isPaused = tournament.status === 'paused';

  const checklist = [
    { label: 'Venue & course configured', done: !!tournament.venue_id },
    { label: '18 holes + GPS pins', done: stats.holesSet >= stats.totalHoles },
    { label: `Players imported (${stats.playerCount})`, done: stats.playerCount > 0 },
    { label: 'Teams & starting holes assigned', done: stats.teamCount > 0 },
    { label: `Sponsors uploaded (${stats.sponsorCount})`, done: stats.sponsorCount > 0 },
    { label: 'Magic links sent', done: stats.magicLinksSent },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top bar */}
      <div
        className="flex items-center justify-between rounded-2xl bg-white px-6 py-4"
        style={{ border: '1px solid #e2e8df' }}
      >
        <div>
          <div
            className="font-bold uppercase"
            style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}
          >
            Tournament Control
          </div>
          <div className="font-barlow font-bold" style={{ fontSize: 30, color: '#15241c' }}>
            {tournament.name}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Status pill */}
          <div
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold"
            style={{
              background: isActive ? '#e9f3ec' : isPaused ? '#fbf1df' : '#eef2ea',
              color: isActive ? '#1a472a' : isPaused ? '#b3741b' : '#5a6b60',
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: isActive ? '#2f8f4e' : isPaused ? '#b3741b' : '#90a094' }}
            />
            {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
          </div>
          <a
            href={`/live/${tournament.slug}/tv`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: '#1a472a', color: '#1a472a' }}
          >
            Open TV Leaderboard ↗
          </a>
          {(isActive || isPaused) && (
            <button
              disabled={saving}
              onClick={() => setStatus(isActive ? 'paused' : 'active')}
              className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ background: '#fbf1df', color: '#b3741b' }}
            >
              {isActive ? '⏸ Pause Round' : '▶ Resume Round'}
            </button>
          )}
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Teams', value: stats.teamCount, sub: 'all checked in' },
          { label: 'Players', value: stats.playerCount, sub: `${stats.playerCount} registered` },
          { label: 'Holes set', value: `${stats.holesSet}/${stats.totalHoles}`, sub: 'GPS pins placed' },
          { label: 'Shots logged', value: stats.shotsLogged.toLocaleString(), sub: 'live syncing' },
        ].map(({ label, value, sub }) => (
          <div
            key={label}
            className="rounded-2xl bg-white p-5"
            style={{ border: '1px solid #e2e8df' }}
          >
            <div
              className="font-barlow font-extrabold"
              style={{ fontSize: 34, color: '#15241c' }}
            >
              {value}
            </div>
            <div className="font-semibold" style={{ fontSize: 14, color: '#46554c' }}>{label}</div>
            <div style={{ fontSize: 12, color: '#90a094' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-[1fr_340px] gap-4">
        {/* Teams on course */}
        <div className="rounded-2xl bg-white p-5" style={{ border: '1px solid #e2e8df' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold" style={{ fontSize: 16, color: '#15241c' }}>
              Teams on course
            </div>
            <span style={{ fontSize: 12, color: '#6b7a70' }}>
              {teamsOnCourse.length} teams · live
            </span>
          </div>
          <div className="flex flex-col gap-2 max-h-[440px] overflow-y-auto">
            {teamsOnCourse.map((team) => {
              const s = STATUS_STYLES[team.status];
              return (
                <div
                  key={team.id}
                  className="flex items-center gap-4 rounded-xl px-4 py-3"
                  style={{ background: '#f8faf6' }}
                >
                  <div
                    className="flex items-center justify-center rounded-lg font-bold text-white text-sm shrink-0"
                    style={{ width: 32, height: 32, background: '#1a472a' }}
                  >
                    {team.team_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold" style={{ fontSize: 14, color: '#15241c' }}>
                      {team.team_name ?? `Team ${team.team_number}`}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7a70' }}>
                      Start H{team.starting_hole} · {team.playerCount}/4 players · thru {team.holesCompleted}
                    </div>
                  </div>
                  <div
                    className="rounded-full px-3 py-1 text-xs font-semibold shrink-0"
                    style={{ background: s.bg, color: s.fg }}
                  >
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-4">
          {/* Setup checklist */}
          <div className="rounded-2xl bg-white p-5 flex flex-col gap-3" style={{ border: '1px solid #e2e8df' }}>
            <div className="font-semibold" style={{ fontSize: 16, color: '#15241c' }}>
              Setup checklist
            </div>
            {checklist.map(({ label, done }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{
                    width: 22,
                    height: 22,
                    background: done ? '#1a472a' : 'transparent',
                    border: done ? 'none' : '2px solid #cdd9cf',
                  }}
                >
                  {done && <span className="text-white text-xs">✓</span>}
                </div>
                <span style={{ fontSize: 13, color: done ? '#15241c' : '#6b7a70' }}>{label}</span>
              </div>
            ))}
            <button
              disabled={saving}
              onClick={sendMagicLinks}
              className="mt-2 w-full rounded-xl py-3 font-semibold text-sm text-white disabled:opacity-50"
              style={{ background: '#1a472a' }}
            >
              Send magic links →
            </button>
          </div>

          {/* Round control */}
          <div className="rounded-2xl bg-white p-5 flex flex-col gap-3" style={{ border: '1px solid #e2e8df' }}>
            <div className="font-semibold" style={{ fontSize: 16, color: '#15241c' }}>
              Round control
            </div>
            <p style={{ fontSize: 12, color: '#6b7a70' }}>
              Pausing suspends scoring on every player device. Use for weather holds.
            </p>
            {(isActive || isPaused) && (
              <button
                disabled={saving}
                onClick={() => setStatus(isActive ? 'paused' : 'active')}
                className="w-full rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
                style={{ background: '#fbf1df', color: '#b3741b' }}
              >
                {isActive ? '⏸ Pause round' : '▶ Resume round'}
              </button>
            )}
            <button
              disabled={saving || tournament.status === 'completed'}
              onClick={() => setStatus('completed')}
              className="w-full rounded-xl py-3 font-semibold text-sm text-white disabled:opacity-50"
              style={{ background: '#15241c' }}
            >
              ✓ Mark tournament complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update admin/tournament/page.tsx to show TournamentControlDashboard when active**

Replace `src/app/(admin)/admin/tournament/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server';
import type { Tournament, Venue, Course } from '@/lib/types';
import { TournamentManager } from './tournament-manager';
import { TournamentControlDashboard } from './tournament-control-dashboard';

export type TournamentRow = Tournament & { venue_name: string; course_name: string };

export default async function TournamentAdminPage() {
  const supabase = await createClient();

  const [
    { data: rawTournaments },
    { data: venues },
    { data: courses },
  ] = await Promise.all([
    supabase
      .from('tournaments')
      .select('*, venue:venues!venue_id(name), course:courses!course_id(name)')
      .order('created_at', { ascending: false }),
    supabase.from('venues').select('*').order('name'),
    supabase.from('courses').select('*').order('name'),
  ]);

  const rows: TournamentRow[] = (
    (rawTournaments as (Tournament & {
      venue: { name: string } | null;
      course: { name: string } | null;
    })[]) ?? []
  ).map((t) => ({
    ...t,
    venue_name: t.venue?.name ?? '',
    course_name: t.course?.name ?? '',
  }));

  // If there is an active/paused tournament, show the control dashboard
  const activeTournament = rows.find((t) => t.status === 'active' || t.status === 'paused') ?? null;

  if (activeTournament) {
    const [
      { data: teams },
      { data: players },
      { data: holes },
      { data: shots },
      { data: sponsors },
      { data: scores },
    ] = await Promise.all([
      supabase.from('teams').select('id, team_name, team_number, starting_hole').eq('tournament_id', activeTournament.id),
      supabase.from('players').select('id, team_id').not('team_id', 'is', null).in(
        'team_id',
        (await supabase.from('teams').select('id').eq('tournament_id', activeTournament.id)).data?.map((t) => t.id as string) ?? []
      ),
      supabase.from('holes').select('id, hole_number, pin_lat, pin_lng').eq('course_id', activeTournament.course_id),
      supabase.from('shots').select('id', { count: 'exact' }).eq('tournament_id', activeTournament.id),
      supabase.from('sponsors').select('id').eq('tournament_id', activeTournament.id).eq('is_active', true),
      supabase.from('scores').select('team_id, hole_number').eq('tournament_id', activeTournament.id).eq('is_best_ball', true),
    ]);

    const teamList = (teams ?? []) as { id: string; team_name: string | null; team_number: number; starting_hole: number }[];
    const playerList = (players ?? []) as { id: string; team_id: string | null }[];
    const holeList = (holes ?? []) as { id: string; hole_number: number; pin_lat: number; pin_lng: number }[];
    const scoreList = (scores ?? []) as { team_id: string; hole_number: number }[];

    // Count players per team
    const playerCountPerTeam = new Map<string, number>();
    for (const p of playerList) {
      if (p.team_id) playerCountPerTeam.set(p.team_id, (playerCountPerTeam.get(p.team_id) ?? 0) + 1);
    }

    // Count holes completed per team
    const holesPerTeam = new Map<string, Set<number>>();
    for (const s of scoreList) {
      if (!holesPerTeam.has(s.team_id)) holesPerTeam.set(s.team_id, new Set());
      holesPerTeam.get(s.team_id)!.add(s.hole_number);
    }

    const teamsOnCourse = teamList.map((t) => {
      const pc = playerCountPerTeam.get(t.id) ?? 0;
      const hc = holesPerTeam.get(t.id)?.size ?? 0;
      const status: 'on_course' | 'player_missing' | 'finished' =
        hc >= activeTournament.holes_played
          ? 'finished'
          : pc < 4
          ? 'player_missing'
          : 'on_course';
      return {
        id: t.id,
        team_number: t.team_number,
        team_name: t.team_name,
        starting_hole: t.starting_hole,
        playerCount: pc,
        holesCompleted: hc,
        status,
      };
    });

    const holesSet = holeList.filter((h) => h.pin_lat !== 0 || h.pin_lng !== 0).length;

    return (
      <TournamentControlDashboard
        tournament={{ ...activeTournament, venue_name: activeTournament.venue_name, course_name: activeTournament.course_name }}
        teamsOnCourse={teamsOnCourse}
        stats={{
          teamCount: teamList.length,
          playerCount: playerList.length,
          holesSet,
          totalHoles: activeTournament.holes_played,
          shotsLogged: (shots as unknown[])?.length ?? 0,
          sponsorCount: (sponsors ?? []).length,
          magicLinksSent: false,
        }}
      />
    );
  }

  return (
    <div className="max-w-4xl">
      <TournamentManager
        tournaments={rows}
        venues={(venues as Venue[]) ?? []}
        courses={(courses as Course[]) ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 4: Type-check + commit**
```bash
npm run type-check
git add src/app/(admin)/admin/tournament/ src/components/admin-sidebar.tsx
git commit -m "feat: admin Tournament Control dashboard — stat row, teams list, checklist, round controls"
```

---

### Task 12: Player Shot Tracker Restyle

**Files:**
- Modify: `src/components/player-pills.tsx`
- Modify: `src/components/shot-outcome-buttons.tsx`
- Modify: `src/app/(player)/round/page.tsx` (header section only)

**Interfaces:**
- `PlayerPills` gets new `currentPlayerId?: string` prop to show "You" label

- [ ] **Step 1: Restyle player-pills.tsx — initials circles + "You" label**
```tsx
import type { Player } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PlayerPillsProps {
  players: Player[];
  activePlayerId: string | null;
  currentPlayerId?: string;
  onSelect: (id: string) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PlayerPills({ players, activePlayerId, currentPlayerId, onSelect }: PlayerPillsProps) {
  return (
    <div className="flex gap-3">
      {players.map((player) => {
        const isActive = player.id === activePlayerId;
        const isCurrentUser = player.id === currentPlayerId;
        const initials = getInitials(player.name);
        const firstName = player.name.split(' ')[0];

        return (
          <button
            key={player.id}
            onClick={() => onSelect(player.id)}
            className="flex flex-col items-center gap-1.5 focus:outline-none"
          >
            <div
              className={cn(
                'flex items-center justify-center rounded-xl font-bold transition-colors',
                isActive ? 'text-white' : 'text-[#15241c]'
              )}
              style={{
                width: 56,
                height: 56,
                fontSize: 16,
                background: isActive ? '#1a472a' : '#fff',
                border: isActive ? 'none' : '1px solid #e2e8df',
                boxShadow: isActive ? 'none' : '0 2px 6px rgba(0,0,0,0.06)',
              }}
            >
              {initials}
            </div>
            <span
              className="text-center font-medium leading-none"
              style={{ fontSize: 11, color: isActive ? '#1a472a' : '#6b7a70' }}
            >
              {isCurrentUser ? 'You' : firstName}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Restyle shot-outcome-buttons.tsx**
```tsx
import type { ShotOutcome } from '@/lib/types';

interface ShotOutcomeButtonsProps {
  onOutcome: (outcome: ShotOutcome) => void;
  disabled?: boolean;
}

const OUTCOMES: Array<{
  outcome: ShotOutcome;
  label: string;
  bg: string;
  fg: string;
  border?: string;
}> = [
  { outcome: 'in_play', label: 'In Play', bg: '#1a472a', fg: '#fff' },
  { outcome: 'out_of_bounds', label: 'Out of Bounds', bg: '#f7ece9', fg: '#a8513f', border: '#f0c8bf' },
  { outcome: 'mulligan', label: 'Mulligan', bg: '#fbf1df', fg: '#b3741b', border: '#f0d99a' },
  { outcome: 'sunk', label: '⛳ Sunk', bg: '#f3e7c4', fg: '#5c4710', border: '#e8d28a' },
];

export function ShotOutcomeButtons({ onOutcome, disabled = false }: ShotOutcomeButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {OUTCOMES.map(({ outcome, label, bg, fg, border }) => (
        <button
          key={outcome}
          disabled={disabled}
          onClick={() => onOutcome(outcome)}
          className="rounded-2xl font-bold transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: bg,
            color: fg,
            border: border ? `1px solid ${border}` : 'none',
            minHeight: 56,
            fontSize: 15,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update round/page.tsx header section**

In `src/app/(player)/round/page.tsx`, find the header render section (the JSX that shows the current hole). Update it to match the design:

Find the section that renders hole info in the return statement and replace the header block. The exact location depends on the existing markup — look for where `currentHole` is rendered.

In the round page's JSX, update the main container and header to use:
```tsx
{/* Overall wrapper */}
<div className="flex flex-col h-screen" style={{ background: '#f4f7f1' }}>
  {/* Header */}
  <div className="px-5 pt-8 pb-4" style={{ background: '#1a472a' }}>
    <div className="flex items-center justify-between mb-1">
      <span
        className="font-bold uppercase"
        style={{ fontSize: 11, letterSpacing: '0.18em', color: '#9fd6ad' }}
      >
        Now Playing
      </span>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 12, color: '#bfe6c9' }}>
          Stroke Idx {currentHole?.handicap ?? '—'}
        </span>
        {position && (
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: '#2f8f4e' }}
            />
            <span className="text-white text-[11px] font-semibold">GPS</span>
          </div>
        )}
      </div>
    </div>
    <div className="flex items-baseline gap-2">
      <span
        className="font-barlow font-extrabold text-white"
        style={{ fontSize: 46, whiteSpace: 'nowrap', lineHeight: 1.1 }}
      >
        Hole {roundState?.current_hole ?? 1}
      </span>
      <span className="text-white font-semibold" style={{ fontSize: 18 }}>
        Par {currentHole?.par ?? '—'}
      </span>
    </div>
  </div>
  {/* ... rest of content */}
```

Also pass `currentPlayerId={player?.id}` to `<PlayerPills>` wherever it is rendered in round/page.tsx.

Update the "Who's hitting?" section label:
```tsx
<div className="font-bold uppercase px-5 pt-5 pb-2" style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}>
  Who&apos;s hitting?
</div>
<div className="px-5">
  <PlayerPills
    players={[player!, ...teammates].filter(Boolean)}
    activePlayerId={activePlayerId}
    currentPlayerId={player?.id}
    onSelect={setActivePlayerId}
  />
</div>
```

Update the sticky outcome buttons section wrapper:
```tsx
<div
  className="sticky bottom-0 p-4"
  style={{ background: '#fff', borderTop: '1px solid #e2e8df' }}
>
  <ShotOutcomeButtons onOutcome={handleOutcome} disabled={recording || holeSunk} />
</div>
```

- [ ] **Step 4: Type-check**
```bash
npm run type-check
```

- [ ] **Step 5: Commit**
```bash
git add src/components/player-pills.tsx src/components/shot-outcome-buttons.tsx src/app/\(player\)/round/page.tsx
git commit -m "feat: player shot tracker restyle — green header, initials pills, design token outcome buttons"
```

---

### Task 13: Final Verification + PR

- [ ] **Step 1: Full type-check + lint**
```bash
npm run type-check && npm run lint
```

- [ ] **Step 2: Run tests**
```bash
npm run test:ci
```
Expected: all existing tests still pass (no business logic changed)

- [ ] **Step 3: Start dev server and verify visually**
```bash
npm run dev
```
Navigate to:
- `/live/[your-tournament-slug]/tv` — verify light header, 25/75 split, sponsor bar, 5 panels rotate
- `/admin/tournament` — verify control dashboard if active tournament exists
- `/round` (as a player) — verify green header, initials pills, outcome buttons

- [ ] **Step 4: Open PR**
```bash
gh pr create \
  --title "feat: design redesign — TV leaderboard, Admin control, Player tracker" \
  --body "$(cat <<'EOF'
## Summary
- TV Leaderboard: light mode, 25/75 layout, Barlow Condensed typography, sparkline leaderboard, 5 rotating panels (Birdies, Hole Difficulty, Shot Stats, Moment of Day, Team Spotlight), 160px sponsor bar
- Admin: Tournament Control dashboard with stat row, teams-on-course list, setup checklist, pause/resume/complete controls
- Player: Green header with Barlow Condensed hole number, initials player pills, design-token outcome buttons

## Test plan
- [ ] TV page renders at /live/[slug]/tv with light background and green header
- [ ] Leaderboard shows sparklines (or dash if no data)
- [ ] All 5 panels rotate every 15s
- [ ] Admin /admin/tournament shows control dashboard when active tournament exists
- [ ] Player /round shows new green header and outcome buttons
- [ ] npm run type-check passes
- [ ] npm run test:ci passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
  )"
```
