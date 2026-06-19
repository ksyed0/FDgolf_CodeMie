import { createClient } from '@/lib/supabase/server';
import { TvDisplay } from '@/components/tv/TvDisplay';
import type { LeaderboardRow, Sponsor } from '@/lib/types';
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

  if (!tournament) return notFound();

  const [{ data: lbData }, { data: sponsorData }] = await Promise.all([
    supabase.rpc('get_leaderboard', { p_tournament_id: tournament.id }),
    supabase
      .from('sponsors')
      .select('*')
      .eq('tournament_id', tournament.id)
      .eq('is_active', true)
      .order('display_order'),
  ]);

  return (
    <div className="bg-[#f4f7f1] h-screen w-screen overflow-hidden">
      <TvDisplay
        tournament={tournament}
        initialLeaderboard={(lbData as LeaderboardRow[]) ?? []}
        initialSponsors={(sponsorData as Sponsor[]) ?? []}
      />
    </div>
  );
}
