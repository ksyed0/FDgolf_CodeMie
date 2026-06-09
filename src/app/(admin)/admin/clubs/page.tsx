import { createClient } from '@/lib/supabase/server';
import { ClubsManager } from './clubs-manager';
import type { Club } from '@/lib/types';

export default async function ClubsAdminPage() {
  const supabase = await createClient();
  const { data: clubs } = await supabase.from('clubs').select('*').order('sort_order');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Clubs</h1>
      <div className="rounded-xl border bg-white shadow-sm">
        <ClubsManager clubs={(clubs as Club[]) ?? []} />
      </div>
    </div>
  );
}
