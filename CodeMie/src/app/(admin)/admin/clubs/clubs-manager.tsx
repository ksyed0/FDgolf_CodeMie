'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { Club } from '@/lib/types';

interface ClubsManagerProps {
  clubs: Club[];
}

export function ClubsManager({ clubs: initial }: ClubsManagerProps) {
  const [clubs, setClubs] = useState(initial);
  const supabase = createClient();

  async function toggleClub(id: string, current: boolean) {
    const { error } = await supabase
      .from('clubs')
      .update({ is_active: !current })
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    setClubs((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: !current } : c)));
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
          <th className="px-4 py-2 text-left">Club</th>
          <th className="px-4 py-2 text-left">Category</th>
          <th className="px-4 py-2 text-left">Active</th>
        </tr>
      </thead>
      <tbody>
        {clubs.map((club) => (
          <tr key={club.id} className="border-b hover:bg-gray-50">
            <td className="px-4 py-3 font-medium">{club.name}</td>
            <td className="px-4 py-3 capitalize text-gray-600">{club.category}</td>
            <td className="px-4 py-3">
              <button
                onClick={() => toggleClub(club.id, club.is_active)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                  club.is_active ? 'bg-[#1a472a]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    club.is_active ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
