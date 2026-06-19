import type { ShotOutcome } from '@/lib/types';

interface ShotOutcomeButtonsProps {
  onOutcome: (outcome: ShotOutcome) => void;
  disabled?: boolean;
}

const OUTCOMES: Array<{
  outcome: ShotOutcome;
  label: string;
  bg: string;
  fg: string;
  border?: string;
}> = [
  { outcome: 'in_play', label: 'In Play', bg: '#1a472a', fg: '#fff' },
  {
    outcome: 'out_of_bounds',
    label: 'Out of Bounds',
    bg: '#f7ece9',
    fg: '#a8513f',
    border: '#f0c8bf',
  },
  { outcome: 'mulligan', label: 'Mulligan', bg: '#fbf1df', fg: '#b3741b', border: '#f0d99a' },
  { outcome: 'sunk', label: '⛳ Sunk', bg: '#f3e7c4', fg: '#5c4710', border: '#e8d28a' },
];

export function ShotOutcomeButtons({ onOutcome, disabled = false }: ShotOutcomeButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {OUTCOMES.map(({ outcome, label, bg, fg, border }) => (
        <button
          key={outcome}
          disabled={disabled}
          onClick={() => onOutcome(outcome)}
          className="rounded-2xl font-bold transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: bg,
            color: fg,
            border: border ? `1px solid ${border}` : 'none',
            minHeight: 56,
            fontSize: 15,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
