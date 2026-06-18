import type { ShotStats } from '@/lib/tv-stats';

interface TvShotStatsPanelProps {
  shotStats: ShotStats;
}

export default function TvShotStatsPanel({ shotStats }: TvShotStatsPanelProps) {
  const { longestDriveMeters, longestDriveTeam, clubOfDay, clubOfDayPct, cleanestTeams } =
    shotStats;

  // Determine if all teams are clean (zero bad shots)
  const allClean = cleanestTeams.length === 0 || cleanestTeams.every((t) => t.badShots === 0);

  return (
    <div className="flex flex-col h-full p-8">
      {/* Title */}
      <div className="text-slate-400 uppercase tracking-widest text-sm mb-8">Shot Stats</div>

      {/* Three equal-width stat cards */}
      <div className="flex gap-6 flex-1">
        {/* Card 1: Longest Drive */}
        <div className="bg-slate-800 rounded-2xl p-8 flex-1 flex flex-col">
          <div className="text-4xl">📏</div>
          <div className="text-6xl font-bold text-white mt-4">
            {longestDriveMeters !== null ? `${longestDriveMeters}m` : 'GPS pending'}
          </div>
          <div className="text-slate-400 text-lg mt-2">
            {longestDriveTeam !== null ? longestDriveTeam : '–'}
          </div>
        </div>

        {/* Card 2: Club of the Day */}
        <div className="bg-slate-800 rounded-2xl p-8 flex-1 flex flex-col">
          <div className="text-4xl">🏌️</div>
          <div className="text-5xl font-bold text-white mt-4">
            {clubOfDay !== null ? clubOfDay : '–'}
          </div>
          <div className="text-slate-400 text-lg mt-2">
            {clubOfDayPct !== null ? `${Math.round(clubOfDayPct)}% of scoring shots` : ''}
          </div>
        </div>

        {/* Card 3: Cleanest Teams */}
        <div className="bg-slate-800 rounded-2xl p-8 flex-1 flex flex-col">
          <div className="text-4xl">🚫</div>
          {allClean ? (
            <div className="text-green-400 text-xl mt-4 text-center">All teams playing clean!</div>
          ) : (
            <>
              {/* Top team */}
              <div className="text-3xl font-bold text-white mt-4">{cleanestTeams[0]?.teamName}</div>
              <div className="text-slate-400 text-lg mt-1">
                {cleanestTeams[0]?.badShots} OB / Water
              </div>

              {/* 2nd and 3rd place (if they exist) */}
              {(cleanestTeams[1] || cleanestTeams[2]) && (
                <div className="text-slate-500 text-sm mt-3 space-y-1">
                  {cleanestTeams[1] && (
                    <div>
                      {cleanestTeams[1].teamName} — {cleanestTeams[1].badShots}
                    </div>
                  )}
                  {cleanestTeams[2] && (
                    <div>
                      {cleanestTeams[2].teamName} — {cleanestTeams[2].badShots}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
