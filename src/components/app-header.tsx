import Link from 'next/link';
import { Trophy } from 'lucide-react';

interface HoleInfo {
  holeNumber: number;
  par: number;
  handicap: number;
}

interface AppHeaderProps {
  variant?: 'full' | 'compact';
  holeInfo?: HoleInfo;
  showAvatar?: boolean;
  userName?: string;
  showLive?: boolean;
}

export function AppHeader({
  variant = 'full',
  holeInfo,
  showAvatar = false,
  userName,
  showLive = false,
}: AppHeaderProps) {
  if (variant === 'compact') {
    return (
      <header className="sticky top-0 z-40 flex items-center justify-between bg-[#1a472a] px-3 py-2 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight text-white">FDgolf</span>
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        </div>
        {holeInfo && (
          <div className="flex items-center gap-3 text-white">
            <span className="text-sm font-semibold">Hole {holeInfo.holeNumber}</span>
            <span className="text-xs text-green-300">Par {holeInfo.par}</span>
            <span className="text-xs text-green-300">HCP {holeInfo.handicap}</span>
          </div>
        )}
        {showAvatar && userName && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-700 text-xs font-bold text-white">
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between bg-[#1a472a] px-4 py-3 shadow-md">
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold tracking-tight text-white">FDgolf</span>
        <span className="rounded-full bg-green-800 px-2 py-0.5 text-[10px] font-semibold text-green-300">
          AI/Run™
        </span>
      </div>
      <div className="flex items-center gap-3">
        {showLive && (
          <Link href="/live" className="text-sm text-green-300 hover:text-white">
            Live
          </Link>
        )}
        <Link href="/leaderboard" className="text-white hover:text-green-300">
          <Trophy className="h-5 w-5" />
        </Link>
        {showAvatar && userName && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-700 text-sm font-bold text-white">
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
}
