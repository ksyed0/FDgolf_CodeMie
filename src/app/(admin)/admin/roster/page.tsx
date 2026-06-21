import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveTournamentId } from '@/lib/active-tournament';
import { RosterManager } from './roster-manager';
import type { Team } from '@/lib/types';

export interface RosterPlayer {
  id: string;
  player_id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  team_id: string | null;
  team_name: string | null;
}

export default async function RosterPage() {
  const tournamentId = await getActiveTournamentId();
  if (!tournamentId) redirect('/admin/tournaments');

  const supabase = await createClient();

  const [{ data: memberships }, { data: teams }] = await Promise.all([
    supabase
      .from('tournament_players')
      .select(
        'id, player_id, team_id, players!player_id(name, email, company, title), teams!team_id(team_name)'
      )
      .eq('tournament_id', tournamentId),
    supabase
      .from('teams')
      .select('id, team_name, team_number')
      .eq('tournament_id', tournamentId)
      .order('team_number'),
  ]);

  const players: RosterPlayer[] = (memberships ?? []).map((m) => {
    const p = m.players as unknown as {
      name: string;
      email: string;
      company: string;
      title: string;
    } | null;
    const t = m.teams as unknown as { team_name: string } | null;
    return {
      id: m.id,
      player_id: m.player_id,
      name: p?.name ?? '',
      email: p?.email ?? '',
      company: p?.company ?? '',
      title: p?.title ?? '',
      team_id: m.team_id,
      team_name: t?.team_name ?? null,
    };
  });

  return (
    <RosterManager tournamentId={tournamentId} players={players} teams={(teams as Team[]) ?? []} />
  );
}
