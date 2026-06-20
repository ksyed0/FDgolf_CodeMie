/**
 * Seed script: TV leaderboard demo data
 *
 * Populates the local Supabase instance with 4 teams, 8 players, 18-hole
 * best-ball scores, and GPS shots so all TV stats panels show real numbers.
 *
 * Run:   npx tsx scripts/seed-tv-data.ts
 * Safe:  idempotent — uses upsert everywhere; never deletes existing data.
 *
 * Par values for CIBC Granite Ridge (from seed.sql):
 *   Front 9 — H1=4, H2=3, H3=5, H4=4, H5=3, H6=4, H7=4, H8=5, H9=4  (par 36)
 *   Back  9 — H10=4, H11=3, H12=5, H13=4, H14=4, H15=3, H16=4, H17=5, H18=4 (par 36)
 *   Total par: 72
 *
 * 18-hole leaderboard (vs par 72):
 *   Fairway Falcons  -11
 *   Birdie Brigade    -7
 *   Eagle Eye         -5
 *   Par Hunters       +3
 */

import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(process.cwd(), ".env.local") });

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54341";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const TOURNAMENT_ID = "00000000-0000-0000-0000-000000000001";
const COURSE_ID = "20000000-0000-0000-0000-000000000001";

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Constants ─────────────────────────────────────────────────────────────────

const HOLE_PARS: Record<number, number> = {
  // Front 9
  1: 4, 2: 3, 3: 5, 4: 4, 5: 3, 6: 4, 7: 4, 8: 5, 9: 4,
  // Back 9
  10: 4, 11: 3, 12: 5, 13: 4, 14: 4, 15: 3, 16: 4, 17: 5, 18: 4,
};

// Blue tee GPS coords matching seed.sql (approx pin positions used as tee proxy)
const TEE_GPS: Record<number, { lat: number; lng: number }> = {
  // Front 9
  1:  { lat: 43.5191, lng: -79.9085 },
  2:  { lat: 43.5188, lng: -79.9078 },
  3:  { lat: 43.5182, lng: -79.9071 },
  4:  { lat: 43.5176, lng: -79.9063 },
  5:  { lat: 43.5170, lng: -79.9056 },
  6:  { lat: 43.5164, lng: -79.9049 },
  7:  { lat: 43.5158, lng: -79.9042 },
  8:  { lat: 43.5152, lng: -79.9035 },
  9:  { lat: 43.5146, lng: -79.9028 },
  // Back 9
  10: { lat: 43.5193, lng: -79.9060 },
  11: { lat: 43.5199, lng: -79.9053 },
  12: { lat: 43.5205, lng: -79.9046 },
  13: { lat: 43.5211, lng: -79.9039 },
  14: { lat: 43.5217, lng: -79.9032 },
  15: { lat: 43.5223, lng: -79.9025 },
  16: { lat: 43.5229, lng: -79.9018 },
  17: { lat: 43.5235, lng: -79.9011 },
  18: { lat: 43.5241, lng: -79.9004 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) throw new Error(msg);
}

async function query<T>(
  label: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promise: PromiseLike<{ data: T | null; error: any }>
): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  assert(data !== null, `${label}: no data returned`);
  return data;
}

// ── Step 1: Teams ─────────────────────────────────────────────────────────────

interface TeamDef {
  tournament_id: string;
  team_number: number;
  team_name: string;
  starting_hole: number;
}

const TEAM_DEFS: TeamDef[] = [
  { tournament_id: TOURNAMENT_ID, team_number: 1, team_name: "Fairway Falcons", starting_hole: 1  },
  { tournament_id: TOURNAMENT_ID, team_number: 2, team_name: "Birdie Brigade",  starting_hole: 5  },
  { tournament_id: TOURNAMENT_ID, team_number: 3, team_name: "Eagle Eye",       starting_hole: 10 },
  { tournament_id: TOURNAMENT_ID, team_number: 4, team_name: "Par Hunters",     starting_hole: 14 },
];

async function seedTeams(): Promise<Record<string, string>> {
  console.log("Step 1: Teams");

  const rows = await query(
    "upsert teams",
    db
      .from("teams")
      .upsert(TEAM_DEFS, { onConflict: "tournament_id,team_number" })
      .select("id, team_name")
  );

  const map: Record<string, string> = {};
  for (const r of rows as { id: string; team_name: string }[]) {
    map[r.team_name] = r.id;
    console.log(`  + ${r.team_name}: ${r.id}`);
  }
  return map;
}

