'use client';

import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TournamentNameEditorProps {
  tournamentId: string;
  initialName: string;
}

export function TournamentNameEditor({ tournamentId, initialName }: TournamentNameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('tournaments')
      .update({ name: trimmed })
      .eq('id', tournamentId);
    if (error) {
      toast.error(error.message);
    } else {
      setName(trimmed);
      setEditing(false);
      toast.success('Name saved');
    }
    setSaving(false);
  }

  function cancel() {
    setDraft(name);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="max-w-sm text-xl font-semibold h-9"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
          }}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={save}
          disabled={saving || !draft.trim()}
          aria-label="Save name"
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button size="icon" variant="ghost" onClick={cancel} aria-label="Cancel">
          <X className="h-4 w-4 text-gray-500" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2">
      <h2 className="text-xl font-semibold">{name}</h2>
      <button
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Edit tournament name"
      >
        <Pencil className="h-4 w-4 text-gray-400 hover:text-gray-600" />
      </button>
    </div>
  );
}
