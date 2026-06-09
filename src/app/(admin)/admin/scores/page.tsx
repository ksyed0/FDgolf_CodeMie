import { createClient } from '@/lib/supabase/server';
import { ScoresTable } from './scores-table';
import type { Score, Player, Team } from '@/lib/types';

export default async function ScoresAdminPage() {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const [{ data: scores }, { data: players }, { data: teams }] = await Promise.all([
    supabase
      .from('scores')
      .select('*')
      .eq('tournament_id', tournament?.id ?? '')
      .order('hole_number'),
    supabase.from('players').select('id, name'),
    supabase.from('teams').select('id, team_number, team_name'),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Scores</h1>
      <ScoresTable
        scores={(scores as Score[]) ?? []}
        players={(players as Pick<Player, 'id' | 'name'>[]) ?? []}
        teams={(teams as Pick<Team, 'id' | 'team_number' | 'team_name'>[]) ?? []}
      />
    </div>
  );
}
