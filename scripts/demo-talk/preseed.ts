import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import type { DemoConfig, DemoTeam } from './types';
import { generateScore } from './score-gen';
import { generateShots } from './gps-gen';

dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

async function injectTeamHole(
  supabase: SupabaseClient,
  config: DemoConfig,
  team: DemoTeam,
  holeIdx: number
) {
  const hole = config.holes[holeIdx];
  const scores = team.players.map(() => generateScore(hole.par));

  const scoreRows = team.players.map((player, idx) => ({
    player_id: player.id,
    team_id: team.id,
    tournament_id: config.tournamentId,
    hole_number: hole.holeNumber,
    strokes: scores[idx],
    is_best_ball: false,
    override_by: null,
    override_at: null,
  }));

  const { error: scoreError } = await (supabase as any)
    .from('scores')
    .upsert(scoreRows, { onConflict: 'player_id,tournament_id,hole_number' });

  if (scoreError) {
    console.error(`[preseed] Score error team=${team.name} hole=${hole.holeNumber}:`, scoreError.message);
    return;
  }

  const minStrokes = Math.min(...scores);
  const bestIdx = scores.indexOf(minStrokes);
  await (supabase as any)
    .from('scores')
    .update({ is_best_ball: true })
    .eq('player_id', team.players[bestIdx].id)
    .eq('team_id', team.id)
    .eq('tournament_id', config.tournamentId)
    .eq('hole_number', hole.holeNumber);

  const shots = generateShots(config.tournamentId, hole, team.players, scores, config.clubs);
  if (shots.length > 0) {
    const { error: shotError } = await (supabase as any).from('shots').insert(shots);
    if (shotError) {
      console.error(`[preseed] Shot error team=${team.name} hole=${hole.holeNumber}:`, shotError.message);
    }
  }
}

async function preSeedTeam(
  supabase: SupabaseClient,
  config: DemoConfig,
  team: DemoTeam,
  fromHoleIdx: number,
  toHoleIdx: number
) {
  for (let holeIdx = fromHoleIdx; holeIdx <= toHoleIdx; holeIdx++) {
    await injectTeamHole(supabase, config, team, holeIdx);
  }
}

/**
 * Instantly and silently seeds scores + shots for every team (including the
 * foreground captain's team) across holes fromHoleIdx..toHoleIdx (0-indexed,
 * inclusive) — no delays, no per-hole logging. Used to fast-forward the talk
 * demo through its early holes before the live kiosk walkthrough begins.
 */
export async function preSeedHoles(
  config: DemoConfig,
  fromHoleIdx: number,
  toHoleIdx: number
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await Promise.all(
    config.teams.map((team) => preSeedTeam(supabase, config, team, fromHoleIdx, toHoleIdx))
  );

  console.log(
    `[preseed] Holes ${fromHoleIdx + 1}-${toHoleIdx + 1} seeded for ${config.teams.length} teams`
  );
}

/**
 * The player-facing /round page tracks progress via a stored `round_states.current_hole`
 * pointer (lazily created at `team.starting_hole` on first load) — it does NOT derive
 * "current hole" from the scores already present. Since preSeedHoles writes scores
 * directly and bypasses the round page entirely, that pointer is left at hole 1 for
 * every team. This upserts it to the first live hole for the foreground team, so the
 * captain's phone lands on the right hole instead of timing out waiting for it.
 */
export async function fastForwardRoundState(
  config: DemoConfig,
  team: DemoTeam,
  currentHoleNumber: number
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await (supabase as any).from('round_states').upsert(
    {
      team_id: team.id,
      current_hole: currentHoleNumber,
      active_player_id: team.players[0].id,
      status: 'in_progress',
    },
    { onConflict: 'team_id' }
  );
  if (error) {
    console.error('[preseed] round_states fast-forward failed:', error.message);
  } else {
    console.log(`[preseed] round_states fast-forwarded to hole ${currentHoleNumber} for ${team.name}`);
  }
}
