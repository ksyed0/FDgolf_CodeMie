import type {
  BirdieStats,
  MomentumEntry,
  HoleDifficulty,
  ShotStats,
  BestAchievement,
} from '@/lib/tv-stats';

interface TvStatsRotatorProps {
  activePanelIndex: 0 | 1 | 2;
  birdieStats: BirdieStats[];
  momentumStats: MomentumEntry[];
  holeDifficulty: HoleDifficulty[];
  shotStats: ShotStats;
  bestAchievement: BestAchievement | null;
}

export default function TvStatsRotator(_props: TvStatsRotatorProps) {
  return <div className="h-full" />;
}
