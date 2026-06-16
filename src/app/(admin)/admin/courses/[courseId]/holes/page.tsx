import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { HolesEditor } from '@/app/(admin)/admin/holes/holes-editor';
import { CourseHolesEditor } from './course-holes-editor';
import { HolesGeneratorPanel } from './holes-generator-panel';
import type { Hole, TeeBox, Course } from '@/lib/types';

export default async function CourseHolesPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, hole_count')
    .eq('id', courseId)
    .single<Pick<Course, 'id' | 'name' | 'hole_count'>>();

  const { data: holes } = await supabase
    .from('holes')
    .select('*')
    .eq('course_id', courseId)
    .order('hole_number');

  const holeIds = ((holes as Hole[]) ?? []).map((h) => h.id);
  const { data: teeBoxes } =
    holeIds.length > 0
      ? await supabase.from('tee_boxes').select('*').in('hole_id', holeIds)
      : { data: [] };

  // Build a yards map keyed by hole ID — picks the first tee box per hole (White first, then any)
  const yardsByHoleId: Record<string, number> = {};
  for (const hole of (holes as Hole[]) ?? []) {
    const boxes = ((teeBoxes as TeeBox[]) ?? []).filter((t) => t.hole_id === hole.id);
    const primary = boxes.find((t) => t.name.toLowerCase() === 'white') ?? boxes[0];
    if (primary) yardsByHoleId[hole.id] = primary.distance_yards;
  }

  const hasHoles = ((holes as Hole[]) ?? []).length > 0;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/courses" className="hover:underline">
          Courses
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{course?.name ?? 'Course'}</span>
        <span>/</span>
        <span>Holes</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">{course?.name} — Holes</h1>

      {!hasHoles && (
        <HolesGeneratorPanel courseId={courseId} holeCount={course?.hole_count ?? 18} />
      )}

      {hasHoles && (
        <>
          {/* Hole pin + par/handicap editor */}
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-700">
                Pin Locations &amp; Par / Handicap
              </h2>
            </div>
            <HolesEditor holes={(holes as Hole[]) ?? []} yardsByHoleId={yardsByHoleId} />
          </div>

          {/* Tee box editor */}
          <CourseHolesEditor
            holes={(holes as Hole[]) ?? []}
            teeBoxes={(teeBoxes as TeeBox[]) ?? []}
          />
        </>
      )}
    </div>
  );
}
