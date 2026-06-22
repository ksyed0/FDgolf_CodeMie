import { chromium } from 'playwright';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import type { DemoConfig } from './types';
import { generateScore } from './score-gen';
import { generateShots } from './gps-gen';

dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

const SHOT_DELAY_MS = 5_000;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const DEMO_CAPTAIN_EMAIL = 'demo-captain@fdgolf.demo';
const DEMO_CAPTAIN_PASSWORD = process.env.DEMO_CAPTAIN_PASSWORD ?? 'DemoKiosk2026!';

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

async function injectOtherPlayers(
  supabase: SupabaseClient,
  config: DemoConfig,
  teamId: string,
  holeIdx: number,
  otherPlayers: Array<{ id: string; name: string }>
) {
  const hole = config.holes[holeIdx];
  const scores = otherPlayers.map(() => generateScore(hole.par));

  const scoreRows = otherPlayers.map((player, idx) => ({
    player_id: player.id,
    team_id: teamId,
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
  if (scoreError) console.error('[foreground] score upsert error:', scoreError.message);

  const shots = generateShots(config.tournamentId, hole, otherPlayers, scores, config.clubs);
  if (shots.length > 0) {
    const { error: shotError } = await (supabase as any).from('shots').insert(shots);
    if (shotError) console.error('[foreground] shots insert error:', shotError.message);
  }

  await (supabase as any).functions
    .invoke('calculate-best-ball', {
      body: { tournament_id: config.tournamentId, team_id: teamId, hole_number: hole.holeNumber },
    })
    .catch(() => {});
}

export async function runForeground(config: DemoConfig): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const foregroundTeam = config.teams[0];
  const otherPlayers = foregroundTeam.players.slice(1);

  // TV window (left)
  const tvBrowser = await chromium.launch({
    headless: false,
    args: ['--window-position=0,60', '--window-size=1270,980'],
  });
  const phoneBrowser = await chromium.launch({
    headless: false,
    args: ['--window-position=1280,60', '--window-size=390,844'],
  });

  try {
    const tvPage = await tvBrowser.newPage();
    await tvPage.goto(`${BASE_URL}/live/${config.slug}/tv`);

    // Phone window (right)
    const phonePage = await phoneBrowser.newPage();
    await phonePage.setViewportSize({ width: 390, height: 844 });

    // Log in as demo captain
    await phonePage.goto(`${BASE_URL}/login`);
    await phonePage.fill('#email', DEMO_CAPTAIN_EMAIL);
    await phonePage.fill('#password', DEMO_CAPTAIN_PASSWORD);
    await phonePage.click('button[type="submit"]');
    await phonePage.waitForURL(/dashboard|round/, { timeout: 15_000 });

    // Navigate to round page (creates round_state from starting_hole=1)
    await phonePage.goto(`${BASE_URL}/round`);
    await phonePage.waitForSelector('text=Hole 1', { timeout: 15_000 });

    for (let i = 0; i < 18; i++) {
      const holeIdx = (foregroundTeam.startingHole - 1 + i) % 18;
      const hole = config.holes[holeIdx];
      const captainScore = generateScore(hole.par);

      // Wait for current hole to be visible
      await phonePage.waitForSelector(`text=Hole ${hole.holeNumber}`, { timeout: 10_000 });

      // Select opening club
      const openingClub = hole.par === 3 ? '9 Iron' : 'Driver';
      await phonePage.getByRole('combobox').click();
      await phonePage.getByRole('option', { name: openingClub }).click();

      // Record each shot
      for (let shot = 1; shot <= captainScore; shot++) {
        const isLast = shot === captainScore;

        if (shot > 1) {
          const nextClub = isLast ? 'Putter' : '7 Iron';
          await phonePage.getByRole('combobox').click();
          await phonePage.getByRole('option', { name: nextClub }).click();
        }

        if (isLast) {
          await phonePage.getByRole('button', { name: /Sunk/ }).click();
        } else {
          await phonePage.getByRole('button', { name: 'In Play' }).click();
        }

        await sleep(SHOT_DELAY_MS);
      }

      // Inject other 3 players' scores to DB while captain's sunk is processing
      await injectOtherPlayers(supabase, config, foregroundTeam.id, holeIdx, otherPlayers);

      // Advance to next hole
      await phonePage.waitForSelector('text=Next Hole →', { timeout: 10_000 });
      await phonePage.getByRole('button', { name: 'Next Hole →' }).click();
      await sleep(1_000);
    }

    // Round complete — app redirects to /leaderboard
    await phonePage.waitForURL(/leaderboard/, { timeout: 15_000 });
    console.log('[foreground] Round complete');
  } finally {
    await tvBrowser.close();
    await phoneBrowser.close();
  }
}
