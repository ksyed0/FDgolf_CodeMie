import { createClient } from '@/lib/supabase/server';
import { LeaderboardTable } from '@/components/leaderboard-table';
import { SponsorBanner } from '@/components/sponsor-banner';
import { AppHeader } from '@/components/app-header';
import type { LeaderboardRow } from '@/components/leaderboard-table';
import type { Sponsor, Tournament } from '@/lib/types';

export const revalidate = 30;

interface LiveLeaderboardPageProps {
  params: { slug: string };
}

export default async function LiveLeaderboardPage({ params }: LiveLeaderboardPageProps) {
  const supabase = await createClient();

  type TournamentWithVenue = Tournament & {
    venue: { name: string; city: string; province_state: string } | null;
  };

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*, venue:venues!venue_id(name, city, province_state)')
    .eq('slug', params.slug)
    .single<TournamentWithVenue>();

  if (!tournament) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Tournament not found.</p>
      </div>
    );
  }

  const [{ data: lbData }, { data: sponsorData }] = await Promise.all([
    supabase.rpc('get_leaderboard', { p_tournament_id: tournament.id }),
    supabase.from('sponsors').select('*').eq('tournament_id', tournament.id).eq('is_active', true),
  ]);

  const rows = (lbData as LeaderboardRow[]) ?? [];
  const sponsors = (sponsorData as Sponsor[]) ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <AppHeader variant="full" showLive={false} />
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-sm text-gray-500">
            {tournament.venue?.name}
            {tournament.venue?.city ? ` · ${tournament.venue.city}` : ''} · Live Leaderboard
          </p>
        </div>
        <div className="rounded-xl border bg-white shadow-sm">
          <LeaderboardTable rows={rows} />
        </div>
        {sponsors.length > 0 && (
          <div className="mt-6">
            <SponsorBanner sponsors={sponsors} />
          </div>
        )}
        <p className="mt-4 text-center text-xs text-gray-400">
          Auto-refreshes every 30 seconds · powered by FDgolf AI/Run™
        </p>
      </div>
    </div>
  );
}
