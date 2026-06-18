import type { HoleDifficulty, BestAchievement } from '@/lib/tv-stats';

interface TvHoleMapPanelProps {
  holeDifficulty: HoleDifficulty[];
  bestAchievement: BestAchievement | null;
}

// Stub — full implementation in Task 6
export default function TvHoleMapPanel(_props: TvHoleMapPanelProps) {
  return <div className="h-full w-full" />;
}
