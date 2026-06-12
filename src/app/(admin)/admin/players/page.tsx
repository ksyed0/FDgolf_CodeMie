import { createClient } from '@/lib/supabase/server';
import { PlayersTable } from './players-table';
import type { Player, Team } from '@/lib/types';

export default async function PlayersAdminPage() {
  const supabase = await createClient();

  const [{ data: players }, { data: teams }, { data: tournaments }] = await Promise.all([
    supabase.from('players').select('*').order('name'),
    supabase.from('teams').select('id, team_number, team_name'),
    supabase.from('tournaments').select('id').limit(1).single(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Players</h1>
      <div className="rounded-xl border bg-white shadow-sm">
        <PlayersTable
          players={(players as Player[]) ?? []}
          teams={(teams as Pick<Team, 'id' | 'team_number' | 'team_name'>[]) ?? []}
          tournamentId={tournaments?.id ?? ''}
        />
      </div>
    </div>
  );
}
