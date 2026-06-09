import { cn } from '@/lib/utils';
import { formatVsPar } from '@/lib/scoring';

export interface LeaderboardRow {
  team_id: string;
  team_number: number;
  team_name: string | null;
  total_score: number;
  holes_completed: number;
  par_total: number;
}

interface LeaderboardTableProps {
  rows: LeaderboardRow[];
}

const RANK_STYLES: Record<number, string> = {
  1: 'border-l-4 border-yellow-400',
  2: 'border-l-4 border-gray-400',
  3: 'border-l-4 border-amber-600',
};

export function LeaderboardTable({ rows }: LeaderboardTableProps) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        No scores recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <th className="px-3 py-2 text-left">Rank</th>
            <th className="px-3 py-2 text-left">Team</th>
            <th className="px-3 py-2 text-right">Score</th>
            <th className="px-3 py-2 text-right">Holes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const rank = idx + 1;
            const vsParVal = row.total_score - row.par_total;
            const vsParLabel = formatVsPar(vsParVal);
            return (
              <tr
                key={row.team_id}
                className={cn(
                  'border-b transition-colors hover:bg-gray-50',
                  RANK_STYLES[rank]
                )}
              >
                <td className="px-3 py-3 font-semibold text-gray-700">
                  {rank}
                </td>
                <td className="px-3 py-3">
                  <div className="font-medium text-gray-900">
                    {row.team_name ?? `Team ${row.team_number}`}
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <span
                    className={cn(
                      'font-bold',
                      vsParVal < 0
                        ? 'text-green-600'
                        : vsParVal > 0
                        ? 'text-red-600'
                        : 'text-gray-700'
                    )}
                  >
                    {vsParLabel}
                  </span>
                </td>
                <td className="px-3 py-3 text-right text-gray-500">
                  {row.holes_completed}/18
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
