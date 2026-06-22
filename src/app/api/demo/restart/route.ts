import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { tournamentId } = body as { tournamentId?: string };

  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, is_demo')
    .eq('id', tournamentId)
    .single();

  if (!tournament?.is_demo) {
    return NextResponse.json({ error: 'Not a demo tournament' }, { status: 403 });
  }

  const { data: tournamentPlayers } = await supabase
    .from('tournament_players')
    .select('player_id')
    .eq('tournament_id', tournamentId);

  const playerIds = (tournamentPlayers ?? []).map((r: { player_id: string }) => r.player_id);

  if (playerIds.length > 0) {
    await supabase.from('shots').delete().in('player_id', playerIds);
  }

  await supabase.from('scores').delete().eq('tournament_id', tournamentId);

  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('tournament_id', tournamentId);
  const teamIds = (teams ?? []).map((r: { id: string }) => r.id);
  if (teamIds.length > 0) {
    await supabase.from('round_states').delete().in('team_id', teamIds);
  }

  await supabase.from('tournaments').update({ status: 'active' }).eq('id', tournamentId);

  return NextResponse.json({ ok: true });
}
