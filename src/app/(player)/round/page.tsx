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

const OUTCOME_LABELS: Record<ShotOutcome, string> = {
  in_play: 'In Play',
  out_of_bounds: 'OOB',
  mulligan: 'Mulligan',
  sunk: 'Sunk',
};

export default function RoundPage() {
  const router = useRouter();
  const supabase = createClient();
  const { position } = useGps();

  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [teammates, setTeammates] = useState<Player[]>([]);
  const [tournament, setTournament] = useState<{
    id: string;
    status: string;
    course_id: string;
    holes_played: 9 | 18;
    nine_hole_selection: 'front' | 'back' | null;
  } | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [roundState, setRoundState] = useState<RoundState | null>(null);

  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [selectedClub, setSelectedClub] = useState<string>('');
  const [holeShots, setHoleShots] = useState<ShotMarker[]>([]);
  const [shotNumber, setShotNumber] = useState(1);
  const [holeSunk, setHoleSunk] = useState(false);
  const [recording, setRecording] = useState(false);
  const [holeSummaryScores, setHoleSummaryScores] = useState<Score[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [dbShots, setDbShots] = useState<Shot[]>([]);
  const [editingShot, setEditingShot] = useState<string | null>(null);
  const [editClub, setEditClub] = useState('');
  const [editOutcome, setEditOutcome] = useState<ShotOutcome>('in_play');

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
          .select('id, status, course_id, holes_played, nine_hole_selection')
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
        .eq('course_id', tournamentData.course_id)
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

      // Load shots for the current hole
      if (rsData && tournamentData) {
        const startHole = rsData.current_hole;
        const allPlayerIds = (teammateData as Player[])?.map((p) => p.id) ?? [];
        if (allPlayerIds.length > 0) {
          const { data: shotData } = await supabase
            .from('shots')
            .select('*')
            .eq('tournament_id', tournamentData.id)
            .eq('hole_number', startHole)
            .in('player_id', allPlayerIds)
            .order('shot_number');
          setDbShots((shotData as Shot[]) ?? []);
        }
      }
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
        // Insert score directly — SyncEngine is for shots only; score write gates the
        // edge function and hole summary fetch, both of which require connectivity anyway.
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

        // Fetch all teammates' scores for the hole summary
        setSummaryLoading(true);
        const { data: summaryData } = await supabase
          .from('scores')
          .select('*')
          .eq('tournament_id', tournament.id)
          .eq('hole_number', roundState.current_hole)
          .in(
            'player_id',
            teammates.map((p) => p.id)
          );
        setHoleSummaryScores((summaryData as Score[]) ?? []);
        setSummaryLoading(false);
      }

      setRecording(false);

      // Refresh shot history
      if (tournament && roundState) {
        const { data: refreshed } = await supabase
          .from('shots')
          .select('*')
          .eq('tournament_id', tournament.id)
          .eq('hole_number', roundState.current_hole)
          .in(
            'player_id',
            teammates.map((p) => p.id)
          )
          .order('shot_number');
        setDbShots((refreshed as Shot[]) ?? []);
      }
    },
    [
      player,
      tournament,
      roundState,
      activePlayerId,
      selectedClub,
      shotNumber,
      position,
      supabase,
      teammates,
    ]
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
    setHoleSummaryScores([]);
    setSummaryLoading(false);
    setDbShots([]);
    setEditingShot(null);
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

        {/* Shot history */}
        {dbShots.length > 0 && !holeSunk && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              This hole
            </p>
            <div className="space-y-1.5">
              {dbShots.map((shot) => {
                const shooter = teammates.find((p) => p.id === shot.player_id);
                const isEditing = editingShot === shot.id;
                return (
                  <div
                    key={shot.id}
                    className="overflow-hidden rounded-lg border bg-white shadow-sm"
                  >
                    <button
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => {
                        if (isEditing) {
                          setEditingShot(null);
                        } else {
                          setEditingShot(shot.id);
                          setEditClub(shot.club_name);
                          setEditOutcome(shot.outcome === 'sunk' ? 'in_play' : shot.outcome);
                        }
                      }}
                    >
                      <span className="text-gray-700">
                        Shot {shot.shot_number} · {shooter?.name ?? 'Unknown'} · {shot.club_name} ·{' '}
                        {OUTCOME_LABELS[shot.outcome]}
                      </span>
                      <span className="text-xs text-[#1a472a]">{isEditing ? '✕' : '✏'}</span>
                    </button>

                    {isEditing && (
                      <div className="space-y-3 border-t bg-gray-50 px-3 py-3">
                        <ClubSelector clubs={clubs} value={editClub} onChange={setEditClub} />
                        <div className="flex gap-2">
                          {(['in_play', 'out_of_bounds', 'mulligan'] as ShotOutcome[]).map((o) => (
                            <button
                              key={o}
                              onClick={() => setEditOutcome(o)}
                              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                                editOutcome === o
                                  ? 'border-[#1a472a] bg-[#1a472a] text-white'
                                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {OUTCOME_LABELS[o]}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setEditingShot(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 bg-[#1a472a] hover:bg-[#143820]"
                            onClick={async () => {
                              const { error } = await supabase
                                .from('shots')
                                .update({ club_name: editClub, outcome: editOutcome })
                                .eq('id', shot.id);
                              if (error) {
                                toast.error(error.message);
                                return;
                              }
                              setDbShots((prev) =>
                                prev.map((s) =>
                                  s.id === shot.id
                                    ? { ...s, club_name: editClub, outcome: editOutcome }
                                    : s
                                )
                              );
                              setEditingShot(null);
                              toast.success('Shot updated');
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
          <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-center text-lg font-bold text-[#1a472a]">
              ⛳ Hole {currentHole.hole_number} Complete
            </p>

            {summaryLoading ? (
              <p className="text-center text-sm text-gray-500">Calculating…</p>
            ) : (
              <>
                {(() => {
                  const bestStrokes =
                    holeSummaryScores.length > 0
                      ? Math.min(...holeSummaryScores.map((s) => s.strokes))
                      : null;
                  const bestBallPar = bestStrokes !== null ? bestStrokes - currentHole.par : null;
                  return (
                    <>
                      {bestBallPar !== null && (
                        <p className="text-center text-sm text-gray-600">
                          Best Ball: {bestStrokes} strokes ({bestBallPar >= 0 ? '+' : ''}
                          {bestBallPar} vs par)
                        </p>
                      )}
                      <div className="space-y-1.5">
                        {teammates.map((p) => {
                          const score = holeSummaryScores.find((s) => s.player_id === p.id);
                          const isBest = score !== undefined && score.strokes === bestStrokes;
                          return (
                            <div
                              key={p.id}
                              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                                isBest
                                  ? 'border border-green-500 bg-green-50 font-bold text-green-700'
                                  : 'border border-gray-200 bg-gray-50 text-gray-700'
                              }`}
                            >
                              <span>{p.name}</span>
                              <span>
                                {score ? `${score.strokes} strokes${isBest ? ' ★' : ''}` : '—'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </>
            )}

            <Button className="w-full bg-[#1a472a] hover:bg-[#143820]" onClick={nextHole}>
              Next Hole →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
