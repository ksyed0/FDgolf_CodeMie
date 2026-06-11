import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SponsorBanner } from '@/components/sponsor-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Tournament, Player, Team, Sponsor } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  setup: 'Not started',
  active: 'In progress',
  completed: 'Completed',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  setup: 'secondary',
  active: 'default',
  completed: 'outline',
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: player }, { data: tournament }] = await Promise.all([
    supabase.from('players').select('*').eq('auth_user_id', user.id).single<Player>(),
    supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single<Tournament>(),
  ]);

  if (player?.role === 'admin') redirect('/admin/tournament');

  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-800">Account pending setup</h2>
        <p className="text-sm text-gray-500">
          Your account has been created but hasn&apos;t been assigned to a team yet.
          Please contact the tournament administrator.
        </p>
      </div>
    );
  }

  let team: Team | null = null;
  let teammates: Player[] = [];
  let sponsors: Sponsor[] = [];

  if (tournament) {
    const [{ data: sponsorData }] = await Promise.all([
      supabase.from('sponsors').select('*').eq('tournament_id', tournament.id),
    ]);
    sponsors = (sponsorData as Sponsor[]) ?? [];

    if (player.team_id) {
      const [{ data: teamData }, { data: teammateData }] = await Promise.all([
        supabase.from('teams').select('*').eq('id', player.team_id).single<Team>(),
        supabase.from('players').select('*').eq('team_id', player.team_id),
      ]);
      team = teamData;
      teammates = (teammateData as Player[]) ?? [];
    }
  }

  const canStartRound = tournament?.status === 'active';

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      {/* Welcome */}
      <div className="rounded-xl bg-[#1a472a] px-4 py-5 text-white">
        <p className="text-sm text-green-300">Welcome back</p>
        <h2 className="text-xl font-bold">{player.name}</h2>
        {player.company && (
          <p className="text-sm text-green-300">
            {player.title ? `${player.title} · ` : ''}
            {player.company}
          </p>
        )}
      </div>

      {/* Tournament status */}
      {tournament && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">{tournament.name}</h3>
            <Badge variant={STATUS_VARIANTS[tournament.status] ?? 'outline'}>
              {STATUS_LABELS[tournament.status] ?? tournament.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">{tournament.venue}</p>
          <p className="text-sm text-gray-500">
            {new Date(tournament.date).toLocaleDateString('en-CA', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      )}

      {/* Team info */}
      {team ? (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800">
            {team.team_name ?? `Team ${team.team_number}`}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Starting hole: {team.starting_hole} &nbsp;·&nbsp; {team.max_players} players max
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {teammates.map((tm) => (
              <span
                key={tm.id}
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  tm.id === player.id
                    ? 'border-[#1a472a] bg-[#1a472a] text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-700'
                }`}
              >
                {tm.name}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-4 shadow-sm text-sm text-gray-500">
          You have not been assigned to a team yet.
        </div>
      )}

      {/* Start Round CTA */}
      <Button
        asChild={canStartRound}
        disabled={!canStartRound}
        className="w-full bg-[#1a472a] text-base hover:bg-[#143820] disabled:opacity-50"
        size="lg"
      >
        {canStartRound ? <Link href="/round">Start Round</Link> : <span>Start Round</span>}
      </Button>
      {!canStartRound && tournament && (
        <p className="text-center text-xs text-gray-500">
          {tournament.status === 'setup'
            ? 'Tournament has not started yet.'
            : 'Tournament is complete.'}
        </p>
      )}

      {/* Sponsors */}
      {sponsors.length > 0 && (
        <div className="mt-4">
          <SponsorBanner sponsors={sponsors} />
        </div>
      )}
    </div>
  );
}
