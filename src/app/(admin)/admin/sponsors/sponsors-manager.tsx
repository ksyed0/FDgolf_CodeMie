'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Sponsor } from '@/lib/types';

interface SponsorsManagerProps {
  sponsors: Sponsor[];
  tournamentId: string;
}

interface SponsorForm {
  name: string;
  logo_url: string;
  display_order: string;
}

const EMPTY_FORM: SponsorForm = { name: '', logo_url: '', display_order: '1' };

export function SponsorsManager({ sponsors: initial, tournamentId }: SponsorsManagerProps) {
  const [sponsors, setSponsors] = useState(initial);
  const [form, setForm] = useState<SponsorForm>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function startEdit(sponsor: Sponsor) {
    setEditId(sponsor.id);
    setForm({
      name: sponsor.name,
      logo_url: sponsor.logo_url,
      display_order: String(sponsor.display_order),
    });
  }

  function cancelEdit() {
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setLoading(true);

    const payload = {
      name: form.name,
      logo_url: form.logo_url,
      display_order: parseInt(form.display_order, 10) || 1,
      tournament_id: tournamentId,
      is_active: true,
    };

    if (editId) {
      const { data, error } = await supabase
        .from('sponsors')
        .update(payload)
        .eq('id', editId)
        .select()
        .single<Sponsor>();
      if (error) {
        toast.error(error.message);
      } else {
        setSponsors((prev) => prev.map((s) => (s.id === editId ? data : s)));
        toast.success('Sponsor updated');
        cancelEdit();
      }
    } else {
      const { data, error } = await supabase
        .from('sponsors')
        .insert(payload)
        .select()
        .single<Sponsor>();
      if (error) {
        toast.error(error.message);
      } else {
        setSponsors((prev) => [...prev, data].sort((a, b) => a.display_order - b.display_order));
        toast.success('Sponsor added');
        setForm(EMPTY_FORM);
      }
    }
    setLoading(false);
  }

  async function deleteSponsor(id: string) {
    const { error } = await supabase.from('sponsors').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSponsors((prev) => prev.filter((s) => s.id !== id));
    toast.success('Sponsor deleted');
  }

  return (
    <div className="space-y-4">
      {/* Add / Edit form */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold">{editId ? 'Edit Sponsor' : 'Add Sponsor'}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
            <Input name="name" value={form.name} onChange={handleChange} placeholder="CIBC" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Logo URL</label>
            <Input
              name="logo_url"
              value={form.logo_url}
              onChange={handleChange}
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Order</label>
            <Input
              name="display_order"
              type="number"
              min={1}
              value={form.display_order}
              onChange={handleChange}
              className="w-20"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={save} disabled={loading} className="bg-[#1a472a] hover:bg-[#143820]">
            {loading ? 'Saving…' : editId ? 'Update' : 'Add'}
          </Button>
          {editId && (
            <Button variant="outline" onClick={cancelEdit}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Sponsors list */}
      <div className="rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <th className="px-4 py-2 text-left">Order</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Logo</th>
              <th className="px-4 py-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {sponsors.map((s) => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{s.display_order}</td>
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2">
                  {s.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo_url} alt={s.name} className="max-h-7 w-auto" />
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => startEdit(s)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => deleteSponsor(s.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {sponsors.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                  No sponsors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
