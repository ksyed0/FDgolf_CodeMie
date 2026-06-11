# Admin Venues, Courses & Tee Boxes — Implementation Plan 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/admin/venues`, `/admin/courses`, and `/admin/courses/[courseId]/holes` pages so admins can manage the full Venue → Course → Hole → TeeBox master data hierarchy through the UI.

**Architecture:** Server components fetch data and pass it to `'use client'` manager components that write directly to Supabase (same pattern as `TournamentManager`). Tee box CRUD uses simple form inputs per hole (no Mapbox drag for this iteration). The existing `HolesEditor` and `PinEditorModal` are reused unchanged under the new course-scoped URL.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase browser client, shadcn/ui (Button, Input, Select, Label), lucide-react icons, Sonner toasts.

---

## File Map

| Action | File |
|--------|------|
| Create | `src/app/(admin)/admin/venues/page.tsx` |
| Create | `src/app/(admin)/admin/venues/venue-manager.tsx` |
| Create | `src/app/(admin)/admin/courses/page.tsx` |
| Create | `src/app/(admin)/admin/courses/course-manager.tsx` |
| Create | `src/app/(admin)/admin/courses/[courseId]/holes/page.tsx` |
| Create | `src/app/(admin)/admin/courses/[courseId]/holes/course-holes-editor.tsx` |
| Modify | `src/components/admin-sidebar.tsx` |

---

## Task 1: Venue Manager — CRUD for `/admin/venues`

**Files:**
- Create: `src/app/(admin)/admin/venues/page.tsx`
- Create: `src/app/(admin)/admin/venues/venue-manager.tsx`

### Context

`venues` table columns: `id uuid`, `name text`, `address1 text`, `address2 text|null`, `city text`, `province_state text`, `postal_code text`, `country text`, `created_at`.

RLS: Admin full access (USING + WITH CHECK from migration 007). Writes go via `@/lib/supabase/client`.

`TournamentManager` at `src/app/(admin)/admin/tournament/tournament-manager.tsx` is the exact pattern to follow: EMPTY_FORM → list → add/edit row → save → delete.

### Steps

- [ ] **Step 1: Create the server component `page.tsx`**

```tsx
// src/app/(admin)/admin/venues/page.tsx
import { createClient } from '@/lib/supabase/server';
import { VenueManager } from './venue-manager';
import type { Venue } from '@/lib/types';

export default async function VenuesAdminPage() {
  const supabase = await createClient();
  const { data: venues } = await supabase
    .from('venues')
    .select('*')
    .order('name');
  return (
    <div className="max-w-4xl">
      <VenueManager venues={(venues as Venue[]) ?? []} />
    </div>
  );
}
```

- [ ] **Step 2: Create `venue-manager.tsx`**