// ── Step 2: Players ───────────────────────────────────────────────────────────

interface PlayerDef {
  auth_user_id: string;
  name: string;
  email: string;
  role: "player";
}

const PLAYER_DEFS_RAW = [
  { auth_user_id: "00000000-aaaa-0000-0000-000000000001", name: "Marcus Webb",   email: "marcus@fdgolf.test", team: "Fairway Falcons" },
  { auth_user_id: "00000000-aaaa-0000-0000-000000000002", name: "Priya Sharma",  email: "priya@fdgolf.test",  team: "Fairway Falcons" },
  { auth_user_id: "00000000-aaaa-0000-0000-000000000003", name: "Daniel Kim",    email: "daniel@fdgolf.test", team: "Birdie Brigade"  },
  { auth_user_id: "00000000-aaaa-0000-0000-000000000004", name: "Sarah Chen",    email: "sarah@fdgolf.test",  team: "Birdie Brigade"  },
  { auth_user_id: "00000000-aaaa-0000-0000-000000000005", name: "James O'Brien", email: "james@fdgolf.test",  team: "Eagle Eye"       },
  { auth_user_id: "00000000-aaaa-0000-0000-000000000006", name: "Aisha Patel",   email: "aisha@fdgolf.test",  team: "Eagle Eye"       },
  { auth_user_id: "00000000-aaaa-0000-0000-000000000007", name: "Tom Nguyen",    email: "tom@fdgolf.test",    team: "Par Hunters"     },
  { auth_user_id: "00000000-aaaa-0000-0000-000000000008", name: "Lisa Park",     email: "lisa@fdgolf.test",   team: "Par Hunters"     },
];

async function seedPlayers(
  teamMap: Record<string, string>
): Promise<Record<string, string>> {
  console.log("\nStep 2: Players");

  const playerDefs: PlayerDef[] = PLAYER_DEFS_RAW.map((p) => ({
    auth_user_id: p.auth_user_id,
    name: p.name,
    email: p.email,
    role: "player" as const,
  }));

  const rows = await query(
    "upsert players",
    db
      .from("players")
      .upsert(playerDefs, { onConflict: "auth_user_id" })
      .select("id, name, email")
  );

  const map: Record<string, string> = {};
  for (const r of rows as { id: string; name: string; email: string }[]) {
    map[r.email] = r.id;
    console.log(`  + ${r.name}: ${r.id}`);
  }

  // Seed tournament_players memberships
  const memberships = PLAYER_DEFS_RAW.map((p) => ({
    player_id: map[p.email],
    team_id: teamMap[p.team],
    tournament_id: TOURNAMENT_ID,
  }));
  await query(
    "upsert tournament_players",
    db
      .from("tournament_players")
      .upsert(memberships, { onConflict: "player_id,tournament_id" })
      .select("player_id")
  );
  console.log(`  + ${memberships.length} tournament_players memberships upserted`);

  return map;
}

// ── Step 3: Tee Boxes ─────────────────────────────────────────────────────────

async function seedTeeBoxes(): Promise<void> {
  console.log("\nStep 3: Tee boxes (for longest-drive GPS)");

  const holes = await query(
    "fetch holes",
    db
      .from("holes")
      .select("id, hole_number")
      .eq("course_id", COURSE_ID)
      .in("hole_number", Array.from({ length: 18 }, (_, i) => i + 1))
  );

  const holeIdMap: Record<number, string> = {};
  for (const h of holes as { id: string; hole_number: number }[]) {
    holeIdMap[h.hole_number] = h.id;
  }

  // distance_yards from seed.sql: par3 ~155-175, par4 ~355-410, par5 ~510-530
  const DIST: Record<number, number> = {
    1: 380, 2: 155, 3: 520, 4: 365, 5: 170, 6: 395, 7: 375, 8: 510, 9: 355,
    10: 385, 11: 160, 12: 530, 13: 370, 14: 410, 15: 175, 16: 390, 17: 515, 18: 400,
  };

  const teeBoxRows = Object.entries(TEE_GPS)
    .filter(([hn]) => holeIdMap[Number(hn)])
    .map(([hn, gps]) => ({
      hole_id: holeIdMap[Number(hn)],
      name: "Blue",
      lat: gps.lat,
      lng: gps.lng,
      distance_yards: DIST[Number(hn)],
    }));

  await query(
    "upsert tee_boxes",
    db
      .from("tee_boxes")
      .upsert(teeBoxRows, { onConflict: "hole_id,name" })
      .select("id")
  );

  console.log(`  + ${teeBoxRows.length} Blue tee boxes upserted for holes 1-18`);
}

