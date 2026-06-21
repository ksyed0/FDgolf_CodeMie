/**
 * Unit tests for src/lib/tv-stats.ts
 *
 * The implementation uses fetchParMap() which fetches holes separately
 * (no PostgREST join from scores to holes — there is no FK).
 * All mocks must provide the 'holes' table returning par data.
 */

import {
  fetchBirdieStats,
  fetchMomentumStats,
  fetchHoleDifficulty,
  fetchShotStats,
  fetchBestAchievement,
  fetchSparklineTracks,
  fetchTeamSpotlight,
} from '@/lib/tv-stats';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function buildChain(data: unknown, error: unknown) {
  const resolved = Promise.resolve({ data, error });
  const chain: Record<string, unknown> = {
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
    single: jest.fn().mockResolvedValue({ data, error }),
  };
  for (const method of ['select', 'eq', 'in', 'not', 'order', 'limit']) {
    chain[method] = jest.fn().mockReturnValue(chain);
  }
  return chain;
}

function buildMultiMockSupabase(tableMap: Record<string, { data: unknown; error: unknown }>) {
  return {
    from: jest.fn().mockImplementation((table: string) => {
      const entry = tableMap[table] ?? { data: null, error: null };
      return buildChain(entry.data, entry.error);
    }),
  };
}

// ---------------------------------------------------------------------------
// Common fixtures
// ---------------------------------------------------------------------------

const TOURNAMENT_ID = 'tournament-1';
const COURSE_ID = 'course-1';
const mockTournament = { course_id: COURSE_ID };

// Par data returned by fetchParMap (holes table)
const MOCK_HOLES_PAR = [
  { hole_number: 1, par: 4 },
  { hole_number: 2, par: 3 },
  { hole_number: 3, par: 5 },
  { hole_number: 4, par: 4 },
  { hole_number: 5, par: 4 },
];

/** Score row — hole_number is a direct column; teams join is embedded */
function makeScoreRow(opts: {
  teamId?: string;
  teamName?: string;
  strokes: number;
  holeNumber?: number;
}) {
  const { teamId = 'team-1', teamName = 'Eagles', strokes, holeNumber = 1 } = opts;
  return {
    strokes,
    hole_number: holeNumber,
    team_id: teamId,
    teams: [{ id: teamId, team_name: teamName }],
  };
}

/** Build a tournament chain where single() resolves correctly */
function makeTournamentChain(data: unknown = mockTournament, error: unknown = null) {
  const chain = buildChain(error ? null : null, null);
  (chain.single as jest.Mock).mockResolvedValue({ data, error });
  return chain;
}

// ---------------------------------------------------------------------------
// fetchBirdieStats
// ---------------------------------------------------------------------------

