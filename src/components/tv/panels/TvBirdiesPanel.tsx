import type { BirdieStats, MomentumEntry } from '@/lib/tv-stats';

interface TvBirdiesPanelProps {
  birdieStats: BirdieStats[];
  momentumStats: MomentumEntry[];
}

function MomentumChip({ vspar, holeNumber }: { vspar: number; holeNumber: number }) {
  let bg: string;
  let fg: string;
  let label: string;

  if (vspar <= -2) {
    bg = '#1a472a';
    fg = '#fff';
    label = 'E';
  } // eagle
  else if (vspar === -1) {
    bg = '#c0392b';
    fg = '#fff';
    label = '−1';
  } // birdie
  else if (vspar === 0) {
    bg = '#eef2ea';
    fg = '#46554c';
    label = 'E';
  } // par
  else {
    bg = '#f0e4e0';
    fg = '#a8513f';
    label = `+${vspar}`;
  } // bogey+

  return (
    <div className="flex flex-col items-center gap-1">
      <span style={{ fontSize: 10, color: '#90a094' }}>H{holeNumber}</span>
      <div
        className="flex items-center justify-center rounded-lg font-barlow font-bold"
        style={{ width: 40, height: 40, background: bg, color: fg, fontSize: 15 }}
      >
        {label}
      </div>
    </div>
  );
}

export default function TvBirdiesPanel({ birdieStats, momentumStats }: TvBirdiesPanelProps) {
  const totalBirdies = birdieStats.reduce((s, t) => s + t.birdies, 0);
  const totalEagles = birdieStats.reduce((s, t) => s + t.eagles, 0);
  const teamsOut = birdieStats.length;
  const maxBirdies = birdieStats[0]?.birdies ?? 1;

  return (
    <div className="flex flex-col h-full p-7 gap-5" style={{ background: '#fff' }}>
      {/* Top 4 stat cards */}
      <div className="flex gap-4 shrink-0">
        {[
          { label: 'Birdies Today', value: String(totalBirdies), color: '#15241c' },
          { label: 'Eagles', value: String(totalEagles), color: '#c79a2e' },
          { label: 'Avg Score', value: '73.4', color: '#15241c' },
          { label: 'Teams Out', value: String(teamsOut), color: '#15241c' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="flex-1 flex flex-col gap-2 rounded-2xl p-5"
            style={{ background: '#f4f7f1', border: '1px solid #e2e8df' }}
          >
            <span
              className="font-bold uppercase"
              style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}
            >
              {label}
            </span>
            <span
              className="font-barlow font-extrabold leading-none"
              style={{ fontSize: 44, color }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="flex flex-1 gap-0 min-h-0">
        {/* Birdie leaders */}
        <div
          className="flex-1 flex flex-col gap-4 pr-6"
          style={{ borderRight: '1px solid #e2e8df' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🏌️</span>
            <span
              className="font-barlow font-bold uppercase"
              style={{ fontSize: 18, letterSpacing: '0.06em', color: '#15241c' }}
            >
              Birdie Leaders
            </span>
          </div>

          <div className="flex flex-col gap-4 flex-1">
            {birdieStats.slice(0, 5).map((team, idx) => {
              const pct = maxBirdies > 0 ? (team.birdies / maxBirdies) * 100 : 0;
              const isTop = idx === 0;
              return (
                <div key={team.teamId} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#15241c' }}>
                      {team.teamName}
                    </span>
                    <div className="flex items-center gap-3">
                      {team.eagles > 0 && (
                        <span style={{ fontSize: 13, color: '#c79a2e' }}>🦅 ×{team.eagles}</span>
                      )}
                      <span
                        className="font-barlow font-extrabold tabular-nums"
                        style={{ fontSize: 32, color: isTop ? '#c0392b' : '#15241c' }}
                      >
                        {team.birdies}
                      </span>
                    </div>
                  </div>
                  <div
                    className="h-[13px] rounded-full overflow-hidden"
                    style={{ background: '#eef2ea' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: isTop ? 'linear-gradient(90deg,#c0392b,#e0654f)' : '#1a472a',
                        transition: 'width 0.9s cubic-bezier(.2,.7,.2,1)',
                        transformOrigin: 'left',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Last 3 holes momentum */}
        <div className="flex-1 flex flex-col gap-4 pl-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">📈</span>
            <span
              className="font-barlow font-bold uppercase"
              style={{ fontSize: 18, letterSpacing: '0.06em', color: '#15241c' }}
            >
              Last 3 Holes
            </span>
          </div>

          <div className="flex flex-col gap-4 flex-1">
            {momentumStats.slice(0, 5).map((team) => {
              const sorted = [...team.lastThreeHoles].sort((a, b) => a.holeNumber - b.holeNumber);
              const sum = sorted.reduce((acc, h) => acc + h.vspar, 0);
              const sumColor = sum < 0 ? '#c0392b' : sum > 0 ? '#33413a' : '#1a472a';
              const sumLabel = sum < 0 ? `−${Math.abs(sum)}` : sum === 0 ? 'E' : `+${sum}`;

              return (
                <div key={team.teamId} className="flex items-center gap-3">
                  <span
                    className="flex-1 font-semibold truncate"
                    style={{ fontSize: 15, color: '#15241c' }}
                  >
                    {team.teamName}
                  </span>
                  <div className="flex items-end gap-2">
                    {sorted.map((hole) => (
                      <MomentumChip
                        key={hole.holeNumber}
                        vspar={hole.vspar}
                        holeNumber={hole.holeNumber}
                      />
                    ))}
                  </div>
                  <span
                    className="font-barlow font-extrabold tabular-nums w-10 text-right"
                    style={{ fontSize: 26, color: sumColor }}
                  >
                    {sumLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
