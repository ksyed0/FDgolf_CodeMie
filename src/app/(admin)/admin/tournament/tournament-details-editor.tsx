'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TournamentDetailsEditorProps {
  tournamentId: string;
  initialVenue: string;
  initialDate: string; // ISO date string YYYY-MM-DD
}

export function TournamentDetailsEditor({
  tournamentId,
  initialVenue,
  initialDate,
}: TournamentDetailsEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [venue, setVenue] = useState(initialVenue);
  const [date, setDate] = useState(initialDate);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!venue.trim()) {
      toast.error('Venue cannot be empty');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('tournaments')
      .update({ venue: venue.trim(), date })
      .eq('id', tournamentId);

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    toast.success('Tournament details updated');
    setEditing(false);
    setSaving(false);
    router.refresh();
  }

  function cancel() {
    setVenue(initialVenue);
    setDate(initialDate);
    setEditing(false);
  }

  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (!editing) {
    return (
      <div className="group flex items-start gap-2">
        <div>
          <p className="text-sm text-gray-500">{venue}</p>
          <p className="text-sm text-gray-500">{displayDate}</p>
        </div>
        <button
          aria-label="Edit venue and date"
          onClick={() => setEditing(true)}
          className="mt-0.5 rounded p-1 opacity-0 transition-opacity hover:bg-gray-100 group-hover:opacity-100"
        >
          <Pencil className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        value={venue}
        onChange={(e) => setVenue(e.target.value)}
        placeholder="Venue"
        className="h-8 text-sm"
        autoFocus
      />
      <Input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          aria-label="Save venue and date"
          className="h-7 bg-[#1a472a] px-2 hover:bg-[#143820]"
          onClick={save}
          disabled={saving}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label="Cancel"
          className="h-7 px-2"
          onClick={cancel}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
