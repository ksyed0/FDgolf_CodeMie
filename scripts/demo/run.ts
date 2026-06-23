import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { seedLionhead } from './seed-lionhead';
import { runBackgroundTeams } from './background';
import { runForeground } from './foreground';
import type { DemoConfig } from './types';

dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

const POLL_INTERVAL_MS = 10_000;
const COMPLETION_TARGET = 1296; // 18 teams × 18 holes × 4 players

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!serviceKey) {
  console.error('[run] SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

async function resetTournament(tournamentId: string) {
  console.log('[run] Resetting tournament…');

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
  console.log('[run] Tournament reset — status: active');
}

async function waitForCompletion(tournamentId: string): Promise<void> {
  console.log(`[run] Waiting for ${COMPLETION_TARGET} score rows…`);
  const MAX_COMPLETION_POLLS = 180; // 180 × 10s = 30 minutes
  let polls = 0;
  while (polls < MAX_COMPLETION_POLLS) {
    polls++;
    await sleep(POLL_INTERVAL_MS);
    const { count } = await (supabase as any)
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);

    console.log(`[run] Score count: ${count ?? 0} / ${COMPLETION_TARGET}`);

    if ((count ?? 0) >= COMPLETION_TARGET) {
      await (supabase as any)
        .from('tournaments').update({ status: 'completed' }).eq('id', tournamentId);
      console.log('[run] Tournament completed — restart overlay visible on TV');
      return;
    }
  }
  if (polls >= MAX_COMPLETION_POLLS) throw new Error('[run] waitForCompletion timed out after 30 minutes');
}

async function waitForRestart(tournamentId: string): Promise<void> {
  console.log('[run] Waiting for restart signal (auto-restart in 2 min)…');
  const AUTO_RESTART_POLLS = 12; // 12 × 10s = 2 minutes, then auto-restart
  const MAX_RESTART_POLLS = 120;
  let rpolls = 0;
  while (rpolls < MAX_RESTART_POLLS) {
    rpolls++;
    await sleep(POLL_INTERVAL_MS);
    const { data } = await (supabase as any)
      .from('tournaments').select('status').eq('id', tournamentId).single();
    if (data?.status === 'active') {
      console.log('[run] Restart signal received');
      return;
    }
    if (rpolls >= AUTO_RESTART_POLLS) {
      console.log('[run] Auto-restarting after 2-minute window…');
      await (supabase as any).from('tournaments').update({ status: 'active' }).eq('id', tournamentId);
      return;
    }
  }
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
  console.log('[run] Starting kiosk demo…');
  const config: DemoConfig = await seedLionhead();

  while (true) {
    try {
      await resetTournament(config.tournamentId);

      // Background teams run concurrently with foreground (fire-and-forget)
      runBackgroundTeams(config);

      // Foreground drives the pace — await it
      await runForeground(config);

      // Check if stopped mid-round via TV stop button
      if (await isStopped(config.tournamentId)) {
        console.log('[run] Demo stopped — exiting loop. Browser windows remain open.');
        return;
      }

      // Poll until all 1,296 scores are present
      await waitForCompletion(config.tournamentId);

      // Wait for TV restart button or 2-min auto-restart countdown
      await waitForRestart(config.tournamentId);

      console.log('[run] Loop complete — starting next iteration…');
    } catch (err) {
      console.error('[run] iteration failed, retrying in 10s:', err);
      await sleep(10_000);
    }
  }
}

main().catch((err) => {
  console.error('[run] Fatal error:', err);
  process.exit(1);
});
