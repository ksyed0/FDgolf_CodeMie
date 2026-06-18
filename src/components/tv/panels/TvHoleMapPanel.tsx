import type { HoleDifficulty, BestAchievement } from '@/lib/tv-stats';

interface TvHoleMapPanelProps {
  holeDifficulty: HoleDifficulty[];
  bestAchievement: BestAchievement | null;
}

function getCircleColor(avgVsPar: number | null): string {
  if (avgVsPar === null) return 'bg-slate-700';
  if (avgVsPar < -0.5) return 'bg-green-500';
  if (avgVsPar >= -0.5 && avgVsPar <= 0.5) return 'bg-yellow-400 text-slate-900';
  return 'bg-red-500';
}

export default function TvHoleMapPanel({ holeDifficulty, bestAchievement }: TvHoleMapPanelProps) {
  // Build lookup map: holeNumber → HoleDifficulty
  const difficultyMap = new Map<number, HoleDifficulty>();
  for (const entry of holeDifficulty) {
    difficultyMap.set(entry.holeNumber, entry);
  }

  // Ensure all holes 1-18 are represented in the map
  for (let i = 1; i <= 18; i++) {
    if (!difficultyMap.has(i)) {
      difficultyMap.set(i, { holeNumber: i, avgVsPar: null });
    }
  }

  return (
    <div className="flex flex-col h-full p-8">
      {/* Title */}
      <h2 className="text-slate-400 uppercase tracking-widest text-sm mb-6">Hole Difficulty</h2>

      {/* Row 1: Holes 1-9 */}
      <div className="flex gap-2">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((holeNum) => {
          const difficulty = difficultyMap.get(holeNum)!;
          const colorClass = getCircleColor(difficulty.avgVsPar);
          return (
            <div
              key={holeNum}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white ${colorClass}`}
            >
              {holeNum}
            </div>
          );
        })}
      </div>

      {/* Row 2: Holes 10-18 */}
      <div className="flex gap-2 mt-4">
        {Array.from({ length: 9 }, (_, i) => i + 10).map((holeNum) => {
          const difficulty = difficultyMap.get(holeNum)!;
          const colorClass = getCircleColor(difficulty.avgVsPar);
          return (
            <div
              key={holeNum}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white ${colorClass}`}
            >
              {holeNum}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 text-slate-400 text-sm">🟢 Easy · 🟡 Average · 🔴 Playing tough</div>

      {/* Best Achievement Callout */}
      {bestAchievement && (
        <div className="mt-6 text-2xl font-bold">
          {bestAchievement.vspar <= -2 ? (
            <div className="text-amber-400">
              🦅 EAGLE — Hole #{bestAchievement.holeNumber} · {bestAchievement.teamName}
            </div>
          ) : bestAchievement.vspar === -1 ? (
            <div className="text-green-400">
              🐦 BIRDIE LEADER — Hole #{bestAchievement.holeNumber} · {bestAchievement.teamName}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
