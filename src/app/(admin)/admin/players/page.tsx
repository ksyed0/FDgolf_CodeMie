import { createClient } from '@/lib/supabase/server';
import { PlayersTable } from './players-table';
import type { Player, Team } from '@/lib/types';

export default async function PlayersAdminPage() {
  const supabase = await createClient();

  const [{ data: players }, { data: teams }, { data: tournament }] = await Promise.all([
    supabase.from('players').select('*').order('name'),
    supabase.from('teams').select('id, team_number, team_name'),
    supabase
      .from('tournaments')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  ]);

  const tournamentId = tournament?.id ?? '';

  const { data: memberships } = tournamentId
    ? await supabase
        .from('tournament_players')
        .select('player_id, team_id')
        .eq('tournament_id', tournamentId)
    : { data: [] };

  const membershipMap: Record<string, string> = Object.fromEntries(
    ((memberships ?? []) as { player_id: string; team_id: string }[]).map((m) => [
      m.player_id,
      m.team_id,
    ])
  );

  return (
    <PlayersTable
      players={(players as Player[]) ?? []}
      teams={(teams as Pick<Team, 'id' | 'team_number' | 'team_name'>[]) ?? []}
      tournamentId={tournamentId}
      membershipMap={membershipMap}
    />
  );
}
