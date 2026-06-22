import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import type { DemoConfig, DemoTeam } from './types';
import { generateScore } from './score-gen';
import { generateShots } from './gps-gen';

dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

const HOLE_DELAY_MS = 20_000;

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

async function injectTeamHole(
  supabase: SupabaseClient,
  config: DemoConfig,
  team: DemoTeam,
  holeIndex: number
) {
  const hole = config.holes[holeIndex % 18];
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
    console.error(`[background] Score error team=${team.name} hole=${hole.holeNumber}:`, scoreError.message);
  }

  const shots = generateShots(config.tournamentId, hole, team.players, scores, config.clubs);
  if (shots.length > 0) {
    const { error: shotError } = await (supabase as any).from('shots').insert(shots);
    if (shotError) {
      console.error(`[background] Shot error team=${team.name} hole=${hole.holeNumber}:`, shotError.message);
    }
  }

  // Trigger best-ball edge function (non-fatal if not running locally)
  await (supabase as any).functions
    .invoke('calculate-best-ball', {
      body: { tournament_id: config.tournamentId, team_id: team.id, hole_number: hole.holeNumber },
    })
    .catch(() => {});
}

async function runTeam(
  supabase: SupabaseClient,
  config: DemoConfig,
  team: DemoTeam,
  teamIndex: number // 1-17
) {
  for (let i = 0; i < 18; i++) {
    const holeIdx = (team.startingHole - 1 + i) % 18;
    await injectTeamHole(supabase, config, team, holeIdx);
    if (i < 17) await sleep(HOLE_DELAY_MS);
  }
  console.log(`[background] Team ${team.name} complete`);
}

export async function runBackgroundTeams(config: DemoConfig): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // config.teams[0] is the foreground team; teams 1-17 are background
  const backgroundTeams = config.teams.slice(1);
  await Promise.all(
    backgroundTeams.map((team: DemoTeam, idx: number) => runTeam(supabase, config, team, idx + 1))
  );
}
