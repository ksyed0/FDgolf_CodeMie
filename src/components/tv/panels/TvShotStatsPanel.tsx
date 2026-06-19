import type { ShotStats } from '@/lib/tv-stats';

interface TvShotStatsPanelProps {
  shotStats: ShotStats;
}

function StatCard({
  icon,
  label,
  primary,
  secondary,
  accent = false,
}: {
  icon: string;
  label: string;
  primary: React.ReactNode;
  secondary?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex-1 rounded-2xl flex flex-col p-6 gap-3 ${
        accent
          ? 'bg-gradient-to-br from-slate-700 to-slate-800 ring-1 ring-white/10'
          : 'bg-slate-800/70'
      }`}
    >
      <span className="text-3xl leading-none">{icon}</span>
      <p className="text-slate-400 uppercase tracking-widest text-[10px] font-semibold">{label}</p>
      <div className="mt-auto">
        <div className="text-white font-bold leading-none">{primary}</div>
        {secondary && <p className="text-slate-400 text-sm mt-2">{secondary}</p>}
      </div>
    </div>
  );
}

export default function TvShotStatsPanel({ shotStats }: TvShotStatsPanelProps) {
  const { longestDriveMeters, longestDriveTeam, clubOfDay, clubOfDayPct, cleanestTeams } =
    shotStats;

  const allClean = cleanestTeams.length === 0 || cleanestTeams.every((t) => t.badShots === 0);

  // Cleanest team content
  let cleanPrimary: React.ReactNode;
  let cleanSecondary: string | undefined;

  if (allClean) {
    cleanPrimary = <span className="text-green-400 text-2xl">All Clean ✓</span>;
    cleanSecondary = 'No penalties recorded';
  } else {
    const top = cleanestTeams[0];
    cleanPrimary = (
      <span className={`text-2xl ${top.badShots === 0 ? 'text-green-400' : 'text-white'}`}>
        {top.teamName}
      </span>
    );
    cleanSecondary =
      top.badShots === 0
        ? '0 OB / Water'
        : `${top.badShots} penalty ${top.badShots === 1 ? 'shot' : 'shots'}`;
  }

  return (
    <div className="flex flex-col h-full p-8 gap-6">
      <p className="text-slate-400 uppercase tracking-widest text-xs font-semibold">Shot Stats</p>

      <div className="flex gap-4 flex-1">
        <StatCard
          icon="📏"
          label="Longest Drive"
          accent
          primary={
            longestDriveMeters !== null ? (
              <span className="text-5xl">{longestDriveMeters}m</span>
            ) : (
              <span className="text-slate-500 text-2xl">GPS pending</span>
            )
          }
          secondary={longestDriveTeam ?? undefined}
        />

        <StatCard
          icon="🏌️"
          label="Club of the Day"
          primary={
            clubOfDay !== null ? (
              <span className="text-3xl">{clubOfDay}</span>
            ) : (
              <span className="text-slate-500 text-2xl">—</span>
            )
          }
          secondary={clubOfDayPct !== null ? `${clubOfDayPct}% of scoring shots` : undefined}
        />

        <StatCard
          icon="🎯"
          label="Cleanest Round"
          primary={cleanPrimary}
          secondary={cleanSecondary}
        />
      </div>

      {/* OB tally for other teams */}
      {!allClean && cleanestTeams.length > 1 && (
        <div className="flex gap-4">
          {cleanestTeams.slice(1).map((t) => (
            <div
              key={t.teamName}
              className="flex-1 flex items-center justify-between rounded-lg bg-slate-800/50 px-4 py-2"
            >
              <span className="text-slate-400 text-sm truncate">{t.teamName}</span>
              <span className="text-slate-400 text-sm font-medium shrink-0 ml-2">
                {t.badShots} {t.badShots === 1 ? 'penalty' : 'penalties'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
