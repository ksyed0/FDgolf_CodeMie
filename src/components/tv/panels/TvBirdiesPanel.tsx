import type { BirdieStats, MomentumEntry } from '@/lib/tv-stats';

interface TvBirdiesPanelProps {
  birdieStats: BirdieStats[];
  momentumStats: MomentumEntry[];
}

const VSPAR_COLOR: Record<string, string> = {
  negative: 'bg-red-500',
  zero: 'bg-slate-600',
  positive: 'bg-slate-400/40',
};

function vsparBarClass(vspar: number): string {
  if (vspar < 0) return VSPAR_COLOR.negative;
  if (vspar > 0) return VSPAR_COLOR.positive;
  return VSPAR_COLOR.zero;
}

function vsparLabel(vspar: number): string {
  if (vspar <= -2) return '🦅';
  if (vspar === -1) return '🐦';
  if (vspar === 0) return '⬜';
  return '+';
}

export default function TvBirdiesPanel({ birdieStats, momentumStats }: TvBirdiesPanelProps) {
  const allZero = birdieStats.length === 0 || birdieStats.every((t) => t.birdies === 0);

  const topBirdie = birdieStats.slice(0, 5);
  const topMomentum = momentumStats.slice(0, 5);

  return (
    <div className="flex h-full gap-px">
      {/* Left: Birdie leaders */}
      <div className="flex-1 flex flex-col p-8 gap-6">
        <p className="text-slate-400 uppercase tracking-widest text-xs font-semibold">
          Birdie Leaders
        </p>

        {allZero ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-500 text-xl text-center">No birdies yet — keep swinging!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 flex-1">
            {topBirdie.map((team, idx) => {
              const maxBirdies = topBirdie[0]?.birdies ?? 1;
              const pct = Math.round((team.birdies / maxBirdies) * 100);
              const isTop = idx === 0;
              return (
                <div key={team.teamId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-medium ${isTop ? 'text-white text-lg' : 'text-slate-300 text-base'}`}
                    >
                      {team.teamName}
                    </span>
                    <div className="flex items-center gap-2">
                      {team.eagles > 0 && (
                        <span className="text-amber-400 text-sm">🦅 ×{team.eagles}</span>
                      )}
                      <span
                        className={`font-bold tabular-nums ${isTop ? 'text-3xl text-red-400' : 'text-xl text-slate-200'}`}
                      >
                        {team.birdies}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isTop ? 'bg-red-400' : 'bg-slate-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px bg-slate-700/50 my-8" />

      {/* Right: Last 3 holes momentum */}
      <div className="flex-1 flex flex-col p-8 gap-6">
        <p className="text-slate-400 uppercase tracking-widest text-xs font-semibold">
          Last 3 Holes
        </p>

        {topMomentum.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-500 text-lg text-center">Scores loading…</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 flex-1">
            {topMomentum.map((team) => {
              const sorted = [...team.lastThreeHoles].sort((a, b) => a.holeNumber - b.holeNumber);
              const sum = sorted.reduce((acc, h) => acc + h.vspar, 0);
              const sumColor = sum < 0 ? 'text-red-400' : sum > 0 ? 'text-slate-400' : 'text-white';

              return (
                <div key={team.teamId} className="flex items-center gap-4">
                  <span className="flex-1 text-slate-200 text-base font-medium truncate">
                    {team.teamName}
                  </span>

                  {/* Hole bars with labels */}
                  <div className="flex items-end gap-2">
                    {sorted.map((hole) => (
                      <div key={hole.holeNumber} className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-slate-500">H{hole.holeNumber}</span>
                        <div
                          title={`${hole.vspar > 0 ? '+' : ''}${hole.vspar}`}
                          className={`w-7 h-7 rounded flex items-center justify-center text-sm ${vsparBarClass(hole.vspar)}`}
                        >
                          {vsparLabel(hole.vspar)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Sum */}
                  <span className={`w-8 text-right text-sm font-bold tabular-nums ${sumColor}`}>
                    {sum > 0 ? `+${sum}` : sum === 0 ? 'E' : sum}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
