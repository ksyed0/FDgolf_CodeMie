'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Player, PlayerRole, Team } from '@/lib/types';

interface PlayersTableProps {
  players: Player[];
  teams: Pick<Team, 'id' | 'team_number' | 'team_name'>[];
}

const ROLES: PlayerRole[] = ['player', 'admin', 'tournament_organizer'];

export function PlayersTable({ players: initial, teams }: PlayersTableProps) {
  const [players, setPlayers] = useState(initial);
  const [search, setSearch] = useState('');
  const supabase = createClient();

  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.team_name ?? `Team ${t.team_number}`]));

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.company ?? '').toLowerCase().includes(search.toLowerCase())
  );

  async function updateRole(playerId: string, role: PlayerRole) {
    const { error } = await supabase.from('players').update({ role }).eq('id', playerId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, role } : p)));
    toast.success('Role updated');
  }

  return (
    <div>
      <div className="border-b p-3">
        <Input
          placeholder="Search by name or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Company</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Team</th>
              <th className="px-4 py-2 text-left">Role</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-gray-600">{p.company}</td>
                <td className="px-4 py-3 text-gray-600">{p.email}</td>
                <td className="px-4 py-3 text-gray-600">
                  {p.team_id ? teamMap[p.team_id] ?? '—' : '—'}
                </td>
                <td className="px-4 py-3">
                  <Select value={p.role} onValueChange={(v) => updateRole(p.id, v as PlayerRole)}>
                    <SelectTrigger className="h-8 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">No players found.</p>
        )}
      </div>
    </div>
  );
}