describe('fetchBirdieStats', () => {
  it('returns [] when tournament query errors', async () => {
    const supabase = buildMultiMockSupabase({
      tournaments: { data: null, error: { message: 'DB error' } },
    });
    expect(await fetchBirdieStats(supabase as never, TOURNAMENT_ID)).toEqual([]);
  });

  it('returns [] when tournament is not found', async () => {
    const supabase = buildMultiMockSupabase({
      tournaments: { data: null, error: null },
    });
    expect(await fetchBirdieStats(supabase as never, TOURNAMENT_ID)).toEqual([]);
  });

  it('returns [] when scores query errors', async () => {
    const tournamentChain = makeTournamentChain();
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(null, { message: 'scores error' });
      }),
    };
    expect(await fetchBirdieStats(supabase as never, TOURNAMENT_ID)).toEqual([]);
  });

  it('returns [] when there are no scores', async () => {
    const tournamentChain = makeTournamentChain();
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain([], null);
      }),
    };
    expect(await fetchBirdieStats(supabase as never, TOURNAMENT_ID)).toEqual([]);
  });

  it('counts birdies (vspar = -1)', async () => {
    const tournamentChain = makeTournamentChain();
    const rows = [
      makeScoreRow({ strokes: 3, holeNumber: 1 }), // birdie (par 4)
      makeScoreRow({ strokes: 3, holeNumber: 1 }), // birdie
    ];
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };

    const result = await fetchBirdieStats(supabase as never, TOURNAMENT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].birdies).toBe(2);
    expect(result[0].eagles).toBe(0);
    expect(result[0].teamName).toBe('Eagles');
  });

  it('counts eagles (vspar <= -2, also increments birdies)', async () => {
    const tournamentChain = makeTournamentChain();
    const rows = [makeScoreRow({ strokes: 2, holeNumber: 1 })]; // eagle (4-2=2)
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };

    const result = await fetchBirdieStats(supabase as never, TOURNAMENT_ID);
    expect(result[0].eagles).toBe(1);
    expect(result[0].birdies).toBe(1);
  });

  it('skips scores for hole numbers with no par data', async () => {
    const tournamentChain = makeTournamentChain();
    const rows = [makeScoreRow({ strokes: 2, holeNumber: 99 })]; // no par for hole 99
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };

    expect(await fetchBirdieStats(supabase as never, TOURNAMENT_ID)).toEqual([]);
  });

  it('sorts teams by birdie count descending', async () => {
    const tournamentChain = makeTournamentChain();
    const rows = [
      makeScoreRow({ teamId: 'team-1', teamName: 'Eagles', strokes: 3, holeNumber: 1 }),
      makeScoreRow({ teamId: 'team-2', teamName: 'Birdies', strokes: 3, holeNumber: 1 }),
      makeScoreRow({ teamId: 'team-2', teamName: 'Birdies', strokes: 2, holeNumber: 2 }), // eagle
    ];
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };

    const result = await fetchBirdieStats(supabase as never, TOURNAMENT_ID);
    expect(result[0].teamId).toBe('team-2'); // 2 birdies (birdie + eagle)
    expect(result[1].teamId).toBe('team-1');
  });
});

// ---------------------------------------------------------------------------
// fetchMomentumStats
// ---------------------------------------------------------------------------

