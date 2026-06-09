import type { ShotOutcome } from '@/lib/types';

interface ShotOutcomeButtonsProps {
  onOutcome: (outcome: ShotOutcome) => void;
  disabled?: boolean;
}

const OUTCOMES: Array<{
  outcome: ShotOutcome;
  label: string;
  className: string;
}> = [
  {
    outcome: 'in_play',
    label: 'In Play',
    className: 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-300',
  },
  {
    outcome: 'out_of_bounds',
    label: 'OOB',
    className: 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300',
  },
  {
    outcome: 'mulligan',
    label: 'Mulligan',
    className: 'bg-orange-500 hover:bg-orange-600 text-white disabled:bg-orange-300',
  },
  {
    outcome: 'sunk',
    label: 'Sunk!',
    className: 'bg-yellow-500 hover:bg-yellow-600 text-white disabled:bg-yellow-300',
  },
];

export function ShotOutcomeButtons({ onOutcome, disabled = false }: ShotOutcomeButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {OUTCOMES.map(({ outcome, label, className }) => (
        <button
          key={outcome}
          disabled={disabled}
          onClick={() => onOutcome(outcome)}
          className={`rounded-xl py-5 text-base font-bold shadow transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
