import type { SupabaseClient } from '@supabase/supabase-js';

export interface PlayerMembership {
  tournamentId: string;
  teamId: string;
}

// Resolves the tournament a player is actually rostered on and that is
// currently active/paused — not just "whatever tournament exists" — so
// multiple tournaments sharing a player account (e.g. demo seeds reusing
// the same demo-captain account) never collide with each other.
export async function getActivePlayerMembership(
  supabase: SupabaseClient,
  playerId: string
): Promise<PlayerMembership | null> {
  const { data } = await supabase
    .from('tournament_players')
    .select('tournament_id, team_id, tournaments!inner(status, created_at)')
    .eq('player_id', playerId)
    .in('tournaments.status', ['active', 'paused']);

  if (!data || data.length === 0) return null;

  const rows = data as unknown as Array<{
    tournament_id: string;
    team_id: string;
    tournaments: { status: string; created_at: string };
  }>;

  rows.sort(
    (a, b) =>
      new Date(b.tournaments.created_at).getTime() - new Date(a.tournaments.created_at).getTime()
  );

  return { tournamentId: rows[0].tournament_id, teamId: rows[0].team_id };
}
