'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Score, Player, Team } from '@/lib/types';

interface ScoresTableProps {
  scores: Score[];
  players: Pick<Player, 'id' | 'name'>[];
  teams: Pick<Team, 'id' | 'team_number' | 'team_name'>[];
}

export function ScoresTable({ scores: initial, players, teams }: ScoresTableProps) {
  const [scores, setScores] = useState(initial);
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterHole, setFilterHole] = useState<string>('all');
  const [overrideTarget, setOverrideTarget] = useState<Score | null>(null);
  const [overrideStrokes, setOverrideStrokes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const playerMap = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.team_name ?? `Team ${t.team_number}`]));

  const holes = Array.from(new Set(scores.map((s) => s.hole_number))).sort((a, b) => a - b);

  const filtered = scores.filter((s) => {
    if (filterTeam !== 'all' && s.team_id !== filterTeam) return false;
    if (filterHole !== 'all' && String(s.hole_number) !== filterHole) return false;
    return true;
  });

  async function saveOverride() {
    if (!overrideTarget) return;
    const strokes = parseInt(overrideStrokes, 10);
    if (isNaN(strokes) || strokes < 1) { toast.error('Enter valid strokes'); return; }
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('scores')
      .update({ strokes, override_by: user?.id ?? null, override_at: new Date().toISOString() })
      .eq('id', overrideTarget.id);

    if (error) {
      toast.error(error.message);
    } else {
      setScores((prev) =>
        prev.map((s) =>
          s.id === overrideTarget.id
            ? { ...s, strokes, override_by: user?.id ?? null, override_at: new Date().toISOString() }
            : s
        )
      );
      toast.success('Score overridden');
      setOverrideTarget(null);
      setOverrideStrokes('');
    }
    setSaving(false);
  }

  return (
    <>
      {/* Filters */}
      <div className="flex gap-2 p-3 border-b flex-wrap">
        <Select value={filterTeam} onValueChange={setFilterTeam}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue placeholder="All teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>{teamMap[t.id]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterHole} onValueChange={setFilterHole}>
          <SelectTrigger className="h-8 w-28">
            <SelectValue placeholder="All holes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All holes</SelectItem>
            {holes.map((h) => (
              <SelectItem key={h} value={String(h)}>Hole {h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <th className="px-4 py-2 text-left">Player</th>
              <th className="px-4 py-2 text-left">Team</th>
              <th className="px-4 py-2 text-left">Hole</th>
              <th className="px-4 py-2 text-left">Strokes</th>
              <th className="px-4 py-2 text-left">Best Ball</th>
              <th className="px-4 py-2 text-left">Override</th>
              <th className="px-4 py-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{playerMap[s.player_id] ?? s.player_id.slice(0, 8)}</td>
                <td className="px-4 py-2">{teamMap[s.team_id] ?? '—'}</td>
                <td className="px-4 py-2">{s.hole_number}</td>
                <td className="px-4 py-2 font-medium">{s.strokes}</td>
                <td className="px-4 py-2">{s.is_best_ball ? '★' : ''}</td>
                <td className="px-4 py-2 text-xs text-gray-400">
                  {s.override_by ? 'Yes' : '—'}
                </td>
                <td className="px-4 py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setOverrideTarget(s); setOverrideStrokes(String(s.strokes)); }}
                  >
                    Override
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">No scores.</p>
        )}
      </div>

      {/* Override dialog */}
      <Dialog open={!!overrideTarget} onOpenChange={(open) => { if (!open) setOverrideTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Score</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              Player: <strong>{overrideTarget ? playerMap[overrideTarget.player_id] : ''}</strong>
              &nbsp;— Hole {overrideTarget?.hole_number}
            </p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Corrected strokes</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={overrideStrokes}
                onChange={(e) => setOverrideStrokes(e.target.value)}
                className="w-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideTarget(null)}>Cancel</Button>
            <Button className="bg-[#1a472a] hover:bg-[#143820]" onClick={saveOverride} disabled={saving}>
              {saving ? 'Saving…' : 'Save Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
