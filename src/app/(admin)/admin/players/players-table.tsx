'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { UserPlus, FileUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CsvImport } from './csv-import';
import type { Player, PlayerRole, Team } from '@/lib/types';

interface PlayersTableProps {
  players: Player[];
  teams: Pick<Team, 'id' | 'team_number' | 'team_name'>[];
  tournamentId: string;
}

const ROLES: PlayerRole[] = ['player', 'admin', 'tournament_organizer'];

const EMPTY_ADD_FORM = { name: '', email: '', company: '', title: '' };

export function PlayersTable({ players: initial, teams, tournamentId }: PlayersTableProps) {
  const [players, setPlayers] = useState(initial);
  const [search, setSearch] = useState('');
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [adding, setAdding] = useState(false);
  const supabase = createClient();

  async function addPlayer() {
    if (!addForm.name.trim() || !addForm.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/admin/add-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const json = (await res.json()) as { player?: Player; error?: string };
      if (!res.ok || !json.player) {
        toast.error(json.error ?? 'Failed to add player');
        return;
      }
      setPlayers((prev) => [...prev, json.player!]);
      setAddForm(EMPTY_ADD_FORM);
      setShowAddForm(false);
      toast.success(`${json.player.name} added`);
    } finally {
      setAdding(false);
    }
  }

  async function sendInvite(player: Player) {
    if (!player.email) {
      toast.error('Player has no email');
      return;
    }
    setInvitingId(player.id);
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: player.email }),
      });
      const json = (await res.json()) as { link?: string; error?: string };
      if (!res.ok || !json.link) {
        toast.error(json.error ?? 'Failed to generate link');
        return;
      }
      await navigator.clipboard.writeText(json.link).catch(() => null);
      toast.success(`Invite link copied to clipboard for ${player.name}`, { duration: 5000 });
    } finally {
      setInvitingId(null);
    }
  }

  const teamMap = Object.fromEntries(
    teams.map((t) => [t.id, t.team_name ?? `Team ${t.team_number}`])
  );

  const filtered = players.filter(
    (p) =>
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
      <div className="flex items-center justify-between border-b p-3">
        <Input
          placeholder="Search by name or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowCsvImport((v) => !v);
              setShowAddForm(false);
            }}
          >
            <FileUp className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button
            size="sm"
            className="bg-[#1a472a] hover:bg-[#143820]"
            onClick={() => {
              setShowAddForm((v) => !v);
              setShowCsvImport(false);
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add Player
          </Button>
        </div>
      </div>

      {showCsvImport && (
        <CsvImport tournamentId={tournamentId} onClose={() => setShowCsvImport(false)} />
      )}

      {showAddForm && (
        <div className="border-b bg-green-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">Add new player</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Name *</Label>
              <Input
                placeholder="Alice Smith"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                placeholder="alice@example.com"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Company</Label>
              <Input
                placeholder="CIBC"
                value={addForm.company}
                onChange={(e) => setAddForm((f) => ({ ...f, company: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input
                placeholder="VP, Capital Markets"
                value={addForm.title}
                onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="bg-[#1a472a] hover:bg-[#143820]"
              onClick={addPlayer}
              disabled={adding}
            >
              {adding ? 'Adding…' : 'Add Player'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setAddForm(EMPTY_ADD_FORM);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Company</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Team</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Invite</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-gray-600">{p.company}</td>
                <td className="px-4 py-3 text-gray-600">{p.email}</td>
                <td className="px-4 py-3 text-gray-600">
                  {p.team_id ? (teamMap[p.team_id] ?? '—') : '—'}
                </td>
                <td className="px-4 py-3">
                  <Select value={p.role} onValueChange={(v) => updateRole(p.id, v as PlayerRole)}>
                    <SelectTrigger className="h-8 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={invitingId === p.id || !p.email}
                    onClick={() => sendInvite(p)}
                  >
                    {invitingId === p.id ? 'Sending…' : 'Send Invite'}
                  </Button>
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
