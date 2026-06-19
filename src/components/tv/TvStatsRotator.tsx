import type {
  BirdieStats,
  MomentumEntry,
  HoleDifficulty,
  ShotStats,
  TeamSpotlight,
} from '@/lib/tv-stats';
import TvBirdiesPanel from './panels/TvBirdiesPanel';
import TvHoleDifficultyPanel from './panels/TvHoleDifficultyPanel';
import TvShotStatsPanel from './panels/TvShotStatsPanel';

interface TvStatsRotatorProps {
  activePanelIndex: 0 | 1 | 2 | 3 | 4;
  birdieStats: BirdieStats[];
  momentumStats: MomentumEntry[];
  holeDifficulty: HoleDifficulty[];
  shotStats: ShotStats;
  teamSpotlight: TeamSpotlight | null;
}

export default function TvStatsRotator({
  activePanelIndex,
  birdieStats,
  momentumStats,
  holeDifficulty,
  shotStats,
  teamSpotlight,
}: TvStatsRotatorProps) {
  const visibilityClass = (index: number) =>
    index === activePanelIndex ? 'opacity-100' : 'opacity-0';

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${visibilityClass(0)}`}>
        <TvBirdiesPanel birdieStats={birdieStats} momentumStats={momentumStats} />
      </div>

      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${visibilityClass(1)}`}>
        <TvHoleDifficultyPanel holeDifficulty={holeDifficulty} />
      </div>

      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${visibilityClass(2)}`}>
        <TvShotStatsPanel shotStats={shotStats} />
      </div>

      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${visibilityClass(3)}`}>
        <div
          className="h-full w-full flex items-center justify-center"
          style={{ background: '#fff' }}
        >
          <span style={{ color: '#999' }}>Moment of Day (Coming Soon)</span>
        </div>
      </div>

      <div className={`absolute inset-0 transition-opacity duration-[400ms] ${visibilityClass(4)}`}>
        {teamSpotlight ? (
          <div className="h-full w-full p-7" style={{ background: '#fff' }}>
            <div
              className="font-barlow font-bold"
              style={{ fontSize: 46, lineHeight: 1.05, color: '#15241c' }}
            >
              {teamSpotlight.teamName}
            </div>
            <span style={{ fontSize: 14, color: '#666' }}>
              {teamSpotlight.score} ({teamSpotlight.holesCompleted} holes)
            </span>
          </div>
        ) : (
          <div
            className="h-full w-full flex items-center justify-center"
            style={{ background: '#fff' }}
          >
            <span style={{ color: '#999' }}>Team Spotlight</span>
          </div>
        )}
      </div>
    </div>
  );
}
