import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RequestBody {
  tournament_id: string;
  team_id: string;
  hole_number: number;
}

interface ScoreRow {
  id: string;
  player_id: string;
  strokes: number;
}

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { tournament_id, team_id, hole_number } = body;

  if (!tournament_id || !team_id || hole_number == null) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: tournament_id, team_id, hole_number' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Fetch all scores for this team + hole, ordered by player_id for determinism on ties
  const { data: scores, error: fetchError } = await supabase
    .from('scores')
    .select('id, player_id, strokes')
    .eq('tournament_id', tournament_id)
    .eq('team_id', team_id)
    .eq('hole_number', hole_number)
    .order('player_id', { ascending: true });

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // No scores yet — nothing to do
  if (!scores || scores.length === 0) {
    return new Response(
      JSON.stringify({ best_ball_player_id: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Find the minimum strokes; on a tie, first by player_id (already sorted)
  const minStrokes = Math.min(...(scores as ScoreRow[]).map((s) => s.strokes));
  const winner = (scores as ScoreRow[]).find((s) => s.strokes === minStrokes)!;

  // Update all rows: winner gets is_best_ball = true, others false
  const updates = (scores as ScoreRow[]).map((s) =>
    supabase
      .from('scores')
      .update({ is_best_ball: s.id === winner.id })
      .eq('id', s.id)
  );

  const results = await Promise.all(updates);

  for (const result of results) {
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(
    JSON.stringify({
      best_ball_player_id: winner.player_id,
      strokes: winner.strokes,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
