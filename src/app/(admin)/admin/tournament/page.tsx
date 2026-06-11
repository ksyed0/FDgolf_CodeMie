import { createClient } from '@/lib/supabase/server';
import type { Tournament } from '@/lib/types';
import { TournamentManager, type TournamentRow } from './tournament-manager';

export default async function TournamentAdminPage() {
  const supabase = await createClient();

  const [{ data: tournaments }, { data: holeRows }] = await Promise.all([
    supabase.from('tournaments').select('*').order('created_at', { ascending: false }),
    supabase.from('holes').select('tournament_id'),
  ]);

  const holeCountMap = (holeRows ?? []).reduce<Record<string, number>>((acc, h) => {
    acc[h.tournament_id] = (acc[h.tournament_id] ?? 0) + 1;
    return acc;
  }, {});

  const rows: TournamentRow[] = ((tournaments as Tournament[]) ?? []).map((t) => ({
    ...t,
    hole_count: holeCountMap[t.id] ?? 0,
  }));

  return (
    <div className="max-w-4xl">
      <TournamentManager tournaments={rows} />
    </div>
  );
}
