import type { Player } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PlayerPillsProps {
  players: Player[];
  activePlayerId: string | null;
  onSelect: (id: string) => void;
}

export function PlayerPills({ players, activePlayerId, onSelect }: PlayerPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {players.map((player) => {
        const isActive = player.id === activePlayerId;
        return (
          <button
            key={player.id}
            onClick={() => onSelect(player.id)}
            data-active={isActive ? 'true' : undefined}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'border-[#1a472a] bg-[#1a472a] text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-[#1a472a] hover:text-[#1a472a]'
            )}
          >
            {player.name.split(' ')[0]}
          </button>
        );
      })}
    </div>
  );
}
