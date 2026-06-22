import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { tournamentId } = body as { tournamentId?: string };

  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fix 2: Distinguish not-found (404) from is_demo=false (403)
  const { data: tournament, error: fetchError } = await supabase
    .from('tournaments')
    .select('id, is_demo')
    .eq('id', tournamentId)
    .single();

  if (fetchError || !tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  if (!tournament.is_demo) {
    return NextResponse.json({ error: 'Not a demo tournament' }, { status: 403 });
  }

  const { data: tournamentPlayers } = await supabase
    .from('tournament_players')
    .select('player_id')
    .eq('tournament_id', tournamentId);

  const playerIds = (tournamentPlayers ?? []).map((r: { player_id: string }) => r.player_id);

  // Fix 1: Surface DB errors from write calls
  if (playerIds.length > 0) {
    const { error: shotsError } = await supabase.from('shots').delete().in('player_id', playerIds);
    if (shotsError) return NextResponse.json({ error: shotsError.message }, { status: 500 });
  }

  const { error: scoresError } = await supabase
    .from('scores')
    .delete()
    .eq('tournament_id', tournamentId);
  if (scoresError) return NextResponse.json({ error: scoresError.message }, { status: 500 });

  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('tournament_id', tournamentId);
  const teamIds = (teams ?? []).map((r: { id: string }) => r.id);
  if (teamIds.length > 0) {
    const { error: roundStatesError } = await supabase
      .from('round_states')
      .delete()
      .in('team_id', teamIds);
    if (roundStatesError)
      return NextResponse.json({ error: roundStatesError.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from('tournaments')
    .update({ status: 'active' })
    .eq('id', tournamentId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
