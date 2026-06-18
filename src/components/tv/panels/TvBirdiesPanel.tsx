import type { BirdieStats, MomentumEntry } from '@/lib/tv-stats';

interface TvBirdiesPanelProps {
  birdieStats: BirdieStats[];
  momentumStats: MomentumEntry[];
}

export default function TvBirdiesPanel({ birdieStats, momentumStats }: TvBirdiesPanelProps) {
  const allZero = birdieStats.length === 0 || birdieStats.every((t) => t.birdies === 0);

  if (allZero) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-center text-2xl text-slate-400">No birdies yet — keep swinging! 🏌️</p>
      </div>
    );
  }

  const topBirdie = birdieStats.slice(0, 5);
  const topMomentum = momentumStats.slice(0, 5);

  return (
    <div className="flex h-full gap-8 p-8">
      {/* Left column — Birdie Leaders */}
      <div className="flex-1">
        <p className="mb-4 text-sm uppercase tracking-widest text-slate-400">🐦 Birdie Leaders</p>
        {topBirdie.map((team) => (
          <div key={team.teamId} className="mb-3 flex items-center justify-between">
            <span className="text-white">{team.teamName}</span>
            <div className="flex items-center gap-2">
              <span className="text-5xl font-bold text-white">{team.birdies}</span>
              <span className="text-2xl">
                {team.birdies > 5 ? `🐦×${team.birdies}` : '🐦'.repeat(team.birdies)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Right column — Last 3 Holes */}
      <div className="flex-1">
        <p className="mb-4 text-sm uppercase tracking-widest text-slate-400">⚡ Last 3 Holes</p>
        {topMomentum.map((team) => {
          const sorted = [...team.lastThreeHoles].sort((a, b) => a.holeNumber - b.holeNumber);
          const sum = sorted.reduce((acc, h) => acc + h.vspar, 0);
          const sumColor = sum < 0 ? 'text-red-400' : sum === 0 ? 'text-white' : 'text-slate-400';

          return (
            <div key={team.teamId} className="mb-3 flex items-center gap-2">
              <span className="flex-1 text-white">{team.teamName}</span>
              <div className="flex items-end gap-1">
                {sorted.map((hole) => {
                  const barClass =
                    hole.vspar < 0
                      ? 'h-6 bg-green-500'
                      : hole.vspar > 0
                        ? 'h-6 bg-red-500'
                        : 'h-3 bg-slate-600';
                  return <div key={hole.holeNumber} className={`w-6 rounded ${barClass}`} />;
                })}
              </div>
              <span className={`w-6 text-right ${sumColor}`}>{sum > 0 ? `+${sum}` : sum}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
