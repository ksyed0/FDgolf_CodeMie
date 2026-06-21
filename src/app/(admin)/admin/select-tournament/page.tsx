import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { setActiveTournamentAction } from '@/lib/actions/set-active-tournament';

export default async function SelectTournamentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!player) redirect('/dashboard');

  const { data: assignments } = await supabase
    .from('tournament_admin_assignments')
    .select('tournament_id, tournaments!tournament_id(id, name, date, status)')
    .eq('player_id', player.id);

  const tournaments = (assignments ?? [])
    .map(
      (a) =>
        a.tournaments as unknown as {
          id: string;
          name: string;
          date: string;
          status: string;
        } | null
    )
    .filter(Boolean) as { id: string; name: string; date: string; status: string }[];

  async function selectTournament(tournamentId: string) {
    'use server';
    await setActiveTournamentAction(tournamentId);
    redirect('/admin/roster');
  }

  return (
    <div className="min-h-screen bg-[#f4f7f1] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#90a094] mb-1">
          TOURNAMENT MANAGEMENT
        </p>
        <h1 className="font-barlow font-extrabold text-[28px] leading-none text-[#15241c] mb-6">
          Select Tournament
        </h1>
        <div className="flex flex-col gap-3">
          {tournaments.map((t) => (
            <form key={t.id} action={selectTournament.bind(null, t.id)}>
              <button
                type="submit"
                className="w-full text-left bg-white rounded-2xl border border-[#e2e8df] px-5 py-4 hover:border-[#1a472a] hover:shadow-sm transition-all"
              >
                <div className="font-semibold text-[17px] text-[#15241c]">{t.name}</div>
                <div className="text-[13px] text-[#6b7a70] mt-0.5">
                  {t.date} · <span className="capitalize">{t.status}</span>
                </div>
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
