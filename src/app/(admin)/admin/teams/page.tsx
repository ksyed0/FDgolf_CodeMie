import { createClient } from '@/lib/supabase/server';
import { getActiveTournamentId } from '@/lib/active-tournament';
import { TeamsManager } from './teams-manager';
import type { Team, Player } from '@/lib/types';

export default async function TeamsAdminPage() {
  const supabase = await createClient();

  const tournamentId = (await getActiveTournamentId()) ?? '';

  const [{ data: teams }, { data: players }, { data: memberships }] = await Promise.all([
    supabase.from('teams').select('*').eq('tournament_id', tournamentId).order('team_number'),
    supabase.from('players').select('*').order('name'),
    tournamentId
      ? supabase
          .from('tournament_players')
          .select('player_id, team_id')
          .eq('tournament_id', tournamentId)
      : Promise.resolve({ data: [] as { player_id: string; team_id: string }[] }),
  ]);

  return (
    <TeamsManager
      teams={(teams as Team[]) ?? []}
      players={(players as Player[]) ?? []}
      tournamentId={tournamentId}
      memberships={(memberships ?? []) as { player_id: string; team_id: string }[]}
    />
  );
}