// ── Step 4: Scores ────────────────────────────────────────────────────────────
//
// Best Ball: one score row per player per hole. is_best_ball=true marks the
// team's counting score. The conflict key is (player_id, tournament_id, hole_number).
//
// 18-hole totals (vs par 72):
//   Fairway Falcons  -11  (front -6, back -5)
//   Birdie Brigade    -7  (front -4, back -3)
//   Eagle Eye         -5  (front -3, back -2)
//   Par Hunters       +3  (front +1, back +2)

const TEAM_SCORES_VSPAR: Record<string, number[]> = {
  //                          H1   H2   H3   H4   H5   H6   H7   H8   H9  H10  H11  H12  H13  H14  H15  H16  H17  H18
  "Fairway Falcons":        [ -1,  -1,   0,  -2,   0,  -1,   0,   0,  -1,  -1,  -1,   0,  -1,   0,  -1,   0,  -1,   0 ], // -11
  "Birdie Brigade":         [  0,  -1,  -1,   0,  -1,   0,  -1,   0,   0,   0,  -1,  -1,   0,  -1,   0,   0,   0,   0 ], //  -7
  "Eagle Eye":              [  0,   0,  -1,   0,   0,  -1,   0,  -1,   0,  -1,   0,   0,  -1,   0,   0,   0,   0,   0 ], //  -5
  "Par Hunters":            [  1,   0,   0,   0,  -1,   0,   0,   0,   1,   0,   0,   1,   0,   1,   0,   0,   0,   0 ], //  +3
};

interface ScoreRow {
  player_id: string;
  team_id: string;
  tournament_id: string;
  hole_number: number;
  strokes: number;
  is_best_ball: boolean;
}

async function seedScores(
  teamMap: Record<string, string>,
  playerMap: Record<string, string>
): Promise<void> {
  console.log("\nStep 4: Scores (18 holes × 4 teams)");

  const teamPlayers: Record<string, string[]> = {
    "Fairway Falcons": [playerMap["marcus@fdgolf.test"], playerMap["priya@fdgolf.test"]],
    "Birdie Brigade":  [playerMap["daniel@fdgolf.test"], playerMap["sarah@fdgolf.test"]],
    "Eagle Eye":       [playerMap["james@fdgolf.test"],  playerMap["aisha@fdgolf.test"]],
    "Par Hunters":     [playerMap["tom@fdgolf.test"],    playerMap["lisa@fdgolf.test"]],
  };

  const scoreRows: ScoreRow[] = [];

  for (const [teamName, vsParArray] of Object.entries(TEAM_SCORES_VSPAR)) {
    const teamId = teamMap[teamName];
    const [p1, p2] = teamPlayers[teamName];

    vsParArray.forEach((vsPar, idx) => {
      const holeNumber = idx + 1;
      const par = HOLE_PARS[holeNumber];
      const bestStrokes = par + vsPar;

      scoreRows.push({
        player_id: p1,
        team_id: teamId,
        tournament_id: TOURNAMENT_ID,
        hole_number: holeNumber,
        strokes: bestStrokes,
        is_best_ball: true,
      });

      scoreRows.push({
        player_id: p2,
        team_id: teamId,
        tournament_id: TOURNAMENT_ID,
        hole_number: holeNumber,
        strokes: par + Math.max(0, vsPar + 1),
        is_best_ball: false,
      });
    });
  }

  await query(
    "upsert scores",
    db
      .from("scores")
      .upsert(scoreRows, { onConflict: "player_id,tournament_id,hole_number" })
      .select("id")
  );

  const bbRows = scoreRows.filter((r) => r.is_best_ball).length;
  console.log(`  + ${scoreRows.length} score rows upserted (${bbRows} best-ball)`);

  for (const [teamName, vsParArray] of Object.entries(TEAM_SCORES_VSPAR)) {
    const total = vsParArray.reduce((a, b) => a + b, 0);
    const sign = total <= 0 ? "" : "+";
    console.log(`    ${teamName.padEnd(18)} ${sign}${total} (vs par 72)`);
  }
}

