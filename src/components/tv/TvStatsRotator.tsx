import type {
  BirdieStats,
  MomentumEntry,
  HoleDifficulty,
  ShotStats,
  BestAchievement,
  TeamSpotlight,
} from '@/lib/tv-stats';
import type { LeaderboardRow } from '@/lib/types';
import TvBirdiesPanel from './panels/TvBirdiesPanel';
import TvHoleDifficultyPanel from './panels/TvHoleDifficultyPanel';
import TvShotStatsPanel from './panels/TvShotStatsPanel';
import TvMomentOfDayPanel from './panels/TvMomentOfDayPanel';
import TvTeamSpotlightPanel from './panels/TvTeamSpotlightPanel';

interface TvStatsRotatorProps {
  activePanelIndex: 0 | 1 | 2 | 3 | 4;
  birdieStats: BirdieStats[];
  momentumStats: MomentumEntry[];
  holeDifficulty: HoleDifficulty[];
  shotStats: ShotStats;
  bestAchievement: BestAchievement | null;
  teamSpotlight: TeamSpotlight | null;
  leaderboard?: LeaderboardRow[];
}

export default function TvStatsRotator({
  activePanelIndex,
  birdieStats,
  momentumStats,
  holeDifficulty,
  shotStats,
  bestAchievement,
  teamSpotlight,
  leaderboard = [],
}: TvStatsRotatorProps) {
  const vis = (i: number) =>
    i === activePanelIndex ? 'opacity-100' : 'opacity-0 pointer-events-none';

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: '#fff' }}>
      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${vis(0)}`}>
        <TvBirdiesPanel birdieStats={birdieStats} momentumStats={momentumStats} />
      </div>
      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${vis(1)}`}>
        <TvHoleDifficultyPanel holeDifficulty={holeDifficulty} />
      </div>
      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${vis(2)}`}>
        <TvShotStatsPanel shotStats={shotStats} />
      </div>
      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${vis(3)}`}>
        <TvMomentOfDayPanel bestAchievement={bestAchievement} />
      </div>
      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${vis(4)}`}>
        <TvTeamSpotlightPanel teamSpotlight={teamSpotlight} leaderboard={leaderboard} />
      </div>
    </div>
  );
}
