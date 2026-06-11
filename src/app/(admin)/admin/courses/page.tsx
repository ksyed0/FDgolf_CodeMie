import { createClient } from '@/lib/supabase/server';
import { CourseManager } from './course-manager';
import type { Course, Venue } from '@/lib/types';

export default async function CoursesAdminPage() {
  const supabase = await createClient();
  const [courseResult, { data: venues }] = await Promise.all([
    supabase.from('courses').select('*, venue:venues!venue_id(name)').order('name'),
    supabase.from('venues').select('*').order('name'),
  ]);

  type CourseWithVenue = Course & { venue: { name: string } | null };
  const courses = (courseResult.data ?? []) as CourseWithVenue[];

  const rows = courses.map((c) => ({
    ...c,
    venue_name: c.venue?.name ?? '',
  }));

  return (
    <div className="max-w-4xl">
      <CourseManager courses={rows} venues={(venues as Venue[]) ?? []} />
    </div>
  );
}
