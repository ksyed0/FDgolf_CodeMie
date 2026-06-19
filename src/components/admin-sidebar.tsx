'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Trophy, Users, UsersRound, Wrench, ClipboardList, Star, MapPin, Flag } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin/tournament', label: 'Tournament', Icon: Trophy },
  { href: '/admin/venues', label: 'Venues', Icon: MapPin },
  { href: '/admin/courses', label: 'Courses', Icon: Flag },
  { href: '/admin/players', label: 'Players', Icon: Users },
  { href: '/admin/teams', label: 'Teams', Icon: UsersRound },
  { href: '/admin/clubs', label: 'Clubs', Icon: Wrench },
  { href: '/admin/scores', label: 'Scores', Icon: ClipboardList },
  { href: '/admin/sponsors', label: 'Sponsors', Icon: Star },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[212px] shrink-0 flex-col bg-[#1a472a] text-white">
      <div className="px-4 py-5 flex items-center gap-3">
        <div
          className="flex items-center justify-center rounded-lg text-lg"
          style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.15)' }}
        >
          ⛳
        </div>
        <div>
          <div
            className="font-barlow font-extrabold text-white"
            style={{ fontSize: 18, letterSpacing: '0.04em' }}
          >
            FDGOLF
          </div>
          <div
            className="text-[10px] font-bold uppercase"
            style={{ letterSpacing: '0.18em', color: '#9fd6ad' }}
          >
            Admin
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-2 pb-4">
        {NAV_ITEMS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'text-white'
                : 'text-[#bfe0c8] hover:text-white'
            )}
            style={
              pathname === href || pathname.startsWith(href + '/')
                ? { background: 'rgba(255,255,255,0.14)' }
                : undefined
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      {/* Signed-in card */}
      <div
        className="mx-2 mb-3 rounded-xl px-3 py-3"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      >
        <div
          className="text-[11px] font-bold uppercase"
          style={{ letterSpacing: '0.12em', color: '#9fd6ad' }}
        >
          Signed In
        </div>
        <div className="text-sm font-semibold text-white mt-0.5">Tournament Director</div>
      </div>
    </aside>
  );
}