// ── Step 5: Shots ─────────────────────────────────────────────────────────────
//
// GPS shots for TV Panel C (shot stats): longest drive, club of day, OB counts.
//
// OB distribution (front 9 unchanged, back 9 adds 3 more):
//   Par Hunters:     0 OB  (cleanest)
//   Eagle Eye:       2 OB  (H4 + H13)
//   Fairway Falcons: 3 OB  (H6, H9, H15)
//   Birdie Brigade:  3 OB  (H1, H7, H16)
//
// Longest drive: Sarah Chen ~265m on every par-4/5 tee shot (highest offset).

type Outcome = "in_play" | "out_of_bounds" | "mulligan" | "sunk";

interface ShotRow {
  player_id: string;
  tournament_id: string;
  hole_number: number;
  shot_number: number;
  club_name: string;
  start_lat: number;
  start_lng: number;
  outcome: Outcome;
}

const M_PER_DEG_LAT = 111_000;
const M_PER_DEG_LNG = 80_000;

function offsetGps(
  lat: number,
  lng: number,
  deltaM_lat: number,
  deltaM_lng: number
): { lat: number; lng: number } {
  return {
    lat: lat + deltaM_lat / M_PER_DEG_LAT,
    lng: lng + deltaM_lng / M_PER_DEG_LNG,
  };
}

// Per-player drive landing offsets (metres from tee toward green)
const DRIVE_OFFSETS: Array<{ dLat: number; dLng: number }> = [
  { dLat: -230, dLng:  15 },  // Marcus  — 230m
  { dLat: -255, dLng: -10 },  // Priya   — 255m
  { dLat: -240, dLng:  20 },  // Daniel  — 240m
  { dLat: -265, dLng:   5 },  // Sarah   — 265m (longest)
  { dLat: -220, dLng:  12 },  // James   — 220m
  { dLat: -245, dLng:  -8 },  // Aisha   — 245m
  { dLat: -235, dLng:  18 },  // Tom     — 235m
  { dLat: -250, dLng:   3 },  // Lisa    — 250m
];

// OB events keyed by teamName+holeNumber+playerIndex (global 0-7)
const OB_EVENTS = new Set([
  "Birdie Brigade:1:2",    // Brigade OB #1  (front 9)
  "Birdie Brigade:7:3",    // Brigade OB #2  (front 9)
  "Birdie Brigade:16:2",   // Brigade OB #3  (back 9)
  "Fairway Falcons:6:0",   // Falcons  OB #1 (front 9)
  "Fairway Falcons:9:1",   // Falcons  OB #2 (front 9)
  "Fairway Falcons:15:0",  // Falcons  OB #3 (back 9)
  "Eagle Eye:4:4",         // Eagle Eye OB #1 (front 9)
  "Eagle Eye:13:5",        // Eagle Eye OB #2 (back 9)
]);

function buildShotsForPlayer(
  playerEmail: string,
  playerIndex: number,
  playerMap: Record<string, string>,
  teamName: string
): ShotRow[] {
  const playerId = playerMap[playerEmail];
  const shots: ShotRow[] = [];

  for (let holeNum = 1; holeNum <= 18; holeNum++) {
    const tee = TEE_GPS[holeNum];
    const par = HOLE_PARS[holeNum];
    const driveOffset = DRIVE_OFFSETS[playerIndex];
    const isParThree = par === 3;

    // Shot 1: tee shot
    const teeClub = isParThree ? "7 Iron" : "Driver (1W)";
    const scaleFactor = isParThree ? 0.45 : 1;
    const landingPos = offsetGps(
      tee.lat,
      tee.lng,
      driveOffset.dLat * scaleFactor,
      driveOffset.dLng * scaleFactor
    );
    shots.push({
      player_id: playerId,
      tournament_id: TOURNAMENT_ID,
      hole_number: holeNum,
      shot_number: 1,
      club_name: teeClub,
      start_lat: landingPos.lat,
      start_lng: landingPos.lng,
      outcome: "in_play",
    });

    // Shot 2: approach (par 4+), may be OB
    if (par >= 4) {
      const approachClub = par === 5 ? "7 Iron" : "Pitching Wedge";
      const approachPos = offsetGps(
        tee.lat,
        tee.lng,
        driveOffset.dLat * 1.4,
        driveOffset.dLng * 1.4
      );
      const obKey = `${teamName}:${holeNum}:${playerIndex}`;
      shots.push({
        player_id: playerId,
        tournament_id: TOURNAMENT_ID,
        hole_number: holeNum,
        shot_number: 2,
        club_name: approachClub,
        start_lat: approachPos.lat,
        start_lng: approachPos.lng,
        outcome: OB_EVENTS.has(obKey) ? "out_of_bounds" : "in_play",
      });
    }

    // Shot 3: putt (always sunk)
    const pinPos = offsetGps(
      tee.lat,
      tee.lng,
      driveOffset.dLat * 1.7,
      driveOffset.dLng * 1.7
    );
    shots.push({
      player_id: playerId,
      tournament_id: TOURNAMENT_ID,
      hole_number: holeNum,
      shot_number: 3,
      club_name: "Putter",
      start_lat: pinPos.lat,
      start_lng: pinPos.lng,
      outcome: "sunk",
    });
  }

  return shots;
}

