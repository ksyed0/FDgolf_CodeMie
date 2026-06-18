'use client';

import { useEffect, useState } from 'react';
import type { Tournament } from '@/lib/types';
import type { LeaderboardRow } from '@/components/leaderboard-table';
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

export function TvDisplay({ tournament, initialLeaderboard }: TvDisplayProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>(initialLeaderboard);
  const [birdieStats, setBirdieStats] = useState<BirdieStats[]>([]);
  const [momentumStats, setMomentumStats] = useState<MomentumEntry[]>([]);
  const [holeDifficulty, setHoleDifficulty] = useState<HoleDifficulty[]>([]);
  const [shotStats, setShotStats] = useState<ShotStats>(DEFAULT_SHOT_STATS);
  const [bestAchievement, setBestAchievement] = useState<BestAchievement | null>(null);
  const [activePanelIndex, setActivePanelIndex] = useState<0 | 1 | 2>(0);

  // Data refresh every 30 seconds
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

      if (lbResult.data) {
        setLeaderboard(lbResult.data as LeaderboardRow[]);
      }
      setBirdieStats(birdie);
      setMomentumStats(momentum);
      setHoleDifficulty(difficulty);
      setShotStats(shots);
      setBestAchievement(best);
    }

    void refreshAll();

    const dataInterval = setInterval(() => {
      void refreshAll();
    }, 30_000);

    return () => clearInterval(dataInterval);
  }, [tournament.id]);

  // Panel rotation every 15 seconds
  useEffect(() => {
    const rotationInterval = setInterval(() => {
      setActivePanelIndex((p) => ((p + 1) % 3) as 0 | 1 | 2);
    }, 15_000);

    return () => clearInterval(rotationInterval);
  }, []);

  const venueName = tournament.venue?.name ?? null;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0f172a] text-white overflow-hidden">
      {/* Header */}
      <div className="h-20 flex items-center justify-between px-8 bg-slate-900 border-b border-slate-800">
        <div className="flex flex-col">
          <span className="text-xl font-bold">{tournament.name}</span>
          <span className="text-sm text-slate-400">
            {venueName ? `${venueName} · ` : ''}
            {tournament.format}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-green-400">
          <span className="animate-pulse">●</span>
          <span>LIVE</span>
        </div>
      </div>

      {/* Main row */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[45%] h-full">
          <TvLeaderboard leaderboard={leaderboard} />
        </div>
        <div className="w-[55%] h-full">
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

      {/* Footer */}
      <div className="h-16 flex items-center justify-between px-8 bg-slate-900 border-t border-slate-800">
        <span className="text-slate-400 text-sm">
          CIBC Capital Markets · Granite Ridge · June 22 2026
        </span>
        <div className="flex items-center gap-2">
          {([0, 1, 2] as const).map((i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-[400ms] ${
                activePanelIndex === i ? 'bg-white' : 'bg-slate-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
