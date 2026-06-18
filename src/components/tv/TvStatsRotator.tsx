import type {
  BirdieStats,
  MomentumEntry,
  HoleDifficulty,
  ShotStats,
  BestAchievement,
} from '@/lib/tv-stats';
import TvBirdiesPanel from './panels/TvBirdiesPanel';
import TvHoleMapPanel from './panels/TvHoleMapPanel';
import TvShotStatsPanel from './panels/TvShotStatsPanel';

interface TvStatsRotatorProps {
  activePanelIndex: 0 | 1 | 2;
  birdieStats: BirdieStats[];
  momentumStats: MomentumEntry[];
  holeDifficulty: HoleDifficulty[];
  shotStats: ShotStats;
  bestAchievement: BestAchievement | null;
}

export default function TvStatsRotator({
  activePanelIndex,
  birdieStats,
  momentumStats,
  holeDifficulty,
  shotStats,
  bestAchievement,
}: TvStatsRotatorProps) {
  const visibilityClass = (index: number) =>
    index === activePanelIndex ? 'opacity-100' : 'opacity-0';

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${visibilityClass(0)}`}>
        <TvBirdiesPanel birdieStats={birdieStats} momentumStats={momentumStats} />
      </div>

      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${visibilityClass(1)}`}>
        <TvHoleMapPanel holeDifficulty={holeDifficulty} bestAchievement={bestAchievement} />
      </div>

      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${visibilityClass(2)}`}>
        <TvShotStatsPanel shotStats={shotStats} />
      </div>
    </div>
  );
}
