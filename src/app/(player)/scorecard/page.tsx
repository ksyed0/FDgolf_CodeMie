import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatVsPar } from '@/lib/scoring';
import { Card } from '@/components/ui/card';
import type { Score, Hole } from '@/lib/types';

export default async function ScorecardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: player } = await supabase
    .from('players')
    .select('id, name')
    .eq('auth_user_id', user.id)
    .single<{ id: string; name: string }>();
  if (!player) redirect('/login');

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single<{ id: string }>();

  if (!tournament) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500">
        No tournament found.
      </div>
    );
  }

  const [{ data: rawScores }, { data: rawHoles }] = await Promise.all([
    supabase
      .from('scores')
      .select('*')
      .eq('player_id', player.id)
      .eq('tournament_id', tournament.id)
      .order('hole_number'),
    supabase
      .from('holes')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('hole_number'),
  ]);

  const scores = (rawScores as Score[]) ?? [];
  const holes = (rawHoles as Hole[]) ?? [];
  const scoreMap = Object.fromEntries(scores.map((s) => [s.hole_number, s]));

  const totalStrokes = scores.reduce((sum, s) => sum + s.strokes, 0);
  const totalPar = holes
    .filter((h) => scoreMap[h.hole_number])
    .reduce((sum, h) => sum + h.par, 0);

  if (scores.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500">
        No scores recorded yet. Start your round to see your scorecard.
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Scorecard</h1>
      <p className="mb-4 text-sm text-gray-500">{player.name}</p>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1a472a] text-xs uppercase text-white">
                <th className="px-3 py-2 text-left">Hole</th>
                <th className="px-3 py-2 text-center">Par</th>
                <th className="px-3 py-2 text-center">Strokes</th>
                <th className="px-3 py-2 text-center">vs Par</th>
                <th className="px-3 py-2 text-center">Best Ball</th>
              </tr>
            </thead>
            <tbody>
              {holes.map((hole) => {
                const score = scoreMap[hole.hole_number];
                const vsPar = score ? score.strokes - hole.par : null;
                return (
                  <tr key={hole.hole_number} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{hole.hole_number}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{hole.par}</td>
                    <td className="px-3 py-2 text-center">
                      {score ? score.strokes : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {vsPar !== null ? (
                        <span className={
                          vsPar < 0 ? 'font-semibold text-green-600' :
                          vsPar > 0 ? 'font-semibold text-red-600' :
                          'text-gray-700'
                        }>
                          {formatVsPar(vsPar)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {score?.is_best_ball ? (
                        <span className="font-bold text-[#1a472a]">✓</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {scores.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-gray-50 font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-center">{totalPar}</td>
                  <td className="px-3 py-2 text-center">{totalStrokes}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={
                      totalStrokes - totalPar < 0 ? 'text-green-600' :
                      totalStrokes - totalPar > 0 ? 'text-red-600' :
                      'text-gray-700'
                    }>
                      {formatVsPar(totalStrokes - totalPar)}
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
