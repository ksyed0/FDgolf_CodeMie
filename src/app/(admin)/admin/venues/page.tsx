import { createClient } from '@/lib/supabase/server';
import { VenueManager } from './venue-manager';
import type { Venue } from '@/lib/types';

export default async function VenuesAdminPage() {
  const supabase = await createClient();
  const { data: venues } = await supabase.from('venues').select('*').order('name');
  return <VenueManager venues={(venues as Venue[]) ?? []} />;
}