describe('fetchMomentumStats', () => {
  it('returns [] when tournament query errors', async () => {
    const supabase = buildMultiMockSupabase({
      tournaments: { data: null, error: { message: 'DB error' } },
    });
    expect(await fetchMomentumStats(supabase as never, TOURNAMENT_ID)).toEqual([]);
  });

  it('returns [] when tournament is not found', async () => {
    const supabase = buildMultiMockSupabase({
      tournaments: { data: null, error: null },
    });
    expect(await fetchMomentumStats(supabase as never, TOURNAMENT_ID)).toEqual([]);
  });

  it('returns [] when there are no scores', async () => {
    const tournamentChain = makeTournamentChain();
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain([], null);
      }),
    };
    expect(await fetchMomentumStats(supabase as never, TOURNAMENT_ID)).toEqual([]);
  });

  it('returns last three holes sorted ascending per team', async () => {
    const tournamentChain = makeTournamentChain();
    const rows = [1, 2, 3, 4, 5].map((hn) => makeScoreRow({ strokes: hn + 4, holeNumber: hn }));
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };

    const result = await fetchMomentumStats(supabase as never, TOURNAMENT_ID);
    expect(result).toHaveLength(1);
    const holes = result[0].lastThreeHoles;
    expect(holes).toHaveLength(3);
    expect(holes[0].holeNumber).toBe(3);
    expect(holes[1].holeNumber).toBe(4);
    expect(holes[2].holeNumber).toBe(5);
  });

  it('calculates vspar correctly', async () => {
    const tournamentChain = makeTournamentChain();
    const rows = [makeScoreRow({ strokes: 3, holeNumber: 1 })]; // par 4 → vspar -1
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };

    const result = await fetchMomentumStats(supabase as never, TOURNAMENT_ID);
    expect(result[0].lastThreeHoles[0].vspar).toBe(-1);
  });

  it('returns [] when scores query errors', async () => {
    const tournamentChain = makeTournamentChain();
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(null, { message: 'scores error' });
      }),
    };
    expect(await fetchMomentumStats(supabase as never, TOURNAMENT_ID)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fetchHoleDifficulty
// ---------------------------------------------------------------------------

describe('fetchHoleDifficulty', () => {
  it('always returns 18 entries on error', async () => {
    const supabase = buildMultiMockSupabase({
      tournaments: { data: null, error: { message: 'DB error' } },
    });
    const result = await fetchHoleDifficulty(supabase as never, TOURNAMENT_ID);
    expect(result).toHaveLength(18);
    result.forEach((h, i) => {
      expect(h.holeNumber).toBe(i + 1);
      expect(h.avgVsPar).toBeNull();
    });
  });

  it('always returns 18 entries on success', async () => {
    const tournamentChain = makeTournamentChain();
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain([], null);
      }),
    };

    const result = await fetchHoleDifficulty(supabase as never, TOURNAMENT_ID);
    expect(result).toHaveLength(18);
    expect(result.map((h) => h.holeNumber)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it('returns avgVsPar=null for holes with no scores', async () => {
    const tournamentChain = makeTournamentChain();
    const rows = [{ strokes: 5, hole_number: 1 }]; // par 4 → vspar +1
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };

    const result = await fetchHoleDifficulty(supabase as never, TOURNAMENT_ID);
    expect(result[0].holeNumber).toBe(1);
    expect(result[0].avgVsPar).toBe(1);
    result.slice(1).forEach((h) => expect(h.avgVsPar).toBeNull());
  });

  it('averages vspar across multiple scores on same hole', async () => {
    const tournamentChain = makeTournamentChain();
    // hole 2 (par 3): vspar -1 and +1 → avg 0
    const rows = [
      { strokes: 2, hole_number: 2 },
      { strokes: 4, hole_number: 2 },
    ];
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };

    const result = await fetchHoleDifficulty(supabase as never, TOURNAMENT_ID);
    expect(result[1].holeNumber).toBe(2);
    expect(result[1].avgVsPar).toBe(0);
  });

  it('returns all null when no par data available for course', async () => {
    const tournamentChain = makeTournamentChain();
    const rows = [{ strokes: 2, hole_number: 1 }];
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain([], null); // no holes for this course
        return buildChain(rows, null);
      }),
    };

    const result = await fetchHoleDifficulty(supabase as never, TOURNAMENT_ID);
    result.forEach((h) => expect(h.avgVsPar).toBeNull());
  });

  it('returns 18 null entries when tournament is not found', async () => {
    const tournamentChain = makeTournamentChain(null);
    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : buildChain([], null)
        ),
    };

    const result = await fetchHoleDifficulty(supabase as never, TOURNAMENT_ID);
    expect(result).toHaveLength(18);
    result.forEach((h) => expect(h.avgVsPar).toBeNull());
  });
});

// ---------------------------------------------------------------------------
// fetchShotStats
// ---------------------------------------------------------------------------

