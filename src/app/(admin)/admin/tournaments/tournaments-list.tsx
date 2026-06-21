'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { AdminTopBar } from '@/components/admin-top-bar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setActiveTournamentAction } from '@/lib/actions/set-active-tournament';
import type { TournamentStatus } from '@/lib/types';

interface TournamentRow {
  id: string;
  name: string;
  slug: string;
  date: string;
  status: TournamentStatus;
  format: string;
  venue: { name: string } | null;
  course: { name: string } | null;
}

interface Venue {
  id: string;
  name: string;
}

interface Course {
  id: string;
  name: string;
  venue_id: string;
}

const STATUS_STYLES: Record<TournamentStatus, string> = {
  setup: 'bg-[#eef2ea] text-[#1a472a]',
  active: 'bg-[#e3f4e8] text-[#166534]',
  paused: 'bg-[#fef9c3] text-[#854d0e]',
  completed: 'bg-[#e0eeff] text-[#1e4fa0]',
};

const EMPTY_FORM = {
  name: '',
  slug: '',
  date: '',
  format: 'best_ball',
  venueId: '',
  courseId: '',
};

export function TournamentsList({
  tournaments: initial,
  venues,
  courses,
}: {
  tournaments: TournamentRow[];
  venues: Venue[];
  courses: Course[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [tournaments, setTournaments] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filteredCourses = form.venueId
    ? courses.filter((c) => c.venue_id === form.venueId)
    : courses;

  function cancel() {
    setShowAdd(false);
    setForm(EMPTY_FORM);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        name: form.name.trim(),
        slug: form.slug.trim(),
        date: form.date,
        format: form.format,
        venue_id: form.venueId,
        course_id: form.courseId,
        status: 'setup' as TournamentStatus,
      })
      .select(
        'id, name, slug, date, status, format, venue:venues!venue_id(name), course:courses!course_id(name)'
      )
      .single();

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    setTournaments((prev) => [data as unknown as TournamentRow, ...prev]);
    toast.success('Tournament created.');
    cancel();
    setSaving(false);
  }

  async function handleManage(tournament: TournamentRow) {
    startTransition(async () => {
      await setActiveTournamentAction(tournament.id);
      router.push('/admin/tournament');
    });
  }

  const isAdding = showAdd;

  const FormPanel = (
    <form onSubmit={handleCreate} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-[13px] text-[#6b7a70]">Name *</Label>
        <Input
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="h-8"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-[13px] text-[#6b7a70]">Slug *</Label>
        <Input
          required
          value={form.slug}
          placeholder="my-tournament-2026"
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          className="h-8"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-[13px] text-[#6b7a70]">Date *</Label>
        <Input
          required
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          className="h-8"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-[13px] text-[#6b7a70]">Venue *</Label>
        <select
          required
          value={form.venueId}
          onChange={(e) => setForm((f) => ({ ...f, venueId: e.target.value, courseId: '' }))}
          className="h-8 rounded-xl border border-[#e2e8df] px-3 text-[13px] text-[#15241c] focus:border-[#1a472a] focus:outline-none"
        >
          <option value="">Select venue…</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-[13px] text-[#6b7a70]">Course *</Label>
        <select
          required
          value={form.courseId}
          onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
          className="h-8 rounded-xl border border-[#e2e8df] px-3 text-[13px] text-[#15241c] focus:border-[#1a472a] focus:outline-none"
        >
          <option value="">Select course…</option>
          {filteredCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={cancel}
          className="flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold bg-[#eef2ea] text-[#15241c]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold bg-[#1a472a] text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Tournament'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="flex flex-col">
      <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Tournaments">
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-xl px-4 py-2 text-[13px] font-semibold bg-[#1a472a] text-white"
        >
          + Add Tournament
        </button>
      </AdminTopBar>

      <div className="px-7 py-6 flex gap-6">
        {/* Left: tournament card list */}
        <div className="flex-1 flex flex-col gap-4">
          {tournaments.length === 0 && (
            <p className="text-[14px] text-[#6b7a70]">No tournaments yet — add one.</p>
          )}
          {tournaments.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-2xl border border-[#e2e8df] p-5 flex items-start gap-4"
            >
              <div
                className="rounded-[13px] bg-[#eef2ea] flex items-center justify-center shrink-0"
                style={{ width: 52, height: 52 }}
              >
                <span style={{ fontSize: 22 }}>🏆</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[17px] text-[#15241c]">{t.name}</p>
                <p className="text-[13px] text-[#6b7a70] mt-0.5">
                  {t.date} · {t.venue?.name ?? '—'} · {t.course?.name ?? '—'}
                </p>
                <div className="flex gap-2 mt-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold capitalize ${STATUS_STYLES[t.status]}`}
                  >
                    {t.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleManage(t)}
                disabled={isPending}
                className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#eef2ea] text-[#1a472a] shrink-0 disabled:opacity-50"
              >
                Manage
              </button>
            </div>
          ))}
        </div>

        {/* Right: Add form panel */}
        {isAdding && (
          <div className="w-80 shrink-0 bg-white rounded-2xl border border-[#e2e8df] p-6 self-start">
            <p className="font-barlow font-bold text-[18px] text-[#15241c] mb-4">Add Tournament</p>
            {FormPanel}
          </div>
        )}
      </div>
    </div>
  );
}
