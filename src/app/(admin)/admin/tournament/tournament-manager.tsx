'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Tournament, TournamentStatus, Venue, Course } from '@/lib/types';

export type TournamentRow = Tournament & { venue_name: string; course_name: string };

interface TournamentManagerProps {
  tournaments: TournamentRow[];
  venues: Venue[];
  courses: Course[];
}

interface FormState {
  name: string;
  slug: string;
  venueId: string;
  courseId: string;
  date: string;
  startTime: string;
  format: string;
  holesPlayed: string; // '9' | '18'
  nineHoleSelection: string; // 'front' | 'back' | ''
  status: TournamentStatus;
}

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  venueId: '',
  courseId: '',
  date: '',
  startTime: '',
  format: 'best_ball',
  holesPlayed: '18',
  nineHoleSelection: '',
  status: 'setup',
};

const STATUS_LABELS: Record<TournamentStatus, string> = {
  setup: 'Setup',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
};

const STATUS_VARIANTS: Record<TournamentStatus, 'default' | 'secondary' | 'outline'> = {
  setup: 'secondary',
  active: 'default',
  paused: 'outline',
  completed: 'outline',
};

export function TournamentManager({ tournaments: initial, venues, courses }: TournamentManagerProps) {
  const router = useRouter();
  const supabase = createClient();
  const [tournaments, setTournaments] = useState<TournamentRow[]>(initial);
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function toSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      if (key === 'name' && typeof value === 'string') {
        const wasAuto = prev.slug === toSlug(prev.name);
        return { ...prev, name: value, slug: wasAuto ? toSlug(value) : prev.slug };
      }
      if (key === 'holesPlayed') {
        return { ...prev, holesPlayed: value as string, nineHoleSelection: value === '18' ? '' : prev.nineHoleSelection };
      }
      return { ...prev, [key]: value };
    });
  }

  // Courses filtered to the selected venue
  const venueCourses = form.venueId
    ? courses.filter((c) => c.venue_id === form.venueId)
    : courses;

  async function save() {
    if (!form.name.trim() || !form.venueId || !form.courseId || !form.date) {
      toast.error('Name, venue, course, and date are required');
      return;
    }
    setSaving(true);

    if (mode === 'add') {
      const { data: created, error } = await supabase
        .from('tournaments')
        .insert({
          name: form.name.trim(),
          slug: form.slug.trim(),
          venue_id: form.venueId,
          course_id: form.courseId,
          date: form.date,
          start_time: form.startTime || null,
          format: form.format,
          holes_played: parseInt(form.holesPlayed, 10),
          nine_hole_selection: form.nineHoleSelection || null,
        })
        .select('*, venue:venues!venue_id(name), course:courses!course_id(name)')
        .single();

      if (error) { toast.error(error.message); setSaving(false); return; }

      const venue = venues.find((v) => v.id === form.venueId);
      const course = courses.find((c) => c.id === form.courseId);
      setTournaments((prev) => [{
        ...(created as Tournament),
        venue_name: venue?.name ?? '',
        course_name: course?.name ?? '',
      }, ...prev]);
      toast.success('Tournament created');
      setMode('list');
    } else if (mode === 'edit' && editingId) {
      const { error } = await supabase
        .from('tournaments')
        .update({
          name: form.name.trim(),
          slug: form.slug.trim(),
          venue_id: form.venueId,
          course_id: form.courseId,
          date: form.date,
          start_time: form.startTime || null,
          format: form.format,
          holes_played: parseInt(form.holesPlayed, 10),
          nine_hole_selection: form.nineHoleSelection || null,
          status: form.status,
        })
        .eq('id', editingId);

      if (error) { toast.error(error.message); setSaving(false); return; }

      const venue = venues.find((v) => v.id === form.venueId);
      const course = courses.find((c) => c.id === form.courseId);
      setTournaments((prev) => prev.map((t) =>
        t.id === editingId
          ? { ...t, ...form, venue_id: form.venueId, course_id: form.courseId,
              holes_played: parseInt(form.holesPlayed, 10) as 9 | 18,
              nine_hole_selection: (form.nineHoleSelection as 'front' | 'back') || null,
              venue_name: venue?.name ?? '',
              course_name: course?.name ?? '' }
          : t
      ));
      toast.success('Tournament updated');
      setMode('list');
      router.refresh();
    }
    setSaving(false);
  }

  function startEdit(t: TournamentRow) {
    setForm({
      name: t.name,
      slug: t.slug,
      venueId: t.venue_id,
      courseId: t.course_id,
      date: t.date,
      startTime: t.start_time ?? '',
      format: t.format,
      holesPlayed: String(t.holes_played),
      nineHoleSelection: t.nine_hole_selection ?? '',
      status: t.status,
    });
    setEditingId(t.id);
    setMode('edit');
  }

  function cancelForm() {
    setMode('list');
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function confirmDelete(id: string) {
    setDeleting(true);
    const { error } = await supabase.from('tournaments').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      setDeleting(false);
      return;
    }
    setTournaments((prev) => prev.filter((t) => t.id !== id));
    setDeleteConfirmId(null);
    setDeleting(false);
    setDeletingId(null);
    toast.success('Tournament deleted');
  }

  // ── Add / Edit form ──────────────────────────────────────────────────────────
  if (mode !== 'list') {
    const isAdd = mode === 'add';

    return (
      <div className="max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={cancelForm} className="text-sm text-[#1a472a] hover:underline">
            ← All tournaments
          </button>
          <span className="text-gray-300">/</span>
          <h2 className="text-lg font-semibold text-gray-900">
            {isAdd ? 'Add Tournament' : 'Edit Tournament'}
          </h2>
        </div>

        <div className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <Label htmlFor="t-name">Name *</Label>
            <Input
              id="t-name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="CIBC Capital Markets Golf Tournament 2026"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="t-slug">URL slug *</Label>
            <Input
              id="t-slug"
              value={form.slug}
              onChange={(e) =>
                setField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
              }
              placeholder="cibc-capital-markets-2026"
            />
            <p className="text-xs text-gray-400">
              Live leaderboard URL: /live/
              <em>{form.slug || '…'}</em>
            </p>
          </div>

          {/* Venue */}
          <div>
            <Label htmlFor="t-venue">Venue *</Label>
            <Select value={form.venueId} onValueChange={(v) => { setField('venueId', v); setField('courseId', ''); }}>
              <SelectTrigger id="t-venue" className="mt-1">
                <SelectValue placeholder="Select a venue…" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name} — {v.city}, {v.province_state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Course */}
          <div>
            <Label htmlFor="t-course">Course *</Label>
            <Select
              value={form.courseId}
              onValueChange={(v) => setField('courseId', v)}
              disabled={!form.venueId}
            >
              <SelectTrigger id="t-course" className="mt-1">
                <SelectValue placeholder={form.venueId ? 'Select a course…' : 'Select a venue first'} />
              </SelectTrigger>
              <SelectContent>
                {venueCourses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} ({c.hole_count} holes)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div>
            <Label htmlFor="t-date">Date *</Label>
            <Input id="t-date" type="date" className="mt-1" value={form.date} onChange={(e) => setField('date', e.target.value)} />
          </div>

          {/* Start time */}
          <div>
            <Label htmlFor="t-time">Start time</Label>
            <Input id="t-time" type="time" className="mt-1" value={form.startTime} onChange={(e) => setField('startTime', e.target.value)} />
          </div>

          {/* Format */}
          <div>
            <Label>Format *</Label>
            <Select value={form.format} onValueChange={(v) => setField('format', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="best_ball">Best Ball</SelectItem>
                <SelectItem value="stroke_play">Stroke Play</SelectItem>
                <SelectItem value="scramble">Scramble</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Holes played */}
          <div>
            <Label>Holes played *</Label>
            <Select value={form.holesPlayed} onValueChange={(v) => setField('holesPlayed', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="18">18 holes</SelectItem>
                <SelectItem value="9">9 holes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Nine-hole selection — only shown when holesPlayed === '9' */}
          {form.holesPlayed === '9' && (
            <div>
              <Label>Which 9 holes? *</Label>
              <Select value={form.nineHoleSelection} onValueChange={(v) => setField('nineHoleSelection', v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Front or back 9?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="front">Front 9 (holes 1–9)</SelectItem>
                  <SelectItem value="back">Back 9 (holes 10–18)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status — edit only */}
          {mode === 'edit' && (
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setField('status', v as TournamentStatus)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="setup">Setup</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            className="bg-[#1a472a] hover:bg-[#143820]"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : isAdd ? 'Create Tournament' : 'Save Changes'}
          </Button>
          <Button variant="outline" onClick={cancelForm} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── Tournament list ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tournaments</h1>
        <Button className="bg-[#1a472a] hover:bg-[#143820]" onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setMode('add'); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Tournament
        </Button>
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
          No tournaments yet.{' '}
          <button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setMode('add'); }} className="font-medium text-[#1a472a] hover:underline">
            Create the first one.
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Venue / Course</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((t) => (
                <React.Fragment key={t.id}>
                  <tr className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{t.venue_name}{t.course_name ? ` — ${t.course_name}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(t.date + 'T12:00:00').toLocaleDateString('en-CA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANTS[t.status]}>
                        {STATUS_LABELS[t.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Edit tournament"
                          onClick={() => startEdit(t)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          title="Delete tournament"
                          onClick={() =>
                            setDeleteConfirmId((prev) => (prev === t.id ? null : t.id))
                          }
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {deleteConfirmId === t.id && (
                    <tr className="border-b bg-red-50 last:border-0">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-medium text-red-700">
                            Delete &ldquo;{t.name}&rdquo;? This permanently removes all
                            teams, scores, and shots for this tournament.
                          </span>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => { setDeletingId(t.id); confirmDelete(t.id); }}
                            disabled={deleting && deletingId === t.id}
                            className="h-7 px-3 text-xs"
                          >
                            {deleting && deletingId === t.id ? 'Deleting…' : 'Confirm delete'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteConfirmId(null)}
                            className="h-7 px-3 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