describe('fetchShotStats', () => {
  const EMPTY_STATS = {
    longestDriveMeters: null,
    longestDriveTeam: null,
    clubOfDay: null,
    clubOfDayPct: null,
    cleanestTeams: [],
  };

  it('returns empty ShotStats when tournament query errors', async () => {
    const supabase = buildMultiMockSupabase({
      tournaments: { data: null, error: { message: 'DB error' } },
    });
    expect(await fetchShotStats(supabase as never, TOURNAMENT_ID)).toEqual(EMPTY_STATS);
  });

  it('returns empty ShotStats when there are no shots', async () => {
    const tournamentChain = makeTournamentChain();
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        return buildChain([], null);
      }),
    };
    expect(await fetchShotStats(supabase as never, TOURNAMENT_ID)).toEqual(EMPTY_STATS);
  });

  it('returns empty ShotStats when shots query errors', async () => {
    const tournamentChain = makeTournamentChain();
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        return buildChain(null, { message: 'shots error' });
      }),
    };
    expect(await fetchShotStats(supabase as never, TOURNAMENT_ID)).toEqual(EMPTY_STATS);
  });

  it('counts out_of_bounds shots as bad shots', async () => {
    const tournamentChain = makeTournamentChain();
    const shots = [
      {
        player_id: 'player-1',
        hole_number: 1,
        shot_number: 2,
        club_name: '7 Iron',
        start_lat: 0,
        start_lng: 0,
        outcome: 'out_of_bounds',
      },
      {
        player_id: 'player-1',
        hole_number: 2,
        shot_number: 2,
        club_name: '7 Iron',
        start_lat: 0,
        start_lng: 0,
        outcome: 'out_of_bounds',
      },
    ];
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'shots') return buildChain(shots, null);
        if (table === 'holes') return buildChain([], null);
        if (table === 'scores') return buildChain([], null);
        if (table === 'teams')
          return buildChain([{ id: 'team-1', team_name: 'Rough Riders' }], null);
        if (table === 'tournament_players')
          return buildChain([{ player_id: 'player-1', team_id: 'team-1' }], null);
        return buildChain(null, null);
      }),
    };

    const result = await fetchShotStats(supabase as never, TOURNAMENT_ID);
    expect(result.cleanestTeams[0].badShots).toBe(2);
  });

  it('cleanestTeams has badShots=0 when no out_of_bounds shots exist', async () => {
    const tournamentChain = makeTournamentChain();
    const shots = [
      {
        player_id: 'player-1',
        hole_number: 1,
        shot_number: 2,
        club_name: '7 Iron',
        start_lat: 0,
        start_lng: 0,
        outcome: 'in_play',
      },
    ];
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'shots') return buildChain(shots, null);
        if (table === 'holes') return buildChain([], null);
        if (table === 'scores') return buildChain([], null);
        if (table === 'teams') return buildChain([{ id: 'team-1', team_name: 'Eagles' }], null);
        if (table === 'tournament_players')
          return buildChain([{ player_id: 'player-1', team_id: 'team-1' }], null);
        return buildChain(null, null);
      }),
    };

    const result = await fetchShotStats(supabase as never, TOURNAMENT_ID);
    expect(result.cleanestTeams[0].teamName).toBe('Eagles');
    expect(result.cleanestTeams[0].badShots).toBe(0);
  });

  it('counts club of day from best-ball shots (putters excluded)', async () => {
    const tournamentChain = makeTournamentChain();
    const shots = [
      {
        player_id: 'p1',
        hole_number: 1,
        shot_number: 2,
        club_name: 'Driver (1W)',
        start_lat: 0,
        start_lng: 0,
        outcome: 'in_play',
      },
      {
        player_id: 'p1',
        hole_number: 1,
        shot_number: 3,
        club_name: 'Driver (1W)',
        start_lat: 0,
        start_lng: 0,
        outcome: 'in_play',
      },
      {
        player_id: 'p1',
        hole_number: 1,
        shot_number: 4,
        club_name: 'Putter',
        start_lat: 0,
        start_lng: 0,
        outcome: 'sunk',
      },
      {
        player_id: 'p1',
        hole_number: 1,
        shot_number: 5,
        club_name: '7 Iron',
        start_lat: 0,
        start_lng: 0,
        outcome: 'in_play',
      },
    ];
    const bbScores = [
      {
        player_id: 'p1',
        hole_number: 1,
        team_id: 'team-1',
        teams: [{ id: 'team-1', team_name: 'Eagles' }],
      },
    ];
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'shots') return buildChain(shots, null);
        if (table === 'holes') return buildChain([], null);
        if (table === 'scores') return buildChain(bbScores, null);
        if (table === 'teams') return buildChain([], null);
        if (table === 'players') return buildChain([], null);
        return buildChain(null, null);
      }),
    };

    const result = await fetchShotStats(supabase as never, TOURNAMENT_ID);
    // Putter excluded → 2 Driver + 1 Iron = 3 total; Driver wins
    expect(result.clubOfDay).toBe('Driver (1W)');
    expect(result.clubOfDayPct).toBe(67); // 2/3
  });

  it('only considers shot_number=1 wood shots for longest drive', async () => {
    const tournamentChain = makeTournamentChain();
    // Tee box at lat=43, lng=-80; driver starts far away; approach starts close
    const shots = [
      // Tee shot (shot_number=1), Driver — should count
      {
        player_id: 'p1',
        hole_number: 1,
        shot_number: 1,
        club_name: 'Driver (1W)',
        start_lat: 43.01,
        start_lng: -80.0,
        outcome: 'in_play',
      },
      // Approach (shot_number=2), 7 Iron — should NOT count for longest drive
      {
        player_id: 'p1',
        hole_number: 1,
        shot_number: 2,
        club_name: '7 Iron',
        start_lat: 43.001,
        start_lng: -80.0,
        outcome: 'in_play',
      },
    ];
    const holesWithTees = [{ id: 'h1', hole_number: 1, tee_boxes: [{ lat: 43.0, lng: -80.0 }] }];
    const bbScores = [
      {
        player_id: 'p1',
        hole_number: 1,
        team_id: 'team-1',
        teams: [{ id: 'team-1', team_name: 'Falcons' }],
      },
    ];
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'shots') return buildChain(shots, null);
        if (table === 'holes') return buildChain(holesWithTees, null);
        if (table === 'scores') return buildChain(bbScores, null);
        if (table === 'teams') return buildChain([], null);
        if (table === 'players') return buildChain([], null);
        return buildChain(null, null);
      }),
    };

    const result = await fetchShotStats(supabase as never, TOURNAMENT_ID);
    // Driver shot is ~1110m from tee (0.01 deg lat ≈ 1111m)
    expect(result.longestDriveMeters).toBeGreaterThan(1000);
    expect(result.longestDriveTeam).toBe('Falcons');
  });
});

