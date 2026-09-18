'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Tournament, TournamentStatus, Sponsor } from '@/lib/types';
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
import { TvRestartOverlay } from './TvRestartOverlay';

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
  const [tournamentStatus, setTournamentStatus] = useState<TournamentStatus>(tournament.status);
  const [isStopping, setIsStopping] = useState(false);
  const isDemoMode = tournament.is_demo;

  async function handleStop() {
    setIsStopping(true);
    await fetch('/api/demo/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId: tournament.id }),
    }).catch(() => {});
    setIsStopping(false);
  }

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

  useEffect(() => {
    if (!isDemoMode) return;
    const supabase = createClient();
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('status')
        .eq('id', tournament.id)
        .single();
      if (data?.status) setTournamentStatus(data.status as TournamentStatus);
    }, 10_000);
    return () => clearInterval(interval);
  }, [tournament.id, isDemoMode]);

  const DESIGN_W = 980;
  const DESIGN_H = 870;
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      setScale(Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const venueLine = [tournament.venue?.name, tournament.venue?.city].filter(Boolean).join(', ');
  const formatLabel = tournament.format.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#f4f7f1',
        position: 'relative',
      }}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          background: '#f4f7f1',
        }}
      >
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
              <span
                className="font-barlow font-extrabold text-white leading-none"
                style={{ fontSize: 28, letterSpacing: '0.03em' }}
              >
                FDGOLF-CM
              </span>
              <span
                className="text-[11px] font-bold uppercase tracking-[0.22em]"
                style={{ color: '#9fd6ad' }}
              >
                Live Scoring
              </span>
            </div>
          </div>

          {/* Center: tournament name — absolutely centred */}
          <div
            className="absolute flex flex-col items-center text-center"
            style={{ left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
          >
            <span
              className="font-barlow font-bold text-white leading-tight"
              style={{ fontSize: 44 }}
            >
              {tournament.name}
            </span>
            <span className="text-[18px] font-medium" style={{ color: '#bfe6c9' }}>
              {[venueLine, formatLabel, tournament.date].filter(Boolean).join(' · ')}
            </span>
          </div>

          {/* Right: LIVE pill + demo stop button */}
          <div className="ml-auto flex items-center gap-3 z-10">
            {isDemoMode && tournamentStatus === 'active' && (
              <button
                onClick={handleStop}
                disabled={isStopping}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-opacity disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  fontSize: 12,
                  letterSpacing: '0.08em',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <span style={{ fontSize: 10 }}>⏹</span>
                {isStopping ? 'STOPPING…' : 'STOP DEMO'}
              </button>
            )}
            {tournamentStatus === 'paused' && isDemoMode && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  fontSize: 12,
                  letterSpacing: '0.08em',
                  color: '#fbbf24',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <span style={{ fontSize: 10 }}>⏸</span>
                DEMO PAUSED
              </div>
            )}
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full font-bold"
              style={{
                background: '#c0392b',
                fontSize: 14,
                letterSpacing: '0.12em',
                color: '#fff',
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"
                style={{ animationDuration: '1.5s' }}
              />
              LIVE
            </div>
          </div>
        </header>

        {/* ── Body: 34% leaderboard | 66% panel ───────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          {/*
            TvLeaderboard's row grid (rank 20px + Team 1fr + Trend 80px + Thru 28px
            + Score 46px, gap 6px×4, plus the row's own 16px×2 padding and 4px×2
            margin) needs roughly 320-330px of content width to show the Team
            column's `1fr` track at a usable size. At the previous 25% (≈245px of
            the 980px design width), the Team track resolved to ~4px and the
            `truncate` span effectively vanished — team names rendered invisible.
            34% (≈333px) is the minimum that keeps every column legible without
            reflowing the rotator panels on the right. See BUG-0008 in docs/BUGS.md.
          */}
          <div className="h-full" style={{ width: '34%', borderRight: '1px solid #e2e8df' }}>
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
              leaderboard={leaderboard}
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
              Proudly
              <br />
              Sponsored By
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
                  <span
                    className="font-barlow font-extrabold leading-none"
                    style={{ fontSize: 22, color: '#15241c' }}
                  >
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

      {isDemoMode && tournamentStatus === 'completed' && (
        <TvRestartOverlay tournamentId={tournament.id} />
      )}
    </div>
  );
}
