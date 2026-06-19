import type { HoleDifficulty, BestAchievement } from '@/lib/tv-stats';

interface TvHoleMapPanelProps {
  holeDifficulty: HoleDifficulty[];
  bestAchievement: BestAchievement | null;
}

function getHoleStyle(avgVsPar: number | null): { circle: string; label: string; glyph: string } {
  if (avgVsPar === null) return { circle: 'bg-slate-700 text-slate-400', label: '', glyph: '' };
  if (avgVsPar <= -0.75) return { circle: 'bg-green-500 text-white', label: 'Easy', glyph: '↓' };
  if (avgVsPar >= 0.75) return { circle: 'bg-red-500 text-white', label: 'Tough', glyph: '↑' };
  return { circle: 'bg-yellow-400 text-slate-900', label: 'Avg', glyph: '→' };
}

function HoleCircle({ hole }: { hole: HoleDifficulty }) {
  const style = getHoleStyle(hole.avgVsPar);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shadow-md transition-colors ${style.circle}`}
        title={
          hole.avgVsPar !== null
            ? `Avg ${hole.avgVsPar > 0 ? '+' : ''}${hole.avgVsPar.toFixed(2)} vs par`
            : 'No data'
        }
      >
        {hole.holeNumber}
      </div>
    </div>
  );
}

export default function TvHoleMapPanel({ holeDifficulty, bestAchievement }: TvHoleMapPanelProps) {
  const diffMap = new Map<number, HoleDifficulty>();
  for (const entry of holeDifficulty) diffMap.set(entry.holeNumber, entry);
  for (let i = 1; i <= 18; i++) {
    if (!diffMap.has(i)) diffMap.set(i, { holeNumber: i, avgVsPar: null });
  }

  const front9 = Array.from({ length: 9 }, (_, i) => diffMap.get(i + 1)!);
  const back9 = Array.from({ length: 9 }, (_, i) => diffMap.get(i + 10)!);

  const playedCount = holeDifficulty.filter((h) => h.avgVsPar !== null).length;

  return (
    <div className="flex flex-col h-full p-8 gap-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <p className="text-slate-400 uppercase tracking-widest text-xs font-semibold">
          Hole Difficulty
        </p>
        {playedCount > 0 && <p className="text-slate-500 text-xs">{playedCount} holes played</p>}
      </div>

      {/* Hole grid */}
      <div className="flex flex-col gap-4 flex-1 justify-center">
        {/* Front 9 */}
        <div>
          <p className="text-slate-600 text-[10px] uppercase font-semibold mb-2 ml-1">Front 9</p>
          <div className="flex gap-2">
            {front9.map((hole) => (
              <HoleCircle key={hole.holeNumber} hole={hole} />
            ))}
          </div>
        </div>

        {/* Back 9 */}
        <div>
          <p className="text-slate-600 text-[10px] uppercase font-semibold mb-2 ml-1">Back 9</p>
          <div className="flex gap-2">
            {back9.map((hole) => (
              <HoleCircle key={hole.holeNumber} hole={hole} />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Easy (avg birdie)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <span>Average</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Playing tough</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-slate-700" />
          <span>Not yet played</span>
        </div>
      </div>

      {/* Best achievement callout */}
      {bestAchievement && (
        <div
          className={`rounded-xl px-5 py-3 flex items-center gap-3 ${
            bestAchievement.vspar <= -2
              ? 'bg-amber-400/10 border border-amber-400/30'
              : 'bg-green-500/10 border border-green-500/30'
          }`}
        >
          <span className="text-2xl">{bestAchievement.vspar <= -2 ? '🦅' : '🐦'}</span>
          <div>
            <p
              className={`font-bold text-base ${bestAchievement.vspar <= -2 ? 'text-amber-400' : 'text-green-400'}`}
            >
              {bestAchievement.vspar <= -2 ? 'EAGLE' : 'BIRDIE'} — Hole #
              {bestAchievement.holeNumber}
            </p>
            <p className="text-slate-400 text-sm">{bestAchievement.teamName}</p>
          </div>
        </div>
      )}
    </div>
  );
}
