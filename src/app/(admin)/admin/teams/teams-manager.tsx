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
import type { Team, Player } from '@/lib/types';

interface TeamsManagerProps {
  teams: Team[];
  players: Player[];
}

export function TeamsManager({ teams: initialTeams, players }: TeamsManagerProps) {
  const [teams, setTeams] = useState(initialTeams);
  const [teamNames, setTeamNames] = useState<Record<string, string>>(
    Object.fromEntries(initialTeams.map((t) => [t.id, t.team_name ?? '']))
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
      .from('players')
      .update({ team_id: teamId === 'none' ? null : teamId })
      .eq('id', playerId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Player assigned');
  }

  return (
    <div className="space-y-4">
      {teams.map((team) => {
        const members = players.filter((p) => p.team_id === team.id);
        return (
          <div key={team.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex-1 min-w-[180px]">
                <Input
                  value={teamNames[team.id] ?? ''}
                  onChange={(e) => setTeamNames((prev) => ({ ...prev, [team.id]: e.target.value }))}
                  onBlur={() => updateTeamName(team.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder={`Team ${team.team_number}`}
                  className="h-8 font-semibold"
                />
                <p className="mt-0.5 text-sm text-gray-500">Starting hole: {team.starting_hole}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Max</label>
                <Select
                  value={String(team.max_players)}
                  onValueChange={(v) => updateMaxPlayers(team.id, Number(v))}
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

            {/* Members */}
            <div className="mt-3 flex flex-wrap gap-1">
              {members.length === 0 ? (
                <span className="text-xs text-gray-400">No members yet</span>
              ) : (
                members.map((p) => (
                  <span
                    key={p.id}
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      p.id === team.captain_id
                        ? 'border-[#1a472a] bg-[#1a472a] text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-700'
                    }`}
                  >
                    {p.name}
                    {p.id === team.captain_id ? ' ★' : ''}
                  </span>
                ))
              )}
            </div>

            {/* Captain selector */}
            {members.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-xs text-gray-500 shrink-0">Captain</label>
                <Select
                  value={team.captain_id ?? ''}
                  onValueChange={(v) => updateCaptain(team.id, v)}
                >
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue placeholder="Select captain" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        );
      })}

      {/* Assign unassigned players */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-gray-900">Assign Players to Teams</h3>
        <div className="space-y-2">
          {players
            .filter((p) => !p.team_id)
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
          {players.filter((p) => !p.team_id).length === 0 && (
            <p className="text-sm text-gray-400">All players assigned.</p>
          )}
        </div>
      </div>
    </div>
  );
}
