import type { LeaderboardRow } from '@/lib/types';
import { formatVsPar } from '@/lib/scoring';

interface TvLeaderboardProps {
  leaderboard: LeaderboardRow[];
}

const RANK_BADGE: Record<number, { bg: string; text: string }> = {
  1: { bg: 'bg-yellow-400', text: 'text-slate-900' },
  2: { bg: 'bg-slate-300', text: 'text-slate-900' },
  3: { bg: 'bg-amber-600', text: 'text-white' },
};

export default function TvLeaderboard({ leaderboard }: TvLeaderboardProps) {
  const displayRows = leaderboard.slice(0, 16);
  const moreCount = Math.max(0, leaderboard.length - 16);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Section label */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700/60">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
        <span className="text-slate-400 uppercase tracking-widest text-xs font-semibold">
          Leaderboard
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[2.5rem_1fr_5rem_4rem] px-6 py-2 border-b border-slate-700/40">
        <span className="text-slate-500 text-[10px] uppercase font-semibold">#</span>
        <span className="text-slate-500 text-[10px] uppercase font-semibold">Team</span>
        <span className="text-slate-500 text-[10px] uppercase font-semibold text-right">Score</span>
        <span className="text-slate-500 text-[10px] uppercase font-semibold text-right">Thru</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        {displayRows.map((row, idx) => {
          const rank = idx + 1;
          const vsParVal = row.total_score - row.par_total;
          const teamName =
            row.team_name && row.team_name.length > 20
              ? row.team_name.slice(0, 20) + '…'
              : (row.team_name ?? `Team ${row.team_number}`);

          const badge = RANK_BADGE[rank];
          const isLeader = rank === 1;

          const scoreColor =
            vsParVal < 0 ? 'text-red-400' : vsParVal > 0 ? 'text-slate-400' : 'text-white';

          return (
            <div
              key={`${row.team_id}-${idx}`}
              className={`grid grid-cols-[2.5rem_1fr_5rem_4rem] items-center px-6 transition-colors
                ${isLeader ? 'bg-yellow-400/5 border-l-2 border-yellow-400' : 'border-l-2 border-transparent'}
                ${isLeader ? 'py-4' : 'py-3'}
              `}
            >
              {/* Rank */}
              {badge ? (
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${badge.bg} ${badge.text}`}
                >
                  {rank}
                </span>
              ) : (
                <span className="text-slate-500 text-sm font-medium">{rank}</span>
              )}

              {/* Team name */}
              <span
                className={`font-medium truncate ${isLeader ? 'text-white text-lg' : 'text-slate-200 text-base'}`}
              >
                {teamName}
              </span>

              {/* Score */}
              <span
                className={`text-right font-bold ${isLeader ? 'text-xl' : 'text-base'} ${scoreColor}`}
              >
                {formatVsPar(vsParVal)}
              </span>

              {/* Thru */}
              <span className="text-right text-sm text-slate-500">
                {row.holes_completed > 0 ? row.holes_completed : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {moreCount > 0 && (
        <div className="px-6 py-3 text-slate-500 text-xs text-center border-t border-slate-800/60">
          + {moreCount} more {moreCount === 1 ? 'team' : 'teams'}
        </div>
      )}
    </div>
  );
}