// ---------------------------------------------------------------------------
// fetchBestAchievement
// ---------------------------------------------------------------------------

describe('fetchBestAchievement', () => {
  it('returns null when tournament query errors', async () => {
    const supabase = buildMultiMockSupabase({
      tournaments: { data: null, error: { message: 'DB error' } },
    });
    expect(await fetchBestAchievement(supabase as never, TOURNAMENT_ID)).toBeNull();
  });

  it('returns null when tournament is not found', async () => {
    const supabase = buildMultiMockSupabase({ tournaments: { data: null, error: null } });
    expect(await fetchBestAchievement(supabase as never, TOURNAMENT_ID)).toBeNull();
  });

  it('returns null when there are no scores', async () => {
    const tournamentChain = makeTournamentChain();
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain([], null);
      }),
    };
    expect(await fetchBestAchievement(supabase as never, TOURNAMENT_ID)).toBeNull();
  });

  it('returns null when all scores are at or over par', async () => {
    const tournamentChain = makeTournamentChain();
    const rows = [
      makeScoreRow({ strokes: 4, holeNumber: 1 }), // par (vspar=0)
      makeScoreRow({ strokes: 5, holeNumber: 1 }), // bogey (vspar=+1)
    ];
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };
    expect(await fetchBestAchievement(supabase as never, TOURNAMENT_ID)).toBeNull();
  });

  it('returns birdie (vspar = -1)', async () => {
    const tournamentChain = makeTournamentChain();
    const rows = [makeScoreRow({ strokes: 3, holeNumber: 1 })]; // par 4 → birdie
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };

    const result = await fetchBestAchievement(supabase as never, TOURNAMENT_ID);
    expect(result).not.toBeNull();
    expect(result!.teamName).toBe('Eagles');
    expect(result!.holeNumber).toBe(1);
    expect(result!.vspar).toBe(-1);
  });

  it('returns eagle over birdie (vspar -2 beats -1)', async () => {
    const tournamentChain = makeTournamentChain();
    const rows = [
      makeScoreRow({ teamId: 'team-1', teamName: 'Eagles', strokes: 3, holeNumber: 1 }), // birdie
      makeScoreRow({ teamId: 'team-2', teamName: 'Aces', strokes: 3, holeNumber: 3 }), // eagle (par 5)
    ];
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };

    const result = await fetchBestAchievement(supabase as never, TOURNAMENT_ID);
    expect(result!.teamName).toBe('Aces');
    expect(result!.holeNumber).toBe(3);
    expect(result!.vspar).toBe(-2);
  });

  it('returns null when scores query errors', async () => {
    const tournamentChain = makeTournamentChain();
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(null, { message: 'scores error' });
      }),
    };
    expect(await fetchBestAchievement(supabase as never, TOURNAMENT_ID)).toBeNull();
  });

  it('uses team_name fallback when team_name is null', async () => {
    const tournamentChain = makeTournamentChain();
    const rows = [
      {
        strokes: 2,
        hole_number: 3,
        team_id: 'team-99',
        teams: [{ id: 'team-99', team_name: null }],
      },
    ];
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };

    const result = await fetchBestAchievement(supabase as never, TOURNAMENT_ID);
    expect(result!.teamName).toBe('Team team-99');
  });
});

