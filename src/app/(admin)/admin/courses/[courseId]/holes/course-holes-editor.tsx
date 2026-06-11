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

  function validateForm(): {
    name: string;
    lat: number;
    lng: number;
    distance_yards: number;
  } | null {
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    const dist = parseInt(form.distanceYards, 10);
    if (!form.name.trim()) {
      toast.error('Tee box name is required (e.g. Red, White, Blue).');
      return null;
    }
    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Valid lat and lng are required.');
      return null;
    }
    if (isNaN(dist) || dist < 1) {
      toast.error('Distance must be a positive number.');
      return null;
    }
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
      if (error) {
        toast.error(error.message);
      } else {
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
      if (error) {
        toast.error(error.message);
      } else {
        setTeeBoxes((ts) => [...ts, data as TeeBox]);
        toast.success('Tee box added.');
        cancelForm();
      }
    }
    setSaving(false);
  }

  async function deleteTeeBox(id: string) {
    const { error } = await supabase.from('tee_boxes').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      setTeeBoxes((ts) => ts.filter((t) => t.id !== id));
      toast.success('Tee box deleted.');
    }
  }

  const TeeBoxFormPanel = (holeId: string) => (
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
        <Button variant="outline" size="sm" onClick={cancelForm}>
          Cancel
        </Button>
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
                <span>
                  Hole {hole.hole_number} — Par {hole.par}
                </span>
                <span className="text-xs text-gray-400">
                  {boxes.length} tee box{boxes.length !== 1 ? 'es' : ''} {isExpanded ? '▲' : '▼'}
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
                    TeeBoxFormPanel(hole.id)}

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
