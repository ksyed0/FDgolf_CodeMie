import type { LeaderboardRow } from '@/lib/types';
import { formatVsPar } from '@/lib/scoring';

interface TvLeaderboardProps {
  leaderboard: LeaderboardRow[];
}

export default function TvLeaderboard({ leaderboard }: TvLeaderboardProps) {
  const displayRows = leaderboard.slice(0, 18);
  const moreCount = Math.max(0, leaderboard.length - 18);

  return (
    <div className="h-full flex flex-col bg-slate-900/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
        <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
        <h2 className="text-slate-400 uppercase tracking-widest text-sm font-semibold">
          Leaderboard
        </h2>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-4 gap-2 px-4 py-2 border-b border-slate-700">
        <div className="text-slate-500 text-xs uppercase font-semibold">#</div>
        <div className="text-slate-500 text-xs uppercase font-semibold">Team</div>
        <div className="text-slate-500 text-xs uppercase font-semibold text-right">Scr</div>
        <div className="text-slate-500 text-xs uppercase font-semibold text-right">Thru</div>
      </div>

      {/* Rows Container */}
      <div className="flex-1 overflow-y-auto">
        {displayRows.map((row, idx) => {
          const rank = idx + 1;
          const vsParVal = row.total_score - row.par_total;
          const teamName =
            row.team_name && row.team_name.length > 22
              ? row.team_name.slice(0, 22) + '…'
              : row.team_name || `Team ${row.team_number}`;

          const isRank1 = rank === 1;
          const isEvenRow = idx % 2 === 1;

          // Score color logic
          let scoreColorClass = 'text-slate-400';
          if (vsParVal < 0) scoreColorClass = 'text-red-400';
          else if (vsParVal === 0) scoreColorClass = 'text-white';

          return (
            <div
              key={`${row.team_id}-${idx}`}
              className={`grid grid-cols-4 gap-2 px-4 py-3 border-b border-slate-800 ${
                isRank1 ? 'border-l-4 border-l-green-600 pl-2 bg-slate-800/50' : ''
              } ${isEvenRow && !isRank1 ? 'bg-slate-800/30' : ''}`}
            >
              <div className="text-slate-300 text-sm font-semibold">{rank}</div>
              <div className={`${isRank1 ? 'text-lg' : 'text-base'} text-slate-200 truncate`}>
                {teamName}
              </div>
              <div className={`text-right text-sm font-semibold ${scoreColorClass}`}>
                {formatVsPar(vsParVal)}
              </div>
              <div className="text-right text-sm text-slate-400">{row.holes_completed}</div>
            </div>
          );
        })}

        {/* Footer: "... and N more teams" */}
        {moreCount > 0 && (
          <div className="px-4 py-3 text-slate-500 text-sm text-center border-t border-slate-800">
            … and {moreCount} more {moreCount === 1 ? 'team' : 'teams'}
          </div>
        )}
      </div>
    </div>
  );
}
