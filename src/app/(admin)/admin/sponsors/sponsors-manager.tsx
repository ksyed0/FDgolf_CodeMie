'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { AdminTopBar } from '@/components/admin-top-bar';
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
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const supabase = createClient();

  function handleReorder(dropTargetId: string) {
    if (!dragId || dragId === dropTargetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const from = sponsors.findIndex((s) => s.id === dragId);
    const to = sponsors.findIndex((s) => s.id === dropTargetId);
    const reordered = [...sponsors];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const updated = reordered.map((s, i) => ({ ...s, display_order: i + 1 }));
    setSponsors(updated);
    setDragId(null);
    setDragOverId(null);
    Promise.all(
      updated.map((s) =>
        supabase.from('sponsors').update({ display_order: s.display_order }).eq('id', s.id)
      )
    ).catch(() => toast.error('Failed to reorder'));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function startEdit(sponsor: Sponsor) {
    setEditId(sponsor.id);
    setShowAdd(true);
    setForm({
      name: sponsor.name,
      logo_url: sponsor.logo_url,
      display_order: String(sponsor.display_order),
    });
  }

  function cancelEdit() {
    setEditId(null);
    setShowAdd(false);
    setForm(EMPTY_FORM);
  }

  async function toggleActive(sponsor: Sponsor) {
    const { error } = await supabase
      .from('sponsors')
      .update({ is_active: !sponsor.is_active })
      .eq('id', sponsor.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSponsors((prev) =>
      prev.map((s) => (s.id === sponsor.id ? { ...s, is_active: !sponsor.is_active } : s))
    );
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
        .insert({ ...payload, display_order: sponsors.length + 1, is_active: true })
        .select()
        .single<Sponsor>();
      if (error) {
        toast.error(error.message);
      } else {
        setSponsors((prev) => [...prev, data].sort((a, b) => a.display_order - b.display_order));
        toast.success('Sponsor added');
        setForm(EMPTY_FORM);
        setShowAdd(false);
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

  const activeSponsors = sponsors.filter((s) => s.is_active);

  return (
    <div>
      <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Sponsors">
        <button
          onClick={() => {
            setEditId(null);
            setForm(EMPTY_FORM);
            setShowAdd(true);
          }}
          className="bg-[#1a472a] text-white rounded-xl px-4 py-2 text-[14px] font-semibold"
        >
          + Add Sponsor
        </button>
      </AdminTopBar>

      <div className="px-7 py-6 flex gap-6">
        {/* Left: sponsor card list */}
        <div className="flex-1 flex flex-col gap-4">
          {sponsors.length === 0 && (
            <div className="bg-white rounded-2xl border border-[#e2e8df] px-[22px] py-10 text-center text-[14px] text-[#90a094]">
              No sponsors yet. Add one to get started.
            </div>
          )}

          {sponsors.map((sponsor) => (
            <div
              key={sponsor.id}
              className="bg-white rounded-2xl border border-[#e2e8df] px-[22px] py-[18px] flex items-center gap-4"
              draggable
              onDragStart={() => setDragId(sponsor.id)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverId(sponsor.id);
              }}
              onDrop={() => handleReorder(sponsor.id)}
              style={{ opacity: dragOverId === sponsor.id && dragId !== sponsor.id ? 0.6 : 1 }}
            >
              {/* Drag handle */}
              <span className="text-[#90a094] text-[20px] cursor-grab shrink-0">⠿</span>

              {/* 72px monogram tile OR logo */}
              <div
                className="rounded-[14px] flex items-center justify-center shrink-0 overflow-hidden"
                style={{ width: 72, height: 72, background: '#1a472a' }}
              >
                {sponsor.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sponsor.logo_url}
                    alt={sponsor.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="font-barlow font-bold text-[22px] text-white">
                    {sponsor.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[17px] text-[#15241c]">{sponsor.name}</p>
                <p className="text-[12px] mt-1">
                  {sponsor.logo_url ? (
                    <span className="text-[#1a472a] font-semibold">✓ Logo uploaded</span>
                  ) : (
                    <span className="text-[#b3741b]">⚠ Logo missing</span>
                  )}
                </p>
              </div>

              {/* Show on TV toggle */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <p className="text-[11px] font-bold uppercase text-[#90a094]">Show on TV</p>
                <button
                  onClick={() => toggleActive(sponsor)}
                  className="rounded-full flex items-center transition-colors"
                  style={{
                    width: 44,
                    height: 24,
                    background: sponsor.is_active ? '#1a472a' : '#cdd9cf',
                    padding: '0 2px',
                    justifyContent: sponsor.is_active ? 'flex-end' : 'flex-start',
                  }}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow" />
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => startEdit(sponsor)}
                  className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#eef2ea] text-[#1a472a]"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteSponsor(sponsor.id)}
                  className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#f7ece9] text-[#a8513f]"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right rail (300px) */}
        <div className="w-[300px] shrink-0 flex flex-col gap-4">
          {/* TV Footer Preview */}
          <div className="rounded-2xl p-4" style={{ background: '#15241c' }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7d9486] mb-3">
              TV Footer Preview
            </p>
            <div className="flex gap-2 flex-wrap">
              {activeSponsors.map((s) => (
                <div
                  key={s.id}
                  className="bg-white rounded-xl p-2 flex items-center gap-2"
                  style={{ boxShadow: '0 3px 10px rgba(0,0,0,.22)' }}
                >
                  <div className="w-8 h-8 rounded-[6px] bg-[#1a472a] flex items-center justify-center text-white text-[10px] font-bold overflow-hidden">
                    {s.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.logo_url} className="w-full h-full object-contain" alt="" />
                    ) : (
                      s.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <span className="font-barlow font-bold text-[14px] text-[#15241c]">{s.name}</span>
                </div>
              ))}
              {activeSponsors.length === 0 && (
                <p className="text-[#7d9486] text-[12px]">No active sponsors</p>
              )}
            </div>
          </div>

          {/* Add / Edit Sponsor form */}
          {showAdd && (
            <div className="bg-white rounded-2xl border border-[#e2e8df] p-5">
              <p className="font-barlow font-bold text-[18px] text-[#15241c] mb-3">
                {editId ? 'Edit Sponsor' : 'Add Sponsor'}
              </p>
              <input
                name="name"
                placeholder="Sponsor name"
                value={form.name}
                onChange={handleChange}
                className="w-full rounded-xl border border-[#e2e8df] px-3 py-2 text-[14px] mb-2.5"
              />
              <input
                name="logo_url"
                placeholder="Logo URL (optional)"
                value={form.logo_url}
                onChange={handleChange}
                className="w-full rounded-xl border border-[#e2e8df] px-3 py-2 text-[14px] mb-3"
              />
              <button
                onClick={save}
                disabled={!form.name.trim() || loading}
                className="w-full rounded-xl py-2.5 text-[14px] font-semibold bg-[#1a472a] text-white disabled:opacity-50"
              >
                {loading ? 'Saving…' : editId ? 'Update Sponsor' : 'Save Sponsor'}
              </button>
              <button
                onClick={cancelEdit}
                className="w-full rounded-xl py-2 text-[13px] text-[#6b7a70] mt-2"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
