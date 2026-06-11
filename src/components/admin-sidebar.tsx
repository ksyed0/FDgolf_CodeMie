'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Users,
  UsersRound,
  Disc,
  Wrench,
  ClipboardList,
  Star,
  MapPin,
  Flag,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin/tournament', label: 'Tournament', Icon: Trophy },
  { href: '/admin/venues', label: 'Venues', Icon: MapPin },
  { href: '/admin/courses', label: 'Courses', Icon: Flag },
  { href: '/admin/players', label: 'Players', Icon: Users },
  { href: '/admin/teams', label: 'Teams', Icon: UsersRound },
  { href: '/admin/holes', label: 'Holes', Icon: Disc },
  { href: '/admin/clubs', label: 'Clubs', Icon: Wrench },
  { href: '/admin/scores', label: 'Scores', Icon: ClipboardList },
  { href: '/admin/sponsors', label: 'Sponsors', Icon: Star },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-48 shrink-0 flex-col bg-[#1a472a] text-white">
      <div className="px-4 py-4">
        <span className="text-lg font-bold">FDgolf</span>
        <span className="ml-1 text-xs text-green-400">Admin</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-2 pb-4">
        {NAV_ITEMS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-green-700 text-white'
                : 'text-green-200 hover:bg-green-800 hover:text-white'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
