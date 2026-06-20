import { createClient } from '@/lib/supabase/server';
import { ClubsManager } from './clubs-manager';
import type { Club } from '@/lib/types';

export default async function ClubsAdminPage() {
  const supabase = await createClient();
  const { data: clubs } = await supabase.from('clubs').select('*').order('sort_order');

  return <ClubsManager clubs={(clubs as Club[]) ?? []} />;
}
