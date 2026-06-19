import { createClient } from '@/lib/supabase/server';
import { CourseManager } from './course-manager';
import type { Course, Venue, Hole } from '@/lib/types';

export default async function CoursesAdminPage() {
  const supabase = await createClient();
  const [courseResult, { data: venues }, { data: holesData }] = await Promise.all([
    supabase.from('courses').select('*, venue:venues!venue_id(name)').order('name'),
    supabase.from('venues').select('*').order('name'),
    supabase.from('holes').select('*').order('hole_number'),
  ]);

  type CourseWithVenue = Course & { venue: { name: string } | null };
  const courses = (courseResult.data ?? []) as CourseWithVenue[];

  const rows = courses.map((c) => ({
    ...c,
    venue_name: c.venue?.name ?? '',
  }));

  // Group holes by course_id
  const holesByCourseId: Record<string, Hole[]> = {};
  for (const hole of (holesData ?? []) as Hole[]) {
    if (!holesByCourseId[hole.course_id]) {
      holesByCourseId[hole.course_id] = [];
    }
    holesByCourseId[hole.course_id].push(hole);
  }

  return (
    <div>
      <CourseManager
        courses={rows}
        venues={(venues as Venue[]) ?? []}
        holesByCourseId={holesByCourseId}
      />
    </div>
  );
}
