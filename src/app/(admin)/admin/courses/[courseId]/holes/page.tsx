import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { HolesEditor } from '@/app/(admin)/admin/holes/holes-editor';
import { CourseHolesEditor } from './course-holes-editor';
import type { Hole, TeeBox, Course } from '@/lib/types';

export default async function CourseHolesPage({
  params,
}: {
  params: { courseId: string };
}) {
  const supabase = await createClient();

  const { data: course } = await supabase
    .from('courses')
    .select('id, name')
    .eq('id', params.courseId)
    .single();

  const { data: holes } = await supabase
    .from('holes')
    .select('*')
    .eq('course_id', params.courseId)
    .order('hole_number');

  const holeIds = ((holes as Hole[]) ?? []).map((h) => h.id);
  const { data: teeBoxes } =
    holeIds.length > 0
      ? await supabase.from('tee_boxes').select('*').in('hole_id', holeIds)
      : { data: [] };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/courses" className="hover:underline">
          Courses
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">
          {(course as Pick<Course, 'name'> | null)?.name ?? 'Course'}
        </span>
        <span>/</span>
        <span>Holes</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">
        {(course as Pick<Course, 'name'> | null)?.name} — Holes
      </h1>

      {/* Hole pin + par/handicap editor */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Pin Locations &amp; Par / Handicap
          </h2>
        </div>
        <HolesEditor holes={(holes as Hole[]) ?? []} />
      </div>

      {/* Tee box editor */}
      <CourseHolesEditor
        holes={(holes as Hole[]) ?? []}
        teeBoxes={(teeBoxes as TeeBox[]) ?? []}
      />
    </div>
  );
}
