'use client';

import React, { useState } from 'react';
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
        <Button variant="outline" size="sm" onClick={cancel}>
          Cancel
        </Button>
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
            onClick={() => {
              setShowAdd(true);
              setForm(EMPTY_FORM);
            }}
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
              <React.Fragment key={v.id}>
                <tr className="border-b hover:bg-gray-50">
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
                        <Button variant="outline" size="sm" onClick={() => startEdit(v)}>
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
                  <tr>
                    <td colSpan={3} className="bg-gray-50 px-4 py-3">
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
