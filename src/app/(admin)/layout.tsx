import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { AdminSidebar } from '@/components/admin-sidebar';
import { ACTIVE_TOURNAMENT_COOKIE } from '@/lib/active-tournament';
import type { PlayerRole } from '@/lib/types';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: player } = await supabase
    .from('players')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (!player || (player.role !== 'system_admin' && player.role !== 'tournament_admin')) {
    redirect('/dashboard');
  }

  const role = player.role as PlayerRole;
  let activeTournament: { id: string; name: string } | undefined;

  if (role === 'tournament_admin') {
    const { data: assignments } = await supabase
      .from('tournament_admin_assignments')
      .select('tournament_id, tournaments!tournament_id(id, name)')
      .eq('player_id', player.id);

    const list = (assignments ?? [])
      .map((a) => {
        const t = a.tournaments as unknown as { id: string; name: string } | null;
        return t ? { id: t.id, name: t.name } : null;
      })
      .filter(Boolean) as { id: string; name: string }[];

    if (list.length === 0) redirect('/dashboard');

    if (list.length >= 2) redirect('/admin/select-tournament');

    // Single assignment — try to set the cookie and proceed. Next.js 16 forbids
    // cookie writes from Server Components; swallow the error and render with
    // `activeTournament` in memory. `getActiveTournamentId()` derives the same
    // assignment for downstream pages when the cookie is missing.
    try {
      const store = await cookies();
      store.set(ACTIVE_TOURNAMENT_COOKIE, list[0].id, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });
    } catch {
      // see comment above
    }
    activeTournament = list[0];
  } else {
    // system_admin — read active tournament from cookie (may be null)
    const store = await cookies();
    const tid = store.get(ACTIVE_TOURNAMENT_COOKIE)?.value;
    if (tid) {
      const { data: t } = await supabase
        .from('tournaments')
        .select('id, name')
        .eq('id', tid)
        .single();
      if (t) activeTournament = { id: t.id, name: t.name };
    }
    // If no cookie set yet, pick the most recent tournament
    if (!activeTournament) {
      const { data: t } = await supabase
        .from('tournaments')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (t) {
        activeTournament = { id: t.id, name: t.name };
        try {
          const store = await cookies();
          store.set(ACTIVE_TOURNAMENT_COOKIE, t.id, {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
          });
        } catch {
          // Next.js 16 forbids cookie writes from Server Components. The cookie
          // will be set on the next navigation that hits a Server Action or
          // Route Handler — the layout still renders with `activeTournament`
          // in memory, so the user sees the right tournament this render.
        }
      }
    }
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar role={role} activeTournament={activeTournament} />
      <main className="flex-1 overflow-auto bg-[#f4f7f1]">{children}</main>
    </div>
  );
}
