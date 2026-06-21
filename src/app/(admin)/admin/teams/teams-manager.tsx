'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminTopBar } from '@/components/admin-top-bar';
import type { Team, Player } from '@/lib/types';

interface TeamsManagerProps {
  teams: Team[];
  players: Player[];
  tournamentId: string;
  memberships: { player_id: string; team_id: string }[];
}

export function TeamsManager({
  teams: initialTeams,
  players,
  tournamentId,
  memberships: initialMemberships,
}: TeamsManagerProps) {
  const [teams, setTeams] = useState(initialTeams);
  const [membershipList, setMembershipList] = useState(initialMemberships);
  const [teamNames, setTeamNames] = useState<Record<string, string>>(
    Object.fromEntries(initialTeams.map((t) => [t.id, t.team_name ?? '']))
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ team_name: '', starting_hole: 1, max_players: 4 });
  const [adding, setAdding] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [editingStartingHoles, setEditingStartingHoles] = useState<Record<string, number>>(
    Object.fromEntries(initialTeams.map((t) => [t.id, t.starting_hole ?? 1]))
  );
  const supabase = createClient();

  async function updateTeamName(teamId: string) {
    const name = teamNames[teamId].trim();
    const { error } = await supabase
      .from('teams')
      .update({ team_name: name || null })
      .eq('id', teamId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, team_name: name || null } : t)));
    toast.success('Team name saved');
  }

  async function updateCaptain(teamId: string, captainId: string) {
    const { error } = await supabase
      .from('teams')
      .update({ captain_id: captainId })
      .eq('id', teamId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, captain_id: captainId } : t)));
    toast.success('Captain updated');
  }

  async function updateMaxPlayers(teamId: string, max: number) {
    const { error } = await supabase.from('teams').update({ max_players: max }).eq('id', teamId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, max_players: max } : t)));
    toast.success('Max players updated');
  }

  async function assignPlayer(playerId: string, teamId: string) {
    const { error } = await supabase
      .from('tournament_players')
      .upsert(
        { player_id: playerId, team_id: teamId, tournament_id: tournamentId },
        { onConflict: 'player_id,tournament_id' }
      );
    if (error) {
      toast.error(error.message);
      return;
    }
    setMembershipList((prev) => [
      ...prev.filter((m) => m.player_id !== playerId),
      { player_id: playerId, team_id: teamId },
    ]);
    toast.success('Player assigned');
  }

  async function updateStartingHole(teamId: string, hole: number) {
    const { error } = await supabase.from('teams').update({ starting_hole: hole }).eq('id', teamId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, starting_hole: hole } : t)));
    toast.success('Starting hole updated');
  }

  async function addTeam() {
    setAdding(true);
    const nextNumber = teams.length > 0 ? Math.max(...teams.map((t) => t.team_number)) + 1 : 1;
    const { data, error } = await supabase
      .from('teams')
      .insert({
        tournament_id: tournamentId,
        team_number: nextNumber,
        team_name: addForm.team_name.trim() || null,
        starting_hole: addForm.starting_hole,
        max_players: addForm.max_players,
      })
      .select()
      .single<Team>();
    if (error) {
      toast.error(error.message);
    } else if (data) {
      setTeams((prev) => [...prev, data]);
      setTeamNames((prev) => ({ ...prev, [data.id]: data.team_name ?? '' }));
      setAddForm({ team_name: '', starting_hole: 1, max_players: 4 });
      setShowAddForm(false);
      toast.success('Team added');
    }
    setAdding(false);
  }

  const membershipMap = new Map(membershipList.map((m) => [m.player_id, m.team_id]));

  // Sort teams by team_number — the first one (lowest number) is the leader
  const sortedTeams = [...teams].sort((a, b) => a.team_number - b.team_number);
  const leaderTeamId = sortedTeams[0]?.id;

  return (
    <div>
      <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Teams">
        <button className="rounded-xl border border-[#d6ddd2] px-3 py-1.5 text-[13px] font-semibold text-[#46554c]">
          ⚡ Auto-assign holes
        </button>
        <button
          className="bg-[#1a472a] text-white rounded-xl px-4 py-2 text-[14px] font-semibold"
          onClick={() => setShowAddForm((v) => !v)}
        >
          {showAddForm ? 'Cancel' : '+ Add Team'}
        </button>
      </AdminTopBar>

      {/* Add Team form */}
      {showAddForm && (
        <div className="mx-7 mt-6 rounded-xl border bg-white p-4 shadow-sm space-y-3">
          <h3 className="font-semibold text-gray-900">New Team</h3>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Team name (optional)"
              value={addForm.team_name}
              onChange={(e) => setAddForm((f) => ({ ...f, team_name: e.target.value }))}
              className="flex-1 min-w-[160px]"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 shrink-0">Starting hole</label>
              <Input
                type="number"
                min={1}
                max={18}
                value={addForm.starting_hole}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, starting_hole: Number(e.target.value) }))
                }
                className="w-16"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 shrink-0">Max</label>
              <Select
                value={String(addForm.max_players)}
                onValueChange={(v) => setAddForm((f) => ({ ...f, max_players: Number(v) }))}
              >
                <SelectTrigger className="h-8 w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="bg-[#1a472a] hover:bg-[#143820]"
            onClick={addTeam}
            disabled={
              adding ||
              !addForm.starting_hole ||
              addForm.starting_hole < 1 ||
              addForm.starting_hole > 18
            }
          >
            {adding ? 'Adding…' : 'Add Team'}
          </Button>
        </div>
      )}

      {/* Team cards grid */}
      <div className="px-7 py-6 grid gap-[18px]" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {sortedTeams.map((team) => {
          const isLeader = team.id === leaderTeamId;
          const teamPlayers = players.filter((p) => membershipMap.get(p.id) === team.id);
          const memberCount = teamPlayers.length;
          const isWarning = memberCount < 4;
          const isEditing = editingTeamId === team.id;

          return (
            <div
              key={team.id}
              className={`bg-white rounded-2xl overflow-hidden border ${isWarning ? 'border-[#ecd9b4]' : 'border-[#e2e8df]'}`}
            >
              {/* Card header */}
              <div
                className="flex items-center justify-between px-[18px] py-3"
                style={{
                  background: isWarning ? '#fbf1df' : isLeader ? '#1a472a' : '#f4f7f1',
                }}
              >
                <span
                  className="font-barlow font-extrabold text-[22px]"
                  style={{ color: isWarning ? '#7a500a' : isLeader ? '#fff' : '#15241c' }}
                >
                  {team.team_name ?? `Team ${team.team_number}`}
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[18px] font-barlow font-bold"
                  style={{
                    background: 'rgba(255,255,255,.18)',
                    color: isLeader && !isWarning ? '#fff' : '#46554c',
                  }}
                >
                  H{team.starting_hole ?? 1}
                </span>
              </div>

              {/* Member list */}
              <div className="px-[18px] py-3 flex flex-col gap-2">
                {[...Array(team.max_players ?? 4)].map((_, i) => {
                  const player = teamPlayers[i];
                  return (
                    <div key={i} className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-[7px] bg-[#eef2ea] flex items-center justify-center text-[11px] font-bold shrink-0 ${player ? 'text-[#1a472a]' : 'text-[#90a094]'}`}
                      >
                        {player
                          ? player.name
                              .split(' ')
                              .map((p) => p[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()
                          : '—'}
                      </div>
                      <div className="flex-1 min-w-0">
                        {player ? (
                          <>
                            <p className="text-[13px] font-semibold text-[#15241c] truncate">
                              {player.name}
                            </p>
                            <p className="text-[11px] text-[#90a094]">Player</p>
                          </>
                        ) : (
                          <p className="text-[13px] font-semibold text-[#90a094]">— Unassigned —</p>
                        )}
                      </div>
                      {player && <span className="text-[11px] text-[#90a094]">HCP —</span>}
                    </div>
                  );
                })}
              </div>

              {/* Card footer */}
              <div className="px-[18px] pb-[14px] pt-2.5 border-t border-[#f0f4ee] flex gap-2">
                <button
                  className="flex-1 rounded-xl py-1.5 text-[13px] font-semibold bg-[#eef2ea] text-[#1a472a]"
                  onClick={() => setEditingTeamId(isEditing ? null : team.id)}
                >
                  {isEditing ? 'Done' : 'Edit team'}
                </button>
                <button
                  className="flex-1 rounded-xl py-1.5 text-[13px] font-semibold bg-[#f4f7f1] text-[#46554c]"
                  onClick={() => setShowAssignPanel(true)}
                >
                  Manage players
                </button>
              </div>

              {/* Edit panel (inline, shown below footer when editing) */}
              {isEditing && (
                <div className="px-[18px] pb-4 pt-3 border-t border-[#f0f4ee] space-y-3 bg-white">
                  <div>
                    <label className="text-[11px] font-semibold text-[#46554c] uppercase tracking-wide">
                      Team name
                    </label>
                    <Input
                      value={teamNames[team.id] ?? ''}
                      onChange={(e) =>
                        setTeamNames((prev) => ({ ...prev, [team.id]: e.target.value }))
                      }
                      onBlur={() => updateTeamName(team.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                      placeholder={`Team ${team.team_number}`}
                      className="mt-1 h-8 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#46554c] uppercase tracking-wide">
                      Starting hole
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={18}
                      value={editingStartingHoles[team.id] ?? team.starting_hole ?? 1}
                      onChange={(e) =>
                        setEditingStartingHoles((prev) => ({
                          ...prev,
                          [team.id]: Number(e.target.value),
                        }))
                      }
                      onBlur={() => {
                        const hole = editingStartingHoles[team.id] ?? 1;
                        if (hole >= 1 && hole <= 18) updateStartingHole(team.id, hole);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                      className="mt-1 h-8 w-20"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-[11px] font-semibold text-[#46554c] uppercase tracking-wide">
                        Max players
                      </label>
                      <Select
                        value={String(team.max_players)}
                        onValueChange={(v) => updateMaxPlayers(team.id, Number(v))}
                      >
                        <SelectTrigger className="mt-1 h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2, 3, 4, 5, 6].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {teamPlayers.length > 0 && (
                      <div className="flex-1">
                        <label className="text-[11px] font-semibold text-[#46554c] uppercase tracking-wide">
                          Captain
                        </label>
                        <Select
                          value={team.captain_id ?? ''}
                          onValueChange={(v) => updateCaptain(team.id, v)}
                        >
                          <SelectTrigger className="mt-1 h-8 w-full">
                            <SelectValue placeholder="Select captain" />
                          </SelectTrigger>
                          <SelectContent>
                            {teamPlayers.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Assign unassigned players */}
      {(showAssignPanel || players.filter((p) => !membershipMap.has(p.id)).length > 0) && (
        <div className="mx-7 mb-7 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Assign Players to Teams</h3>
            {showAssignPanel && (
              <button
                className="text-[12px] text-[#46554c] font-semibold"
                onClick={() => setShowAssignPanel(false)}
              >
                Close
              </button>
            )}
          </div>
          {players.filter((p) => !membershipMap.has(p.id)).length === 0 ? (
            <p className="text-sm text-[#90a094]">All players assigned.</p>
          ) : (
            <div className="space-y-2">
              {players
                .filter((p) => !membershipMap.has(p.id))
                .map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="min-w-[140px] text-sm">{p.name}</span>
                    <Select onValueChange={(v) => assignPlayer(p.id, v)}>
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue placeholder="Assign to team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.team_name ?? `Team ${t.team_number}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
