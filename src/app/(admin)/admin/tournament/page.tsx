import { createClient } from '@/lib/supabase/server';
import type { Tournament, Venue, Course } from '@/lib/types';
import { TournamentManager } from './tournament-manager';
import { TournamentControlDashboard } from './tournament-control-dashboard';

export type TournamentRow = Tournament & { venue_name: string; course_name: string };

export default async function TournamentAdminPage() {
  const supabase = await createClient();

  const [{ data: rawTournaments }, { data: venues }, { data: courses }] = await Promise.all([
    supabase
      .from('tournaments')
      .select('*, venue:venues!venue_id(name), course:courses!course_id(name)')
      .order('created_at', { ascending: false }),
    supabase.from('venues').select('*').order('name'),
    supabase.from('courses').select('*').order('name'),
  ]);

  const rows: TournamentRow[] = (
    (rawTournaments as (Tournament & {
      venue: { name: string } | null;
      course: { name: string } | null;
    })[]) ?? []
  ).map((t) => ({
    ...t,
    venue_name: t.venue?.name ?? '',
    course_name: t.course?.name ?? '',
  }));

  // If there is an active/paused tournament, show the control dashboard
  const activeTournament = rows.find((t) => t.status === 'active' || t.status === 'paused') ?? null;

  if (activeTournament) {
    const [
      { data: teams },
      { data: holes },
      { count: shotsCount },
      { data: sponsors },
      { data: scores },
    ] = await Promise.all([
      supabase
        .from('teams')
        .select('id, team_name, team_number, starting_hole')
        .eq('tournament_id', activeTournament.id),
      supabase
        .from('holes')
        .select('id, hole_number, pin_lat, pin_lng')
        .eq('course_id', activeTournament.course_id),
      supabase
        .from('shots')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', activeTournament.id),
      supabase
        .from('sponsors')
        .select('id')
        .eq('tournament_id', activeTournament.id)
        .eq('is_active', true),
      supabase
        .from('scores')
        .select('team_id, hole_number')
        .eq('tournament_id', activeTournament.id)
        .eq('is_best_ball', true),
    ]);

    const teamList = (teams ?? []) as {
      id: string;
      team_name: string | null;
      team_number: number;
      starting_hole: number;
    }[];

    const teamIds = teamList.map((t) => t.id);
    const { data: tpData } = teamIds.length
      ? await supabase
          .from('tournament_players')
          .select('player_id, team_id')
          .in('team_id', teamIds)
      : { data: [] };

    const tpList = (tpData ?? []) as { player_id: string; team_id: string }[];
    const holeList = (holes ?? []) as {
      id: string;
      hole_number: number;
      pin_lat: number;
      pin_lng: number;
    }[];
    const scoreList = (scores ?? []) as { team_id: string; hole_number: number }[];

    // Count players per team
    const playerCountPerTeam = new Map<string, number>();
    for (const tp of tpList) {
      playerCountPerTeam.set(tp.team_id, (playerCountPerTeam.get(tp.team_id) ?? 0) + 1);
    }

    // Count holes completed per team
    const holesPerTeam = new Map<string, Set<number>>();
    for (const s of scoreList) {
      if (!holesPerTeam.has(s.team_id)) holesPerTeam.set(s.team_id, new Set());
      holesPerTeam.get(s.team_id)!.add(s.hole_number);
    }

    const teamsOnCourse = teamList.map((t) => {
      const pc = playerCountPerTeam.get(t.id) ?? 0;
      const hc = holesPerTeam.get(t.id)?.size ?? 0;
      const status: 'on_course' | 'player_missing' | 'finished' =
        hc >= activeTournament.holes_played ? 'finished' : pc < 4 ? 'player_missing' : 'on_course';
      return {
        id: t.id,
        team_number: t.team_number,
        team_name: t.team_name,
        starting_hole: t.starting_hole,
        playerCount: pc,
        holesCompleted: hc,
        status,
      };
    });

    const holesSet = holeList.filter((h) => h.pin_lat !== 0 || h.pin_lng !== 0).length;

    return (
      <TournamentControlDashboard
        tournament={{
          ...activeTournament,
          venue_name: activeTournament.venue_name,
          course_name: activeTournament.course_name,
        }}
        teamsOnCourse={teamsOnCourse}
        stats={{
          teamCount: teamList.length,
          playerCount: tpList.length,
          holesSet,
          totalHoles: activeTournament.holes_played,
          shotsLogged: shotsCount ?? 0,
          sponsorCount: (sponsors ?? []).length,
          magicLinksSent: false,
        }}
      />
    );
  }

  return (
    <div className="max-w-4xl">
      <TournamentManager
        tournaments={rows}
        venues={(venues as Venue[]) ?? []}
        courses={(courses as Course[]) ?? []}
      />
    </div>
  );
}
