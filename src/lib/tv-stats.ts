import { SupabaseClient } from '@supabase/supabase-js';
import { distanceMeters, type GpsPosition } from './gps';

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

export interface BirdieStats {
  teamId: string;
  teamName: string;
  birdies: number;
  eagles: number;
}

export interface MomentumEntry {
  teamId: string;
  teamName: string;
  lastThreeHoles: { holeNumber: number; vspar: number }[];
}

export interface HoleDifficulty {
  holeNumber: number;
  avgVsPar: number | null;
}

export interface ShotStats {
  longestDriveMeters: number | null;
  longestDriveTeam: string | null;
  clubOfDay: string | null;
  clubOfDayPct: number | null;
  cleanestTeams: { teamName: string; badShots: number }[];
}

export interface BestAchievement {
  teamName: string;
  holeNumber: number;
  vspar: number;
}

export interface SparklineEntry {
  teamId: string;
  teamName: string;
  track: number[]; // cumulative vs-par after each completed hole
  holesCompleted: number;
}

export interface RosterPlayer {
  playerId: string;
  name: string;
  title: string;
  company: string;
  bbHolesCount: number;
}

export interface TeamSpotlight {
  teamId: string;
  teamName: string;
  score: number;
  holesCompleted: number;
  birdies: number;
  eagles: number;
  pars: number;
  penalties: number;
  roster: RosterPlayer[];
  scorecard: { holeNumber: number; vspar: number }[];
}

// ---------------------------------------------------------------------------
// Internal row shapes
// ---------------------------------------------------------------------------

interface TeamRow {
  id: string;
  team_name: string | null;
}

interface TeeBoxRow {
  lat: number;
  lng: number;
}

interface HoleWithTees {
  id: string;
  hole_number: number;
  tee_boxes: TeeBoxRow[];
}

// Supabase returns joined relations as object or array depending on cardinality
function asTeam(v: unknown): TeamRow | null {
  if (!v) return null;
  const a = v as TeamRow[];
  return Array.isArray(a) ? (a[0] ?? null) : (v as TeamRow);
}

// ---------------------------------------------------------------------------
// Shared helper: fetch hole par map for a course
// scores.hole_number is a plain integer (no FK to holes), so we fetch holes
// separately and build an in-memory map rather than using a PostgREST join.
// ---------------------------------------------------------------------------

