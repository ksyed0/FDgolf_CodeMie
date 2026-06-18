import { createClient } from '@/lib/supabase/server';
import { TvDisplay } from '@/components/tv/TvDisplay';
import type { LeaderboardRow } from '@/components/leaderboard-table';
import type { Tournament } from '@/lib/types';
import { notFound } from 'next/navigation';

export const revalidate = 30;

export const viewport = { width: '1920', initialScale: 1 };

interface TvLeaderboardPageProps {
  params: Promise<{ slug: string }>;
}

export default async function TvLeaderboardPage({ params }: TvLeaderboardPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  type TournamentWithVenue = Tournament & {
    venue: { name: string; city: string; province_state: string } | null;
  };

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*, venue:venues!venue_id(name, city, province_state)')
    .eq('slug', slug)
    .single<TournamentWithVenue>();

  if (!tournament) {
    return notFound();
  }

  const { data: lbData } = await supabase.rpc('get_leaderboard', {
    p_tournament_id: tournament.id,
  });

  const leaderboard = (lbData as LeaderboardRow[]) ?? [];

  return (
    <div className="bg-[#0f172a] h-screen w-screen overflow-hidden">
      <TvDisplay tournament={tournament} initialLeaderboard={leaderboard} />
    </div>
  );
}
