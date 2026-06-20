'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { AdminTopBar } from '@/components/admin-top-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Course, Venue, Hole } from '@/lib/types';

export type CourseRow = Course & { venue_name: string };

type CourseForm = {
  venueId: string;
  name: string;
  holeCount: '9' | '18';
  parTotal: string;
  courseRating: string;
  slopeRating: string;
};

const EMPTY_FORM: CourseForm = {
  venueId: '',
  name: '',
  holeCount: '18',
  parTotal: '72',
  courseRating: '',
  slopeRating: '',
};

interface CourseManagerProps {
  courses: CourseRow[];
  venues: Venue[];
  holesByCourseId: Record<string, Hole[]>;
}

export function CourseManager({ courses: initial, venues, holesByCourseId }: CourseManagerProps) {
  const [courses, setCourses] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [venueFilter, setVenueFilter] = useState<string>('__all__');
  const supabase = createClient();

  function startEdit(c: CourseRow) {
    setEditingId(c.id);
    setShowAdd(false);
    setForm({
      venueId: c.venue_id,
      name: c.name,
      holeCount: c.hole_count === 9 ? '9' : '18',
      parTotal: String(c.par_total),
      courseRating: c.course_rating !== null ? String(c.course_rating) : '',
      slopeRating: c.slope_rating !== null ? String(c.slope_rating) : '',
    });
  }

  function cancel() {
    setEditingId(null);
    setShowAdd(false);
    setForm(EMPTY_FORM);
  }

  async function save() {
    if (!form.venueId) {
      toast.error('Select a venue.');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Course name is required.');
      return;
    }
    const parNum = parseInt(form.parTotal, 10);
    if (isNaN(parNum) || parNum < 27) {
      toast.error('Par total must be a number ≥ 27.');
      return;
    }
    setSaving(true);

    const payload = {
      venue_id: form.venueId,
      name: form.name.trim(),
      hole_count: parseInt(form.holeCount, 10),
      par_total: parNum,
      course_rating: form.courseRating ? parseFloat(form.courseRating) : null,
      slope_rating: form.slopeRating ? parseInt(form.slopeRating, 10) : null,
    };

    if (editingId) {
      const { data, error } = await supabase
        .from('courses')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single();
      if (error) {
        toast.error(error.message);
      } else {
        const venueName = venues.find((v) => v.id === form.venueId)?.name ?? '';
        setCourses((cs) =>
          cs.map((c) => (c.id === editingId ? { ...(data as Course), venue_name: venueName } : c))
        );
        toast.success('Course updated.');
        cancel();
      }
    } else {
      const { data, error } = await supabase.from('courses').insert(payload).select().single();
      if (error) {
        toast.error(error.message);
      } else {
        const venueName = venues.find((v) => v.id === form.venueId)?.name ?? '';
        setCourses((cs) => [...cs, { ...(data as Course), venue_name: venueName }]);
        toast.success('Course added.');
        cancel();
      }
    }
    setSaving(false);
  }

  async function deleteCourse(id: string) {
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      setCourses((cs) => cs.filter((c) => c.id !== id));
      toast.success('Course deleted.');
    }
    setConfirmDelete(null);
  }

  const FormPanel = (
    <div className="grid grid-cols-2 gap-3 rounded-xl border bg-white p-4 shadow-sm">
      {/* Venue */}
      <div className="col-span-2 flex flex-col gap-1">
        <Label className="text-xs text-gray-500">Venue *</Label>
        <Select
          value={form.venueId || '__none__'}
          onValueChange={(v) => setForm((f) => ({ ...f, venueId: v === '__none__' ? '' : v }))}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select venue…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Select venue…</SelectItem>
            {venues.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Course name */}
      <div className="col-span-2 flex flex-col gap-1">
        <Label className="text-xs text-gray-500">Course name *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="h-8 text-sm"
          placeholder="e.g. Main Course"
        />
      </div>

      {/* Hole count */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-500">Holes</Label>
        <Select
          value={form.holeCount}
          onValueChange={(v) => setForm((f) => ({ ...f, holeCount: v as '9' | '18' }))}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="18">18</SelectItem>
            <SelectItem value="9">9</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Par total */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-500">Par total</Label>
        <Input
          type="number"
          value={form.parTotal}
          onChange={(e) => setForm((f) => ({ ...f, parTotal: e.target.value }))}
          className="h-8 text-sm"
          min={27}
          max={90}
        />
      </div>

      {/* Course rating */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-500">Course rating</Label>
        <Input
          type="number"
          step="0.1"
          value={form.courseRating}
          onChange={(e) => setForm((f) => ({ ...f, courseRating: e.target.value }))}
          className="h-8 text-sm"
          placeholder="e.g. 71.3"
        />
      </div>

      {/* Slope rating */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-500">Slope rating</Label>
        <Input
          type="number"
          value={form.slopeRating}
          onChange={(e) => setForm((f) => ({ ...f, slopeRating: e.target.value }))}
          className="h-8 text-sm"
          placeholder="e.g. 128"
        />
      </div>

      <div className="col-span-2 flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={cancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={save}
          disabled={saving}
          className="bg-[#1a472a] hover:bg-[#143820]"
        >
          {saving ? 'Saving…' : editingId ? 'Update Course' : 'Add Course'}
        </Button>
      </div>
    </div>
  );

  const filteredCourses =
    venueFilter === '__all__' ? courses : courses.filter((c) => c.venue_id === venueFilter);

  return (
    <div>
      <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Courses">
        {/* Venue filter dropdown */}
        <select
          value={venueFilter}
          onChange={(e) => setVenueFilter(e.target.value)}
          className="rounded-[10px] border border-[#d6ddd2] px-3 py-1.5 text-[14px] bg-white text-[#15241c]"
        >
          <option value="__all__">All venues</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        {!showAdd && !editingId && (
          <button
            onClick={() => {
              setShowAdd(true);
              setForm(EMPTY_FORM);
            }}
            className="rounded-[10px] px-3 py-1.5 text-[14px] font-semibold bg-[#1a472a] text-white hover:bg-[#143820]"
          >
            + Add Course
          </button>
        )}
      </AdminTopBar>

      <div className="px-7 py-6 flex flex-col gap-5">
        {showAdd && <div>{FormPanel}</div>}

        {filteredCourses.length === 0 && !showAdd && (
          <p className="text-center text-sm text-[#90a094] py-10">
            No courses yet — add one above.
          </p>
        )}

        {filteredCourses.map((course) => {
          const holes = holesByCourseId[course.id] ?? [];
          const front9 = holes.filter((h) => h.hole_number <= 9);
          const back9 = holes.filter((h) => h.hole_number >= 10);
          const gpsCount = holes.filter((h) => h.pin_lat !== 0 && h.pin_lng !== 0).length;
          const totalHoles = course.hole_count;

          return (
            <div
              key={course.id}
              className="bg-white rounded-2xl border border-[#e2e8df] overflow-hidden"
            >
              {/* Course header row */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8eee4]">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-[17px] text-[#15241c]">{course.name}</span>
                  <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#e9f3ec] text-[#1a472a]">
                    {totalHoles} holes
                  </span>
                  <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#eef2ea] text-[#46554c]">
                    Par {course.par_total}
                  </span>
                  <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#fbf1df] text-[#b3741b]">
                    GPS: {gpsCount}/{totalHoles}
                  </span>
                  {course.venue_name && (
                    <span className="text-[12px] text-[#90a094]">{course.venue_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {confirmDelete === course.id ? (
                    <span className="flex items-center gap-2 text-xs">
                      Delete?{' '}
                      <button
                        onClick={() => deleteCourse(course.id)}
                        className="font-medium text-red-600 hover:underline"
                      >
                        Yes
                      </button>{' '}
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-gray-400 hover:underline"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(course)}
                        className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#eef2ea] text-[#1a472a] hover:bg-[#e2ecde]"
                      >
                        Edit Course
                      </button>
                      <button
                        onClick={() => setConfirmDelete(course.id)}
                        className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#fef2f2] text-red-600 hover:bg-[#fee2e2]"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Edit form (inline) */}
              {editingId === course.id && (
                <div className="px-6 py-4 border-b border-[#e8eee4] bg-[#f8faf6]">{FormPanel}</div>
              )}

              {/* 18-hole grid */}
              <div className="p-5">
                {holes.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-[13px] text-[#90a094] mb-2">No holes configured yet.</p>
                    <Link
                      href={`/admin/courses/${course.id}/holes`}
                      className="text-[13px] font-semibold text-[#1a472a] hover:underline"
                    >
                      Set up holes →
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Front 9 */}
                    {front9.length > 0 && (
                      <>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#90a094] mb-2">
                          Front 9
                        </p>
                        <div className="grid grid-cols-9 gap-2 mb-4">
                          {front9.map((hole) => (
                            <HoleTile key={hole.id} hole={hole} courseId={course.id} />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Back 9 */}
                    {back9.length > 0 && (
                      <>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#90a094] mb-2">
                          Back 9
                        </p>
                        <div className="grid grid-cols-9 gap-2">
                          {back9.map((hole) => (
                            <HoleTile key={hole.id} hole={hole} courseId={course.id} />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Holes editor link */}
                {holes.length > 0 && (
                  <div className="mt-3 text-right">
                    <Link
                      href={`/admin/courses/${course.id}/holes`}
                      className="text-[12px] font-semibold text-[#1a472a] hover:underline"
                    >
                      Edit holes & GPS →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HoleTile({ hole, courseId }: { hole: Hole; courseId: string }) {
  const hasGps = hole.pin_lat !== 0 && hole.pin_lng !== 0;
  const gpsDotColor = hasGps ? '#2f8f4e' : '#e9b73a';

  return (
    <Link href={`/admin/courses/${courseId}/holes`}>
      <div className="bg-[#f4f7f1] rounded-[10px] p-2.5 text-center cursor-pointer hover:bg-[#e9f3ec] transition-colors">
        <p className="font-barlow font-bold text-[20px] text-[#15241c] leading-none">
          {hole.hole_number}
        </p>
        <p className="text-[11px] text-[#6b7a70] mt-0.5">P{hole.par}</p>
        <p className="text-[10px] text-[#90a094]">— yd</p>
        <p className="text-[10px] text-[#90a094]">SI {hole.handicap}</p>
        <span
          className="inline-block w-2 h-2 rounded-full mt-1"
          style={{ background: gpsDotColor }}
        />
      </div>
    </Link>
  );
}
