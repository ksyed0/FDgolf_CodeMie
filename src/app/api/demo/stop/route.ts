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

  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'paused' })
    .eq('id', tournamentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
