'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { AdminTopBar } from '@/components/admin-top-bar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Team } from '@/lib/types';
import type { RosterPlayer } from './page';

const supabase = createClient();

const EMPTY_NEW = { name: '', email: '', company: '', title: '', teamId: '' };

interface PlayerSearchResult {
  id: string;
  name: string;
  email: string;
}

export function RosterManager({
  tournamentId,
  players: initial,
  teams,
}: {
  tournamentId: string;
  players: RosterPlayer[];
  teams: Team[];
}) {
  const [players, setPlayers] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searchTeamId, setSearchTeamId] = useState('');

  const [newForm, setNewForm] = useState(EMPTY_NEW);
  const [saving, setSaving] = useState(false);

  // 250ms debounce — supabase is module-level, intentionally NOT in dep array
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const enrolledPlayerIds = new Set(players.map((p) => p.player_id));
      const { data } = await supabase
        .from('players')
        .select('id, name, email')
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(8);
      setSearchResults(
        ((data ?? []) as PlayerSearchResult[]).filter((p) => !enrolledPlayerIds.has(p.id))
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, players]);

  async function enrollExisting(player: PlayerSearchResult) {
    setSaving(true);
    const { data, error } = await supabase
      .from('tournament_players')
      .insert({
        player_id: player.id,
        tournament_id: tournamentId,
        team_id: searchTeamId || null,
      })
      .select('id, player_id, team_id, teams!team_id(team_name)')
      .single();

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    const t = data.teams as unknown as { team_name: string } | null;
    setPlayers((prev) => [
      ...prev,
      {
        id: data.id,
        player_id: data.player_id,
        name: player.name,
        email: player.email,
        company: '',
        title: '',
        team_id: data.team_id,
        team_name: t?.team_name ?? null,
      },
    ]);
    toast.success(`${player.name} added to roster.`);
    setSearchQuery('');
    setSearchResults([]);
    setSearchTeamId('');
    setSaving(false);
    setShowAdd(false);
  }

  async function createAndEnroll(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: p, error: pErr } = await supabase
      .from('players')
      .insert({
        name: newForm.name.trim(),
        email: newForm.email.trim(),
        company: newForm.company.trim(),
        title: newForm.title.trim(),
        role: 'player',
      })
      .select('id, name, email')
      .single();

    if (pErr) {
      toast.error(pErr.message);
      setSaving(false);
      return;
    }

    const { data: tp, error: tpErr } = await supabase
      .from('tournament_players')
      .insert({
        player_id: p.id,
        tournament_id: tournamentId,
        team_id: newForm.teamId || null,
      })
      .select('id, player_id, team_id, teams!team_id(team_name)')
      .single();

    if (tpErr) {
      toast.error(tpErr.message);
      setSaving(false);
      return;
    }
    const t = tp.teams as unknown as { team_name: string } | null;
    setPlayers((prev) => [
      ...prev,
      {
        id: tp.id,
        player_id: tp.player_id,
        name: p.name,
        email: p.email,
        company: newForm.company,
        title: newForm.title,
        team_id: tp.team_id,
        team_name: t?.team_name ?? null,
      },
    ]);
    toast.success(`${p.name} created and enrolled.`);
    setNewForm(EMPTY_NEW);
    setSaving(false);
    setShowNew(false);
  }

  async function removeFromTournament(membershipId: string) {
    const { error } = await supabase.from('tournament_players').delete().eq('id', membershipId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPlayers((prev) => prev.filter((p) => p.id !== membershipId));
    toast.success('Player removed from tournament.');
    setConfirmRemoveId(null);
  }

  const AddExistingForm = (
    <div className="w-80 shrink-0 bg-white rounded-2xl border border-[#e2e8df] p-6 self-start">
      <p className="font-barlow font-bold text-[18px] text-[#15241c] mb-4">Add Existing Player</p>
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email…"
          />
          {searchResults.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full rounded-2xl border border-[#e2e8df] bg-white shadow-lg overflow-hidden">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => enrollExisting(p)}
                  disabled={saving}
                  className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#eef2ea] flex justify-between"
                >
                  <span className="font-medium text-[#15241c]">{p.name}</span>
                  <span className="text-[#6b7a70]">{p.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[#6b7a70]">Assign to team</Label>
          <select
            value={searchTeamId}
            onChange={(e) => setSearchTeamId(e.target.value)}
            className="h-8 rounded-md border border-input px-3 text-[13px] focus:border-[#1a472a] focus:outline-none"
          >
            <option value="">No team yet</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.team_name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            setShowAdd(false);
            setSearchQuery('');
            setSearchResults([]);
          }}
          className="rounded-xl px-3 py-2 text-[13px] font-semibold bg-[#eef2ea] text-[#15241c]"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const NewPlayerForm = (
    <div className="w-80 shrink-0 bg-white rounded-2xl border border-[#e2e8df] p-6 self-start">
      <p className="font-barlow font-bold text-[18px] text-[#15241c] mb-4">New Player</p>
      <form onSubmit={createAndEnroll} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-[#6b7a70]">Name *</Label>
          <Input
            required
            value={newForm.name}
            onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[#6b7a70]">Email *</Label>
          <Input
            required
            type="email"
            value={newForm.email}
            onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[#6b7a70]">Company</Label>
          <Input
            value={newForm.company}
            onChange={(e) => setNewForm((f) => ({ ...f, company: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[#6b7a70]">Title</Label>
          <Input
            value={newForm.title}
            onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[#6b7a70]">Team</Label>
          <select
            value={newForm.teamId}
            onChange={(e) => setNewForm((f) => ({ ...f, teamId: e.target.value }))}
            className="h-8 rounded-md border border-input px-3 text-[13px] focus:border-[#1a472a] focus:outline-none"
          >
            <option value="">No team yet</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.team_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setShowNew(false);
              setNewForm(EMPTY_NEW);
            }}
            className="flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold bg-[#eef2ea] text-[#15241c]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold bg-[#1a472a] text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create & Enroll'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="flex flex-col">
      <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Roster">
        <button
          onClick={() => {
            setShowAdd(true);
            setShowNew(false);
          }}
          className="rounded-xl px-4 py-2 text-[13px] font-semibold bg-[#eef2ea] text-[#1a472a]"
        >
          + Add Existing
        </button>
        <button
          onClick={() => {
            setShowNew(true);
            setShowAdd(false);
          }}
          className="rounded-xl px-4 py-2 text-[13px] font-semibold bg-[#1a472a] text-white"
        >
          + New Player
        </button>
      </AdminTopBar>

      <div className="px-7 py-6 flex gap-6">
        {/* Left: player list */}
        <div className="flex-1 flex flex-col gap-4">
          {players.length === 0 && (
            <p className="text-[14px] text-[#6b7a70]">No players enrolled yet.</p>
          )}
          {players.map((p) => (
            <React.Fragment key={p.id}>
              <div className="bg-white rounded-2xl border border-[#e2e8df] p-5 flex items-start gap-4">
                <div
                  className="rounded-[13px] bg-[#eef2ea] flex items-center justify-center shrink-0"
                  style={{ width: 52, height: 52 }}
                >
                  <span style={{ fontSize: 22 }}>👤</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[17px] text-[#15241c]">{p.name}</p>
                  <p className="text-[13px] text-[#6b7a70] mt-0.5">{p.email}</p>
                  <div className="flex gap-2 mt-2">
                    {p.team_name ? (
                      <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#e9f3ec] text-[#1a472a]">
                        {p.team_name}
                      </span>
                    ) : (
                      <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#f4f7f1] text-[#6b7a70]">
                        No team
                      </span>
                    )}
                    {p.company && (
                      <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-[#eef2ea] text-[#6b7a70]">
                        {p.company}
                      </span>
                    )}
                  </div>
                </div>
                {confirmRemoveId === p.id ? (
                  <div className="flex items-center gap-2 shrink-0 text-[13px]">
                    <span className="text-[#6b7a70]">Remove?</span>
                    <button
                      onClick={() => removeFromTournament(p.id)}
                      className="font-semibold text-[#a8513f] hover:underline"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmRemoveId(null)}
                      className="text-[#6b7a70] hover:underline"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemoveId(p.id)}
                    className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#f7ece9] text-[#a8513f] shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Right: form panel */}
        {showAdd && AddExistingForm}
        {showNew && NewPlayerForm}
      </div>
    </div>
  );
}
