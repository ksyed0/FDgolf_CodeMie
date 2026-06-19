import type { TeamSpotlight } from '@/lib/tv-stats';
import type { LeaderboardRow } from '@/lib/types';

interface Props {
  teamSpotlight: TeamSpotlight | null;
  leaderboard: LeaderboardRow[];
}

function ScorecardChip({ vspar, holeNumber }: { vspar: number; holeNumber: number }) {
  let bg: string;
  let fg: string;
  let label: string;
  if (vspar <= -2) {
    bg = '#1a472a';
    fg = '#fff';
    label = 'E';
  } else if (vspar === -1) {
    bg = '#c0392b';
    fg = '#fff';
    label = '−1';
  } else if (vspar === 0) {
    bg = '#eef2ea';
    fg = '#46554c';
    label = 'E';
  } else {
    bg = '#f0e4e0';
    fg = '#a8513f';
    label = `+${vspar}`;
  }
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="flex items-center justify-center rounded font-barlow font-bold"
        style={{ width: 30, height: 30, background: bg, color: fg, fontSize: 13 }}
      >
        {label}
      </div>
      <span style={{ fontSize: 9, color: '#90a094' }}>{holeNumber}</span>
    </div>
  );
}

function formatScore(vspar: number) {
  if (vspar < 0) return `−${Math.abs(vspar)}`;
  if (vspar === 0) return 'E';
  return `+${vspar}`;
}

