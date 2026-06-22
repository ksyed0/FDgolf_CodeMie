'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Users,
  UsersRound,
  Wrench,
  ClipboardList,
  Star,
  MapPin,
  Flag,
  UserCheck,
  ChevronDown,
} from 'lucide-react';
import { setActiveTournamentAction } from '@/lib/actions/set-active-tournament';
import type { PlayerRole } from '@/lib/types';

const GLOBAL_NAV = [
  { href: '/admin/tournaments', label: 'Tournaments', Icon: Trophy },
  { href: '/admin/players', label: 'Players', Icon: Users },
  { href: '/admin/venues', label: 'Venues', Icon: MapPin },
  { href: '/admin/courses', label: 'Courses', Icon: Flag },
  { href: '/admin/clubs', label: 'Clubs', Icon: Wrench },
];

const TOURNAMENT_NAV = [
  { href: '/admin/roster', label: 'Roster', Icon: Users },
  { href: '/admin/tournament', label: 'Tournament', Icon: Trophy },
  { href: '/admin/teams', label: 'Teams', Icon: UsersRound },
  { href: '/admin/scores', label: 'Scores', Icon: ClipboardList },
  { href: '/admin/sponsors', label: 'Sponsors', Icon: Star },
];

interface AdminSidebarProps {
  role: PlayerRole;
  activeTournament?: { id: string; name: string };
}

function NavItem({ href, label, Icon }: { href: string; label: string; Icon: React.ElementType }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
        active ? 'text-white' : 'text-[#bfe0c8] hover:text-white'
      )}
      style={active ? { background: 'rgba(255,255,255,0.14)' } : undefined}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function AdminSidebar({ role, activeTournament }: AdminSidebarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleTournamentChange = (tournamentId: string) => {
    startTransition(async () => {
      await setActiveTournamentAction(tournamentId);
      router.refresh();
    });
  };

  return (
    <aside className="flex h-full w-[212px] shrink-0 flex-col bg-[#1a472a] text-white">
      {/* Wordmark */}
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
            FDGOLF-CM
          </div>
          <div
            className="text-[10px] font-bold uppercase"
            style={{ letterSpacing: '0.18em', color: '#9fd6ad' }}
          >
            Admin
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-4 px-2 pb-4 overflow-y-auto">
        {/* Global section — system_admin only */}
        {role === 'system_admin' && (
          <div>
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#6fa87a]">
              Global
            </div>
            {GLOBAL_NAV.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        )}

        {/* This Tournament section */}
        <div>
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#6fa87a]">
            This Tournament
          </div>
          {activeTournament ? (
            <div className="px-3 py-1 mb-1 text-xs font-semibold text-[#9fd6ad] truncate flex items-center gap-1">
              <span className="truncate">{activeTournament.name}</span>
              {role === 'system_admin' && (
                <button
                  onClick={() => {
                    // Switcher: navigate to /admin/tournaments to change active tournament
                    router.push('/admin/tournaments');
                  }}
                  className="shrink-0 text-[#6fa87a] hover:text-white transition-colors"
                  title="Switch tournament"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="px-3 py-1 mb-1 text-xs text-[#6fa87a] italic">
              No tournament selected
            </div>
          )}
          {TOURNAMENT_NAV.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>
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
        <div className="text-[13px] font-semibold text-white mt-0.5">
          {role === 'system_admin' ? 'System Admin' : 'Tournament Admin'}
        </div>
      </div>
    </aside>
  );
}
