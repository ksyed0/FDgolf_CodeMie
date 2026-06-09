'use client';

import type { Club, ClubCategory } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ClubSelectorProps {
  clubs: Club[];
  value: string;
  onChange: (name: string) => void;
}

const CATEGORY_LABELS: Record<ClubCategory, string> = {
  wood: 'Wood',
  hybrid: 'Hybrid',
  iron: 'Iron',
  wedge: 'Wedge',
  putter: 'Putter',
};

const CATEGORY_ORDER: ClubCategory[] = ['wood', 'hybrid', 'iron', 'wedge', 'putter'];

export function ClubSelector({ clubs, value, onChange }: ClubSelectorProps) {
  const active = clubs.filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order);

  const grouped = CATEGORY_ORDER.reduce<Record<ClubCategory, Club[]>>(
    (acc, cat) => {
      acc[cat] = active.filter((c) => c.category === cat);
      return acc;
    },
    { wood: [], hybrid: [], iron: [], wedge: [], putter: [] }
  );

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select club" />
      </SelectTrigger>
      <SelectContent>
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (items.length === 0) return null;
          return (
            <SelectGroup key={cat}>
              <SelectLabel>{CATEGORY_LABELS[cat]}</SelectLabel>
              {items.map((club) => (
                <SelectItem key={club.id} value={club.name}>
                  {club.name}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
