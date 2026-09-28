import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { seedTalkDemo } from './seed-talk';
import { preSeedHoles, fastForwardRoundState } from './preseed';
import { runBackgroundTeams } from './background-talk';
import { runForeground } from './foreground-talk';
import type { DemoConfig } from './types';

dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

const POLL_INTERVAL_MS = 5_000;
const COMPLETION_TARGET = 1296; // 18 teams × 18 holes × 4 players

// Talk demo fast-forwards silently through holes 1-14, then plays holes
// 15-18 live (0-indexed: 0..13 pre-seeded, 14..17 live).
const PRESEED_FROM_HOLE_IDX = 0;
const PRESEED_TO_HOLE_IDX = 13;
const LIVE_FROM_HOLE_IDX = 14;
const LIVE_TO_HOLE_IDX = 17;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!serviceKey) {
  console.error('[run-talk] SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

async function resetTournament(tournamentId: string) {
  console.log('[run-talk] Resetting tournament…');

  const { data: tp } = await (supabase as any)
    .from('tournament_players').select('player_id').eq('tournament_id', tournamentId);
  const playerIds = (tp ?? []).map((r: { player_id: string }) => r.player_id);
  if (playerIds.length > 0) {
    await (supabase as any).from('shots').delete().in('player_id', playerIds);
  }

  await (supabase as any).from('scores').delete().eq('tournament_id', tournamentId);

  const { data: teams } = await (supabase as any)
    .from('teams').select('id').eq('tournament_id', tournamentId);
  const teamIds = (teams ?? []).map((r: { id: string }) => r.id);
  if (teamIds.length > 0) {
    await (supabase as any).from('round_states').delete().in('team_id', teamIds);
  }

  await (supabase as any).from('tournaments').update({ status: 'active' }).eq('id', tournamentId);
  console.log('[run-talk] Tournament reset — status: active');
}

async function waitForCompletion(tournamentId: string): Promise<void> {
  console.log(`[run-talk] Waiting for ${COMPLETION_TARGET} score rows…`);
  const MAX_COMPLETION_POLLS = 60; // 60 × 5s = 5 minutes
  let polls = 0;
  while (polls < MAX_COMPLETION_POLLS) {
    polls++;
    await sleep(POLL_INTERVAL_MS);
    const { count } = await (supabase as any)
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);

    console.log(`[run-talk] Score count: ${count ?? 0} / ${COMPLETION_TARGET}`);

    if ((count ?? 0) >= COMPLETION_TARGET) {
      await (supabase as any)
        .from('tournaments').update({ status: 'completed' }).eq('id', tournamentId);
      console.log('[run-talk] Tournament completed — restart overlay visible on TV');
      return;
    }
  }
  if (polls >= MAX_COMPLETION_POLLS) throw new Error('[run-talk] waitForCompletion timed out after 5 minutes');
}

async function isStopped(tournamentId: string): Promise<boolean> {
  const { data } = await (supabase as any)
    .from('tournaments')
    .select('status')
    .eq('id', tournamentId)
    .single();
  return data?.status === 'paused';
}

async function main() {
  console.log('[run-talk] Starting FDgolf talk demo…');
  const config: DemoConfig = await seedTalkDemo();

  while (true) {
    try {
      await resetTournament(config.tournamentId);

      console.log('[run-talk] Pre-seeding holes 1-14 silently…');
      await preSeedHoles(config, PRESEED_FROM_HOLE_IDX, PRESEED_TO_HOLE_IDX);

      // preSeedHoles writes scores directly and never touches round_states, so the
      // player-facing /round page's "current hole" pointer would still default to
      // hole 1 (team.starting_hole). Fast-forward it to the first live hole so the
      // foreground captain's phone actually lands on hole 15.
      await fastForwardRoundState(
        config,
        config.teams[0],
        config.holes[LIVE_FROM_HOLE_IDX].holeNumber
      );

      console.log('[run-talk] Starting live kiosk walkthrough from hole 15…');

      // Background teams run concurrently with foreground (fire-and-forget)
      runBackgroundTeams(config, LIVE_FROM_HOLE_IDX, LIVE_TO_HOLE_IDX);

      // Foreground drives the pace — await it
      await runForeground(config, LIVE_FROM_HOLE_IDX, LIVE_TO_HOLE_IDX);

      // Check if stopped mid-round via TV stop button
      if (await isStopped(config.tournamentId)) {
        console.log('[run-talk] Demo stopped — exiting loop. Browser windows remain open.');
        return;
      }

      // Poll until all 1,296 scores are present
      await waitForCompletion(config.tournamentId);

      console.log('[run-talk] Talk demo finished — stopping (no auto-restart). Browser windows remain open.');
      return;
    } catch (err) {
      console.error('[run-talk] iteration failed, retrying in 10s:', err);
      await sleep(10_000);
    }
  }
}

main().catch((err) => {
  console.error('[run-talk] Fatal error:', err);
  process.exit(1);
});
