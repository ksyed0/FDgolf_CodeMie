'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Plus, Copy } from 'lucide-react';
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
import type { Tournament, TournamentStatus } from '@/lib/types';

export interface TournamentRow extends Tournament {
  hole_count: number;
}

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

const FORMATS = [
  { value: 'best_ball', label: 'Best Ball' },
  { value: 'stroke_play', label: 'Stroke Play' },
  { value: 'scramble', label: 'Scramble' },
];

const STATUSES: { value: TournamentStatus; label: string }[] = [
  { value: 'setup', label: 'Setup — pre-tournament configuration' },
  { value: 'active', label: 'Active — scoring open' },
  { value: 'paused', label: 'Paused — scoring suspended' },
  { value: 'completed', label: 'Completed — read-only archive' },
];

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

const EMPTY_FORM = {
  name: '',
  slug: '',
  venue: '',
  course: '',
  date: '',
  format: 'best_ball',
  status: 'setup' as TournamentStatus,
  importFromId: '__none__',
};

type FormState = typeof EMPTY_FORM;
type Mode = 'list' | 'add' | 'edit';

interface Props {
  tournaments: TournamentRow[];
}

export function TournamentManager({ tournaments: initial }: Props) {
  const router = useRouter();
  const [tournaments, setTournaments] = useState(initial);
  const [mode, setMode] = useState<Mode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => {
      if (field === 'name') {
        // Keep slug in sync while it still matches the auto-generated version
        const wasAuto = prev.slug === toSlug(prev.name);
        return { ...prev, name: value, slug: wasAuto ? toSlug(value) : prev.slug };
      }
      return { ...prev, [field]: value };
    });
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDeleteConfirmId(null);
    setMode('add');
  }

  function openEdit(t: TournamentRow) {
    setForm({
      name: t.name,
      slug: t.slug,
      venue: t.venue,
      course: t.course ?? '',
      date: t.date.slice(0, 10),
      format: t.format,
      status: t.status,
      importFromId: '__none__',
    });
    setEditingId(t.id);
    setDeleteConfirmId(null);
    setMode('edit');
  }

  function cancelForm() {
    setMode('list');
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function save() {
    if (!form.name.trim() || !form.venue.trim() || !form.date) {
      toast.error('Name, venue, and date are required');
      return;
    }
    const slug = form.slug.trim() || toSlug(form.name);
    setSaving(true);

    try {
      if (mode === 'add') {
        const { data: created, error } = await supabase
          .from('tournaments')
          .insert({
            name: form.name.trim(),
            slug,
            venue: form.venue.trim(),
            course: form.course.trim() || null,
            date: form.date,
            format: form.format,
            status: 'setup',
          })
          .select()
          .single<Tournament>();

        if (error || !created) {
          toast.error(error?.message ?? 'Failed to create tournament');
          return;
        }

        let holeCount = 0;
        if (form.importFromId && form.importFromId !== '__none__') {
          const { data: srcHoles, error: fetchErr } = await supabase
            .from('holes')
            .select('hole_number, par, handicap, pin_lat, pin_lng')
            .eq('tournament_id', form.importFromId);

          if (fetchErr) {
            toast.error(`Tournament created but could not fetch source holes: ${fetchErr.message}`);
          } else if (srcHoles?.length) {
            const { error: insertErr } = await supabase
              .from('holes')
              .insert(srcHoles.map((h) => ({ ...h, tournament_id: created.id })));

            if (insertErr) {
              toast.error(`Tournament created but hole import failed: ${insertErr.message}`);
            } else {
              holeCount = srcHoles.length;
            }
          }
        }

        setTournaments((prev) => [{ ...created, hole_count: holeCount }, ...prev]);
        toast.success(
          holeCount > 0
            ? `Tournament created — ${holeCount} holes imported`
            : 'Tournament created'
        );
        setMode('list');
      } else if (mode === 'edit' && editingId) {
        const { error } = await supabase
          .from('tournaments')
          .update({
            name: form.name.trim(),
            slug,
            venue: form.venue.trim(),
            course: form.course.trim() || null,
            date: form.date,
            format: form.format,
            status: form.status,
          })
          .eq('id', editingId);

        if (error) {
          toast.error(error.message);
          return;
        }

        setTournaments((prev) =>
          prev.map((t) =>
            t.id === editingId
              ? {
                  ...t,
                  name: form.name.trim(),
                  slug,
                  venue: form.venue.trim(),
                  course: form.course.trim() || null,
                  date: form.date,
                  format: form.format,
                  status: form.status,
                }
              : t
          )
        );
        toast.success('Tournament updated');
        setMode('list');
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
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
    toast.success('Tournament deleted');
  }

  function copyLiveUrl(slug: string) {
    navigator.clipboard
      .writeText(`${window.location.origin}/live/${slug}`)
      .then(() => toast.success('Live URL copied'))
      .catch(() => toast.error('Could not copy to clipboard'));
  }

  // ── Add / Edit form ──────────────────────────────────────────────────────────
  if (mode !== 'list') {
    const isAdd = mode === 'add';
    const tournamentsWithHoles = tournaments.filter(
      (t) => t.hole_count > 0 && t.id !== editingId
    );

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

          <div className="space-y-1">
            <Label htmlFor="t-venue">Venue *</Label>
            <Input
              id="t-venue"
              value={form.venue}
              onChange={(e) => setField('venue', e.target.value)}
              placeholder="Granite Ridge Golf Club, Milton, ON"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="t-course">Course</Label>
            <Input
              id="t-course"
              value={form.course}
              onChange={(e) => setField('course', e.target.value)}
              placeholder="North Course (leave blank if only one course at this venue)"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="t-date">Date *</Label>
            <Input
              id="t-date"
              type="date"
              value={form.date}
              onChange={(e) => setField('date', e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Format *</Label>
            <Select value={form.format} onValueChange={(v) => setField('format', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status — edit only */}
          {!isAdd && (
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setField('status', v as TournamentStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Hole import — add only, only when source tournaments exist */}
          {isAdd && tournamentsWithHoles.length > 0 && (
            <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-4">
              <Label>Import hole data</Label>
              <Select
                value={form.importFromId}
                onValueChange={(v) => setField('importFromId', v)}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Don't import — set up holes manually" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Don&apos;t import — set up holes manually</SelectItem>
                  {tournamentsWithHoles.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.hole_count} holes)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Copies par, handicap, and pin GPS coordinates from the selected tournament.
                Useful when reusing the same course.
              </p>
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
        <Button className="bg-[#1a472a] hover:bg-[#143820]" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Tournament
        </Button>
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
          No tournaments yet.{' '}
          <button onClick={openAdd} className="font-medium text-[#1a472a] hover:underline">
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
                <th className="px-4 py-3 text-left">Holes</th>
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
                      <div>{t.venue}</div>
                      {t.course && (
                        <div className="text-xs text-gray-400">{t.course}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(t.date + 'T12:00:00').toLocaleDateString('en-CA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.hole_count}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANTS[t.status]}>
                        {STATUS_LABELS[t.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Copy live leaderboard URL"
                          onClick={() => copyLiveUrl(t.slug)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          title="Edit tournament"
                          onClick={() => openEdit(t)}
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
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-medium text-red-700">
                            Delete &ldquo;{t.name}&rdquo;? This permanently removes all
                            holes, teams, scores, and shots for this tournament.
                          </span>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => confirmDelete(t.id)}
                            disabled={deleting}
                            className="h-7 px-3 text-xs"
                          >
                            {deleting ? 'Deleting…' : 'Confirm delete'}
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