```tsx
// src/app/(admin)/admin/venues/venue-manager.tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Venue } from '@/lib/types';

type VenueForm = {
  name: string;
  address1: string;
  address2: string;
  city: string;
  province_state: string;
  postal_code: string;
  country: string;
};

const EMPTY_FORM: VenueForm = {
  name: '',
  address1: '',
  address2: '',
  city: '',
  province_state: '',
  postal_code: '',
  country: 'CA',
};

interface VenueManagerProps {
  venues: Venue[];
}

export function VenueManager({ venues: initial }: VenueManagerProps) {
  const [venues, setVenues] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<VenueForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const supabase = createClient();

  function field(key: keyof VenueForm, label: string, required = false) {
    return (
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-500">
          {label}{required && ' *'}
        </Label>
        <Input
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="h-8 text-sm"
          required={required}
        />
      </div>
    );
  }

  function startEdit(v: Venue) {
    setEditingId(v.id);
    setShowAdd(false);
    setForm({
      name: v.name,
      address1: v.address1,
      address2: v.address2 ?? '',
      city: v.city,
      province_state: v.province_state,
      postal_code: v.postal_code,
      country: v.country,
    });
  }

  function cancel() {
    setEditingId(null);
    setShowAdd(false);
    setForm(EMPTY_FORM);
  }

  async function save() {
    if (!form.name.trim() || !form.city.trim()) {
      toast.error('Name and city are required.');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      address1: form.address1.trim(),
      address2: form.address2.trim() || null,
      city: form.city.trim(),
      province_state: form.province_state.trim(),
      postal_code: form.postal_code.trim(),
      country: form.country.trim() || 'CA',
    };

    if (editingId) {
      const { data, error } = await supabase
        .from('venues')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single();
      if (error) { toast.error(error.message); }
      else {
        setVenues((vs) => vs.map((v) => (v.id === editingId ? (data as Venue) : v)));
        toast.success('Venue updated.');
        cancel();
      }
    } else {
      const { data, error } = await supabase
        .from('venues')
        .insert(payload)
        .select()
        .single();
      if (error) { toast.error(error.message); }
      else {
        setVenues((vs) => [...vs, data as Venue]);
        toast.success('Venue added.');
        cancel();
      }
    }
    setSaving(false);
  }

  async function deleteVenue(id: string) {
    const { error } = await supabase.from('venues').delete().eq('id', id);
    if (error) { toast.error(error.message); }
    else {
      setVenues((vs) => vs.filter((v) => v.id !== id));
      toast.success('Venue deleted.');
    }
    setConfirmDelete(null);
  }

  const FormPanel = (
    <div className="grid grid-cols-2 gap-3 rounded-xl border bg-white p-4 shadow-sm">
      <div className="col-span-2">{field('name', 'Venue name', true)}</div>
      <div className="col-span-2">{field('address1', 'Address line 1')}</div>
      <div className="col-span-2">{field('address2', 'Address line 2')}</div>
      {field('city', 'City', true)}
      {field('province_state', 'Province / State')}
      {field('postal_code', 'Postal code')}
      {field('country', 'Country')}
      <div className="col-span-2 flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={cancel}>Cancel</Button>
        <Button
          size="sm"
          onClick={save}
          disabled={saving}
          className="bg-[#1a472a] hover:bg-[#143820]"
        >
          {saving ? 'Saving…' : editingId ? 'Update Venue' : 'Add Venue'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Venues</h1>
        {!showAdd && !editingId && (
          <Button
            size="sm"
            onClick={() => { setShowAdd(true); setForm(EMPTY_FORM); }}
            className="bg-[#1a472a] hover:bg-[#143820]"
          >
            + Add Venue
          </Button>
        )}
      </div>

      {showAdd && FormPanel}

      <div className="rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Location</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {venues.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400">
                  No venues yet — add one above.
                </td>
              </tr>
            )}
            {venues.map((v) => (
              <>
                <tr key={v.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{v.name}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {[v.city, v.province_state].filter(Boolean).join(', ')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {confirmDelete === v.id ? (
                      <span className="flex items-center justify-end gap-2 text-xs">
                        Delete?
                        <button
                          onClick={() => deleteVenue(v.id)}
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(v)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:border-red-300 hover:text-red-700"
                          onClick={() => setConfirmDelete(v.id)}
                        >
                          Delete
                        </Button>
                      </span>
                    )}
                  </td>
                </tr>
                {editingId === v.id && (
                  <tr key={`${v.id}-edit`}>
                    <td colSpan={3} className="bg-gray-50 px-4 py-3">
                      {FormPanel}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the page renders**

Run `npm run type-check` — expect 0 errors.

Start dev server (`npm run dev`) and visit `http://localhost:3000/admin/venues` — expect the venues list with the seeded Granite Ridge entry.

- [ ] **Step 4: Commit**

```bash
git add src/app/(admin)/admin/venues/
git commit -m "feat: venue manager — list, add, edit, delete at /admin/venues"
```

---

## Task 2: Course Manager — CRUD for `/admin/courses`

**Files:**
- Create: `src/app/(admin)/admin/courses/page.tsx`
- Create: `src/app/(admin)/admin/courses/course-manager.tsx`

### Context

`courses` table columns: `id uuid`, `venue_id uuid FK`, `name text`, `hole_count int` (9|18), `par_total int`, `course_rating numeric(4,1)|null`, `slope_rating int|null`, `created_at`.

Courses dropdown in the form must be filtered by the selected venue (same pattern as TournamentManager).

From the Courses list, provide a "Manage Holes →" link to `/admin/courses/[courseId]/holes`.

### Steps

- [ ] **Step 1: Create server component `page.tsx`**

