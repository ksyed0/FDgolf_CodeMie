import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Shot } from '@/lib/types';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  let body: Omit<Shot, 'id' | 'created_at'>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { player_id, tournament_id, hole_number, shot_number, club_name, start_lat, start_lng, outcome } = body;

  if (!player_id || !tournament_id || !hole_number || !shot_number || !club_name || !outcome) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('shots')
    .insert({ player_id, tournament_id, hole_number, shot_number, club_name, start_lat, start_lng, outcome })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
