import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import type { Tournament } from '@/lib/types';
import { TournamentControls } from './tournament-controls';
import { TournamentNameEditor } from './tournament-name-editor';

const STATUS_LABELS: Record<string, string> = {
  setup: 'Not started',
  active: 'In progress',
  completed: 'Completed',
};

export default async function TournamentAdminPage() {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single<Tournament>();

  if (!tournament) {
    return <p className="text-gray-500">No tournament found.</p>;
  }

  const [{ count: playerCount }, { count: teamCount }] = await Promise.all([
    supabase.from('players').select('*', { count: 'exact', head: true }),
    supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournament.id),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tournament</h1>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <TournamentNameEditor
              tournamentId={tournament.id}
              initialName={tournament.name}
            />
            <p className="text-sm text-gray-500">{tournament.venue}</p>
            <p className="text-sm text-gray-500">
              {new Date(tournament.date).toLocaleDateString('en-CA', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <p className="mt-1 text-sm text-gray-500">Format: {tournament.format}</p>
          </div>
          <Badge variant={tournament.status === 'active' ? 'default' : 'secondary'}>
            {STATUS_LABELS[tournament.status] ?? tournament.status}
          </Badge>
        </div>

        <div className="mt-4 flex gap-6 border-t pt-4 text-sm">
          <div>
            <p className="font-semibold text-gray-900">{playerCount ?? 0}</p>
            <p className="text-gray-500">Players</p>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{teamCount ?? 0}</p>
            <p className="text-gray-500">Teams</p>
          </div>
        </div>
      </div>

      <TournamentControls tournament={tournament} slug={tournament.slug} />
    </div>
  );
}
