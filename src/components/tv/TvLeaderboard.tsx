import type { LeaderboardRow } from '@/lib/types';
import type { SparklineEntry } from '@/lib/tv-stats';

interface TvLeaderboardProps {
  leaderboard: LeaderboardRow[];
  sparklines: SparklineEntry[];
}

const CREST_COLORS: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#e7c66b', fg: '#5c4710' },
  2: { bg: '#cfd6cf', fg: '#3a443c' },
  3: { bg: '#d8a772', fg: '#4a2f12' },
};
const DEFAULT_CREST = { bg: '#dfe7df', fg: '#46554c' };

function getInitials(name: string | null, number: number): string {
  if (!name) return String(number);
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatScore(vspar: number): string {
  if (vspar < 0) return `−${Math.abs(vspar)}`;
  if (vspar === 0) return 'E';
  return `+${vspar}`;
}

function SparklineSvg({ track, vspar }: { track: number[]; vspar: number }) {
  const SW = 120;
  const SH = 34;
  if (track.length < 2) {
    return <svg width={80} height={24} viewBox={`0 0 ${SW} ${SH}`} />;
  }
  const stroke = vspar < 0 ? '#c0392b' : vspar === 0 ? '#1a472a' : '#9aa89e';
  const xAt = (i: number) => (i / (track.length - 1)) * SW;
  const yAt = (v: number, min: number, max: number) =>
    max === min ? SH / 2 : SH - ((v - min) / (max - min)) * SH;

  const allMin = Math.min(...track);
  const allMax = Math.max(...track);
  const pts = track.map((v, i) => `${xAt(i)},${yAt(v, allMin, allMax)}`).join(' ');
  const lastX = xAt(track.length - 1);
  const lastY = yAt(track[track.length - 1], allMin, allMax);

  return (
    <svg
      width={80}
      height={24}
      viewBox={`0 0 ${SW} ${SH}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={5} fill={stroke} />
    </svg>
  );
}

export default function TvLeaderboard({ leaderboard, sparklines }: TvLeaderboardProps) {
  const displayRows = leaderboard.slice(0, 16);
  const moreCount = Math.max(0, leaderboard.length - 16);
  const sparkMap = new Map(sparklines.map((s) => [s.teamId, s]));

  return (
    <div
      data-testid="tv-leaderboard-panel"
      className="h-full flex flex-col overflow-hidden"
      style={{ background: '#f4f7f1' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid #e2e8df' }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse"
          style={{ background: '#2f8f4e', animationDuration: '1.4s' }}
        />
        <span
          className="font-barlow font-bold uppercase"
          style={{ fontSize: 23, letterSpacing: '0.05em', color: '#15241c' }}
        >
          Leaderboard
        </span>
      </div>

      {/* Column heads */}
      <div
        className="grid px-4 py-2"
        style={{
          gridTemplateColumns: '20px 1fr 80px 28px 46px',
          gap: 6,
          borderBottom: '1px solid #e2e8df',
        }}
      >
        {['#', 'Team', 'Trend', 'Thru', 'Sc'].map((h) => (
          <span
            key={h}
            className="font-bold uppercase"
            style={{ fontSize: 10, letterSpacing: '0.1em', color: '#90a094' }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {displayRows.map((row, idx) => {
          const rank = idx + 1;
          const vsParVal = row.total_score - row.par_total;
          const spark = sparkMap.get(row.team_id);
          const crest = CREST_COLORS[rank] ?? DEFAULT_CREST;
          const initials = getInitials(row.team_name, row.team_number);

          const scoreColor = vsParVal < 0 ? '#c0392b' : vsParVal > 0 ? '#33413a' : '#1a472a';
          const rankColor = rank <= 3 ? '#1a472a' : '#8a988e';

          const rowBg =
            rank === 1
              ? 'linear-gradient(90deg,#fbf3d8,#f4f7f1)'
              : rank <= 3
                ? '#ffffff'
                : 'transparent';
          const rowBorder =
            rank === 1 ? '1px solid #ecd58a' : rank <= 3 ? '1px solid #e8eee4' : 'none';

          return (
            <div
              key={`${row.team_id}-${idx}`}
              className="grid items-center px-4"
              style={{
                gridTemplateColumns: '20px 1fr 80px 28px 46px',
                gap: 6,
                height: 52,
                borderRadius: 9,
                margin: '2px 4px',
                background: rowBg,
                border: rowBorder,
              }}
            >
              {/* Pos */}
              <span className="font-barlow font-bold" style={{ fontSize: 19, color: rankColor }}>
                {rank}
              </span>

              {/* Team: crest + name */}
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="flex items-center justify-center rounded-full shrink-0 font-bold text-[11px]"
                  style={{ width: 26, height: 26, background: crest.bg, color: crest.fg }}
                >
                  {initials}
                </div>
                <span className="truncate font-semibold" style={{ fontSize: 15, color: '#15241c' }}>
                  {row.team_name ?? `Team ${row.team_number}`}
                </span>
              </div>

              {/* Sparkline */}
              <div className="flex items-center justify-center">
                {spark && spark.track.length >= 2 ? (
                  <SparklineSvg track={spark.track} vspar={vsParVal} />
                ) : (
                  <span style={{ color: '#c8d3ce', fontSize: 10 }}>—</span>
                )}
              </div>

              {/* Thru */}
              <span style={{ fontSize: 12, color: '#6b7a70' }}>
                {row.holes_completed > 0 ? row.holes_completed : '—'}
              </span>

              {/* Score */}
              <span
                className="font-barlow font-extrabold tabular-nums text-right"
                style={{ fontSize: 23, color: scoreColor }}
              >
                {formatScore(vsParVal)}
              </span>
            </div>
          );
        })}
      </div>

      {moreCount > 0 && (
        <div
          className="px-5 py-3 text-center"
          style={{ fontSize: 12, color: '#90a094', borderTop: '1px solid #e2e8df' }}
        >
          + {moreCount} more {moreCount === 1 ? 'team' : 'teams'}
        </div>
      )}
    </div>
  );
}
