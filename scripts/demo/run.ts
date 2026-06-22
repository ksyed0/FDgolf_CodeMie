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
  while (true) {
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
}

async function waitForRestart(tournamentId: string): Promise<void> {
  console.log('[run] Waiting for restart signal…');
  while (true) {
    await sleep(POLL_INTERVAL_MS);
    const { data } = await (supabase as any)
      .from('tournaments').select('status').eq('id', tournamentId).single();
    if (data?.status === 'active') {
      console.log('[run] Restart signal received');
      return;
    }
  }
}

async function closeBrowsers() {
  const browsers = (runForeground as any).__browsers;
  if (browsers) {
    await browsers.tvBrowser?.close().catch(() => {});
    await browsers.phoneBrowser?.close().catch(() => {});
    (runForeground as any).__browsers = null;
  }
}

async function main() {
  console.log('[run] Starting kiosk demo…');
  const config: DemoConfig = await seedLionhead();

  while (true) {
    await resetTournament(config.tournamentId);

    // Background teams run concurrently with foreground
    const backgroundPromise = runBackgroundTeams(config);

    // Foreground drives the pace — await it
    await runForeground(config);

    // Wait for any lagging background inserts
    await backgroundPromise;

    // Poll until all 1,296 scores are present
    await waitForCompletion(config.tournamentId);

    // Wait for TV restart button or 10-min auto-restart countdown
    await waitForRestart(config.tournamentId);

    await closeBrowsers();
    console.log('[run] Loop complete — starting next iteration…');
  }
}

main().catch((err) => {
  console.error('[run] Fatal error:', err);
  process.exit(1);
});