export default function TvTeamSpotlightPanel({ teamSpotlight, leaderboard }: Props) {
  if (!teamSpotlight) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: '#fff' }}>
        <p style={{ color: '#90a094', fontSize: 18 }}>No scoring data yet</p>
      </div>
    );
  }

  const second = leaderboard[1] ?? null;
  const secondVsPar = second ? second.total_score - second.par_total : null;
  const leaderVsPar = teamSpotlight.score;

  return (
    <div className="flex h-full">
      {/* Left: spotlight */}
      <div
        className="flex flex-col p-7 gap-4 overflow-hidden"
        style={{ width: '54%', background: '#fff', borderRight: '1px solid #e2e8df' }}
      >
        <div>
          <div
            className="font-bold uppercase"
            style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}
          >
            Team Spotlight
          </div>
          <div className="flex items-start justify-between">
            <div
              className="font-barlow font-bold"
              style={{ fontSize: 48, lineHeight: 1.1, color: '#15241c' }}
            >
              {teamSpotlight.teamName}
            </div>
            <div className="text-right">
              <span
                className="font-barlow font-extrabold"
                style={{ fontSize: 56, color: '#c0392b' }}
              >
                {formatScore(leaderVsPar)}
              </span>
              <div style={{ fontSize: 12, color: '#90a094' }}>
                Thru {teamSpotlight.holesCompleted} · Leading
              </div>
            </div>
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex gap-3 shrink-0">
          {[
            { label: 'Birdies', val: teamSpotlight.birdies },
            { label: 'Eagle', val: teamSpotlight.eagles },
            { label: 'Pars', val: teamSpotlight.pars },
            { label: 'Penalties', val: teamSpotlight.penalties },
          ].map(({ label, val }) => (
            <div
              key={label}
              className="flex-1 flex flex-col items-center gap-1 rounded-xl py-3"
              style={{ background: '#f4f7f1', border: '1px solid #e2e8df' }}
            >
              <span className="font-barlow font-bold" style={{ fontSize: 28, color: '#15241c' }}>
                {val}
              </span>
              <span
                className="font-bold uppercase"
                style={{ fontSize: 10, letterSpacing: '0.12em', color: '#90a094' }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Roster */}
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
          {teamSpotlight.roster.map((p) => (
            <div
              key={p.playerId}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: '#f8faf6', border: '1px solid #e8eee4' }}
            >
              <div
                className="flex items-center justify-center rounded-full font-bold text-white text-sm shrink-0"
                style={{ width: 44, height: 44, background: '#1a472a' }}
              >
                {p.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate" style={{ fontSize: 15, color: '#15241c' }}>
                  {p.name}
                </div>
                <div className="truncate" style={{ fontSize: 12, color: '#6b7a70' }}>
                  {[p.title, p.company].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-barlow font-bold" style={{ fontSize: 20, color: '#1a472a' }}>
                  {p.bbHolesCount}
                </div>
                <div style={{ fontSize: 10, color: '#90a094' }}>BB HOLES</div>
              </div>
            </div>
          ))}
        </div>

        {/* Scorecard strip */}
        <div className="shrink-0">
          <div
            className="font-bold uppercase mb-2"
            style={{ fontSize: 10, letterSpacing: '0.14em', color: '#90a094' }}
          >
            Best-Ball Scorecard · vs Par
          </div>
          <div className="flex gap-1 flex-wrap">
            {teamSpotlight.scorecard.map((s) => (
              <ScorecardChip key={s.holeNumber} vspar={s.vspar} holeNumber={s.holeNumber} />
            ))}
          </div>
        </div>
      </div>

      {/* Right: head-to-head */}
      <div className="flex-1 flex flex-col p-7 gap-5" style={{ background: '#f4f7f1' }}>
        <div>
          <div
            className="font-bold uppercase"
            style={{ fontSize: 11, letterSpacing: '0.14em', color: '#90a094' }}
          >
            Head to Head
          </div>
          <div className="font-barlow font-bold" style={{ fontSize: 28, color: '#15241c' }}>
            Race for the Lead
          </div>
        </div>

        {/* Big score cards */}
        <div className="flex items-center gap-3">
          <div
            className="flex-1 flex flex-col items-center justify-center rounded-2xl py-5"
            style={{ background: '#1a472a' }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#9fd6ad' }}>
              {teamSpotlight.teamName}
            </span>
            <span className="font-barlow font-extrabold text-white" style={{ fontSize: 52 }}>
              {formatScore(leaderVsPar)}
            </span>
            <span style={{ fontSize: 11, color: '#9fd6ad' }}>
              1st · Thru {teamSpotlight.holesCompleted}
            </span>
          </div>

          <span className="font-barlow font-bold" style={{ fontSize: 22, color: '#90a094' }}>
            VS
          </span>

          {second && (
            <div
              className="flex-1 flex flex-col items-center justify-center rounded-2xl py-5"
              style={{ background: '#fff', border: '1px solid #e2e8df' }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#46554c' }}>
                {second.team_name ?? `Team ${second.team_number}`}
              </span>
              <span
                className="font-barlow font-extrabold"
                style={{ fontSize: 52, color: '#33413a' }}
              >
                {secondVsPar !== null ? formatScore(secondVsPar) : '—'}
              </span>
              <span style={{ fontSize: 11, color: '#6b7a70' }}>
                2nd · Thru {second.holes_completed}
              </span>
            </div>
          )}
        </div>

        {/* Comparison table */}
        <div className="flex flex-col gap-2 flex-1">
          {[
            {
              label: 'Score',
              left: formatScore(leaderVsPar),
              right: secondVsPar !== null ? formatScore(secondVsPar) : '—',
            },
            { label: 'Birdies', left: String(teamSpotlight.birdies), right: '—' },
            { label: 'Eagles', left: String(teamSpotlight.eagles), right: '0' },
          ].map(({ label, left, right }) => (
            <div
              key={label}
              className="flex items-center rounded-xl px-4 py-3"
              style={{ background: '#fff', border: '1px solid #e2e8df' }}
            >
              <span
                className="font-barlow font-bold"
                style={{ fontSize: 20, color: '#15241c', width: 60 }}
              >
                {left}
              </span>
              <span
                className="flex-1 text-center font-bold uppercase"
                style={{ fontSize: 10, letterSpacing: '0.14em', color: '#90a094' }}
              >
                {label}
              </span>
              <span
                className="font-barlow font-bold text-right"
                style={{ fontSize: 20, color: '#33413a', width: 60 }}
              >
                {right}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
