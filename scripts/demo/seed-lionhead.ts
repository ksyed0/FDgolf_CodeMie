import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import type { DemoConfig, DemoHole, DemoTeam, DemoClub } from './types';

dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SERVICE_KEY) {
  console.error('[seed-lionhead] SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_SLUG = 'lionhead-legends-demo';
const DEMO_CAPTAIN_EMAIL = 'demo-captain@fdgolf.demo';
const DEMO_CAPTAIN_PASSWORD = 'DemoKiosk2026!';

const HOLE_DATA = [
  { holeNumber: 1,  par: 4, yards: 415, handicap: 9,  pinLat: 43.6510, pinLng: -79.8420, teeLat: 43.6498, teeLng: -79.8432 },
  { holeNumber: 2,  par: 4, yards: 390, handicap: 5,  pinLat: 43.6525, pinLng: -79.8405, teeLat: 43.6512, teeLng: -79.8418 },
  { holeNumber: 3,  par: 3, yards: 185, handicap: 17, pinLat: 43.6538, pinLng: -79.8388, teeLat: 43.6530, teeLng: -79.8395 },
  { holeNumber: 4,  par: 5, yards: 510, handicap: 1,  pinLat: 43.6550, pinLng: -79.8370, teeLat: 43.6535, teeLng: -79.8385 },
  { holeNumber: 5,  par: 4, yards: 405, handicap: 11, pinLat: 43.6542, pinLng: -79.8350, teeLat: 43.6550, teeLng: -79.8363 },
  { holeNumber: 6,  par: 4, yards: 360, handicap: 13, pinLat: 43.6528, pinLng: -79.8335, teeLat: 43.6540, teeLng: -79.8348 },
  { holeNumber: 7,  par: 5, yards: 530, handicap: 3,  pinLat: 43.6512, pinLng: -79.8318, teeLat: 43.6520, teeLng: -79.8332 },
  { holeNumber: 8,  par: 3, yards: 170, handicap: 15, pinLat: 43.6498, pinLng: -79.8302, teeLat: 43.6505, teeLng: -79.8315 },
  { holeNumber: 9,  par: 4, yards: 394, handicap: 7,  pinLat: 43.6485, pinLng: -79.8288, teeLat: 43.6492, teeLng: -79.8300 },
  { holeNumber: 10, par: 4, yards: 370, handicap: 10, pinLat: 43.6470, pinLng: -79.8305, teeLat: 43.6480, teeLng: -79.8292 },
  { holeNumber: 11, par: 4, yards: 400, handicap: 6,  pinLat: 43.6458, pinLng: -79.8322, teeLat: 43.6468, teeLng: -79.8310 },
  { holeNumber: 12, par: 5, yards: 500, handicap: 2,  pinLat: 43.6445, pinLng: -79.8340, teeLat: 43.6455, teeLng: -79.8328 },
  { holeNumber: 13, par: 3, yards: 175, handicap: 18, pinLat: 43.6432, pinLng: -79.8358, teeLat: 43.6440, teeLng: -79.8345 },
  { holeNumber: 14, par: 4, yards: 385, handicap: 12, pinLat: 43.6420, pinLng: -79.8375, teeLat: 43.6430, teeLng: -79.8362 },
  { holeNumber: 15, par: 5, yards: 460, handicap: 4,  pinLat: 43.6408, pinLng: -79.8392, teeLat: 43.6418, teeLng: -79.8380 },
  { holeNumber: 16, par: 4, yards: 415, handicap: 8,  pinLat: 43.6418, pinLng: -79.8410, teeLat: 43.6408, teeLng: -79.8398 },
  { holeNumber: 17, par: 3, yards: 165, handicap: 16, pinLat: 43.6432, pinLng: -79.8425, teeLat: 43.6422, teeLng: -79.8415 },
  { holeNumber: 18, par: 4, yards: 420, handicap: 14, pinLat: 43.6448, pinLng: -79.8438, teeLat: 43.6438, teeLng: -79.8428 },
] as const;

const TEAM_NAMES = [
  'Eagle Squadron', 'Birdie Brigade', 'Par Patrol', 'Bogey Busters',
  'Fairway Falcons', 'Iron Rangers', 'Wedge Warriors', 'Chip Shots',
  'Bunker Boys', "Driver's Club", 'Green Machines', 'Sand Savers',
  'Back Nine', 'Front Runners', 'Links Lions', 'Turf Tigers',
  'Pin Seekers', 'Rough Riders',
];

const PLAYER_FIRST = ['James', 'Sarah', 'Michael', 'Emma', 'David', 'Olivia', 'Ryan', 'Sophie',
  'Chris', 'Laura', 'Daniel', 'Anna', 'Mark', 'Rachel', 'Tom', 'Jessica'];
const PLAYER_LAST = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Taylor', 'Wilson',
  'Moore', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson'];

function playerName(teamIdx: number, playerIdx: number): string {
  const globalPlayerIndex = teamIdx * 4 + playerIdx;
  const firstIdx = globalPlayerIndex % PLAYER_FIRST.length;
  const lastIdx = Math.floor(globalPlayerIndex / PLAYER_FIRST.length) % PLAYER_LAST.length;
  return `${PLAYER_FIRST[firstIdx]} ${PLAYER_LAST[lastIdx]}`;
}

async function upsertVenueAndCourse(): Promise<{ venueId: string; courseId: string }> {
  let { data: venue } = await supabase
    .from('venues').select('id').eq('name', 'Lionhead Golf and Country Club').maybeSingle();
  if (!venue) {
    const { data, error } = await supabase.from('venues').insert({
      name: 'Lionhead Golf and Country Club',
      address1: '8525 Mississauga Rd',
      city: 'Brampton',
      province_state: 'ON',
      postal_code: 'L6Y 0E3',
      country: 'Canada',
    }).select('id').single();
    if (error) throw new Error(`[seed] venues insert failed: ${error.message}`);
    venue = data;
    console.log('[seed] Venue created');
  } else {
    console.log('[seed] Venue exists');
  }

  let { data: course } = await supabase
    .from('courses').select('id').eq('name', 'Legends Course').eq('venue_id', venue.id).maybeSingle();
  if (!course) {
    const { data, error } = await supabase.from('courses').insert({
      venue_id: venue.id,
      name: 'Legends Course',
      hole_count: 18,
      par_total: 72,
      course_rating: 72.4,
      slope_rating: 139,
    }).select('id').single();
    if (error) throw new Error(`[seed] courses insert failed: ${error.message}`);
    course = data;
    console.log('[seed] Course created');
  } else {
    console.log('[seed] Course exists');
  }

  return { venueId: venue.id as string, courseId: course.id as string };
}

async function upsertHoles(courseId: string): Promise<DemoHole[]> {
  const demoHoles: DemoHole[] = [];

  for (const h of HOLE_DATA) {
    let { data: hole } = await supabase
      .from('holes').select('id').eq('course_id', courseId).eq('hole_number', h.holeNumber).maybeSingle();
    if (!hole) {
      const { data, error } = await supabase.from('holes').insert({
        course_id: courseId,
        hole_number: h.holeNumber,
        par: h.par,
        handicap: h.handicap,
        pin_lat: h.pinLat,
        pin_lng: h.pinLng,
      }).select('id').single();
      if (error) throw new Error(`[seed] holes insert failed (hole ${h.holeNumber}): ${error.message}`);
      hole = data;
    }

    let { data: teeBox } = await supabase
      .from('tee_boxes').select('id').eq('hole_id', hole.id).eq('name', 'Blue').maybeSingle();
    if (!teeBox) {
      const { error } = await supabase.from('tee_boxes').insert({
        hole_id: hole.id,
        name: 'Blue',
        lat: h.teeLat,
        lng: h.teeLng,
        distance_yards: h.yards,
      });
      if (error) throw new Error(`[seed] tee_boxes insert failed (hole ${h.holeNumber}): ${error.message}`);
    }

    demoHoles.push({
      id: hole.id as string,
      holeNumber: h.holeNumber,
      par: h.par,
      pinLat: h.pinLat,
      pinLng: h.pinLng,
      teeLat: h.teeLat,
      teeLng: h.teeLng,
    });
  }

  console.log('[seed] 18 holes + tee boxes ready');
  return demoHoles;
}

async function upsertTournament(venueId: string, courseId: string): Promise<string> {
  let { data: tournament } = await supabase
    .from('tournaments').select('id').eq('slug', DEMO_SLUG).maybeSingle();
  if (!tournament) {
    const { data, error } = await supabase.from('tournaments').insert({
      name: 'Lionhead Legends Demo',
      slug: DEMO_SLUG,
      venue_id: venueId,
      course_id: courseId,
      date: '2026-06-21',
      format: 'best_ball',
      holes_played: 18,
      status: 'setup',
      is_demo: true,
    }).select('id').single();
    if (error) throw new Error(`[seed] tournaments insert failed: ${error.message}`);
    tournament = data;
    console.log('[seed] Tournament created');
  } else {
    console.log('[seed] Tournament exists');
  }
  return tournament.id as string;
}

async function upsertDemoCaptainAuth(): Promise<string> {
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  let user = users.find((u) => u.email === DEMO_CAPTAIN_EMAIL);
  if (!user) {
    const { data: created } = await supabase.auth.admin.createUser({
      email: DEMO_CAPTAIN_EMAIL,
      password: DEMO_CAPTAIN_PASSWORD,
      email_confirm: true,
    });
    user = created.user!;
    console.log('[seed] Demo captain auth user created');
  } else {
    console.log('[seed] Demo captain auth user exists');
  }
  return user.id;
}

async function upsertTeamsAndPlayers(tournamentId: string, captainAuthUserId: string): Promise<DemoTeam[]> {
  const demoTeams: DemoTeam[] = [];

  for (let teamIdx = 0; teamIdx < TEAM_NAMES.length; teamIdx++) {
    const teamName = TEAM_NAMES[teamIdx];
    const startingHole = teamIdx + 1;

    let { data: team } = await supabase
      .from('teams').select('id').eq('tournament_id', tournamentId).eq('team_name', teamName).maybeSingle();
    if (!team) {
      const { data, error } = await supabase.from('teams').insert({
        tournament_id: tournamentId,
        team_number: teamIdx + 1,
        team_name: teamName,
        starting_hole: startingHole,
        max_players: 4,
      }).select('id').single();
      if (error) throw new Error(`[seed] teams insert failed (${teamName}): ${error.message}`);
      team = data;
    }

    const demoPlayers: DemoTeam['players'] = [];
    for (let pi = 0; pi < 4; pi++) {
      const name = playerName(teamIdx, pi);
      const email = `demo-${teamIdx}-${pi}@fdgolf.demo`;
      const isCaptain = teamIdx === 0 && pi === 0;

      // Non-captain players use fixed fake UUIDs — DB record only, no auth needed
      const authUserId = isCaptain
        ? captainAuthUserId
        : `00000000-dddd-0000-${String(teamIdx).padStart(4, '0')}-${String(pi).padStart(12, '0')}`;

      let { data: player } = await supabase
        .from('players').select('id').eq('email', email).maybeSingle();
      if (!player) {
        const { data, error } = await supabase.from('players').insert({
          auth_user_id: authUserId,
          name,
          email,
          title: '',
          company: 'Demo Corp',
          role: 'player',
        }).select('id').single();
        if (error) throw new Error(`[seed] players insert failed (${email}): ${error.message}`);
        player = data;
      }

      await supabase.from('tournament_players').upsert(
        { player_id: player.id, team_id: team.id, tournament_id: tournamentId },
        { onConflict: 'player_id,tournament_id', ignoreDuplicates: true }
      );

      if (isCaptain) {
        await supabase.from('teams').update({ captain_id: player.id }).eq('id', team.id);
      }

      demoPlayers.push({ id: player.id as string, name });
    }

    demoTeams.push({ id: team.id as string, name: teamName, startingHole, players: demoPlayers });
  }

  console.log('[seed] 18 teams + 72 players ready');
  return demoTeams;
}

async function fetchClubs(): Promise<DemoClub[]> {
  const { data } = await supabase
    .from('clubs').select('id, name, category').eq('is_active', true).order('sort_order');
  if (!data || data.length === 0) {
    throw new Error('[seed] No active clubs found — run ./scripts/reset-and-seed.sh first');
  }
  return data as DemoClub[];
}

export async function seedLionhead(): Promise<DemoConfig> {
  console.log('[seed-lionhead] Starting…');
  const { venueId, courseId } = await upsertVenueAndCourse();
  const holes = await upsertHoles(courseId);
  const tournamentId = await upsertTournament(venueId, courseId);
  const captainAuthUserId = await upsertDemoCaptainAuth();
  const teams = await upsertTeamsAndPlayers(tournamentId, captainAuthUserId);
  const clubs = await fetchClubs();
  console.log('[seed-lionhead] Done.');
  return { tournamentId, slug: DEMO_SLUG, holes, teams, clubs };
}

if (require.main === module) {
  seedLionhead().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