async function fetchParMap(
  supabase: SupabaseClient,
  courseId: string
): Promise<Map<number, number>> {
  const { data } = await supabase
    .from('holes')
    .select('hole_number, par')
    .eq('course_id', courseId);
  const map = new Map<number, number>();
  for (const h of data ?? []) {
    map.set(h.hole_number as number, h.par as number);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Empty-result helpers
// ---------------------------------------------------------------------------

function emptyShotStats(): ShotStats {
  return {
    longestDriveMeters: null,
    longestDriveTeam: null,
    clubOfDay: null,
    clubOfDayPct: null,
    cleanestTeams: [],
  };
}

function buildEmptyDifficulty(): HoleDifficulty[] {
  return Array.from({ length: 18 }, (_, i) => ({ holeNumber: i + 1, avgVsPar: null }));
}

// ---------------------------------------------------------------------------
// fetchBirdieStats
// ---------------------------------------------------------------------------

export async function fetchBirdieStats(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<BirdieStats[]> {
  try {
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('course_id')
      .eq('id', tournamentId)
      .single();

    if (tErr) throw tErr;
    if (!tournament) return [];

    const [parMap, { data: scores, error: sErr }] = await Promise.all([
      fetchParMap(supabase, tournament.course_id as string),
      supabase
        .from('scores')
        .select('strokes, hole_number, team_id, teams!inner(id, team_name)')
        .eq('tournament_id', tournamentId)
        .eq('is_best_ball', true),
    ]);

    if (sErr) throw sErr;
    if (!scores || scores.length === 0) return [];

    const map = new Map<
      string,
      { teamId: string; teamName: string; birdies: number; eagles: number }
    >();

    for (const row of scores) {
      const par = parMap.get(row.hole_number as number);
      if (par === undefined) continue;

      const team = asTeam(row.teams);
      if (!team) continue;

      const teamId: string = team.id;
      const teamName: string = team.team_name ?? `Team ${teamId}`;
      const vspar: number = (row.strokes as number) - par;

      if (!map.has(teamId)) {
        map.set(teamId, { teamId, teamName, birdies: 0, eagles: 0 });
      }

      const entry = map.get(teamId)!;
      if (vspar <= -2) {
        entry.eagles++;
        entry.birdies++;
      } else if (vspar === -1) {
        entry.birdies++;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.birdies - a.birdies);
  } catch (error: unknown) {
    console.warn((error as Error).message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// fetchMomentumStats
// ---------------------------------------------------------------------------

export async function fetchMomentumStats(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<MomentumEntry[]> {
  try {
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('course_id')
      .eq('id', tournamentId)
      .single();

    if (tErr) throw tErr;
    if (!tournament) return [];

    const [parMap, { data: scores, error: sErr }] = await Promise.all([
      fetchParMap(supabase, tournament.course_id as string),
      supabase
        .from('scores')
        .select('strokes, hole_number, team_id, teams!inner(id, team_name)')
        .eq('tournament_id', tournamentId)
        .eq('is_best_ball', true),
    ]);

    if (sErr) throw sErr;
    if (!scores || scores.length === 0) return [];

    const teamHoles = new Map<
      string,
      { teamId: string; teamName: string; holes: { holeNumber: number; vspar: number }[] }
    >();

    for (const row of scores) {
      const par = parMap.get(row.hole_number as number);
      if (par === undefined) continue;

      const team = asTeam(row.teams);
      if (!team) continue;

      const teamId: string = team.id;
      const teamName: string = team.team_name ?? `Team ${teamId}`;

      if (!teamHoles.has(teamId)) {
        teamHoles.set(teamId, { teamId, teamName, holes: [] });
      }

      teamHoles.get(teamId)!.holes.push({
        holeNumber: row.hole_number as number,
        vspar: (row.strokes as number) - par,
      });
    }

    return Array.from(teamHoles.values()).map((team) => {
      const sorted = team.holes.sort((a, b) => b.holeNumber - a.holeNumber).slice(0, 3);
      const lastThreeHoles = sorted.sort((a, b) => a.holeNumber - b.holeNumber);
      return { teamId: team.teamId, teamName: team.teamName, lastThreeHoles };
    });
  } catch (error: unknown) {
    console.warn((error as Error).message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// fetchHoleDifficulty
// ---------------------------------------------------------------------------

export async function fetchHoleDifficulty(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<HoleDifficulty[]> {
  try {
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('course_id')
      .eq('id', tournamentId)
      .single();

    if (tErr) throw tErr;
    if (!tournament) return buildEmptyDifficulty();

    const [parMap, { data: scores, error: sErr }] = await Promise.all([
      fetchParMap(supabase, tournament.course_id as string),
      supabase
        .from('scores')
        .select('strokes, hole_number')
        .eq('tournament_id', tournamentId)
        .eq('is_best_ball', true),
    ]);

    if (sErr) throw sErr;

    const holeSums = new Map<number, { sum: number; count: number }>();

    for (const row of scores ?? []) {
      const hn = row.hole_number as number;
      const par = parMap.get(hn);
      if (par === undefined) continue;

      const vspar = (row.strokes as number) - par;
      const existing = holeSums.get(hn);
      if (existing) {
        existing.sum += vspar;
        existing.count++;
      } else {
        holeSums.set(hn, { sum: vspar, count: 1 });
      }
    }

    return Array.from({ length: 18 }, (_, i) => {
      const hn = i + 1;
      const entry = holeSums.get(hn);
      return { holeNumber: hn, avgVsPar: entry ? entry.sum / entry.count : null };
    });
  } catch (error: unknown) {
    console.warn((error as Error).message);
    return buildEmptyDifficulty();
  }
}

// ---------------------------------------------------------------------------
// fetchShotStats
//
// Longest drive: only tee shots (shot_number = 1) with a wood/driver club,
// measured from the shot's recorded GPS position to the hole's tee box.
// Club of day: most-used club on best-ball player:hole combos, putters excluded.
// ---------------------------------------------------------------------------

const PUTTER_RE = /putter/i;
const WOOD_RE = /\b(driver|1w|3w|5w|wood)\b/i;

export async function fetchShotStats(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<ShotStats> {
  try {
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('course_id')
      .eq('id', tournamentId)
      .single();

    if (tErr) throw tErr;
    if (!tournament) return emptyShotStats();

    const courseId: string = tournament.course_id as string;

    const [{ data: shots, error: shotErr }, { data: holesRaw, error: holeErr }] = await Promise.all(
      [
        supabase
          .from('shots')
          .select('player_id, hole_number, shot_number, club_name, start_lat, start_lng, outcome')
          .eq('tournament_id', tournamentId),
        supabase
          .from('holes')
          .select('id, hole_number, tee_boxes(lat, lng)')
          .eq('course_id', courseId),
      ]
    );

    if (shotErr) throw shotErr;
    if (holeErr) throw holeErr;
    if (!shots || shots.length === 0) return emptyShotStats();

    // hole_number → tee GPS (first box with valid coords)
    const teeMap = new Map<number, { lat: number; lng: number }>();
    for (const h of (holesRaw as unknown as HoleWithTees[]) ?? []) {
      const valid = h.tee_boxes?.find((tb) => tb.lat !== 0 && tb.lng !== 0);
      if (valid) teeMap.set(h.hole_number, { lat: valid.lat, lng: valid.lng });
    }

    // player:hole → team name (from best-ball scores)
    const { data: bbScores, error: bbErr } = await supabase
      .from('scores')
      .select('player_id, hole_number, team_id, teams!inner(id, team_name)')
      .eq('tournament_id', tournamentId)
      .eq('is_best_ball', true);

    if (bbErr) throw bbErr;

    const playerTeamMap = new Map<string, string>();
    const bbPlayerHoleSet = new Set<string>();

    for (const s of bbScores ?? []) {
      const team = asTeam(s.teams);
      if (team) {
        playerTeamMap.set(s.player_id as string, team.team_name ?? `Team ${team.id}`);
      }
      bbPlayerHoleSet.add(`${s.player_id as string}:${s.hole_number as number}`);
    }

    // --- Longest drive (tee shots only, wood clubs only) ---
    // Drive distance = distance from tee to where ball landed = distance(tee, shot_2.start),
    // because shot_N.start_lat/lng is where the player stands before shot N (ball's resting spot).
    let longestDriveMeters: number | null = null;
    let longestDrivePlayerId: string | null = null;

    // Group shots by player:hole so we can look up the follow-up shot
    const shotsByPlayerHole = new Map<string, Array<(typeof shots)[number]>>();
    for (const shot of shots) {
      const key = `${shot.player_id as string}:${shot.hole_number as number}`;
      if (!shotsByPlayerHole.has(key)) shotsByPlayerHole.set(key, []);
      shotsByPlayerHole.get(key)!.push(shot);
    }

    for (const [, playerHoleShots] of shotsByPlayerHole) {
      playerHoleShots.sort((a, b) => (a.shot_number as number) - (b.shot_number as number));
      const teeShot = playerHoleShots[0];
      if (!teeShot || (teeShot.shot_number as number) !== 1) continue;
      if (!teeShot.club_name || !WOOD_RE.test(teeShot.club_name as string)) continue;

      const tee = teeMap.get(teeShot.hole_number as number);
      if (!tee) continue;

      // Ball lands where the next shot starts
      const nextShot = playerHoleShots[1];
      if (!nextShot) continue;
      const landLat = nextShot.start_lat as number;
      const landLng = nextShot.start_lng as number;
      if (!landLat || !landLng) continue;

      const landPos: GpsPosition = { lat: landLat, lng: landLng, accuracy: 0 };
      const meters = distanceMeters(landPos, { lat: tee.lat, lng: tee.lng });

      // Sanity check: no human drives > 550 m (~600 yds); filter GPS outliers
      if (meters > 550) continue;

      if (longestDriveMeters === null || meters > longestDriveMeters) {
        longestDriveMeters = Math.round(meters);
        longestDrivePlayerId = teeShot.player_id as string;
      }
    }

    const longestDriveTeam =
      longestDrivePlayerId !== null ? (playerTeamMap.get(longestDrivePlayerId) ?? null) : null;

    // --- Club of day (best-ball shots, putters excluded) ---
    const clubCounts = new Map<string, number>();
    let totalBbShots = 0;

    for (const shot of shots) {
      const key = `${shot.player_id as string}:${shot.hole_number as number}`;
      if (!bbPlayerHoleSet.has(key)) continue;
      if (!shot.club_name) continue;

      const clubName = shot.club_name as string;
      if (PUTTER_RE.test(clubName)) continue;

      clubCounts.set(clubName, (clubCounts.get(clubName) ?? 0) + 1);
      totalBbShots++;
    }

    let clubOfDay: string | null = null;
    let clubOfDayPct: number | null = null;

    if (clubCounts.size > 0 && totalBbShots > 0) {
      let maxCount = 0;
      for (const [name, count] of clubCounts) {
        if (count > maxCount) {
          maxCount = count;
          clubOfDay = name;
        }
      }
      clubOfDayPct = Math.round((maxCount / totalBbShots) * 100);
    }

    // --- Cleanest teams (fewest out_of_bounds shots) ---
    const { data: teams, error: teamErr } = await supabase
      .from('teams')
      .select('id, team_name')
      .eq('tournament_id', tournamentId);

    if (teamErr) throw teamErr;

    const teamIds = teams?.map((t) => t.id as string) ?? [];

    const { data: tpRows, error: playerErr } = await supabase
      .from('tournament_players')
      .select('player_id, team_id')
      .eq('tournament_id', tournamentId)
      .in('team_id', teamIds);

    if (playerErr) throw playerErr;

    const playerToTeamId = new Map<string, string>();
    for (const tp of tpRows ?? []) {
      playerToTeamId.set(tp.player_id as string, tp.team_id as string);
    }

    const badShotMap = new Map<string, { teamName: string; badShots: number }>();
    for (const t of teams ?? []) {
      const tn = (t.team_name as string | null) ?? `Team ${t.id as string}`;
      badShotMap.set(t.id as string, { teamName: tn, badShots: 0 });
    }

    for (const shot of shots) {
      if (shot.outcome !== 'out_of_bounds') continue;
      const teamId = playerToTeamId.get(shot.player_id as string);
      if (!teamId) continue;
      const entry = badShotMap.get(teamId);
      if (entry) entry.badShots++;
    }

    const cleanestTeams = Array.from(badShotMap.values())
      .sort((a, b) => a.badShots - b.badShots)
      .slice(0, 3);

    return {
      longestDriveMeters,
      longestDriveTeam,
      clubOfDay,
      clubOfDayPct,
      cleanestTeams,
    };
  } catch (error: unknown) {
    console.warn((error as Error).message);
    return emptyShotStats();
  }
}

// ---------------------------------------------------------------------------
// fetchBestAchievement
// ---------------------------------------------------------------------------

export async function fetchBestAchievement(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<BestAchievement | null> {
  try {
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('course_id')
      .eq('id', tournamentId)
      .single();

    if (tErr) throw tErr;
    if (!tournament) return null;

    const [parMap, { data: scores, error: sErr }] = await Promise.all([
      fetchParMap(supabase, tournament.course_id as string),
      supabase
        .from('scores')
        .select('strokes, hole_number, teams!inner(id, team_name)')
        .eq('tournament_id', tournamentId)
        .eq('is_best_ball', true),
    ]);

    if (sErr) throw sErr;
    if (!scores || scores.length === 0) return null;

    let best: BestAchievement | null = null;
    let bestVsPar = 0;

    for (const row of scores) {
      const par = parMap.get(row.hole_number as number);
      if (par === undefined) continue;

      const team = asTeam(row.teams);
      if (!team) continue;

      const vspar = (row.strokes as number) - par;
      if (vspar < bestVsPar) {
        bestVsPar = vspar;
        best = {
          teamName: team.team_name ?? `Team ${team.id}`,
          holeNumber: row.hole_number as number,
          vspar,
        };
      }
    }

    return best;
  } catch (error: unknown) {
    console.warn((error as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// fetchSparklineTracks
// ---------------------------------------------------------------------------

export async function fetchSparklineTracks(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<SparklineEntry[]> {
  try {
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('course_id')
      .eq('id', tournamentId)
      .single();
    if (tErr) throw tErr;
    if (!tournament) return [];

    const [parMap, { data: scores, error: sErr }] = await Promise.all([
      fetchParMap(supabase, tournament.course_id as string),
      supabase
        .from('scores')
        .select('strokes, hole_number, team_id, teams!inner(id, team_name)')
        .eq('tournament_id', tournamentId)
        .eq('is_best_ball', true),
    ]);
    if (sErr) throw sErr;
    if (!scores || scores.length === 0) return [];

    const teamHoles = new Map<
      string,
      { teamId: string; teamName: string; holes: { holeNumber: number; vspar: number }[] }
    >();

    for (const row of scores) {
      const par = parMap.get(row.hole_number as number);
      if (par === undefined) continue;
      const team = asTeam(row.teams);
      if (!team) continue;
      const tid: string = team.id;
      if (!teamHoles.has(tid)) {
        teamHoles.set(tid, { teamId: tid, teamName: team.team_name ?? `Team ${tid}`, holes: [] });
      }
      teamHoles.get(tid)!.holes.push({
        holeNumber: row.hole_number as number,
        vspar: (row.strokes as number) - par,
      });
    }

    return Array.from(teamHoles.values()).map(({ teamId, teamName, holes }) => {
      const sorted = holes.sort((a, b) => a.holeNumber - b.holeNumber);
      const track: number[] = [];
      let cum = 0;
      for (const h of sorted) {
        cum += h.vspar;
        track.push(cum);
      }
      return { teamId, teamName, track, holesCompleted: sorted.length };
    });
  } catch (error: unknown) {
    console.warn((error as Error).message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// fetchTeamSpotlight
// ---------------------------------------------------------------------------

export async function fetchTeamSpotlight(
  supabase: SupabaseClient,
  tournamentId: string,
  teamId: string
): Promise<TeamSpotlight | null> {
  try {
    const [{ data: tournament, error: tErr }, { data: tpData, error: tpErr }] = await Promise.all([
      supabase.from('tournaments').select('course_id').eq('id', tournamentId).single(),
      supabase
        .from('tournament_players')
        .select('player_id')
        .eq('team_id', teamId)
        .eq('tournament_id', tournamentId),
    ]);
    if (tErr) throw tErr;
    if (tpErr) throw tpErr;
    if (!tournament) return null;

    const teamPlayerIds = (tpData ?? []).map((r) => r.player_id as string);

    const [
      parMap,
      { data: scores, error: sErr },
      { data: players, error: pErr },
      { data: shots, error: shErr },
    ] = await Promise.all([
      fetchParMap(supabase, tournament.course_id as string),
      supabase
        .from('scores')
        .select('strokes, hole_number, player_id, is_best_ball')
        .eq('tournament_id', tournamentId)
        .eq('team_id', teamId),
      teamPlayerIds.length
        ? supabase.from('players').select('id, name, title, company').in('id', teamPlayerIds)
        : Promise.resolve({ data: [], error: null }),
      teamPlayerIds.length
        ? supabase
            .from('shots')
            .select('outcome')
            .eq('tournament_id', tournamentId)
            .in('player_id', teamPlayerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (sErr) throw sErr;
    if (pErr) throw pErr;

    const bbScores = (scores ?? []).filter((s) => s.is_best_ball);
    const allScores = scores ?? [];

    let score = 0;
    const holesSet = new Set<number>();
    let birdies = 0;
    let eagles = 0;
    let pars = 0;
    const scorecard: { holeNumber: number; vspar: number }[] = [];

    for (const row of bbScores) {
      const par = parMap.get(row.hole_number as number);
      if (par === undefined) continue;
      const vspar = (row.strokes as number) - par;
      score += vspar;
      holesSet.add(row.hole_number as number);
      scorecard.push({ holeNumber: row.hole_number as number, vspar });
      if (vspar <= -2) {
        eagles++;
        birdies++;
      } else if (vspar === -1) birdies++;
      else if (vspar === 0) pars++;
    }
    scorecard.sort((a, b) => a.holeNumber - b.holeNumber);

    const penalties = (shots ?? []).filter((s) => s.outcome === 'out_of_bounds').length;

    // per-player best-ball holes contributed
    const playerBbHoles = new Map<string, number>();
    for (const row of allScores) {
      if (!row.is_best_ball) continue;
      const pid = row.player_id as string;
      playerBbHoles.set(pid, (playerBbHoles.get(pid) ?? 0) + 1);
    }

    const roster: RosterPlayer[] = (players ?? [])
      .map((p) => ({
        playerId: p.id as string,
        name: p.name as string,
        title: (p.title as string) || '',
        company: (p.company as string) || '',
        bbHolesCount: playerBbHoles.get(p.id as string) ?? 0,
      }))
      .sort((a, b) => b.bbHolesCount - a.bbHolesCount);

    const { data: teamRow } = await supabase
      .from('teams')
      .select('team_name')
      .eq('id', teamId)
      .single();

    return {
      teamId,
      teamName: (teamRow?.team_name as string | null) ?? `Team ${teamId}`,
      score,
      holesCompleted: holesSet.size,
      birdies,
      eagles,
      pars,
      penalties,
      roster,
      scorecard,
    };
  } catch (error: unknown) {
    console.warn((error as Error).message);
    return null;
  }
}
