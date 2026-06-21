import { createClient } from '@/lib/supabase/server';
import { TournamentsList } from './tournaments-list';

export default async function TournamentsPage() {
  const supabase = await createClient();

  const [{ data: tournaments }, { data: venues }, { data: courses }] = await Promise.all([
    supabase
      .from('tournaments')
      .select(
        `
        id, name, slug, date, status, format,
        venue:venues!venue_id(name),
        course:courses!course_id(name)
      `
      )
      .order('date', { ascending: false }),
    supabase.from('venues').select('id, name').order('name'),
    supabase.from('courses').select('id, name, venue_id').order('name'),
  ]);

  return (
    <TournamentsList
      tournaments={
        (tournaments ?? []) as unknown as Parameters<typeof TournamentsList>[0]['tournaments']
      }
      venues={venues ?? []}
      courses={courses ?? []}
    />
  );
}