async function seedShots(
  teamMap: Record<string, string>,
  playerMap: Record<string, string>
): Promise<void> {
  console.log("\nStep 5: Shots (18 holes × 8 players)");

  const playerDefs = [
    { email: "marcus@fdgolf.test", team: "Fairway Falcons", idx: 0 },
    { email: "priya@fdgolf.test",  team: "Fairway Falcons", idx: 1 },
    { email: "daniel@fdgolf.test", team: "Birdie Brigade",  idx: 2 },
    { email: "sarah@fdgolf.test",  team: "Birdie Brigade",  idx: 3 },
    { email: "james@fdgolf.test",  team: "Eagle Eye",       idx: 4 },
    { email: "aisha@fdgolf.test",  team: "Eagle Eye",       idx: 5 },
    { email: "tom@fdgolf.test",    team: "Par Hunters",     idx: 6 },
    { email: "lisa@fdgolf.test",   team: "Par Hunters",     idx: 7 },
  ];

  const allShots: ShotRow[] = [];
  for (const p of playerDefs) {
    allShots.push(...buildShotsForPlayer(p.email, p.idx, playerMap, p.team));
  }

  // Delete prior TV-seed shots for these 8 players so re-runs stay clean
  const seededPlayerIds = Object.values(playerMap);
  const { error: delErr } = await db
    .from("shots")
    .delete()
    .in("player_id", seededPlayerIds)
    .eq("tournament_id", TOURNAMENT_ID);
  if (delErr) throw new Error(`delete shots: ${delErr.message}`);

  // Insert in batches of 50
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < allShots.length; i += BATCH) {
    const batch = allShots.slice(i, i + BATCH);
    await query(
      `insert shots batch ${Math.floor(i / BATCH) + 1}`,
      db.from("shots").insert(batch).select("id")
    );
    inserted += batch.length;
  }

  // OB summary per team
  const obByTeam: Record<string, number> = {};
  for (const p of playerDefs) {
    const pid = playerMap[p.email];
    const ob = allShots
      .filter((s) => s.player_id === pid && s.outcome === "out_of_bounds")
      .length;
    obByTeam[p.team] = (obByTeam[p.team] ?? 0) + ob;
  }

  console.log(`  + ${inserted} shots inserted`);
  for (const [team, ob] of Object.entries(obByTeam)) {
    console.log(`    ${team.padEnd(18)} OB shots: ${ob}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Connecting to ${SUPABASE_URL}\n`);
  console.log("=== TV Demo Seed (18 holes) ===\n");

  const teamMap = await seedTeams();
  const playerMap = await seedPlayers(teamMap);
  await seedTeeBoxes();
  await seedScores(teamMap, playerMap);
  await seedShots(teamMap, playerMap);

  console.log(`
=== Summary ===

  4 teams, 8 players, 18-hole scores, GPS shots for all holes

  Leaderboard (vs par 72):
    Fairway Falcons  -11  (front -6, back -5)
    Birdie Brigade    -7  (front -4, back -3)
    Eagle Eye         -5  (front -3, back -2)
    Par Hunters       +3  (front +1, back +2)

  TV Panel A — Birdie Leaders (18 holes):
    Fairway Falcons:  9 birdies + 1 eagle
    Birdie Brigade:   7 birdies
    Eagle Eye:        5 birdies
    Par Hunters:      1 birdie

  TV Panel B — Last 3 holes (H16-H18):
    Fairway Falcons:  par, birdie, par
    Birdie Brigade:   par, par, par
    Eagle Eye:        par, par, par
    Par Hunters:      par, bogey, par

  TV Panel C — Shot Stats:
    Longest drive:    Sarah Chen (Brigade) ~265m
    Club of day:      Driver (1W) — ~40% of shots
    Cleanest team:    Par Hunters (0 OB)

  Tee box GPS seeded for all 18 holes → longest drive resolves ✓

  Supabase Studio: http://127.0.0.1:54343
`);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
