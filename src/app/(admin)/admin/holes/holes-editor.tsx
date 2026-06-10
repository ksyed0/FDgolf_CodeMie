'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PinEditorModal } from './pin-editor-modal';
import type { Hole } from '@/lib/types';

interface HolesEditorProps {
  holes: Hole[];
}

export function HolesEditor({ holes: initial }: HolesEditorProps) {
  const [holes, setHoles] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [editingPin, setEditingPin] = useState<Hole | null>(null);
  const supabase = createClient();

  function updateHole(id: string, field: 'par' | 'handicap', value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    setHoles((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: num } : h)));
  }

  function applyPin(id: string, lat: number, lng: number) {
    setHoles((prev) => prev.map((h) => (h.id === id ? { ...h, pin_lat: lat, pin_lng: lng } : h)));
    setEditingPin(null);
    toast.success('Pin updated — click Save Changes to persist.');
  }

  async function saveAll() {
    setSaving(true);
    const updates = holes.map((h) =>
      supabase
        .from('holes')
        .update({ par: h.par, handicap: h.handicap, pin_lat: h.pin_lat, pin_lng: h.pin_lng })
        .eq('id', h.id)
    );
    const results = await Promise.all(updates);
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      toast.error('Some holes failed to save.');
    } else {
      toast.success('All holes saved!');
    }
    setSaving(false);
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <th className="px-4 py-2 text-left">Hole</th>
            <th className="px-4 py-2 text-left">Par</th>
            <th className="px-4 py-2 text-left">Handicap</th>
            <th className="px-4 py-2 text-left">Pin (lat, lng)</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {holes.map((h) => (
            <tr key={h.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 font-medium">{h.hole_number}</td>
              <td className="px-4 py-2">
                <Input
                  type="number"
                  min={3}
                  max={5}
                  className="h-8 w-16"
                  value={h.par}
                  onChange={(e) => updateHole(h.id, 'par', e.target.value)}
                />
              </td>
              <td className="px-4 py-2">
                <Input
                  type="number"
                  min={1}
                  max={18}
                  className="h-8 w-16"
                  value={h.handicap}
                  onChange={(e) => updateHole(h.id, 'handicap', e.target.value)}
                />
              </td>
              <td className="px-4 py-2 font-mono text-xs text-gray-500">
                {h.pin_lat.toFixed(5)}, {h.pin_lng.toFixed(5)}
              </td>
              <td className="px-4 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingPin(h)}
                >
                  Edit Pin
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="p-4">
        <Button onClick={saveAll} disabled={saving} className="bg-[#1a472a] hover:bg-[#143820]">
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {editingPin && (
        <PinEditorModal
          hole={editingPin}
          onClose={() => setEditingPin(null)}
          onSave={(lat, lng) => applyPin(editingPin.id, lat, lng)}
        />
      )}
    </div>
  );
}
