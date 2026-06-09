import { createClient } from '@/lib/supabase/server';
import { HolesEditor } from './holes-editor';
import type { Hole } from '@/lib/types';

export default async function HolesAdminPage() {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { data: holes } = await supabase
    .from('holes')
    .select('*')
    .eq('tournament_id', tournament?.id ?? '')
    .order('hole_number');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Holes</h1>
      <div className="rounded-xl border bg-white shadow-sm">
        <HolesEditor holes={(holes as Hole[]) ?? []} />
      </div>
    </div>
  );
}
