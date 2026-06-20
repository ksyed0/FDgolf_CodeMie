'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { AdminTopBar } from '@/components/admin-top-bar';
import type { Club, ClubCategory } from '@/lib/types';

interface ClubsManagerProps {
  clubs: Club[];
}

export function ClubsManager({ clubs: initial }: ClubsManagerProps) {
  const [clubs, setClubs] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<ClubCategory>('iron');
  const [adding, setAdding] = useState(false);
  const supabase = createClient();

  async function toggleClub(id: string, current: boolean) {
    const { error } = await supabase.from('clubs').update({ is_active: !current }).eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setClubs((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: !current } : c)));
  }

  function handleReorder(dropTargetId: string) {
    if (!dragId || dragId === dropTargetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const from = clubs.findIndex((c) => c.id === dragId);
    const to = clubs.findIndex((c) => c.id === dropTargetId);
    const reordered = [...clubs];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const updated = reordered.map((c, i) => ({ ...c, sort_order: i + 1 }));
    setClubs(updated);
    setDragId(null);
    setDragOverId(null);
    Promise.all(
      updated.map((c) => supabase.from('clubs').update({ sort_order: c.sort_order }).eq('id', c.id))
    ).catch(() => toast.error('Failed to reorder'));
  }

  async function addClub() {
    if (!newName.trim()) return;
    setAdding(true);
    const sort_order = clubs.length + 1;
    const { data, error } = await supabase
      .from('clubs')
      .insert({ name: newName.trim(), category: newCategory, sort_order, is_active: true })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
    } else {
      setClubs((prev) => [...prev, data as Club]);
      setNewName('');
      toast.success('Club added');
    }
    setAdding(false);
  }

  return (
    <div>
      <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Clubs" />

      <div className="px-7 py-6 flex gap-6">
        {/* Left: sortable club list */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl border border-[#e2e8df] overflow-hidden">
            {/* Column headers */}
            <div
              className="grid px-5 py-2 border-b border-[#eef2ea] text-[11px] font-bold uppercase tracking-[0.1em] text-[#90a094]"
              style={{ gridTemplateColumns: '32px 1fr 80px 120px 80px 80px' }}
            >
              <div />
              <div>Club</div>
              <div>Type</div>
              <div>Usage</div>
              <div>Active</div>
              <div>Actions</div>
            </div>

            {/* Rows */}
            {clubs.map((club) => (
              <div
                key={club.id}
                draggable
                onDragStart={() => setDragId(club.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverId(club.id);
                }}
                onDrop={() => handleReorder(club.id)}
                className="grid items-center px-5 py-3 border-b border-[#f0f4ee] hover:bg-[#fafcf9]"
                style={{
                  gridTemplateColumns: '32px 1fr 80px 120px 80px 80px',
                  opacity: dragOverId === club.id && dragId !== club.id ? 0.6 : 1,
                }}
              >
                {/* Drag handle */}
                <span className="text-[#90a094] cursor-grab text-[18px]">⠿</span>

                {/* Club name + monogram tile */}
                <div className="flex items-center gap-2.5">
                  <div className="w-[30px] h-[30px] rounded-[8px] bg-[#eef2ea] flex items-center justify-center text-[11px] font-bold text-[#1a472a]">
                    {club.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-semibold text-[14px] text-[#15241c]">{club.name}</span>
                </div>

                {/* Category chip */}
                <span className="rounded-lg px-2.5 py-0.5 text-[12px] font-medium bg-[#f4f7f1] text-[#6b7a70] capitalize">
                  {club.category}
                </span>

                {/* Usage bar (placeholder based on position) */}
                <div className="h-[6px] rounded-full bg-[#eef2ea] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1a472a] transition-all"
                    style={{
                      width: `${Math.max(5, 100 - (clubs.indexOf(club) / Math.max(clubs.length - 1, 1)) * 100)}%`,
                    }}
                  />
                </div>

                {/* Active toggle */}
                <button
                  onClick={() => toggleClub(club.id, club.is_active)}
                  className="rounded-full flex items-center transition-colors"
                  style={{
                    width: 44,
                    height: 24,
                    background: club.is_active ? '#1a472a' : '#cdd9cf',
                    padding: '0 2px',
                    justifyContent: club.is_active ? 'flex-end' : 'flex-start',
                  }}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow" />
                </button>

                {/* Edit button */}
                <button className="rounded-lg px-2.5 py-1 text-[12px] font-semibold bg-[#eef2ea] text-[#1a472a]">
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right rail (260px) */}
        <div className="w-[260px] shrink-0">
          <div className="bg-white rounded-2xl border border-[#e2e8df] p-5">
            <p className="font-barlow font-bold text-[18px] text-[#15241c] mb-3">Add Club</p>

            {/* Name input */}
            <input
              placeholder="Club name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-xl border border-[#e2e8df] px-3 py-2 text-[14px] mb-2.5"
            />

            {/* Category select */}
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as ClubCategory)}
              className="w-full rounded-xl border border-[#e2e8df] px-3 py-2 text-[14px] mb-3"
            >
              <option value="wood">Wood</option>
              <option value="hybrid">Hybrid</option>
              <option value="iron">Iron</option>
              <option value="wedge">Wedge</option>
              <option value="putter">Putter</option>
            </select>

            <button
              onClick={addClub}
              disabled={!newName.trim() || adding}
              className="w-full rounded-xl py-2.5 text-[14px] font-semibold bg-[#1a472a] text-white disabled:opacity-50"
            >
              {adding ? 'Adding…' : 'Add Club'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
