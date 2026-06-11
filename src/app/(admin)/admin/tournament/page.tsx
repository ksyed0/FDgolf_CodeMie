import { createClient } from '@/lib/supabase/server';
import type { Tournament, Venue, Course } from '@/lib/types';
import { TournamentManager } from './tournament-manager';

export type TournamentRow = Tournament & { venue_name: string; course_name: string };

export default async function TournamentAdminPage() {
  const supabase = await createClient();

  const [{ data: rawTournaments }, { data: venues }, { data: courses }] = await Promise.all([
    supabase
      .from('tournaments')
      .select('*, venue:venues!venue_id(name), course:courses!course_id(name)')
      .order('created_at', { ascending: false }),
    supabase.from('venues').select('*').order('name'),
    supabase.from('courses').select('*').order('name'),
  ]);

  const rows: TournamentRow[] = ((rawTournaments as (Tournament & {
    venue: { name: string } | null;
    course: { name: string } | null;
  })[]) ?? []).map((t) => ({
    ...t,
    venue_name: t.venue?.name ?? '',
    course_name: t.course?.name ?? '',
  }));

  return (
    <div className="max-w-4xl">
      <TournamentManager
        tournaments={rows}
        venues={(venues as Venue[]) ?? []}
        courses={(courses as Course[]) ?? []}
      />
    </div>
  );
}
