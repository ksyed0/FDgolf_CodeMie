'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { syncEngine } from '@/lib/sync-engine';
import { useGps } from '@/hooks/use-gps';
import { AppHeader } from '@/components/app-header';
import { PlayerPills } from '@/components/player-pills';
import { ClubSelector } from '@/components/club-selector';
import { ShotOutcomeButtons } from '@/components/shot-outcome-buttons';
import { HoleMap } from '@/components/hole-map';
import { Button } from '@/components/ui/button';
import type { Player, Team, Hole, Club, RoundState, Shot, ShotOutcome, Score } from '@/lib/types';

interface ShotMarker {
  lat: number;
  lng: number;
  outcome: ShotOutcome;
}

export default function RoundPage() {
  const router = useRouter();
  const supabase = createClient();
  const { position } = useGps();

  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [teammates, setTeammates] = useState<Player[]>([]);
  const [tournament, setTournament] = useState<{ id: string; status: string } | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [roundState, setRoundState] = useState<RoundState | null>(null);

  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [selectedClub, setSelectedClub] = useState<string>('');
  const [holeShots, setHoleShots] = useState<ShotMarker[]>([]);
  const [shotNumber, setShotNumber] = useState(1);
  const [holeSunk, setHoleSunk] = useState(false);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('auth_user_id', user.id)
        .single<Player>();
      if (!playerData?.team_id) {
        toast.error('You are not assigned to a team.');
        router.push('/dashboard');
        return;
      }
      setPlayer(playerData);
      setActivePlayerId(playerData.id);

      const [
        { data: tournamentData },
        { data: teamData },
        { data: teammateData },
        { data: clubData },
      ] = await Promise.all([
        supabase
          .from('tournaments')
          .select('id, status')
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        supabase.from('teams').select('*').eq('id', playerData.team_id).single<Team>(),
        supabase.from('players').select('*').eq('team_id', playerData.team_id),
        supabase.from('clubs').select('*').eq('is_active', true).order('sort_order'),
      ]);

      if (tournamentData?.status !== 'active' && tournamentData?.status !== 'paused') {
        toast.error('Tournament is not active.');
        router.push('/dashboard');
        return;
      }

      setTournament(tournamentData);
      setTeam(teamData ?? null);
      setTeammates((teammateData as Player[]) ?? []);
      setClubs((clubData as Club[]) ?? []);

      const { data: holeData } = await supabase
        .from('holes')
        .select('*')
        .eq('tournament_id', tournamentData.id)
        .order('hole_number');
      setHoles((holeData as Hole[]) ?? []);

      // Load or create round state
      let { data: rsData } = await supabase
        .from('round_states')
        .select('*')
        .eq('team_id', playerData.team_id)
        .single<RoundState>();

      if (!rsData) {
        const startHole = teamData?.starting_hole ?? 1;
        const { data: created } = await supabase
          .from('round_states')
          .insert({
            team_id: playerData.team_id,
            current_hole: startHole,
            active_player_id: playerData.id,
            status: 'in_progress',
          })
          .select()
          .single<RoundState>();
        rsData = created;
      }
      setRoundState(rsData ?? null);

      setLoading(false);
    }
    loadData().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentHole = roundState
    ? holes.find((h) => h.hole_number === roundState.current_hole)
    : null;

  const recordShot = useCallback(
    async (outcome: ShotOutcome) => {
      if (!player || !tournament || !roundState || !activePlayerId || !selectedClub) {
        toast.error('Select a player and club first.');
        return;
      }
      setRecording(true);

      const shotPayload: Omit<Shot, 'id' | 'created_at'> = {
        player_id: activePlayerId,
        tournament_id: tournament.id,
        hole_number: roundState.current_hole,
        shot_number: shotNumber,
        club_name: selectedClub,
        start_lat: position?.lat ?? 0,
        start_lng: position?.lng ?? 0,
        outcome,
      };

      // Enqueue via sync engine (offline-safe)
      syncEngine.enqueue('shots', shotPayload as Record<string, unknown>);

      // Optimistic shot marker
      if (position) {
        setHoleShots((prev) => [...prev, { lat: position.lat, lng: position.lng, outcome }]);
      }

      setShotNumber((n) => n + 1);

      if (outcome === 'sunk') {
        // Write score
        const strokes = shotNumber;
        const scorePayload = {
          player_id: activePlayerId,
          team_id: roundState.team_id,
          tournament_id: tournament.id,
          hole_number: roundState.current_hole,
          strokes,
          is_best_ball: false,
          override_by: null,
          override_at: null,
        };
        syncEngine.enqueue('scores', scorePayload as Record<string, unknown>);

        // Insert score in Supabase immediately
        const { data: insertedScore } = await supabase
          .from('scores')
          .upsert(scorePayload, { onConflict: 'player_id,tournament_id,hole_number' })
          .select()
          .single<Score>();

        if (insertedScore && tournament) {
          // Trigger best-ball edge function
          supabase.functions
            .invoke('calculate-best-ball', {
              body: {
                tournament_id: tournament.id,
                team_id: roundState.team_id,
                hole_number: roundState.current_hole,
              },
            })
            .catch(console.error);
        }

        setHoleSunk(true);
      }

      setRecording(false);
    },
    [player, tournament, roundState, activePlayerId, selectedClub, shotNumber, position, supabase]
  );

  const nextHole = useCallback(async () => {
    if (!roundState || !team) return;
    const nextHoleNum =
      roundState.current_hole + 1 > 18
        ? roundState.current_hole // stay at 18 if we've gone around
        : roundState.current_hole + 1;

    // Check if we've completed all 18 holes (shotgun — team may have started at != 1)
    const isComplete = roundState.current_hole === 18;

    const newStatus = isComplete ? 'completed' : 'in_progress';

    await supabase
      .from('round_states')
      .update({
        current_hole: isComplete ? roundState.current_hole : nextHoleNum,
        status: newStatus,
      })
      .eq('id', roundState.id);

    if (isComplete) {
      toast.success('Round complete!');
      router.push('/leaderboard');
      return;
    }

    setRoundState((prev) =>
      prev ? { ...prev, current_hole: nextHoleNum, status: newStatus } : prev
    );
    setHoleShots([]);
    setShotNumber(1);
    setHoleSunk(false);
    setSelectedClub('');
  }, [roundState, team, supabase, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading round…</p>
      </div>
    );
  }

  if (!currentHole || !roundState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">No active hole found.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <AppHeader
        variant="compact"
        holeInfo={{
          holeNumber: currentHole.hole_number,
          par: currentHole.par,
          handicap: currentHole.handicap,
        }}
      />

      {tournament?.status === 'paused' && (
        <div className="mx-auto w-full max-w-md px-4 pt-4">
          <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            <span className="text-base">⏸</span>
            <span>
              Tournament is paused — play has been suspended. Please wait for the tournament
              director.
            </span>
          </div>
        </div>
      )}

      <div
        className={`mx-auto w-full max-w-md space-y-4 px-4 pb-24 pt-4 ${tournament?.status === 'paused' ? 'pointer-events-none opacity-50' : ''}`}
      >
        {/* Player selector */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Who is hitting?
          </p>
          <PlayerPills
            players={teammates}
            activePlayerId={activePlayerId}
            onSelect={setActivePlayerId}
          />
        </div>

        {/* Hole map */}
        <HoleMap pinLat={currentHole.pin_lat} pinLng={currentHole.pin_lng} shots={holeShots} />

        {/* Club selector */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Club (shot {shotNumber})
          </p>
          <ClubSelector clubs={clubs} value={selectedClub} onChange={setSelectedClub} />
        </div>

        {/* Outcome buttons */}
        {!holeSunk ? (
          <ShotOutcomeButtons
            onOutcome={recordShot}
            disabled={recording || !selectedClub || !activePlayerId}
          />
        ) : (
          <div className="space-y-3 rounded-xl border bg-white p-4 text-center shadow-sm">
            <p className="text-lg font-bold text-[#1a472a]">
              Hole {currentHole.hole_number} complete!
            </p>
            <p className="text-sm text-gray-600">
              Score: {shotNumber - 1} ({shotNumber - 1 - currentHole.par >= 0 ? '+' : ''}
              {shotNumber - 1 - currentHole.par} vs par)
            </p>
            <Button className="w-full bg-[#1a472a] hover:bg-[#143820]" onClick={nextHole}>
              Next Hole
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
