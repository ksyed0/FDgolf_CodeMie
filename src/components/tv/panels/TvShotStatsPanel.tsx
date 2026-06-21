import type { ShotStats } from '@/lib/tv-stats';

function metersToYards(m: number): number {
  return Math.round(m * 1.09361);
}

function DonutRing({ pct }: { pct: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;
  return (
    <svg width={130} height={130} viewBox="0 0 130 130">
      <circle cx={65} cy={65} r={R} fill="none" stroke="#e3eadf" strokeWidth={14} />
      <circle
        cx={65}
        cy={65}
        r={R}
        fill="none"
        stroke="#1a472a"
        strokeWidth={14}
        strokeDasharray={`${dash} ${C}`}
        strokeLinecap="round"
        transform="rotate(-90 65 65)"
      />
      <text
        x={65}
        y={65}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: 24, fill: '#15241c' }}
      >
        {pct}%
      </text>
    </svg>
  );
}

function TrajectoryArc() {
  return (
    <svg viewBox="0 0 500 100" width="100%" height={80} style={{ opacity: 0.6 }}>
      <path
        d="M 20 90 Q 260 10 480 90"
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={2.5}
        strokeDasharray="8 6"
      />
      <circle cx={20} cy={90} r={7} fill="rgba(255,255,255,0.7)" />
      <circle cx={480} cy={90} r={7} fill="rgba(255,255,255,0.7)" />
    </svg>
  );
}

export default function TvShotStatsPanel({ shotStats }: { shotStats: ShotStats }) {
  const { longestDriveMeters, longestDriveTeam, clubOfDay, clubOfDayPct, cleanestTeams } =
    shotStats;
  const yards = longestDriveMeters !== null ? metersToYards(longestDriveMeters) : null;
  const topClean = cleanestTeams[0] ?? null;
  const runners = cleanestTeams.slice(1);

  return (
    <div className="flex flex-col h-full p-7 gap-4" style={{ background: '#fff' }}>
      <div>
        <div
          className="font-bold uppercase"
          style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}
        >
          Off the Tee &amp; Around the Green
        </div>
        <div className="font-barlow font-bold" style={{ fontSize: 42, color: '#15241c' }}>
          Shot Stats
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Longest Drive — 42% width */}
        <div
          className="flex flex-col justify-between rounded-2xl p-7 relative overflow-hidden"
          style={{
            width: '42%',
            background: 'linear-gradient(150deg,#1a472a,#0f2e1b)',
            flexShrink: 0,
          }}
        >
          <div>
            <div
              className="font-bold uppercase"
              style={{ fontSize: 11, letterSpacing: '0.14em', color: '#9fd6ad' }}
            >
              Longest Drive
            </div>
            {yards !== null ? (
              <div className="flex items-baseline gap-1 mt-2">
                <span
                  className="font-barlow font-extrabold text-white leading-none"
                  style={{ fontSize: 110 }}
                >
                  {yards}
                </span>
                <span className="font-barlow font-bold text-white" style={{ fontSize: 32 }}>
                  yds
                </span>
              </div>
            ) : (
              <span
                className="font-barlow font-bold text-white mt-2 block"
                style={{ fontSize: 36 }}
              >
                GPS pending
              </span>
            )}
            {longestDriveTeam && (
              <div className="mt-2">
                <div className="font-bold text-white" style={{ fontSize: 20 }}>
                  {longestDriveTeam}
                </div>
              </div>
            )}
          </div>
          <div className="mt-auto">
            <TrajectoryArc />
          </div>
        </div>

        {/* Club of Day */}
        <div
          className="flex-1 flex flex-col items-center justify-center gap-3 rounded-2xl p-6"
          style={{ background: '#f4f7f1' }}
        >
          <div
            className="font-bold uppercase"
            style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}
          >
            Club of the Day
          </div>
          {clubOfDayPct !== null && <DonutRing pct={clubOfDayPct} />}
          {clubOfDay && (
            <span className="font-barlow font-extrabold" style={{ fontSize: 36, color: '#15241c' }}>
              {clubOfDay}
            </span>
          )}
          {clubOfDayPct !== null && (
            <span style={{ fontSize: 13, color: '#6b7a70' }}>of scoring shots</span>
          )}
        </div>

        {/* Cleanest Round */}
        <div
          className="flex-1 flex flex-col gap-4 rounded-2xl p-6"
          style={{ background: '#f4f7f1' }}
        >
          <div
            className="font-bold uppercase"
            style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}
          >
            Cleanest Round
          </div>
          {topClean && (
            <>
              <div className="flex flex-col items-center gap-2 flex-1 justify-center">
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{ width: 72, height: 72, background: '#1a472a' }}
                >
                  <span className="text-white text-3xl">✓</span>
                </div>
                <span
                  className="font-barlow font-bold"
                  style={{ fontSize: 28, color: '#15241c', textAlign: 'center' }}
                >
                  {topClean.teamName}
                </span>
                <span style={{ fontSize: 13, color: '#6b7a70' }}>
                  {topClean.badShots === 0
                    ? '0 penalties · 0 OB'
                    : `${topClean.badShots} penalties`}
                </span>
              </div>
              {runners.length > 0 && (
                <div className="flex flex-col gap-2">
                  {runners.map((t) => (
                    <div
                      key={t.teamName}
                      className="flex items-center justify-between rounded-xl px-3 py-2"
                      style={{ background: '#fff' }}
                    >
                      <span style={{ fontSize: 13, color: '#46554c' }}>{t.teamName}</span>
                      <span style={{ fontSize: 13, color: '#c0392b', fontWeight: 600 }}>
                        {t.badShots} {t.badShots === 1 ? 'penalty' : 'penalties'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
