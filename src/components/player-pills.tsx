import type { Player } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PlayerPillsProps {
  players: Player[];
  activePlayerId: string | null;
  currentPlayerId?: string;
  onSelect: (id: string) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PlayerPills({
  players,
  activePlayerId,
  currentPlayerId,
  onSelect,
}: PlayerPillsProps) {
  return (
    <div className="flex gap-3">
      {players.map((player) => {
        const isActive = player.id === activePlayerId;
        const isCurrentUser = player.id === currentPlayerId;
        const initials = getInitials(player.name);
        const firstName = player.name.split(' ')[0];

        return (
          <button
            key={player.id}
            onClick={() => onSelect(player.id)}
            className="flex flex-col items-center gap-1.5 focus:outline-none"
          >
            <div
              className={cn(
                'flex items-center justify-center rounded-xl font-bold transition-colors',
                isActive ? 'text-white' : 'text-[#15241c]'
              )}
              style={{
                width: 56,
                height: 56,
                fontSize: 16,
                background: isActive ? '#1a472a' : '#fff',
                border: isActive ? 'none' : '1px solid #e2e8df',
                boxShadow: isActive ? 'none' : '0 2px 6px rgba(0,0,0,0.06)',
              }}
            >
              {initials}
            </div>
            <span
              className="text-center font-medium leading-none"
              style={{ fontSize: 11, color: isActive ? '#1a472a' : '#6b7a70' }}
            >
              {isCurrentUser ? 'You' : firstName}
            </span>
          </button>
        );
      })}
    </div>
  );
}
