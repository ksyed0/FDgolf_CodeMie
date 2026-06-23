import { chromium, type Browser, type Page } from 'playwright';
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

// Persistent browser state — opened once, reused across every loop iteration
let _tvBrowser: Browser | null = null;
let _phoneBrowser: Browser | null = null;
let _tvPage: Page | null = null;
let _phonePage: Page | null = null;
let _loggedIn = false;

async function closeBrowsers() {
  try { await _tvBrowser?.close(); } catch {}
  try { await _phoneBrowser?.close(); } catch {}
  _tvBrowser = null;
  _phoneBrowser = null;
  _tvPage = null;
  _phonePage = null;
  _loggedIn = false;
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

  // Fetch all 4 player scores for this hole and mark best ball locally
  const { data: allScores } = await (supabase as any)
    .from('scores')
    .select('player_id, strokes')
    .eq('team_id', teamId)
    .eq('tournament_id', config.tournamentId)
    .eq('hole_number', hole.holeNumber);
  if (allScores && allScores.length > 0) {
    const minStrokes = Math.min(...allScores.map((s: { strokes: number }) => s.strokes));
    const best = allScores.find((s: { strokes: number }) => s.strokes === minStrokes);
    if (best) {
      await (supabase as any)
        .from('scores')
        .update({ is_best_ball: true })
        .eq('player_id', best.player_id)
        .eq('team_id', teamId)
        .eq('tournament_id', config.tournamentId)
        .eq('hole_number', hole.holeNumber);
    }
  }
}

export async function runForeground(config: DemoConfig): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const foregroundTeam = config.teams[0];
  const otherPlayers = foregroundTeam.players.slice(1);

  // Open browsers once; reuse on subsequent iterations
  if (!_tvBrowser || !_tvPage) {
    _tvBrowser = await chromium.launch({
      headless: false,
      args: ['--window-position=0,25', '--window-size=980,960'],
    });
    _tvPage = await _tvBrowser.newPage();
    await _tvPage.setViewportSize({ width: 980, height: 870 });
  }

  if (!_phoneBrowser || !_phonePage) {
    _phoneBrowser = await chromium.launch({
      headless: false,
      args: ['--window-position=990,25', '--window-size=520,960'],
    });
    _phonePage = await _phoneBrowser.newPage();
    await _phonePage.setViewportSize({ width: 520, height: 874 });
  }

  const tvPage = _tvPage;
  const phonePage = _phonePage;

  try {
    // Reload TV to pick up fresh tournament state
    await tvPage.goto(`${BASE_URL}/live/${config.slug}/tv`);

    // First iteration: log in. Subsequent iterations: navigate directly to /round.
    if (!_loggedIn) {
      await phonePage.goto(`${BASE_URL}/login`);
      await phonePage.fill('#email', DEMO_CAPTAIN_EMAIL);
      await phonePage.fill('#password', DEMO_CAPTAIN_PASSWORD);
      await phonePage.click('button[type="submit"]');
      await phonePage.waitForURL(/dashboard|round/, { timeout: 15_000 });
      _loggedIn = true;
    }

    await phonePage.goto(`${BASE_URL}/round`);
    await phonePage.waitForSelector('text=Hole 1', { timeout: 15_000 });

    for (let i = 0; i < 18; i++) {
      // Check for stop signal before each hole
      const { data: statusRow } = await (supabase as any)
        .from('tournaments')
        .select('status')
        .eq('id', config.tournamentId)
        .single();
      if (statusRow?.status === 'paused') {
        console.log('[foreground] Stop signal received — halting round');
        return;
      }

      const holeIdx = (foregroundTeam.startingHole - 1 + i) % 18;
      const hole = config.holes[holeIdx];
      const captainScore = generateScore(hole.par);

      await phonePage.waitForSelector(`text=Hole ${hole.holeNumber}`, { timeout: 10_000 });

      const openingClub = hole.par === 3 ? '9 Iron' : 'Driver';
      await phonePage.getByRole('combobox').click();
      await phonePage.getByRole('option', { name: openingClub }).click();

      for (let shot = 1; shot <= captainScore; shot++) {
        const isLast = shot === captainScore;

        if (shot > 1) {
          const nextClub = isLast ? 'Putter' : '7 Iron';
          await phonePage.getByRole('combobox').click();
          await phonePage.getByRole('option', { name: nextClub }).click();
        }

        if (isLast) {
          await phonePage.locator('button.rounded-2xl', { hasText: /Sunk/ }).click();
        } else {
          await phonePage.locator('button.rounded-2xl', { hasText: 'In Play' }).click();
        }

        await sleep(SHOT_DELAY_MS);
      }

      await injectOtherPlayers(supabase, config, foregroundTeam.id, holeIdx, otherPlayers);

      await phonePage.waitForSelector('text=Next Hole →', { timeout: 10_000 });
      await phonePage.getByRole('button', { name: 'Next Hole →' }).click();
      await sleep(1_000);
    }

    // Round complete — phone navigates to /leaderboard; TV stays on /live/slug/tv
    await phonePage.waitForURL(/leaderboard/, { timeout: 15_000 });
    console.log('[foreground] Round complete — windows staying open for next iteration');
  } catch (err) {
    // Browser crashed or selector failed — close so they reopen cleanly next iteration
    console.error('[foreground] Error, resetting browsers:', (err as Error).message);
    await closeBrowsers();
    throw err;
  }
}