// ---------------------------------------------------------------------------
// fetchSparklineTracks
// ---------------------------------------------------------------------------

describe('fetchSparklineTracks', () => {
  it('returns [] when tournament query errors', async () => {
    const tournamentChain = makeTournamentChain(null, { message: 'db error' });
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        return buildChain([], null);
      }),
    };
    expect(await fetchSparklineTracks(supabase as never, TOURNAMENT_ID)).toEqual([]);
  });

  it('returns [] when tournament is not found', async () => {
    const tournamentChain = makeTournamentChain(null, null);
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        return buildChain([], null);
      }),
    };
    expect(await fetchSparklineTracks(supabase as never, TOURNAMENT_ID)).toEqual([]);
  });

  it('returns [] when scores are empty', async () => {
    const tournamentChain = makeTournamentChain();
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain([], null);
      }),
    };
    expect(await fetchSparklineTracks(supabase as never, TOURNAMENT_ID)).toEqual([]);
  });

  it('returns [] when scores query errors', async () => {
    const tournamentChain = makeTournamentChain();
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(null, { message: 'scores error' });
      }),
    };
    expect(await fetchSparklineTracks(supabase as never, TOURNAMENT_ID)).toEqual([]);
  });

  it('builds cumulative vspar track per team sorted by hole number', async () => {
    const tournamentChain = makeTournamentChain();
    const rows = [
      {
        strokes: 3,
        hole_number: 1,
        team_id: 'team-1',
        teams: [{ id: 'team-1', team_name: 'Eagles' }],
      },
      {
        strokes: 5,
        hole_number: 2,
        team_id: 'team-1',
        teams: [{ id: 'team-1', team_name: 'Eagles' }],
      },
      {
        strokes: 4,
        hole_number: 3,
        team_id: 'team-1',
        teams: [{ id: 'team-1', team_name: 'Eagles' }],
      },
    ];
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };
    const result = await fetchSparklineTracks(supabase as never, TOURNAMENT_ID);
    expect(result).toHaveLength(1);
    // hole1: 3-4=-1 (cum=-1), hole2: 5-3=+2 (cum=+1), hole3: 4-5=-1 (cum=0)
    expect(result[0].teamId).toBe('team-1');
    expect(result[0].teamName).toBe('Eagles');
    expect(result[0].track).toEqual([-1, 1, 0]);
    expect(result[0].holesCompleted).toBe(3);
  });

  it('groups multiple teams independently', async () => {
    const tournamentChain = makeTournamentChain();
    const rows = [
      {
        strokes: 3,
        hole_number: 1,
        team_id: 'team-1',
        teams: [{ id: 'team-1', team_name: 'Eagles' }],
      },
      {
        strokes: 5,
        hole_number: 1,
        team_id: 'team-2',
        teams: [{ id: 'team-2', team_name: 'Hawks' }],
      },
    ];
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };
    const result = await fetchSparklineTracks(supabase as never, TOURNAMENT_ID);
    expect(result).toHaveLength(2);
    const eagles = result.find((r) => r.teamId === 'team-1');
    const hawks = result.find((r) => r.teamId === 'team-2');
    // team-1 hole1: 3-4=-1
    expect(eagles?.track).toEqual([-1]);
    // team-2 hole1: 5-4=+1
    expect(hawks?.track).toEqual([1]);
  });

  it('skips scores where par data is missing', async () => {
    const tournamentChain = makeTournamentChain();
    // hole_number 99 has no par in MOCK_HOLES_PAR
    const rows = [
      {
        strokes: 3,
        hole_number: 99,
        team_id: 'team-1',
        teams: [{ id: 'team-1', team_name: 'Eagles' }],
      },
    ];
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };
    const result = await fetchSparklineTracks(supabase as never, TOURNAMENT_ID);
    // no valid rows → returns []
    expect(result).toEqual([]);
  });

  it('uses team_name fallback when team_name is null', async () => {
    const tournamentChain = makeTournamentChain();
    const rows = [
      {
        strokes: 3,
        hole_number: 1,
        team_id: 'team-99',
        teams: [{ id: 'team-99', team_name: null }],
      },
    ];
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        return buildChain(rows, null);
      }),
    };
    const result = await fetchSparklineTracks(supabase as never, TOURNAMENT_ID);
    expect(result[0].teamName).toBe('Team team-99');
  });
});

