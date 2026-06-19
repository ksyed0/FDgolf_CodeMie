'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { AdminTopBar } from '@/components/admin-top-bar';
import type { Score, Player, Team } from '@/lib/types';

interface ScoresTableProps {
  scores: Score[];
  players: Pick<Player, 'id' | 'name'>[];
  teams: Pick<Team, 'id' | 'team_number' | 'team_name'>[];
  parMap: Record<number, number>;
}

export function ScoresTable({ scores: initial, players, teams, parMap }: ScoresTableProps) {
  const [scores, setScores] = useState(initial);
  const [overrideTarget, setOverrideTarget] = useState<Score | null>(null);
  const [overrideStrokes, setOverrideStrokes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const playerMap = Object.fromEntries(players.map((p) => [p.id, p.name]));

  async function saveOverride() {
    if (!overrideTarget) return;
    const strokes = parseInt(overrideStrokes, 10);
    if (isNaN(strokes) || strokes < 1) {
      toast.error('Enter valid strokes');
      return;
    }
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
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
            ? {
                ...s,
                strokes,
                override_by: user?.id ?? null,
                override_at: new Date().toISOString(),
              }
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
    <div>
      <AdminTopBar eyebrow="TOURNAMENT MANAGEMENT" title="Scores">
        <div className="flex items-center gap-2 text-[13px] text-[#6b7a70]">
          <span className="w-2 h-2 rounded-full bg-[#2f8f4e] animate-pulse" />
          <span>Auto-refreshing</span>
        </div>
        <div className="flex items-center gap-2">
          {(
            [
              ['Eagle', '#1a472a', '#fff'],
              ['Birdie', '#c0392b', '#fff'],
              ['Par', '#e8eee4', '#46554c'],
              ['Bogey+', '#f0e4e0', '#a8513f'],
            ] as [string, string, string][]
          ).map(([l, bg, fg]) => (
            <span
              key={l}
              className="rounded-lg px-2.5 py-0.5 text-[12px] font-semibold"
              style={{ background: bg, color: fg }}
            >
              {l}
            </span>
          ))}
        </div>
      </AdminTopBar>

      <div className="px-7 py-6">
        <div className="bg-white rounded-2xl border border-[#e2e8df] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: '#f4f7f1' }}>
                <th
                  className="text-left px-5 py-3 font-barlow font-bold text-[16px] text-[#15241c] sticky left-0 bg-[#f4f7f1]"
                  style={{ minWidth: 160 }}
                >
                  Team
                </th>
                {Array.from({ length: 18 }, (_, i) => (
                  <th
                    key={i + 1}
                    className="font-barlow font-bold text-[16px] text-[#15241c] px-1 py-3 text-center"
                    style={{ minWidth: 44 }}
                  >
                    {i + 1}
                  </th>
                ))}
                <th
                  className="font-barlow font-bold text-[16px] text-[#15241c] px-4 py-3 text-center sticky right-0 bg-[#f4f7f1]"
                  style={{ borderLeft: '2px solid #d6ddd2', minWidth: 72 }}
                >
                  Tot
                </th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => {
                const teamScores = scores.filter((s) => s.team_id === team.id && s.is_best_ball);
                const totalVsPar = teamScores.reduce(
                  (acc, s) => acc + (s.strokes - (parMap[s.hole_number] ?? 4)),
                  0
                );
                return (
                  <tr key={team.id} className="border-t border-[#f0f4ee] hover:bg-[#fafcf9]">
                    <td className="px-5 py-2 font-semibold text-[14px] text-[#15241c] sticky left-0 bg-white">
                      {team.team_name ?? `Team ${team.team_number}`}
                    </td>
                    {Array.from({ length: 18 }, (_, i) => {
                      const hole = i + 1;
                      const score = teamScores.find((s) => s.hole_number === hole);
                      // Find any score for this team+hole to allow override (not just best ball)
                      const anyScore = scores.find(
                        (s) => s.team_id === team.id && s.hole_number === hole && s.is_best_ball
                      );
                      const par = parMap[hole] ?? 4;
                      const vsPar = score ? score.strokes - par : null;

                      let bg = '#f9faf8';
                      let fg = '#c2ccc4';
                      let label = '·';

                      if (score) {
                        label = String(score.strokes);
                        if (vsPar! <= -2) {
                          bg = '#1a472a';
                          fg = '#fff';
                        } else if (vsPar! === -1) {
                          bg = '#c0392b';
                          fg = '#fff';
                        } else if (vsPar! === 0) {
                          bg = '#e8eee4';
                          fg = '#46554c';
                        } else {
                          bg = '#f0e4e0';
                          fg = '#a8513f';
                        }
                      }

                      return (
                        <td key={hole} className="px-1 py-2 text-center">
                          <button
                            className="font-semibold text-[13px] rounded-[7px] mx-auto flex items-center justify-center"
                            style={{ width: 28, height: 28, background: bg, color: fg }}
                            onClick={() => {
                              if (anyScore) {
                                setOverrideTarget(anyScore);
                                setOverrideStrokes(String(anyScore.strokes));
                              }
                            }}
                          >
                            {label}
                          </button>
                        </td>
                      );
                    })}
                    {/* Total */}
                    <td
                      className="px-4 py-2 text-center font-barlow font-extrabold text-[22px] sticky right-0 bg-white"
                      style={{
                        borderLeft: '2px solid #d6ddd2',
                        color:
                          totalVsPar < 0 ? '#c0392b' : totalVsPar === 0 ? '#1a472a' : '#33413a',
                      }}
                    >
                      {totalVsPar < 0
                        ? `−${Math.abs(totalVsPar)}`
                        : totalVsPar === 0
                          ? 'E'
                          : `+${totalVsPar}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {teams.length === 0 && (
            <p className="py-8 text-center text-sm text-[#6b7a70]">No teams or scores yet.</p>
          )}
        </div>
      </div>

      {/* Override dialog */}
      <Dialog
        open={!!overrideTarget}
        onOpenChange={(open) => {
          if (!open) setOverrideTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Score</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              Player:{' '}
              <strong>
                {overrideTarget ? (playerMap[overrideTarget.player_id] ?? 'Unknown') : ''}
              </strong>
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
            <Button variant="outline" onClick={() => setOverrideTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[#1a472a] hover:bg-[#143820]"
              onClick={saveOverride}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
