'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getActivePlayerMembership } from '@/lib/tournament-membership';
import { useRealtimeScores } from '@/hooks/use-realtime-scores';
import { LeaderboardTable } from '@/components/leaderboard-table';
import { SponsorBanner } from '@/components/sponsor-banner';
import type { LeaderboardRow, Sponsor } from '@/lib/types';

export default function LeaderboardPage() {
  const [tournamentId, setTournamentId] = useState<string>('');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let playerId: string | null = null;
      if (user) {
        const { data: pd } = await supabase
          .from('players')
          .select('id')
          .eq('auth_user_id', user.id)
          .single<{ id: string }>();
        playerId = pd?.id ?? null;
      }

      const membership = playerId ? await getActivePlayerMembership(supabase, playerId) : null;

      // Leaderboard is also a spectator view (system_admin/tournament_admin,
      // or an authenticated player with no tournament_players row) — those
      // viewers have no membership to resolve from, so fall back to whichever
      // tournament is currently active, same as before BUG-0015 scoped the
      // player-facing pages to membership.
      let resolvedTournamentId = membership?.tournamentId ?? null;
      if (!resolvedTournamentId) {
        const { data: fallback } = await supabase
          .from('tournaments')
          .select('id')
          .in('status', ['active', 'paused'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle<{ id: string }>();
        resolvedTournamentId = fallback?.id ?? null;
      }

      if (!resolvedTournamentId) {
        setLoading(false);
        return;
      }

      setTournamentId(resolvedTournamentId);
      setMyTeamId(membership?.teamId ?? null);

      const [{ data: lbData }, { data: sponsorData }] = await Promise.all([
        supabase.rpc('get_leaderboard', { p_tournament_id: resolvedTournamentId }),
        supabase.from('sponsors').select('*').eq('tournament_id', resolvedTournamentId),
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
        <LeaderboardTable rows={rows} myTeamId={myTeamId} />
      </div>
      {sponsors.length > 0 && (
        <div className="mt-2">
          <SponsorBanner sponsors={sponsors} />
        </div>
      )}
    </div>
  );
}
