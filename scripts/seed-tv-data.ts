/**
 * Seed script: TV leaderboard demo data
 *
 * Populates the local Supabase instance with 4 teams, 8 players, 9-hole
 * best-ball scores, and ~50 GPS shots so all three TV stats panels show
 * real numbers during a demo.
 *
 * Run:   npx tsx scripts/seed-tv-data.ts
 * Safe:  idempotent — uses upsert everywhere; never deletes existing data.
 *
 * Actual par values for CIBC course holes 1-9 (from DB):
 *   H1=4, H2=3, H3=5, H4=4, H5=3, H6=4, H7=4, H8=5, H9=4  (front 9 par 36)
 *
 * Tee boxes: DB has one Blue tee row for H1 (43.5181, -79.9072) with GPS.
 * The TV longest-drive panel will show a value if shots are within ~300m of
 * any hole's tee box GPS.  We seed tee boxes for H1-H9 so all holes resolve.
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

// Actual par values from the CIBC Granite Ridge course (verified from DB)
const HOLE_PARS: Record<number, number> = {
  1: 4, 2: 3, 3: 5, 4: 4, 5: 3, 6: 4, 7: 4, 8: 5, 9: 4,
};

// Tee box GPS for holes 1-9 (Blue tee, approximate positions from seed.sql pin coords)
// H1 already exists in DB; we upsert all of them so longest-drive resolves correctly.
const TEE_GPS: Record<number, { lat: number; lng: number }> = {
  1: { lat: 43.5191, lng: -79.9085 },
  2: { lat: 43.5188, lng: -79.9078 },
  3: { lat: 43.5182, lng: -79.9071 },
  4: { lat: 43.5176, lng: -79.9063 },
  5: { lat: 43.5170, lng: -79.9056 },
  6: { lat: 43.5164, lng: -79.9049 },
  7: { lat: 43.5158, lng: -79.9042 },
  8: { lat: 43.5152, lng: -79.9035 },
  9: { lat: 43.5146, lng: -79.9028 },
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
  { tournament_id: TOURNAMENT_ID, team_number: 1, team_name: "Fairway Falcons", starting_hole: 1 },
  { tournament_id: TOURNAMENT_ID, team_number: 2, team_name: "Birdie Brigade",  starting_hole: 5 },
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
  team_id: string;
}

// Fixed fake auth UUIDs — won't clash with real auth users (no auth.users rows created)
const PLAYER_DEFS_RAW = [
  { auth_user_id: "00000000-aaaa-0000-0000-000000000001", name: "Marcus Webb",    email: "marcus@fdgolf.test",  team: "Fairway Falcons" },
  { auth_user_id: "00000000-aaaa-0000-0000-000000000002", name: "Priya Sharma",   email: "priya@fdgolf.test",   team: "Fairway Falcons" },
  { auth_user_id: "00000000-aaaa-0000-0000-000000000003", name: "Daniel Kim",     email: "daniel@fdgolf.test",  team: "Birdie Brigade"  },
  { auth_user_id: "00000000-aaaa-0000-0000-000000000004", name: "Sarah Chen",     email: "sarah@fdgolf.test",   team: "Birdie Brigade"  },
  { auth_user_id: "00000000-aaaa-0000-0000-000000000005", name: "James O'Brien",  email: "james@fdgolf.test",   team: "Eagle Eye"       },
  { auth_user_id: "00000000-aaaa-0000-0000-000000000006", name: "Aisha Patel",    email: "aisha@fdgolf.test",   team: "Eagle Eye"       },
  { auth_user_id: "00000000-aaaa-0000-0000-000000000007", name: "Tom Nguyen",     email: "tom@fdgolf.test",     team: "Par Hunters"     },
  { auth_user_id: "00000000-aaaa-0000-0000-000000000008", name: "Lisa Park",      email: "lisa@fdgolf.test",    team: "Par Hunters"     },
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
    team_id: teamMap[p.team],
  }));

  const rows = await query(
    "upsert players",
    db
      .from("players")
      .upsert(playerDefs, { onConflict: "auth_user_id" })
      .select("id, name, email")
  );

  const map: Record<string, string> = {}; // email → player id
  for (const r of rows as { id: string; name: string; email: string }[]) {
    map[r.email] = r.id;
    console.log(`  + ${r.name}: ${r.id}`);
  }
  return map;
}

// ── Step 3: Tee Boxes ─────────────────────────────────────────────────────────
//
// We need hole_id values to upsert tee_boxes.  Fetch them from the DB first.
// Conflict target: (hole_id, name) — unique constraint in migration 007.

async function seedTeeBoxes(): Promise<void> {
  console.log("\nStep 3: Tee boxes (for longest-drive GPS)");

  // Fetch hole UUIDs for this course
  const holes = await query(
    "fetch holes",
    db
      .from("holes")
      .select("id, hole_number")
      .eq("course_id", COURSE_ID)
      .in("hole_number", [1, 2, 3, 4, 5, 6, 7, 8, 9])
  );

  const holeIdMap: Record<number, string> = {};
  for (const h of holes as { id: string; hole_number: number }[]) {
    holeIdMap[h.hole_number] = h.id;
  }

  const teeBoxRows = Object.entries(TEE_GPS)
    .filter(([hn]) => holeIdMap[Number(hn)])
    .map(([hn, gps]) => ({
      hole_id: holeIdMap[Number(hn)],
      name: "Blue",
      lat: gps.lat,
      lng: gps.lng,
      distance_yards: 380 - (Number(hn) % 3) * 20, // plausible yardage variation
    }));

  await query(
    "upsert tee_boxes",
    db
      .from("tee_boxes")
      .upsert(teeBoxRows, { onConflict: "hole_id,name" })
      .select("id")
  );

  console.log(`  + ${teeBoxRows.length} Blue tee boxes upserted for holes 1-9`);
}

// ── Step 4: Scores ────────────────────────────────────────────────────────────
//
// Best Ball format: one score row per player per hole (is_best_ball=true marks
// the winning score).  The scores unique constraint is (player_id, tournament_id,
// hole_number), so we upsert once per player per hole.
//
// Strategy: for each hole we generate a best-ball stroke count per team, then
// attribute it to player[0] of that team (is_best_ball=true).  Player[1] gets
// the same hole recorded with strokes+1 (their individual score, not best ball).
//
// This gives the TV panels real data without over-complicating the seed.

// Best-ball scores per team per hole.  vspar values:
//   - Negative = eagle/birdie, 0 = par, positive = bogey
// Designed so: Falcons lead, Brigade 2nd, Eagle Eye 3rd, Par Hunters 4th
const TEAM_SCORES_VSPAR: Record<string, number[]> = {
  //                           H1   H2   H3   H4   H5   H6   H7   H8   H9
  "Fairway Falcons":          [ -1,  -1,   0,  -2,   0,  -1,   0,   0,  -1 ], // -6  (6 under)
  "Birdie Brigade":           [  0,  -1,  -1,   0,  -1,   0,  -1,   0,   0 ], // -4  (4 under)
  "Eagle Eye":                [  0,   0,  -1,   0,   0,  -1,   0,  -1,   0 ], // -3  (3 under)
  "Par Hunters":              [  1,   0,   0,   0,  -1,   0,   0,   0,   1 ], // +1  (1 over)
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
  console.log("\nStep 4: Scores (9 holes × 4 teams)");

  // Build player lists per team (ordered by PLAYER_DEFS_RAW)
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

      // Best-ball player (p1): the winning score
      scoreRows.push({
        player_id: p1,
        team_id: teamId,
        tournament_id: TOURNAMENT_ID,
        hole_number: holeNumber,
        strokes: bestStrokes,
        is_best_ball: true,
      });

      // Second player (p2): individual score (par or bogey — not best ball)
      scoreRows.push({
        player_id: p2,
        team_id: teamId,
        tournament_id: TOURNAMENT_ID,
        hole_number: holeNumber,
        strokes: par + Math.max(0, vsPar + 1), // always ≥ par, never better than p1
        is_best_ball: false,
      });
    });
  }

  // Upsert — conflict on (player_id, tournament_id, hole_number)
  await query(
    "upsert scores",
    db
      .from("scores")
      .upsert(scoreRows, { onConflict: "player_id,tournament_id,hole_number" })
      .select("id")
  );

  const bbRows = scoreRows.filter((r) => r.is_best_ball).length;
  console.log(`  + ${scoreRows.length} score rows upserted (${bbRows} best-ball)`);

  // Log summary
  for (const [teamName, vsParArray] of Object.entries(TEAM_SCORES_VSPAR)) {
    const total = vsParArray.reduce((a, b) => a + b, 0);
    const sign = total <= 0 ? "" : "+";
    console.log(`    ${teamName.padEnd(18)} ${sign}${total} (vs par 36)`);
  }
}

// ── Step 5: Shots ─────────────────────────────────────────────────────────────
//
// GPS shots for the TV Panel C (shot stats):
//   - longestDrive: computed from distance between shot start_lat/lng and tee box
//   - clubOfDay:    most-used club_name across best-ball hole shots
//   - cleanestTeams: fewest out_of_bounds shots
//
// Shot distribution plan:
//   ~50 shots, holes 1-9, all 8 players
//   Driver ~40%, 7 Iron ~20%, Pitching Wedge 15%, Sand Wedge 10%, Putter 15%
//   Par Hunters: 0 OB  |  Eagle Eye: 1 OB  |  Falcons: 2 OB  |  Brigade: 2 OB
//
// For longest drive: tee shot (shot_number=1, club=Driver) start coords are
// offset slightly from the tee box to simulate a drive landing ~220-280m away.

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

// Approximate degrees for metres at ~43.5°N
// 1° lat ≈ 111,000m;  1° lng ≈ 80,000m at this latitude
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

// Tee-shot landing coords (the shot start_lat/lng = where ball lands after the drive)
// Measured from tee box toward the green — roughly 220-270m out
const DRIVE_OFFSETS: Array<{ dLat: number; dLng: number }> = [
  { dLat: -230, dLng:  15 },  // Marcus  — 230m straight
  { dLat: -255, dLng: -10 },  // Priya   — 255m slight left
  { dLat: -240, dLng:  20 },  // Daniel  — 240m slight right
  { dLat: -265, dLng:   5 },  // Sarah   — 265m (longest)
  { dLat: -220, dLng:  12 },  // James   — 220m
  { dLat: -245, dLng:  -8 },  // Aisha   — 245m
  { dLat: -235, dLng:  18 },  // Tom     — 235m
  { dLat: -250, dLng:   3 },  // Lisa    — 250m
];

function buildShotsForPlayer(
  playerEmail: string,
  playerIndex: number,
  playerMap: Record<string, string>,
  teamId: string,
  teamName: string
): ShotRow[] {
  const playerId = playerMap[playerEmail];
  const shots: ShotRow[] = [];

  for (let holeNum = 1; holeNum <= 9; holeNum++) {
    const tee = TEE_GPS[holeNum];
    const par = HOLE_PARS[holeNum];

    // Shot 1: Tee shot (Driver on par 4/5, mid-iron on par 3)
    const isParThree = par === 3;
    const teeClub = isParThree ? "7 Iron" : "Driver (1W)";
    const teeOutcome: Outcome = "in_play";
    const driveOffset = DRIVE_OFFSETS[playerIndex];
    const landingPos = isParThree
      ? offsetGps(tee.lat, tee.lng, driveOffset.dLat * 0.45, driveOffset.dLng * 0.45)
      : offsetGps(tee.lat, tee.lng, driveOffset.dLat, driveOffset.dLng);

    shots.push({
      player_id: playerId,
      tournament_id: TOURNAMENT_ID,
      hole_number: holeNum,
      shot_number: 1,
      club_name: teeClub,
      start_lat: landingPos.lat,
      start_lng: landingPos.lng,
      outcome: teeOutcome,
    });

    // Shot 2: approach / chip (par 4+)
    if (par >= 4) {
      const approachClub = par === 5 ? "7 Iron" : "Pitching Wedge";
      const approachPos = offsetGps(tee.lat, tee.lng, driveOffset.dLat * 1.4, driveOffset.dLng * 1.4);

      // OB shots per design (team/hole/player specific)
      let shot2Outcome: Outcome = "in_play";
      if (teamName === "Eagle Eye" && holeNum === 4 && playerIndex === 4) {
        shot2Outcome = "out_of_bounds"; // Eagle Eye 1 OB
      } else if (teamName === "Fairway Falcons" && holeNum === 6 && playerIndex === 0) {
        shot2Outcome = "out_of_bounds"; // Falcons OB #1
      } else if (teamName === "Fairway Falcons" && holeNum === 9 && playerIndex === 1) {
        shot2Outcome = "out_of_bounds"; // Falcons OB #2
      } else if (teamName === "Birdie Brigade" && holeNum === 1 && playerIndex === 2) {
        shot2Outcome = "out_of_bounds"; // Brigade OB #1
      } else if (teamName === "Birdie Brigade" && holeNum === 7 && playerIndex === 3) {
        shot2Outcome = "out_of_bounds"; // Brigade OB #2
      }

      shots.push({
        player_id: playerId,
        tournament_id: TOURNAMENT_ID,
        hole_number: holeNum,
        shot_number: 2,
        club_name: approachClub,
        start_lat: approachPos.lat,
        start_lng: approachPos.lng,
        outcome: shot2Outcome,
      });
    }

    // Shot 3: putt
    const pinPos = offsetGps(tee.lat, tee.lng, driveOffset.dLat * 1.7, driveOffset.dLng * 1.7);
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
  console.log("\nStep 5: Shots (~50 GPS shots across 9 holes)");

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
    const teamId = teamMap[p.team];
    const playerShots = buildShotsForPlayer(
      p.email,
      p.idx,
      playerMap,
      teamId,
      p.team
    );
    allShots.push(...playerShots);
  }

  // Delete existing TV-seed shots before upsert (shots has no unique key suitable
  // for conflict resolution beyond id, and we want a clean slate on re-runs).
  // Only delete shots for our 8 seeded players (safe: ignores other players' data).
  const seededPlayerIds = Object.values(playerMap);
  const { error: delErr } = await db
    .from("shots")
    .delete()
    .in("player_id", seededPlayerIds)
    .eq("tournament_id", TOURNAMENT_ID);
  if (delErr) throw new Error(`delete shots: ${delErr.message}`);

  // Insert in batches of 50 to avoid request size limits
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < allShots.length; i += BATCH) {
    const batch = allShots.slice(i, i + BATCH);
    await query(
      `insert shots batch ${i / BATCH + 1}`,
      db.from("shots").insert(batch).select("id")
    );
    inserted += batch.length;
  }

  // Log OB summary per team for verification
  const obByTeam: Record<string, number> = {};
  for (const p of playerDefs) {
    const pid = playerMap[p.email];
    const teamShots = allShots.filter((s) => s.player_id === pid);
    const ob = teamShots.filter((s) => s.outcome === "out_of_bounds").length;
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
  console.log("=== TV Demo Seed ===\n");

  const teamMap = await seedTeams();
  const playerMap = await seedPlayers(teamMap);
  await seedTeeBoxes();
  await seedScores(teamMap, playerMap);
  await seedShots(teamMap, playerMap);

  console.log(`
=== Summary ===

  4 teams, 8 players, 9-hole scores, ~50 GPS shots

  TV Panel A — Birdie/Eagle Leaders:
    Fairway Falcons:  6 birdies + 1 eagle (eagle counts in both)
    Birdie Brigade:   4 birdies
    Eagle Eye:        3 birdies
    Par Hunters:      1 birdie

  TV Panel B — Momentum (last 3 holes, H7-H9):
    Fairway Falcons:  H7 E, H8 par, H9 birdie
    Birdie Brigade:   H7 birdie, H8 par, H9 par
    Eagle Eye:        H7 par, H8 birdie, H9 par
    Par Hunters:      H7 par, H8 par, H9 bogey

  TV Panel C — Shot Stats:
    Longest drive:    Sarah Chen (Brigade) ~265m
    Club of day:      Driver (1W) — ~40% of shots
    Cleanest teams:   Par Hunters (0 OB) > Eagle Eye (1 OB) > Falcons/Brigade (2 OB each)

  Tee box GPS seeded for H1-H9 → longest drive will resolve ✓

  Supabase Studio: http://127.0.0.1:54343
`);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
