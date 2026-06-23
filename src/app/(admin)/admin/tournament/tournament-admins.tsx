'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';

interface AdminRow {
  id: string;
  player_id: string;
  name: string;
  email: string;
}

interface PlayerResult {
  id: string;
  name: string;
  email: string;
}

const supabase = createClient();

export function TournamentAdmins({ tournamentId }: { tournamentId: string }) {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tournament_admin_assignments')
        .select('id, player_id, players!player_id(name, email)')
        .eq('tournament_id', tournamentId);
      setAdmins(
        (data ?? []).map((a) => {
          const p = a.players as unknown as { name: string; email: string } | null;
          return { id: a.id, player_id: a.player_id, name: p?.name ?? '', email: p?.email ?? '' };
        })
      );
    }
    load();
  }, [tournamentId]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('players')
        .select('id, name, email')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(8);
      const existingIds = new Set(admins.map((a) => a.player_id));
      setResults(((data ?? []) as PlayerResult[]).filter((p) => !existingIds.has(p.id)));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, admins]);

  async function assign(player: PlayerResult) {
    setLoading(true);
    const { data, error } = await supabase
      .from('tournament_admin_assignments')
      .insert({ player_id: player.id, tournament_id: tournamentId })
      .select('id, player_id')
      .single();

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    await supabase
      .from('players')
      .update({ role: 'tournament_admin' })
      .eq('id', player.id)
      .eq('role', 'player');

    setAdmins((prev) => [
      ...prev,
      { id: data.id, player_id: data.player_id, name: player.name, email: player.email },
    ]);
    toast.success(`${player.name} assigned as tournament admin.`);
    setQuery('');
    setResults([]);
    setLoading(false);
  }

  async function remove(assignmentId: string) {
    const { error } = await supabase
      .from('tournament_admin_assignments')
      .delete()
      .eq('id', assignmentId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAdmins((prev) => prev.filter((a) => a.id !== assignmentId));
    toast.success('Admin removed.');
    setConfirmRemoveId(null);
  }

  return (
    <section className="bg-white rounded-2xl border border-[#e2e8df] p-5 space-y-4">
      <p className="font-barlow font-bold text-[18px] text-[#15241c]">Tournament Admins</p>

      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search player by name or email…"
          className="h-8 text-[13px]"
        />
        {results.length > 0 && (
          <div className="absolute z-10 top-full mt-1 w-full rounded-2xl border border-[#e2e8df] bg-white shadow-lg overflow-hidden">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => assign(p)}
                disabled={loading}
                className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#eef2ea] flex justify-between items-center"
              >
                <span className="font-medium text-[#15241c]">{p.name}</span>
                <span className="text-[#6b7a70]">{p.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {admins.length === 0 ? (
        <p className="text-[13px] text-[#6b7a70] italic">No admins assigned yet.</p>
      ) : (
        <ul className="divide-y divide-[#e2e8df]">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2.5">
              <div>
                <div className="text-[13px] font-semibold text-[#15241c]">{a.name}</div>
                <div className="text-[12px] text-[#6b7a70]">{a.email}</div>
              </div>
              {confirmRemoveId === a.id ? (
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="text-[#6b7a70]">Remove?</span>
                  <button
                    onClick={() => remove(a.id)}
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
                  onClick={() => setConfirmRemoveId(a.id)}
                  className="rounded-xl px-3 py-1.5 text-[13px] font-semibold bg-[#f7ece9] text-[#a8513f]"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
