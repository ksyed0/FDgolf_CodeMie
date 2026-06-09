'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeScores } from '@/hooks/use-realtime-scores';
import { LeaderboardTable } from '@/components/leaderboard-table';
import { SponsorBanner } from '@/components/sponsor-banner';
import type { LeaderboardRow } from '@/components/leaderboard-table';
import type { Sponsor } from '@/lib/types';

export default function LeaderboardPage() {
  const [tournamentId, setTournamentId] = useState<string>('');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function init() {
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!tournament) {
        setLoading(false);
        return;
      }

      setTournamentId(tournament.id);

      const [{ data: lbData }, { data: sponsorData }] = await Promise.all([
        supabase.rpc('get_leaderboard', { p_tournament_id: tournament.id }),
        supabase.from('sponsors').select('*').eq('tournament_id', tournament.id),
      ]);

      setRows((lbData as LeaderboardRow[]) ?? []);
      setSponsors((sponsorData as Sponsor[]) ?? []);
      setLoading(false);
    }
    init().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to realtime score updates and re-fetch leaderboard
  const scores = useRealtimeScores(tournamentId);

  useEffect(() => {
    if (!tournamentId || scores.length === 0) return;
    supabase.rpc('get_leaderboard', { p_tournament_id: tournamentId }).then(({ data }) => {
      if (data) setRows(data as LeaderboardRow[]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, tournamentId]);

  if (loading) {
    return <div className="py-16 text-center text-sm text-gray-500">Loading leaderboard…</div>;
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <h2 className="text-xl font-bold text-gray-900">Leaderboard</h2>
      <div className="rounded-xl border bg-white shadow-sm">
        <LeaderboardTable rows={rows} />
      </div>
      {sponsors.length > 0 && (
        <div className="mt-2">
          <SponsorBanner sponsors={sponsors} />
        </div>
      )}
    </div>
  );
}
