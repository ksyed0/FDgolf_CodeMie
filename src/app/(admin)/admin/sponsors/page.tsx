import { createClient } from '@/lib/supabase/server';
import { getActiveTournamentId } from '@/lib/active-tournament';
import { SponsorsManager } from './sponsors-manager';
import type { Sponsor } from '@/lib/types';

export default async function SponsorsAdminPage() {
  const supabase = await createClient();

  const tournamentId = (await getActiveTournamentId()) ?? '';

  const { data: sponsors } = await supabase
    .from('sponsors')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('display_order');

  return <SponsorsManager sponsors={(sponsors as Sponsor[]) ?? []} tournamentId={tournamentId} />;
}