// ---------------------------------------------------------------------------
// fetchTeamSpotlight
// ---------------------------------------------------------------------------

const TEAM_ID = 'team-1';

describe('fetchTeamSpotlight', () => {
  it('returns null when tournament query errors', async () => {
    const tournamentChain = makeTournamentChain(null, { message: 'db error' });
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        return buildChain([], null);
      }),
    };
    expect(await fetchTeamSpotlight(supabase as never, TOURNAMENT_ID, TEAM_ID)).toBeNull();
  });

  it('returns null when tournament is not found', async () => {
    const tournamentChain = makeTournamentChain(null, null);
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        return buildChain([], null);
      }),
    };
    expect(await fetchTeamSpotlight(supabase as never, TOURNAMENT_ID, TEAM_ID)).toBeNull();
  });

  it('returns null when scores query errors', async () => {
    const tournamentChain = makeTournamentChain();
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        if (table === 'players') return buildChain([], null);
        if (table === 'shots') return buildChain([], null);
        if (table === 'teams') return buildChain({ team_name: 'Eagles' }, null);
        return buildChain(null, { message: 'scores error' });
      }),
    };
    expect(await fetchTeamSpotlight(supabase as never, TOURNAMENT_ID, TEAM_ID)).toBeNull();
  });

  it('returns null when players query errors', async () => {
    const tournamentChain = makeTournamentChain();
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        if (table === 'scores') return buildChain([], null);
        if (table === 'shots') return buildChain([], null);
        if (table === 'teams') return buildChain({ team_name: 'Eagles' }, null);
        // players error
        return buildChain(null, { message: 'players error' });
      }),
    };
    expect(await fetchTeamSpotlight(supabase as never, TOURNAMENT_ID, TEAM_ID)).toBeNull();
  });

  it('calculates score, birdies, eagles, pars correctly from best-ball scores', async () => {
    const tournamentChain = makeTournamentChain();
    const bbScores = [
      { strokes: 3, hole_number: 1, player_id: 'p1', is_best_ball: true }, // -1 birdie
      { strokes: 1, hole_number: 2, player_id: 'p1', is_best_ball: true }, // -2 eagle
      { strokes: 5, hole_number: 3, player_id: 'p2', is_best_ball: true }, // 0 par
    ];
    const teamChain = buildChain({ team_name: 'Eagles' }, null);
    (teamChain.single as jest.Mock).mockResolvedValue({
      data: { team_name: 'Eagles' },
      error: null,
    });

    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        if (table === 'scores') return buildChain(bbScores, null);
        if (table === 'players')
          return buildChain([{ id: 'p1', name: 'Alice', title: 'CEO', company: 'Acme' }], null);
        if (table === 'shots') return buildChain([], null);
        if (table === 'teams') return teamChain;
        return buildChain([], null);
      }),
    };

    const result = await fetchTeamSpotlight(supabase as never, TOURNAMENT_ID, TEAM_ID);
    expect(result).not.toBeNull();
    // score: (-1) + (-2) + 0 = -3
    expect(result!.score).toBe(-3);
    expect(result!.birdies).toBe(2); // eagle also counts as birdie
    expect(result!.eagles).toBe(1);
    expect(result!.pars).toBe(1);
    expect(result!.holesCompleted).toBe(3);
    expect(result!.teamName).toBe('Eagles');
    expect(result!.penalties).toBe(0);
  });

  it('counts out_of_bounds shots as penalties', async () => {
    const tournamentChain = makeTournamentChain();
    const teamChain = buildChain({ team_name: 'Hawks' }, null);
    (teamChain.single as jest.Mock).mockResolvedValue({
      data: { team_name: 'Hawks' },
      error: null,
    });

    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        if (table === 'scores') return buildChain([], null);
        if (table === 'tournament_players') return buildChain([{ player_id: 'p1' }], null);
        if (table === 'players')
          return buildChain([{ id: 'p1', name: 'Bob', title: '', company: '' }], null);
        if (table === 'shots')
          return buildChain(
            [{ outcome: 'out_of_bounds' }, { outcome: 'out_of_bounds' }, { outcome: 'in_play' }],
            null
          );
        if (table === 'teams') return teamChain;
        return buildChain([], null);
      }),
    };

    const result = await fetchTeamSpotlight(supabase as never, TOURNAMENT_ID, TEAM_ID);
    expect(result!.penalties).toBe(2);
  });

  it('builds roster sorted by bbHolesCount descending', async () => {
    const tournamentChain = makeTournamentChain();
    const scores = [
      { strokes: 3, hole_number: 1, player_id: 'p1', is_best_ball: true },
      { strokes: 3, hole_number: 2, player_id: 'p1', is_best_ball: true },
      { strokes: 4, hole_number: 1, player_id: 'p2', is_best_ball: true },
    ];
    const players = [
      { id: 'p2', name: 'Bob', title: 'CFO', company: 'Corp' },
      { id: 'p1', name: 'Alice', title: 'CEO', company: 'Acme' },
    ];
    const teamChain = buildChain({ team_name: 'Eagles' }, null);
    (teamChain.single as jest.Mock).mockResolvedValue({
      data: { team_name: 'Eagles' },
      error: null,
    });

    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        if (table === 'scores') return buildChain(scores, null);
        if (table === 'tournament_players')
          return buildChain([{ player_id: 'p1' }, { player_id: 'p2' }], null);
        if (table === 'players') return buildChain(players, null);
        if (table === 'shots') return buildChain([], null);
        if (table === 'teams') return teamChain;
        return buildChain([], null);
      }),
    };

    const result = await fetchTeamSpotlight(supabase as never, TOURNAMENT_ID, TEAM_ID);
    expect(result!.roster).toHaveLength(2);
    // p1 has 2 bb holes, p2 has 1 — so p1 comes first
    expect(result!.roster[0].playerId).toBe('p1');
    expect(result!.roster[0].bbHolesCount).toBe(2);
    expect(result!.roster[1].playerId).toBe('p2');
    expect(result!.roster[1].bbHolesCount).toBe(1);
  });

  it('uses team_name fallback when teams row is null', async () => {
    const tournamentChain = makeTournamentChain();
    const teamChain = buildChain(null, null);
    (teamChain.single as jest.Mock).mockResolvedValue({ data: null, error: null });

    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        if (table === 'scores') return buildChain([], null);
        if (table === 'players') return buildChain([], null);
        if (table === 'shots') return buildChain([], null);
        if (table === 'teams') return teamChain;
        return buildChain([], null);
      }),
    };

    const result = await fetchTeamSpotlight(supabase as never, TOURNAMENT_ID, TEAM_ID);
    expect(result!.teamName).toBe(`Team ${TEAM_ID}`);
  });

  it('scorecard is sorted by hole number', async () => {
    const tournamentChain = makeTournamentChain();
    const scores = [
      { strokes: 5, hole_number: 3, player_id: 'p1', is_best_ball: true },
      { strokes: 3, hole_number: 1, player_id: 'p1', is_best_ball: true },
      { strokes: 4, hole_number: 2, player_id: 'p1', is_best_ball: true },
    ];
    const teamChain = buildChain({ team_name: 'Eagles' }, null);
    (teamChain.single as jest.Mock).mockResolvedValue({
      data: { team_name: 'Eagles' },
      error: null,
    });

    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'holes') return buildChain(MOCK_HOLES_PAR, null);
        if (table === 'scores') return buildChain(scores, null);
        if (table === 'players') return buildChain([], null);
        if (table === 'shots') return buildChain([], null);
        if (table === 'teams') return teamChain;
        return buildChain([], null);
      }),
    };

    const result = await fetchTeamSpotlight(supabase as never, TOURNAMENT_ID, TEAM_ID);
    const holeNums = result!.scorecard.map((s) => s.holeNumber);
    expect(holeNums).toEqual([1, 2, 3]);
  });
});
