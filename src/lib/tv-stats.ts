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

// ---------------------------------------------------------------------------
// Internal row shapes returned by Supabase (relations come back as arrays)
// ---------------------------------------------------------------------------

interface HoleRow {
  hole_number: number;
  par: number;
  course_id: string;
}

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

// Supabase returns joined relations as arrays; cast via unknown to avoid TS overlap errors
function asHole(v: unknown): HoleRow | null {
  if (!v) return null;
  const a = v as HoleRow[];
  return Array.isArray(a) ? (a[0] ?? null) : (v as HoleRow);
}

function asTeam(v: unknown): TeamRow | null {
  if (!v) return null;
  const a = v as TeamRow[];
  return Array.isArray(a) ? (a[0] ?? null) : (v as TeamRow);
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

    const { data: scores, error: sErr } = await supabase
      .from('scores')
      .select(
        `strokes, team_id,
         teams!inner(id, team_name),
         holes!inner(hole_number, par, course_id)`
      )
      .eq('tournament_id', tournamentId)
      .eq('is_best_ball', true);

    if (sErr) throw sErr;
    if (!scores || scores.length === 0) return [];

    const map = new Map<
      string,
      { teamId: string; teamName: string; birdies: number; eagles: number }
    >();

    for (const row of scores) {
      const hole = asHole(row.holes);
      if (!hole || hole.course_id !== (tournament.course_id as string)) continue;

      const team = asTeam(row.teams);
      if (!team) continue;

      const teamId: string = team.id;
      const teamName: string = team.team_name ?? `Team ${teamId}`;
      const vspar: number = (row.strokes as number) - hole.par;

      if (!map.has(teamId)) {
        map.set(teamId, { teamId, teamName, birdies: 0, eagles: 0 });
      }

      const entry = map.get(teamId)!;
      if (vspar <= -2) {
        entry.eagles++;
        entry.birdies++; // eagles are also under-par achievements
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

    const { data: scores, error: sErr } = await supabase
      .from('scores')
      .select(
        `strokes, team_id,
         teams!inner(id, team_name),
         holes!inner(hole_number, par, course_id)`
      )
      .eq('tournament_id', tournamentId)
      .eq('is_best_ball', true);

    if (sErr) throw sErr;
    if (!scores || scores.length === 0) return [];

    const teamHoles = new Map<
      string,
      { teamId: string; teamName: string; holes: { holeNumber: number; vspar: number }[] }
    >();

    for (const row of scores) {
      const hole = asHole(row.holes);
      if (!hole || hole.course_id !== (tournament.course_id as string)) continue;

      const team = asTeam(row.teams);
      if (!team) continue;

      const teamId: string = team.id;
      const teamName: string = team.team_name ?? `Team ${teamId}`;

      if (!teamHoles.has(teamId)) {
        teamHoles.set(teamId, { teamId, teamName, holes: [] });
      }

      teamHoles.get(teamId)!.holes.push({
        holeNumber: hole.hole_number,
        vspar: (row.strokes as number) - hole.par,
      });
    }

    return Array.from(teamHoles.values()).map((team) => {
      // Sort descending by hole_number, take top 3, then re-order ascending
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

    const { data: scores, error: sErr } = await supabase
      .from('scores')
      .select(`strokes, holes!inner(hole_number, par, course_id)`)
      .eq('tournament_id', tournamentId)
      .eq('is_best_ball', true);

    if (sErr) throw sErr;

    const holeSums = new Map<number, { sum: number; count: number }>();

    if (scores) {
      for (const row of scores) {
        const hole = asHole(row.holes);
        if (!hole || hole.course_id !== (tournament.course_id as string)) continue;

        const hn = hole.hole_number;
        const vspar = (row.strokes as number) - hole.par;

        const existing = holeSums.get(hn);
        if (existing) {
          existing.sum += vspar;
          existing.count++;
        } else {
          holeSums.set(hn, { sum: vspar, count: 1 });
        }
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
// Actual schema:
//   shots: player_id, tournament_id, hole_number (int), shot_number, club_name (text),
//          start_lat, start_lng, outcome ('in_play'|'out_of_bounds'|'mulligan'|'sunk')
//   tee_boxes: hole_id, name, lat, lng  (joined via holes.id / holes.hole_number)
//   holes: id, course_id, hole_number
//
// Note: the brief describes outcome IN ('OB','Water') and shots.lat/lng — the real
// schema uses 'out_of_bounds' and start_lat/start_lng. This implementation uses
// the actual column names and values.
// ---------------------------------------------------------------------------

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

    // Fetch all shots for this tournament
    const { data: shots, error: shotErr } = await supabase
      .from('shots')
      .select('player_id, hole_number, club_name, start_lat, start_lng, outcome')
      .eq('tournament_id', tournamentId);

    if (shotErr) throw shotErr;
    if (!shots || shots.length === 0) return emptyShotStats();

    // Fetch holes for this course with their tee boxes
    const { data: holesRaw, error: holeErr } = await supabase
      .from('holes')
      .select('id, hole_number, tee_boxes(lat, lng)')
      .eq('course_id', courseId);

    if (holeErr) throw holeErr;

    // Build hole_number → tee GPS map (first tee box with valid coords)
    const teeMap = new Map<number, { lat: number; lng: number }>();
    if (holesRaw) {
      for (const h of holesRaw as unknown as HoleWithTees[]) {
        const boxes = h.tee_boxes;
        if (!boxes || boxes.length === 0) continue;
        const valid = boxes.find((tb) => tb.lat !== 0 && tb.lng !== 0);
        if (valid) teeMap.set(h.hole_number, { lat: valid.lat, lng: valid.lng });
      }
    }

    // --- Longest drive ---
    // Fetch best-ball scores to map player → team name
    const { data: bbScores, error: bbErr } = await supabase
      .from('scores')
      .select('player_id, hole_number, team_id, teams!inner(id, team_name)')
      .eq('tournament_id', tournamentId)
      .eq('is_best_ball', true);

    if (bbErr) throw bbErr;

    const playerTeamMap = new Map<string, string>();
    const bbPlayerHoleSet = new Set<string>();

    if (bbScores) {
      for (const s of bbScores) {
        const team = asTeam(s.teams);
        if (team) {
          playerTeamMap.set(s.player_id as string, team.team_name ?? `Team ${team.id}`);
        }
        bbPlayerHoleSet.add(`${s.player_id as string}:${s.hole_number as number}`);
      }
    }

    let longestDriveMeters: number | null = null;
    let longestDrivePlayerId: string | null = null;

    for (const shot of shots) {
      const holeNum: number = shot.hole_number as number;
      const shotLat: number = shot.start_lat as number;
      const shotLng: number = shot.start_lng as number;

      if (!shotLat || !shotLng) continue;

      const tee = teeMap.get(holeNum);
      if (!tee) continue;

      const shotPos: GpsPosition = { lat: shotLat, lng: shotLng, accuracy: 0 };
      const meters = distanceMeters(shotPos, { lat: tee.lat, lng: tee.lng });

      if (longestDriveMeters === null || meters > longestDriveMeters) {
        longestDriveMeters = Math.round(meters);
        longestDrivePlayerId = shot.player_id as string;
      }
    }

    const longestDriveTeam =
      longestDrivePlayerId !== null ? (playerTeamMap.get(longestDrivePlayerId) ?? null) : null;

    // --- Club of day (most-used club_name on best-ball hole shots) ---
    const clubCounts = new Map<string, number>();
    let totalBbShots = 0;

    for (const shot of shots) {
      const key = `${shot.player_id as string}:${shot.hole_number as number}`;
      if (!bbPlayerHoleSet.has(key)) continue;

      if (!shot.club_name) continue;

      const clubName: string = shot.club_name as string;
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

    const { data: players, error: playerErr } = await supabase
      .from('players')
      .select('id, team_id')
      .not('team_id', 'is', null)
      .in('team_id', teamIds);

    if (playerErr) throw playerErr;

    const playerToTeamId = new Map<string, string>();
    if (players) {
      for (const p of players) {
        if (p.team_id) playerToTeamId.set(p.id as string, p.team_id as string);
      }
    }

    const badShotMap = new Map<string, { teamName: string; badShots: number }>();
    if (teams) {
      for (const t of teams) {
        const tn = (t.team_name as string | null) ?? `Team ${t.id as string}`;
        badShotMap.set(t.id as string, { teamName: tn, badShots: 0 });
      }
    }

    for (const shot of shots) {
      if (shot.outcome !== 'out_of_bounds') continue;

      const playerId: string = shot.player_id as string;
      const teamId = playerToTeamId.get(playerId);
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

    const { data: scores, error: sErr } = await supabase
      .from('scores')
      .select(
        `strokes, hole_number,
         teams!inner(id, team_name),
         holes!inner(hole_number, par, course_id)`
      )
      .eq('tournament_id', tournamentId)
      .eq('is_best_ball', true);

    if (sErr) throw sErr;
    if (!scores || scores.length === 0) return null;

    let best: BestAchievement | null = null;
    let bestVsPar = 0; // must be < 0 to qualify

    for (const row of scores) {
      const hole = asHole(row.holes);
      if (!hole || hole.course_id !== (tournament.course_id as string)) continue;

      const team = asTeam(row.teams);
      if (!team) continue;

      const vspar = (row.strokes as number) - hole.par;

      if (vspar < bestVsPar) {
        bestVsPar = vspar;
        best = {
          teamName: team.team_name ?? `Team ${team.id}`,
          holeNumber: hole.hole_number,
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
