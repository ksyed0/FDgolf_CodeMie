'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminTopBar } from '@/components/admin-top-bar';
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
        <Label className="text-xs text-[#6b7a70]">
          {label}
          {required && ' *'}
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
      if (error) {
        toast.error(error.message);
      } else {
        setVenues((vs) => vs.map((v) => (v.id === editingId ? (data as Venue) : v)));
        toast.success('Venue updated.');
        cancel();
      }
    } else {
      const { data, error } = await supabase.from('venues').insert(payload).select().single();
      if (error) {
        toast.error(error.message);
      } else {
        setVenues((vs) => [...vs, data as Venue]);
        toast.success('Venue added.');
        cancel();
      }
    }
    setSaving(false);
  }

  async function deleteVenue(id: string) {
    const { error } = await supabase.from('venues').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      setVenues((vs) => vs.filter((v) => v.id !== id));
      toast.success('Venue deleted.');
    }
    setConfirmDelete(null);
  }

  const isAdding = showAdd && !editingId;

  const FormPanel = (
    <div className="flex flex-col gap-3">
      <div>{field('name', 'Venue name', true)}</div>
      <div>{field('address1', 'Address line 1')}</div>
      <div>{field('address2', 'Address line 2')}</div>
      <div className="grid grid-cols-2 gap-3">
        {field('city', 'City', true)}
        {field('province_state', 'Province / State')}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('postal_code', 'Postal code')}
        {field('country', 'Country')}
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={cancel}
          className="flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold bg-[#eef2ea] text-[#15241c]"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold bg-[#1a472a] text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : editingId ? 'Update Venue' : 'Save Venue'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col">
      <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Venues">
        <button
          onClick={() => {
            setShowAdd(true);
            setEditingId(null);
            setForm(EMPTY_FORM);
          }}
          className="rounded-xl px-4 py-2 text-[13px] font-semibold bg-[#1a472a] text-white"
        >
          + Add Venue
        </button>
      </AdminTopBar>

      <div className="px-7 py-6 flex gap-6">
        {/* Left: venue card list */}
        <div className="flex-1 flex flex-col gap-4">
          {venues.length === 0 && (
            <p className="text-[14px] text-[#6b7a70]">No venues yet — add one above.</p>
          )}
          {venues.map((v) => (
            <React.Fragment key={v.id}>
              <div className="bg-white rounded-2xl border border-[#e2e8df] p-5 flex items-start gap-4">
                {/* 52px tile */}
                <div
                  className="rounded-[13px] bg-[#eef2ea] flex items-center justify-center shrink-0"
                  style={{ width: 52, height: 52 }}
                >
                  <span style={{ fontSize: 22 }}>📍</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[17px] text-[#15241c]">{v.name}</p>
                  <p className="text-[13px] text-[#6b7a70] mt-0.5">
                    {[v.address1, v.city].filter(Boolean).join(', ')}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#e9f3ec] text-[#1a472a]">
                      Venue
                    </span>
                    <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#fbf1df] text-[#b3741b]">
                      GPS not configured
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {confirmDelete === v.id ? (
                  <div className="flex items-center gap-2 shrink-0 text-[13px]">
                    <span className="text-[#6b7a70]">Delete?</span>
                    <button
                      onClick={() => deleteVenue(v.id)}
                      className="font-semibold text-[#a8513f] hover:underline"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="text-[#6b7a70] hover:underline"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(v)}
                      className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#eef2ea] text-[#1a472a]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete(v.id)}
                      className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#f7ece9] text-[#a8513f]"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Inline edit form below the card */}
              {editingId === v.id && (
                <div className="bg-white rounded-2xl border border-[#e2e8df] p-6">
                  <p className="font-barlow font-bold text-[18px] text-[#15241c] mb-4">
                    Edit Venue
                  </p>
                  {FormPanel}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Right: Add Venue form (320px, shown when adding) */}
        {isAdding && (
          <div className="w-80 shrink-0 bg-white rounded-2xl border border-[#e2e8df] p-6 self-start">
            <p className="font-barlow font-bold text-[18px] text-[#15241c] mb-4">Add Venue</p>
            {FormPanel}
          </div>
        )}
      </div>
    </div>
  );
}
