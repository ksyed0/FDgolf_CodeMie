'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FileUp, UserPlus } from 'lucide-react';
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
import { AdminTopBar } from '@/components/admin-top-bar';
import type { Player, PlayerRole, Team } from '@/lib/types';

interface PlayersTableProps {
  players: Player[];
  teams: Pick<Team, 'id' | 'team_number' | 'team_name'>[];
  tournamentId: string;
}

const ROLES: PlayerRole[] = ['player', 'admin', 'tournament_organizer'];

const EMPTY_ADD_FORM = { name: '', email: '', company: '', title: '' };

const GRID_COLS = '28px 1fr 160px 120px 80px 140px 120px 80px';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

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

  async function sendAllLinks() {
    const unlinked = players.filter((p) => !p.auth_user_id && p.email);
    if (unlinked.length === 0) {
      toast.info('All players are already linked');
      return;
    }
    for (const player of unlinked) {
      await sendInvite(player);
    }
  }

  async function updateRole(playerId: string, role: PlayerRole) {
    const { error } = await supabase.from('players').update({ role }).eq('id', playerId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, role } : p)));
    toast.success('Role updated');
  }

  const teamMap = Object.fromEntries(
    teams.map((t) => [t.id, t.team_name ?? `Team ${t.team_number}`])
  );

  const filtered = players.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.company ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const linkedCount = players.filter((p) => p.auth_user_id).length;
  const notSentCount = players.filter((p) => !p.auth_user_id).length;

  return (
    <div>
      <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Players">
        <button
          className="flex items-center gap-1.5 rounded-xl border border-[#e2e8df] bg-white px-4 py-2 text-[14px] font-semibold text-[#46554c] hover:bg-[#f0f4ee]"
          onClick={() => {
            setShowCsvImport((v) => !v);
            setShowAddForm(false);
          }}
        >
          <FileUp className="h-4 w-4" />
          Import CSV
        </button>
        <button
          className="flex items-center gap-1.5 rounded-xl border border-[#e2e8df] bg-white px-4 py-2 text-[14px] font-semibold text-[#46554c] hover:bg-[#f0f4ee]"
          onClick={() => {
            setShowAddForm((v) => !v);
            setShowCsvImport(false);
          }}
        >
          <UserPlus className="h-4 w-4" />
          Add Player
        </button>
        <button
          className="rounded-xl bg-[#1a472a] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#143820]"
          onClick={sendAllLinks}
        >
          Send all links →
        </button>
      </AdminTopBar>

      {/* CSV Import panel */}
      {showCsvImport && (
        <CsvImport tournamentId={tournamentId} onClose={() => setShowCsvImport(false)} />
      )}

      {/* Add Player form */}
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

      {/* Filter bar */}
      <div className="flex items-center justify-between border-b border-[#eef2ea] bg-white px-7 py-2.5">
        <div className="flex items-center gap-2 text-[13px] font-medium text-[#46554c]">
          <span>All players</span>
          <span className="rounded-full bg-[#e9f3ec] px-2.5 py-0.5 font-semibold text-[#1a472a]">
            ✓ Linked {linkedCount}
          </span>
          <span className="rounded-full bg-[#fbf1df] px-2.5 py-0.5 font-semibold text-[#b3741b]">
            ⏳ Pending 0
          </span>
          <span className="rounded-full bg-[#f0f4ee] px-2.5 py-0.5 font-semibold text-[#46554c]">
            Not sent {notSentCount}
          </span>
        </div>
        <Input
          placeholder="Search by name or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Data table */}
      <div className="px-7 py-6">
        <div className="overflow-hidden rounded-2xl border border-[#e2e8df] bg-white">
          {/* Table header */}
          <div
            className="grid border-b border-[#eef2ea] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#90a094]"
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <div>
              <input type="checkbox" aria-label="Select all" />
            </div>
            <div>Player</div>
            <div>Company</div>
            <div>Title</div>
            <div className="text-center">HCP</div>
            <div>Team</div>
            <div>Magic Link</div>
            <div>Actions</div>
          </div>

          {/* Table rows */}
          {filtered.map((player) => (
            <div
              key={player.id}
              className="grid items-center border-b border-[#f0f4ee] px-4 py-3 hover:bg-[#fafcf9]"
              style={{ gridTemplateColumns: GRID_COLS, minHeight: 52 }}
            >
              <input type="checkbox" aria-label={`Select ${player.name}`} />

              {/* Player: green avatar + name + status */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a472a] text-[12px] font-bold text-white">
                  {getInitials(player.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-[#15241c]">{player.name}</p>
                  <p className="truncate text-[11px] text-[#90a094]">
                    {player.auth_user_id ? 'linked' : 'no account'}
                  </p>
                </div>
              </div>

              {/* Company */}
              <div className="truncate text-[13px] text-[#46554c]">{player.company || '—'}</div>

              {/* Title */}
              <div className="truncate text-[12px] text-[#6b7a70]">{player.title || '—'}</div>

              {/* HCP */}
              <div className="text-center text-[14px] font-semibold text-[#46554c]">—</div>

              {/* Team pill */}
              <div>
                {player.team_id ? (
                  <span className="rounded-full bg-[#e9f3ec] px-2.5 py-0.5 text-[12px] font-semibold text-[#1a472a]">
                    {teamMap[player.team_id] ?? 'Team'}
                  </span>
                ) : (
                  <span className="text-[12px] text-[#90a094]">—</span>
                )}
              </div>

              {/* Magic link status + role selector */}
              <div className="flex flex-col gap-1">
                <span
                  className={`w-fit rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                    player.auth_user_id
                      ? 'bg-[#e9f3ec] text-[#1a472a]'
                      : 'bg-[#f0f4ee] text-[#46554c]'
                  }`}
                >
                  {player.auth_user_id ? 'Linked' : 'Not sent'}
                </span>
                <Select
                  value={player.role}
                  onValueChange={(v) => updateRole(player.id, v as PlayerRole)}
                >
                  <SelectTrigger className="h-6 w-full text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="text-[11px]">
                        {r.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div>
                <button
                  className="rounded-lg bg-[#eef2ea] px-2.5 py-1 text-[12px] font-semibold text-[#1a472a] hover:bg-[#e2eadf] disabled:opacity-50"
                  disabled={invitingId === player.id || !player.email}
                  onClick={() => sendInvite(player)}
                >
                  {invitingId === player.id ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-[#90a094]">No players found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
