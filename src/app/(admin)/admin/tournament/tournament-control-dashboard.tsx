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
    const { error } = await supabase.from('tournaments').update({ status }).eq('id', tournament.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        status === 'paused'
          ? 'Round paused'
          : status === 'completed'
            ? 'Tournament complete'
            : 'Round resumed'
      );
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
          {
            label: 'Holes set',
            value: `${stats.holesSet}/${stats.totalHoles}`,
            sub: 'GPS pins placed',
          },
          { label: 'Shots logged', value: stats.shotsLogged.toLocaleString(), sub: 'live syncing' },
        ].map(({ label, value, sub }) => (
          <div
            key={label}
            className="rounded-2xl bg-white p-5"
            style={{ border: '1px solid #e2e8df' }}
          >
            <div className="font-barlow font-extrabold" style={{ fontSize: 34, color: '#15241c' }}>
              {value}
            </div>
            <div className="font-semibold" style={{ fontSize: 14, color: '#46554c' }}>
              {label}
            </div>
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
                      Start H{team.starting_hole} · {team.playerCount}/4 players · thru{' '}
                      {team.holesCompleted}
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
          <div
            className="rounded-2xl bg-white p-5 flex flex-col gap-3"
            style={{ border: '1px solid #e2e8df' }}
          >
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
          <div
            className="rounded-2xl bg-white p-5 flex flex-col gap-3"
            style={{ border: '1px solid #e2e8df' }}
          >
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
