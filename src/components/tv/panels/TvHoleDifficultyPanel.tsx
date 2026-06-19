import type { HoleDifficulty } from '@/lib/tv-stats';

interface Props {
  holeDifficulty: HoleDifficulty[];
}

function getBarStyle(avg: number | null): {
  color: string;
  tier: 'easy' | 'par' | 'tough' | 'none';
} {
  if (avg === null) return { color: '#dfe7df', tier: 'none' };
  if (avg <= -0.4) return { color: '#1a472a', tier: 'easy' };
  if (avg >= 0.4) return { color: '#c0392b', tier: 'tough' };
  return { color: '#e9b73a', tier: 'par' };
}

export default function TvHoleDifficultyPanel({ holeDifficulty }: Props) {
  const diffMap = new Map<number, HoleDifficulty>();
  for (const h of holeDifficulty) diffMap.set(h.holeNumber, h);
  const holes = Array.from({ length: 18 }, (_, i) => {
    return diffMap.get(i + 1) ?? { holeNumber: i + 1, avgVsPar: null };
  });

  const playedCount = holeDifficulty.filter((h) => h.avgVsPar !== null).length;
  const values = holes.map((h) => h.avgVsPar ?? 0);
  const absMax = Math.max(...values.map(Math.abs), 0.1);
  const MAX_BAR_H = 150;

  const toughest =
    [...holeDifficulty]
      .filter((h) => h.avgVsPar !== null)
      .sort((a, b) => (b.avgVsPar ?? 0) - (a.avgVsPar ?? 0))[0] ?? null;
  const easiest =
    [...holeDifficulty]
      .filter((h) => h.avgVsPar !== null)
      .sort((a, b) => (a.avgVsPar ?? 0) - (b.avgVsPar ?? 0))[0] ?? null;

  return (
    <div className="flex flex-col h-full p-7 gap-4" style={{ background: '#fff' }}>
      {/* Header */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <div
            className="font-bold uppercase"
            style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}
          >
            Course Report
          </div>
          <div
            className="font-barlow font-bold"
            style={{ fontSize: 46, lineHeight: 1.05, color: '#15241c' }}
          >
            Hole
            <br />
            Difficulty
          </div>
        </div>
        <div className="flex items-center gap-5 pb-1">
          {[
            { color: '#1a472a', label: 'Easy' },
            { color: '#e9b73a', label: 'Par' },
            { color: '#c0392b', label: 'Tough' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
              <span style={{ fontSize: 13, color: '#46554c' }}>{label}</span>
            </div>
          ))}
          <span style={{ fontSize: 13, color: '#90a094' }}>{playedCount} of 18 played</span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex flex-1 items-end gap-0 min-h-0 overflow-hidden">
        {holes.map((hole, i) => {
          const avg = hole.avgVsPar;
          const { color } = getBarStyle(avg);
          const barH = avg !== null ? Math.max(12, (Math.abs(avg) / absMax) * MAX_BAR_H) : 8;
          const isTough = avg !== null && avg > 0;

          return (
            <div key={hole.holeNumber} className="flex flex-col items-center flex-1">
              {/* Divider between front/back 9 */}
              {i === 9 && (
                <div
                  className="absolute"
                  style={{
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: '#ddd',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* Value label above bar (tough) */}
              <div style={{ height: 28 }} className="flex items-end justify-center">
                {avg !== null && isTough && (
                  <span className="font-bold" style={{ fontSize: 12, color: '#c0392b' }}>
                    +{avg.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Bar */}
              <div className="w-[42px] rounded-sm" style={{ height: barH, background: color }} />

              {/* Value label below bar (easy) */}
              <div style={{ height: 22 }} className="flex items-start justify-center">
                {avg !== null && !isTough && (
                  <span className="font-bold" style={{ fontSize: 12, color: '#1a472a' }}>
                    {avg.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Hole number + par */}
              <div className="flex flex-col items-center mt-1">
                <span style={{ fontSize: 12, fontWeight: 600, color: '#15241c' }}>
                  {hole.holeNumber}
                </span>
                <span style={{ fontSize: 10, color: '#90a094' }}>
                  P{hole.holeNumber <= 9 ? (hole.holeNumber % 3 === 0 ? 5 : 4) : 4}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Callout cards */}
      <div className="flex gap-4 shrink-0">
        {toughest && (
          <div
            className="flex-1 rounded-2xl p-4"
            style={{ background: '#fbecea', border: '1px solid #f5c6c2' }}
          >
            <div
              className="font-bold uppercase mb-1"
              style={{ fontSize: 10, letterSpacing: '0.14em', color: '#c0392b' }}
            >
              Toughest Hole
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="font-barlow font-extrabold"
                style={{ fontSize: 36, color: '#c0392b' }}
              >
                +{toughest.avgVsPar?.toFixed(1)}
              </span>
              <span style={{ fontSize: 18, color: '#33413a', fontWeight: 600 }}>
                Hole {toughest.holeNumber}
              </span>
            </div>
          </div>
        )}
        {easiest && (
          <div
            className="flex-1 rounded-2xl p-4"
            style={{ background: '#e9f3ec', border: '1px solid #b8dfc3' }}
          >
            <div
              className="font-bold uppercase mb-1"
              style={{ fontSize: 10, letterSpacing: '0.14em', color: '#1a472a' }}
            >
              Easiest Hole
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="font-barlow font-extrabold"
                style={{ fontSize: 36, color: '#1a472a' }}
              >
                {easiest.avgVsPar?.toFixed(1)}
              </span>
              <span style={{ fontSize: 18, color: '#33413a', fontWeight: 600 }}>
                Hole {easiest.holeNumber}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
