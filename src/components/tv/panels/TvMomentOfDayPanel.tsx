import type { BestAchievement } from '@/lib/tv-stats';

function ShotDiagram() {
  return (
    <svg viewBox="0 0 340 280" width="100%" height="100%" style={{ maxHeight: 260 }}>
      {/* Green circle */}
      <ellipse cx={170} cy={130} rx={130} ry={100} fill="#2d6a40" />
      <ellipse cx={170} cy={130} rx={110} ry={82} fill="#3a7a4e" opacity={0.6} />
      {/* Flag at hole */}
      <circle cx={190} cy={105} r={6} fill="#c0392b" />
      <line x1={190} y1={105} x2={190} y2={75} stroke="#fff" strokeWidth={2} />
      <polygon points="190,75 215,85 190,95" fill="#c0392b" />
      {/* Tee label bottom */}
      <rect x={120} y={220} width={70} height={28} rx={8} fill="#1a472a" />
      <text
        x={155}
        y={238}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        style={{ fontSize: 13, fontWeight: 700 }}
      >
        TEE
      </text>
      {/* Approach arc (dotted) */}
      <path
        d="M 155 230 Q 120 160 185 108"
        fill="none"
        stroke="#e7c66b"
        strokeWidth={2.5}
        strokeDasharray="7 5"
      />
      {/* Ball near cup */}
      <circle cx={190} cy={105} r={9} fill="#fff" opacity={0.9} />
      {/* Distance label */}
      <text
        x={100}
        y={175}
        textAnchor="middle"
        fill="#e7c66b"
        style={{ fontSize: 12, fontWeight: 700 }}
      >
        4 ft
      </text>
    </svg>
  );
}

export default function TvMomentOfDayPanel({
  bestAchievement,
}: {
  bestAchievement: BestAchievement | null;
}) {
  if (!bestAchievement) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: '#fff' }}>
        <p style={{ color: '#90a094', fontSize: 18 }}>No eagle or birdie moments yet</p>
      </div>
    );
  }

  const isEagle = bestAchievement.vspar <= -2;
  const label = isEagle ? 'EAGLE' : 'BIRDIE';
  const scoreLabel =
    bestAchievement.vspar < 0 ? `−${Math.abs(bestAchievement.vspar)}` : `+${bestAchievement.vspar}`;

  return (
    <div className="flex h-full">
      {/* Left: celebration */}
      <div
        className="flex flex-col justify-center p-10 gap-4"
        style={{ width: '52%', background: 'linear-gradient(150deg,#1a472a,#0d2414)' }}
      >
        <div
          className="font-bold uppercase"
          style={{ fontSize: 11, letterSpacing: '0.18em', color: '#9fd6ad' }}
        >
          Moment of the Day
        </div>
        <div className="flex items-center gap-4">
          <span style={{ fontSize: 56 }}>🦅</span>
          <span
            className="font-barlow font-extrabold text-white leading-none"
            style={{ fontSize: 100 }}
          >
            {label}
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-barlow font-extrabold" style={{ fontSize: 40, color: '#c0392b' }}>
            {scoreLabel}
          </span>
          <span style={{ fontSize: 18, color: '#bfe6c9' }}>Hole {bestAchievement.holeNumber}</span>
        </div>
        <div className="mt-2">
          <div className="font-barlow font-bold text-white" style={{ fontSize: 34 }}>
            {bestAchievement.teamName}
          </div>
          <div style={{ fontSize: 15, color: '#9fd6ad', marginTop: 4 }}>
            &ldquo;Making history one shot at a time&rdquo;
          </div>
        </div>
      </div>

      {/* Right: shot diagram */}
      <div
        className="flex-1 flex flex-col items-center justify-center gap-6 p-8"
        style={{ background: '#f8faf6' }}
      >
        <div
          className="font-bold uppercase"
          style={{ fontSize: 11, letterSpacing: '0.18em', color: '#90a094' }}
        >
          The Shot
        </div>
        <div style={{ width: '100%', flex: 1, maxHeight: 260 }}>
          <ShotDiagram />
        </div>
        {/* Stat chips */}
        <div className="flex gap-4 w-full">
          {[
            { value: '215', label: 'YD APPROACH' },
            { value: '4', label: 'FT FOR EAGLE' },
            { value: '3', label: 'STROKES' },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="flex-1 flex flex-col items-center gap-1 rounded-xl py-3"
              style={{ background: '#fff', border: '1px solid #e2e8df' }}
            >
              <span
                className="font-barlow font-extrabold"
                style={{ fontSize: 28, color: '#15241c' }}
              >
                {value}
              </span>
              <span
                className="font-bold uppercase"
                style={{ fontSize: 10, letterSpacing: '0.14em', color: '#90a094' }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
