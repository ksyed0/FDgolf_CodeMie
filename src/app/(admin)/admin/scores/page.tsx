import { createClient } from '@/lib/supabase/server';
import { ScoresTable } from './scores-table';
import type { Score, Player, Team, Shot } from '@/lib/types';

export default async function ScoresAdminPage() {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const tid = tournament?.id ?? '';

  const [{ data: scores }, { data: players }, { data: teams }, { data: mulliganShots }] =
    await Promise.all([
      supabase.from('scores').select('*').eq('tournament_id', tid).order('hole_number'),
      supabase.from('players').select('id, name, team_id'),
      supabase.from('teams').select('id, team_number, team_name'),
      supabase
        .from('shots')
        .select('player_id, hole_number')
        .eq('tournament_id', tid)
        .eq('outcome', 'mulligan'),
    ]);

  const playerList =
    (players as (Pick<Player, 'id' | 'name'> & { team_id: string | null })[]) ?? [];
  const teamList = (teams as Pick<Team, 'id' | 'team_number' | 'team_name'>[]) ?? [];

  const playerMap = Object.fromEntries(playerList.map((p) => [p.id, p]));
  const teamMap = Object.fromEntries(
    teamList.map((t) => [t.id, t.team_name ?? `Team ${t.team_number}`])
  );

  // Group mulligans by player
  const mulligansByPlayer = (
    (mulliganShots as Pick<Shot, 'player_id' | 'hole_number'>[]) ?? []
  ).reduce<Record<string, number>>((acc, s) => {
    acc[s.player_id] = (acc[s.player_id] ?? 0) + 1;
    return acc;
  }, {});

  const mulliganRows = Object.entries(mulligansByPlayer)
    .map(([playerId, count]) => ({
      playerId,
      name: playerMap[playerId]?.name ?? 'Unknown',
      team: playerMap[playerId]?.team_id ? (teamMap[playerMap[playerId].team_id!] ?? '—') : '—',
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Scores</h1>
      <ScoresTable
        scores={(scores as Score[]) ?? []}
        players={playerList.map(({ id, name }) => ({ id, name }))}
        teams={teamList}
      />

      {/* Mulligan Report */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Mulligan Report</h2>
        {mulliganRows.length === 0 ? (
          <p className="text-sm text-gray-500">No mulligans recorded.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                  <th className="px-4 py-2 text-left">Player</th>
                  <th className="px-4 py-2 text-left">Team</th>
                  <th className="px-4 py-2 text-right">Mulligans</th>
                </tr>
              </thead>
              <tbody>
                {mulliganRows.map(({ playerId, name, team, count }) => (
                  <tr key={playerId} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{name}</td>
                    <td className="px-4 py-2 text-gray-600">{team}</td>
                    <td className="px-4 py-2 text-right font-semibold">{count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-gray-50 font-semibold">
                  <td className="px-4 py-2" colSpan={2}>
                    Total
                  </td>
                  <td className="px-4 py-2 text-right">
                    {mulliganRows.reduce((s, r) => s + r.count, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
