import { createClient } from '@/lib/supabase/server';
import { SponsorsManager } from './sponsors-manager';
import type { Sponsor } from '@/lib/types';

export default async function SponsorsAdminPage() {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { data: sponsors } = await supabase
    .from('sponsors')
    .select('*')
    .eq('tournament_id', tournament?.id ?? '')
    .order('display_order');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Sponsors</h1>
      <SponsorsManager
        sponsors={(sponsors as Sponsor[]) ?? []}
        tournamentId={tournament?.id ?? ''}
      />
    </div>
  );
}