```tsx
// src/app/(admin)/admin/courses/page.tsx
import { createClient } from '@/lib/supabase/server';
import { CourseManager } from './course-manager';
import type { Course, Venue } from '@/lib/types';

export default async function CoursesAdminPage() {
  const supabase = await createClient();
  const [{ data: courses }, { data: venues }] = await Promise.all([
    supabase
      .from('courses')
      .select('*, venue:venues!venue_id(name)')
      .order('name') as Promise<{ data: (Course & { venue: { name: string } | null })[] | null }>,
    supabase.from('venues').select('*').order('name'),
  ]);

  const rows = (courses ?? []).map((c) => ({
    ...c,
    venue_name: c.venue?.name ?? '',
  }));

  return (
    <div className="max-w-4xl">
      <CourseManager
        courses={rows}
        venues={(venues as Venue[]) ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `course-manager.tsx`**

```tsx
// src/app/(admin)/admin/courses/course-manager.tsx
'use client';

import { useState } from 'react';
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
      courseRating: c.course_rating != null ? String(c.course_rating) : '',
      slopeRating: c.slope_rating != null ? String(c.slope_rating) : '',
    });
  }

  function cancel() {
    setEditingId(null);
    setShowAdd(false);
    setForm(EMPTY_FORM);
  }

  async function save() {
    if (!form.venueId) { toast.error('Select a venue.'); return; }
    if (!form.name.trim()) { toast.error('Course name is required.'); return; }
    const parNum = parseInt(form.parTotal, 10);
    if (isNaN(parNum) || parNum < 27) { toast.error('Par total must be a number ≥ 27.'); return; }
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
      if (error) { toast.error(error.message); }
      else {
        const venueName = venues.find((v) => v.id === form.venueId)?.name ?? '';
        setCourses((cs) =>
          cs.map((c) => (c.id === editingId ? { ...(data as Course), venue_name: venueName } : c))
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
      if (error) { toast.error(error.message); }
      else {
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
    if (error) { toast.error(error.message); }
    else {
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
          onValueChange={(v) =>
            setForm((f) => ({ ...f, venueId: v === '__none__' ? '' : v }))
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select venue…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Select venue…</SelectItem>
            {venues.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
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
        <Button variant="outline" size="sm" onClick={cancel}>Cancel</Button>
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
            onClick={() => { setShowAdd(true); setForm(EMPTY_FORM); }}
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
              <>
                <tr key={c.id} className="border-b hover:bg-gray-50">
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
                          <Button variant="outline" size="sm">Holes →</Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(c)}
                        >
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
                  <tr key={`${c.id}-edit`}>
                    <td colSpan={4} className="bg-gray-50 px-4 py-3">
                      {FormPanel}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the page renders**

Run `npm run type-check` — expect 0 errors.

Visit `http://localhost:3000/admin/courses` — expect the courses list with "Main Course" entry and "Holes →" link.

- [ ] **Step 4: Commit**

```bash
git add src/app/(admin)/admin/courses/page.tsx src/app/(admin)/admin/courses/course-manager.tsx
git commit -m "feat: course manager — list, add, edit, delete at /admin/courses"
```

---

## Task 3: Course-Scoped Holes + TeeBox Editor

**Files:**
- Create: `src/app/(admin)/admin/courses/[courseId]/holes/page.tsx`
- Create: `src/app/(admin)/admin/courses/[courseId]/holes/course-holes-editor.tsx`

### Context

`tee_boxes` table columns: `id uuid`, `hole_id uuid FK`, `name text`, `lat double precision`, `lng double precision`, `distance_yards int`, `unique(hole_id, name)`.

The existing `HolesEditor` handles par/handicap/pin editing — reuse it directly. The `CourseHolesEditor` wraps `HolesEditor` and adds a tee-box section below it: per-hole accordion showing existing tee boxes and a form to add/edit/delete them.

The page receives `courseId` from the URL params. It also fetches the course name to display in the breadcrumb.

### Steps

- [ ] **Step 1: Create the server component page**

```tsx
// src/app/(admin)/admin/courses/[courseId]/holes/page.tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { HolesEditor } from '@/app/(admin)/admin/holes/holes-editor';
import { CourseHolesEditor } from './course-holes-editor';
import type { Hole, TeeBox } from '@/lib/types';
import type { Course } from '@/lib/types';

export default async function CourseHolesPage({
  params,
}: {
  params: { courseId: string };
}) {
  const supabase = await createClient();

  const [{ data: course }, { data: holes }, { data: teeBoxes }] = await Promise.all([
    supabase
      .from('courses')
      .select('id, name')
      .eq('id', params.courseId)
      .single() as Promise<{ data: Pick<Course, 'id' | 'name'> | null }>,
    supabase
      .from('holes')
      .select('*')
      .eq('course_id', params.courseId)
      .order('hole_number') as Promise<{ data: Hole[] | null }>,
    supabase
      .from('tee_boxes')
      .select('*')
      .in(
        'hole_id',
        ((await supabase.from('holes').select('id').eq('course_id', params.courseId)).data ?? []).map(
          (h: { id: string }) => h.id
        )
      ) as Promise<{ data: TeeBox[] | null }>,
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/courses" className="hover:underline">Courses</Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{course?.name ?? 'Course'}</span>
        <span>/</span>
        <span>Holes</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">
        {course?.name} — Holes
      </h1>

      {/* Hole pin + par/handicap editor */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Pin Locations &amp; Par / Handicap</h2>
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
```

- [ ] **Step 2: Create `course-holes-editor.tsx`**

```tsx
// src/app/(admin)/admin/courses/[courseId]/holes/course-holes-editor.tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Hole, TeeBox } from '@/lib/types';

type TeeBoxForm = { name: string; lat: string; lng: string; distanceYards: string };
const EMPTY_TBOX: TeeBoxForm = { name: '', lat: '', lng: '', distanceYards: '' };

interface CourseHolesEditorProps {
  holes: Hole[];
  teeBoxes: TeeBox[];
}

export function CourseHolesEditor({ holes, teeBoxes: initialBoxes }: CourseHolesEditorProps) {
  const [teeBoxes, setTeeBoxes] = useState(initialBoxes);
  const [expandedHoleId, setExpandedHoleId] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [editingTeeBox, setEditingTeeBox] = useState<TeeBox | null>(null);
  const [form, setForm] = useState<TeeBoxForm>(EMPTY_TBOX);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  function boxesForHole(holeId: string) {
    return teeBoxes.filter((t) => t.hole_id === holeId);
  }

  function startAdd(holeId: string) {
    setAddingFor(holeId);
    setEditingTeeBox(null);
    setForm(EMPTY_TBOX);
    setExpandedHoleId(holeId);
  }

  function startEdit(t: TeeBox) {
    setEditingTeeBox(t);
    setAddingFor(null);
    setForm({
      name: t.name,
      lat: String(t.lat),
      lng: String(t.lng),
      distanceYards: String(t.distance_yards),
    });
    setExpandedHoleId(t.hole_id);
  }

  function cancelForm() {
    setAddingFor(null);
    setEditingTeeBox(null);
    setForm(EMPTY_TBOX);
  }

  function validateForm(): { name: string; lat: number; lng: number; distance_yards: number } | null {
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    const dist = parseInt(form.distanceYards, 10);
    if (!form.name.trim()) { toast.error('Tee box name is required (e.g. Red, White, Blue).'); return null; }
    if (isNaN(lat) || isNaN(lng)) { toast.error('Valid lat and lng are required.'); return null; }
    if (isNaN(dist) || dist < 1) { toast.error('Distance must be a positive number.'); return null; }
    return { name: form.name.trim(), lat, lng, distance_yards: dist };
  }

  async function saveTeeBox(holeId: string) {
    const validated = validateForm();
    if (!validated) return;
    setSaving(true);

    if (editingTeeBox) {
      const { data, error } = await supabase
        .from('tee_boxes')
        .update(validated)
        .eq('id', editingTeeBox.id)
        .select()
        .single();
      if (error) { toast.error(error.message); }
      else {
        setTeeBoxes((ts) => ts.map((t) => (t.id === editingTeeBox.id ? (data as TeeBox) : t)));
        toast.success('Tee box updated.');
        cancelForm();
      }
    } else {
      const { data, error } = await supabase
        .from('tee_boxes')
        .insert({ ...validated, hole_id: holeId })
        .select()
        .single();
      if (error) { toast.error(error.message); }
      else {
        setTeeBoxes((ts) => [...ts, data as TeeBox]);
        toast.success('Tee box added.');
        cancelForm();
      }
    }
    setSaving(false);
  }

  async function deleteTeeBox(id: string) {
    const { error } = await supabase.from('tee_boxes').delete().eq('id', id);
    if (error) { toast.error(error.message); }
    else {
      setTeeBoxes((ts) => ts.filter((t) => t.id !== id));
      toast.success('Tee box deleted.');
    }
  }

  const TeeBoxForm = (holeId: string) => (
    <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border bg-gray-50 p-3">
      <div className="col-span-2 flex flex-col gap-1">
        <Label className="text-xs text-gray-500">Name (e.g. Red, White, Blue, Gold) *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="h-8 text-sm"
          placeholder="Red"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-500">Latitude *</Label>
        <Input
          type="number"
          step="0.000001"
          value={form.lat}
          onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
          className="h-8 text-sm"
          placeholder="43.518100"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-500">Longitude *</Label>
        <Input
          type="number"
          step="0.000001"
          value={form.lng}
          onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
          className="h-8 text-sm"
          placeholder="-79.907200"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-500">Distance (yards) *</Label>
        <Input
          type="number"
          value={form.distanceYards}
          onChange={(e) => setForm((f) => ({ ...f, distanceYards: e.target.value }))}
          className="h-8 text-sm"
          placeholder="380"
        />
      </div>
      <div className="flex items-end justify-end gap-2">
        <Button variant="outline" size="sm" onClick={cancelForm}>Cancel</Button>
        <Button
          size="sm"
          onClick={() => saveTeeBox(holeId)}
          disabled={saving}
          className="bg-[#1a472a] hover:bg-[#143820]"
        >
          {saving ? 'Saving…' : editingTeeBox ? 'Update' : 'Add'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-700">Tee Boxes</h2>
      </div>
      <div className="divide-y">
        {holes.map((hole) => {
          const boxes = boxesForHole(hole.id);
          const isExpanded = expandedHoleId === hole.id;
          return (
            <div key={hole.id} className="px-4 py-3">
              <button
                className="flex w-full items-center justify-between text-sm font-medium text-gray-800 hover:text-gray-900"
                onClick={() => setExpandedHoleId(isExpanded ? null : hole.id)}
              >
                <span>Hole {hole.hole_number} — Par {hole.par}</span>
                <span className="text-xs text-gray-400">
                  {boxes.length} tee box{boxes.length !== 1 ? 'es' : ''}{' '}
                  {isExpanded ? '▲' : '▼'}
                </span>
              </button>

              {isExpanded && (
                <div className="mt-2 space-y-2">
                  {boxes.length > 0 && (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="py-1 text-left font-normal">Name</th>
                          <th className="py-1 text-left font-normal">Lat, Lng</th>
                          <th className="py-1 text-left font-normal">Yards</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {boxes.map((t) => (
                          <tr key={t.id} className="border-t border-gray-100">
                            <td className="py-1 font-medium">{t.name}</td>
                            <td className="py-1 font-mono text-gray-500">
                              {t.lat.toFixed(5)}, {t.lng.toFixed(5)}
                            </td>
                            <td className="py-1 text-gray-500">{t.distance_yards}</td>
                            <td className="py-1 text-right">
                              <button
                                onClick={() => startEdit(t)}
                                className="mr-2 text-blue-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteTeeBox(t.id)}
                                className="text-red-500 hover:underline"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {boxes.length === 0 && !addingFor && !editingTeeBox && (
                    <p className="text-xs text-gray-400">No tee boxes yet.</p>
                  )}

                  {(addingFor === hole.id || editingTeeBox?.hole_id === hole.id) &&
                    TeeBoxForm(hole.id)}

                  {addingFor !== hole.id && editingTeeBox?.hole_id !== hole.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 text-xs"
                      onClick={() => startAdd(hole.id)}
                    >
                      + Add Tee Box
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Fix the tee_boxes query in page.tsx — simplify the subquery**

The `page.tsx` above fetches tee_boxes using a subquery for hole IDs. Simplify to a single Supabase call using `holes!inner(tee_boxes(*))` or a direct join. Since Supabase doesn't support nested selects across joins in one call cleanly, the safer pattern is to fetch hole IDs first, then tee boxes:

```tsx
// Replace the three-way Promise.all in page.tsx with:
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

const holeIds = (holes ?? []).map((h: { id: string }) => h.id);

const { data: teeBoxes } = holeIds.length > 0
  ? await supabase.from('tee_boxes').select('*').in('hole_id', holeIds)
  : { data: [] };
```

Update `page.tsx` to use this sequential pattern:

```tsx
// src/app/(admin)/admin/courses/[courseId]/holes/page.tsx
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
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/courses" className="hover:underline">Courses</Link>
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

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Pin Locations &amp; Par / Handicap</h2>
        </div>
        <HolesEditor holes={(holes as Hole[]) ?? []} />
      </div>

      <CourseHolesEditor
        holes={(holes as Hole[]) ?? []}
        teeBoxes={(teeBoxes as TeeBox[]) ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run type-check and verify manually**

```bash
npm run type-check
```
Expected: 0 errors.

Visit `http://localhost:3000/admin/courses` → click "Holes →" for Main Course → expect the holes editor + empty tee box section for each hole.

- [ ] **Step 5: Commit**

```bash
git add src/app/(admin)/admin/courses/
git commit -m "feat: course holes + tee box editor at /admin/courses/[courseId]/holes"
```

---

## Task 4: Admin Sidebar — Add Venues and Courses Links

**Files:**
- Modify: `src/components/admin-sidebar.tsx`

### Context

Current `NAV_ITEMS` uses lucide-react icons. Add `MapPin` for Venues and `Flag` for Courses. Both should be grouped under "Master Data" conceptually, but since the sidebar is a flat list, just insert them after Tournament.

### Steps

- [ ] **Step 1: Update `admin-sidebar.tsx`**

```tsx
// src/components/admin-sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Users,
  UsersRound,
  Disc,
  Wrench,
  ClipboardList,
  Star,
  MapPin,
  Flag,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin/tournament', label: 'Tournament', Icon: Trophy },
  { href: '/admin/venues', label: 'Venues', Icon: MapPin },
  { href: '/admin/courses', label: 'Courses', Icon: Flag },
  { href: '/admin/players', label: 'Players', Icon: Users },
  { href: '/admin/teams', label: 'Teams', Icon: UsersRound },
  { href: '/admin/holes', label: 'Holes', Icon: Disc },
  { href: '/admin/clubs', label: 'Clubs', Icon: Wrench },
  { href: '/admin/scores', label: 'Scores', Icon: ClipboardList },
  { href: '/admin/sponsors', label: 'Sponsors', Icon: Star },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-48 shrink-0 flex-col bg-[#1a472a] text-white">
      <div className="px-4 py-4">
        <span className="text-lg font-bold">FDgolf</span>
        <span className="ml-1 text-xs text-green-400">Admin</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-2 pb-4">
        {NAV_ITEMS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-green-700 text-white'
                : 'text-green-200 hover:bg-green-800 hover:text-white'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Verify nav links render**

Visit any admin page — expect Venues and Courses links appear between Tournament and Players.

- [ ] **Step 3: Final checks**

```bash
npm run type-check   # 0 errors
npm run test:ci      # 81 passed, coverage above thresholds
```

Manually test the golden paths:
1. Create a new venue → appears in list
2. Create a course for that venue → appears in courses list with venue name
3. Click "Holes →" → navigates to course holes page showing 18 holes
4. Expand a hole → click "+ Add Tee Box" → fill form → save → tee box appears

- [ ] **Step 4: Commit**

```bash
git add src/components/admin-sidebar.tsx
git commit -m "feat: add Venues and Courses links to admin sidebar"
```

---

## Final Wrap-Up

- [ ] **Push and open PR**

```bash
git push -u origin feature/plan2-admin-venues-courses
gh pr create --base develop \
  --title "feat: admin UI for venues, courses, tee boxes" \
  --body "Adds /admin/venues, /admin/courses, and /admin/courses/[courseId]/holes pages. Tee box CRUD via inline form per hole."
```

- [ ] **Update progress.md and MEMORY.md** with Plan 2 completion.
