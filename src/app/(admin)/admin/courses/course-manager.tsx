'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
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
import type { Course, Venue } from '@/lib/types';

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
}

export function CourseManager({ courses: initial, venues }: CourseManagerProps) {
  const [courses, setCourses] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
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
          cs.map((c) =>
            c.id === editingId ? { ...(data as Course), venue_name: venueName } : c,
          ),
        );
        toast.success('Course updated.');
        cancel();
      }
    } else {
      const { data, error } = await supabase
        .from('courses')
        .insert(payload)
        .select()
        .single();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
        {!showAdd && !editingId && (
          <Button
            size="sm"
            onClick={() => {
              setShowAdd(true);
              setForm(EMPTY_FORM);
            }}
            className="bg-[#1a472a] hover:bg-[#143820]"
          >
            + Add Course
          </Button>
        )}
      </div>

      {showAdd && FormPanel}

      <div className="rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <th className="px-4 py-2 text-left">Course</th>
              <th className="px-4 py-2 text-left">Venue</th>
              <th className="px-4 py-2 text-left">Holes / Par</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                  No courses yet — add one above.
                </td>
              </tr>
            )}
            {courses.map((c) => (
              <React.Fragment key={c.id}>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2 text-gray-500">{c.venue_name}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {c.hole_count} holes · par {c.par_total}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {confirmDelete === c.id ? (
                      <span className="flex items-center justify-end gap-2 text-xs">
                        Delete?
                        <button
                          onClick={() => deleteCourse(c.id)}
                          className="font-medium text-red-600 hover:underline"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-gray-400 hover:underline"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <span className="flex items-center justify-end gap-2">
                        <Link href={`/admin/courses/${c.id}/holes`}>
                          <Button variant="outline" size="sm">
                            Holes →
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm" onClick={() => startEdit(c)}>
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:border-red-300 hover:text-red-700"
                          onClick={() => setConfirmDelete(c.id)}
                        >
                          Delete
                        </Button>
                      </span>
                    )}
                  </td>
                </tr>
                {editingId === c.id && (
                  <tr>
                    <td colSpan={4} className="bg-gray-50 px-4 py-3">
                      {FormPanel}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
