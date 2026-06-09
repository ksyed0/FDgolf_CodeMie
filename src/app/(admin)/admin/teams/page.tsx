import { createClient } from '@/lib/supabase/server';
import { TeamsManager } from './teams-manager';
import type { Team, Player } from '@/lib/types';

export default async function TeamsAdminPage() {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const [{ data: teams }, { data: players }] = await Promise.all([
    supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', tournament?.id ?? '')
      .order('team_number'),
    supabase.from('players').select('*').order('name'),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
      <TeamsManager teams={(teams as Team[]) ?? []} players={(players as Player[]) ?? []} />
    </div>
  );
}
