'use client';

import { useEffect, useState } from 'react';
import type { Tournament } from '@/lib/types';
import type { LeaderboardRow } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import {
  fetchBirdieStats,
  fetchMomentumStats,
  fetchHoleDifficulty,
  fetchShotStats,
  fetchBestAchievement,
  type BirdieStats,
  type MomentumEntry,
  type HoleDifficulty,
  type ShotStats,
  type BestAchievement,
} from '@/lib/tv-stats';
import TvLeaderboard from './TvLeaderboard';
import TvStatsRotator from './TvStatsRotator';

type TournamentWithVenue = Tournament & {
  venue?: { name: string; city: string; province_state: string } | null;
};

interface TvDisplayProps {
  tournament: TournamentWithVenue;
  initialLeaderboard: LeaderboardRow[];
}

const DEFAULT_SHOT_STATS: ShotStats = {
  longestDriveMeters: null,
  longestDriveTeam: null,
  clubOfDay: null,
  clubOfDayPct: null,
  cleanestTeams: [],
};

const PANEL_LABELS = ['Birdies & Momentum', 'Hole Difficulty', 'Shot Stats'];

export function TvDisplay({ tournament, initialLeaderboard }: TvDisplayProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>(initialLeaderboard);
  const [birdieStats, setBirdieStats] = useState<BirdieStats[]>([]);
  const [momentumStats, setMomentumStats] = useState<MomentumEntry[]>([]);
  const [holeDifficulty, setHoleDifficulty] = useState<HoleDifficulty[]>([]);
  const [shotStats, setShotStats] = useState<ShotStats>(DEFAULT_SHOT_STATS);
  const [bestAchievement, setBestAchievement] = useState<BestAchievement | null>(null);
  const [activePanelIndex, setActivePanelIndex] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    const supabase = createClient();

    async function refreshAll() {
      const [lbResult, birdie, momentum, difficulty, shots, best] = await Promise.all([
        supabase.rpc('get_leaderboard', { p_tournament_id: tournament.id }),
        fetchBirdieStats(supabase, tournament.id),
        fetchMomentumStats(supabase, tournament.id),
        fetchHoleDifficulty(supabase, tournament.id),
        fetchShotStats(supabase, tournament.id),
        fetchBestAchievement(supabase, tournament.id),
      ]);

      if (lbResult.data) setLeaderboard(lbResult.data as LeaderboardRow[]);
      setBirdieStats(birdie);
      setMomentumStats(momentum);
      setHoleDifficulty(difficulty);
      setShotStats(shots);
      setBestAchievement(best);
    }

    void refreshAll();
    const dataInterval = setInterval(() => void refreshAll(), 30_000);
    return () => clearInterval(dataInterval);
  }, [tournament.id]);

  useEffect(() => {
    const rotationInterval = setInterval(() => {
      setActivePanelIndex((p) => ((p + 1) % 3) as 0 | 1 | 2);
    }, 15_000);
    return () => clearInterval(rotationInterval);
  }, []);

  const venueLine = [tournament.venue?.name, tournament.venue?.city].filter(Boolean).join(', ');

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1424] text-white overflow-hidden">
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="shrink-0 h-[72px] flex items-center justify-between px-8 bg-slate-900 border-b border-slate-700/60">
        <div className="flex flex-col gap-0.5">
          <span className="text-xl font-bold tracking-tight">{tournament.name}</span>
          <span className="text-sm text-slate-400">
            {venueLine ? `${venueLine} · ` : ''}
            <span className="capitalize">{tournament.format.replace(/_/g, ' ')}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span>Live</span>
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Leaderboard — 38% */}
        <div className="w-[38%] h-full border-r border-slate-700/50">
          <TvLeaderboard leaderboard={leaderboard} />
        </div>

        {/* Stats rotator — 62% */}
        <div className="flex-1 h-full">
          <TvStatsRotator
            activePanelIndex={activePanelIndex}
            birdieStats={birdieStats}
            momentumStats={momentumStats}
            holeDifficulty={holeDifficulty}
            shotStats={shotStats}
            bestAchievement={bestAchievement}
          />
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="shrink-0 h-12 flex items-center justify-between px-8 bg-slate-900 border-t border-slate-700/60">
        <span className="text-slate-500 text-xs truncate">
          {tournament.name}
          {tournament.venue?.name ? ` · ${tournament.venue.name}` : ''}
          {tournament.venue?.city ? `, ${tournament.venue.city}` : ''}
          {` · ${tournament.date}`}
        </span>

        {/* Panel indicator + label */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-slate-500 text-xs">{PANEL_LABELS[activePanelIndex]}</span>
          <div className="flex items-center gap-1.5">
            {([0, 1, 2] as const).map((i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  activePanelIndex === i ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-slate-600'
                }`}
              />
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
