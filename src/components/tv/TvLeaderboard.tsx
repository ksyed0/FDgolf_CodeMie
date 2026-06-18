import type { LeaderboardRow } from '@/components/leaderboard-table';

interface TvLeaderboardProps {
  leaderboard: LeaderboardRow[];
}

export default function TvLeaderboard({ leaderboard: _ }: TvLeaderboardProps) {
  return <div className="h-full bg-slate-900/50 p-4 text-white">Leaderboard</div>;
}
