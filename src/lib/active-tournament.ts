import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const ACTIVE_TOURNAMENT_COOKIE = 'x-active-tournament';

/**
 * Returns the active tournament id for the current admin request.
 *
 * Reads the `x-active-tournament` cookie when present (set by
 * `setActiveTournamentAction` or AdminLayout in older Next.js versions). When
 * the cookie is missing — which happens on the very first admin navigation in
 * Next.js 16 because Server Components cannot write cookies — falls back to
 * deriving the tournament from the user's role:
 *
 *   - `tournament_admin` → their single assignment (oldest first if many)
 *   - `system_admin`     → most recently created tournament
 *
 * This mirrors the in-memory selection AdminLayout makes when its own cookie
 * write throws, so admin pages keep working even when the cookie is never set.
 */
export async function getActiveTournamentId(): Promise<string | null> {
  const store = await cookies();
  const fromCookie = store.get(ACTIVE_TOURNAMENT_COOKIE)?.value;
  if (fromCookie) return fromCookie;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: player } = await supabase
    .from('players')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!player) return null;

  if (player.role === 'tournament_admin') {
    const { data } = await supabase
      .from('tournament_admin_assignments')
      .select('tournament_id')
      .eq('player_id', player.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return data?.tournament_id ?? null;
  }

  if (player.role === 'system_admin') {
    const { data } = await supabase
      .from('tournaments')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  }

  return null;
}
