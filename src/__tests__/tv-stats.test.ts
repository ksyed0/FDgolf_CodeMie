/**
 * Unit tests for src/lib/tv-stats.ts
 *
 * Each exported function receives a Supabase client as a parameter, so we
 * mock the client rather than the module itself.  The mock uses the same
 * chained-query pattern as the real Supabase JS client:
 *
 *   supabase.from('table').select('...').eq('col', val)  → resolves { data, error }
 *   supabase.from('table').select('...').eq(...).single() → resolves { data, error }
 */

import {
  fetchBirdieStats,
  fetchMomentumStats,
  fetchHoleDifficulty,
  fetchShotStats,
  fetchBestAchievement,
} from '@/lib/tv-stats';

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable Supabase mock where every terminal call (the chain as a
 * whole, or `.single()`) resolves to { data, error }.
 *
 * The chain must be "awaitable" itself (for `await supabase.from().select().eq()`)
 * AND expose a `.single()` method (for `await supabase.from().select().eq().single()`).
 *
 * We do this by returning a thenable object from each chain method.
 */
function buildChain(data: unknown, error: unknown) {
  // A thenable that also exposes the chain methods and .single()
  const resolved = Promise.resolve({ data, error });

  const chain: Record<string, unknown> = {
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
    single: jest.fn().mockResolvedValue({ data, error }),
  };

  // Each method returns the same chain (supports arbitrary depth)
  for (const method of ['select', 'eq', 'in', 'not', 'order', 'limit']) {
    chain[method] = jest.fn().mockReturnValue(chain);
  }

  return chain;
}

/**
 * Build a mock Supabase client where every call to `.from()` returns a chain
 * that resolves to the same { data, error }.
 *
 * For tests that need different responses for different tables, use
 * `buildMultiMockSupabase`.
 */
function buildMockSupabase(data: unknown = null, error: unknown = null) {
  const chain = buildChain(data, error);
  return { from: jest.fn().mockReturnValue(chain) };
}

/**
 * Build a mock Supabase client where each call to `.from(tableName)` can
 * return a different result.  `tableMap` is { tableName: { data, error } }.
 * Any table not in the map falls back to { data: null, error: null }.
 */
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

/** One birdie score row (vspar = -1) */
function makeBirdieScoreRow(overrides: {
  teamId?: string;
  teamName?: string;
  strokes?: number;
  par?: number;
}) {
  const { teamId = 'team-1', teamName = 'Eagles', strokes = 3, par = 4 } = overrides;
  return {
    strokes,
    team_id: teamId,
    teams: [{ id: teamId, team_name: teamName }],
    holes: [{ hole_number: 1, par, course_id: COURSE_ID }],
  };
}

// ---------------------------------------------------------------------------
// fetchBirdieStats
// ---------------------------------------------------------------------------

describe('fetchBirdieStats', () => {
  it('returns [] when the tournament query returns an error', async () => {
    const supabase = buildMultiMockSupabase({
      tournaments: { data: null, error: { message: 'DB error' } },
    });
    const result = await fetchBirdieStats(supabase as never, TOURNAMENT_ID);
    expect(result).toEqual([]);
  });

  it('returns [] when tournament is not found', async () => {
    const supabase = buildMultiMockSupabase({
      tournaments: { data: null, error: null },
    });
    const result = await fetchBirdieStats(supabase as never, TOURNAMENT_ID);
    expect(result).toEqual([]);
  });

  it('returns [] when the scores query returns an error', async () => {
    // tournament.single() must succeed; scores chain must fail
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });

    const scoresChain = buildChain(null, { message: 'scores error' });

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchBirdieStats(supabase as never, TOURNAMENT_ID);
    expect(result).toEqual([]);
  });

  it('returns [] when there are no scores', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const scoresChain = buildChain([], null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchBirdieStats(supabase as never, TOURNAMENT_ID);
    expect(result).toEqual([]);
  });

  it('counts birdies correctly (vspar = -1)', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const rows = [
      makeBirdieScoreRow({ strokes: 3, par: 4 }), // birdie
      makeBirdieScoreRow({ strokes: 3, par: 4 }), // birdie
    ];
    const scoresChain = buildChain(rows, null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchBirdieStats(supabase as never, TOURNAMENT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].birdies).toBe(2);
    expect(result[0].eagles).toBe(0);
    expect(result[0].teamName).toBe('Eagles');
  });

  it('counts eagles correctly (vspar <= -2, also increments birdies)', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const rows = [
      makeBirdieScoreRow({ strokes: 2, par: 4 }), // eagle (vspar = -2)
    ];
    const scoresChain = buildChain(rows, null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchBirdieStats(supabase as never, TOURNAMENT_ID);
    expect(result[0].eagles).toBe(1);
    expect(result[0].birdies).toBe(1); // eagle also increments birdies
  });

  it('ignores scores from a different course', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const rows = [
      {
        strokes: 3,
        team_id: 'team-1',
        teams: [{ id: 'team-1', team_name: 'Eagles' }],
        holes: [{ hole_number: 1, par: 4, course_id: 'different-course' }],
      },
    ];
    const scoresChain = buildChain(rows, null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchBirdieStats(supabase as never, TOURNAMENT_ID);
    expect(result).toEqual([]);
  });

  it('sorts teams by birdie count descending', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const rows = [
      makeBirdieScoreRow({ teamId: 'team-1', teamName: 'Eagles', strokes: 3, par: 4 }),
      makeBirdieScoreRow({ teamId: 'team-2', teamName: 'Birdies', strokes: 3, par: 4 }),
      makeBirdieScoreRow({ teamId: 'team-2', teamName: 'Birdies', strokes: 3, par: 4 }),
    ];
    const scoresChain = buildChain(rows, null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchBirdieStats(supabase as never, TOURNAMENT_ID);
    expect(result[0].teamId).toBe('team-2'); // 2 birdies first
    expect(result[1].teamId).toBe('team-1');
  });
});

// ---------------------------------------------------------------------------
// fetchMomentumStats
// ---------------------------------------------------------------------------

describe('fetchMomentumStats', () => {
  it('returns [] when the tournament query returns an error', async () => {
    const supabase = buildMultiMockSupabase({
      tournaments: { data: null, error: { message: 'DB error' } },
    });
    const result = await fetchMomentumStats(supabase as never, TOURNAMENT_ID);
    expect(result).toEqual([]);
  });

  it('returns [] when tournament is not found', async () => {
    const supabase = buildMultiMockSupabase({
      tournaments: { data: null, error: null },
    });
    const result = await fetchMomentumStats(supabase as never, TOURNAMENT_ID);
    expect(result).toEqual([]);
  });

  it('returns [] when there are no scores', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const scoresChain = buildChain([], null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchMomentumStats(supabase as never, TOURNAMENT_ID);
    expect(result).toEqual([]);
  });

  it('returns last three holes (sorted ascending) per team', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });

    // 5 holes played — momentum should return only holes 3, 4, 5 (sorted asc)
    const rows = [1, 2, 3, 4, 5].map((hn) => ({
      strokes: hn + 4,
      team_id: 'team-1',
      teams: [{ id: 'team-1', team_name: 'Eagles' }],
      holes: [{ hole_number: hn, par: 4, course_id: COURSE_ID }],
    }));
    const scoresChain = buildChain(rows, null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchMomentumStats(supabase as never, TOURNAMENT_ID);
    expect(result).toHaveLength(1);
    const holes = result[0].lastThreeHoles;
    expect(holes).toHaveLength(3);
    // Should be holes 3, 4, 5 in ascending order
    expect(holes[0].holeNumber).toBe(3);
    expect(holes[1].holeNumber).toBe(4);
    expect(holes[2].holeNumber).toBe(5);
  });

  it('calculates vspar correctly for each hole', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });

    const rows = [
      {
        strokes: 3,
        team_id: 'team-1',
        teams: [{ id: 'team-1', team_name: 'Eagles' }],
        holes: [{ hole_number: 1, par: 4, course_id: COURSE_ID }], // vspar = -1
      },
    ];
    const scoresChain = buildChain(rows, null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchMomentumStats(supabase as never, TOURNAMENT_ID);
    expect(result[0].lastThreeHoles[0].vspar).toBe(-1);
  });

  it('returns [] when scores query returns an error', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const scoresChain = buildChain(null, { message: 'scores error' });

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchMomentumStats(supabase as never, TOURNAMENT_ID);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fetchHoleDifficulty
// ---------------------------------------------------------------------------

describe('fetchHoleDifficulty', () => {
  it('always returns exactly 18 entries on error', async () => {
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

  it('always returns exactly 18 entries on success', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const scoresChain = buildChain([], null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchHoleDifficulty(supabase as never, TOURNAMENT_ID);
    expect(result).toHaveLength(18);
    expect(result.map((h) => h.holeNumber)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it('returns avgVsPar=null for holes with no scores', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    // Only hole 1 has a score
    const rows = [
      {
        strokes: 5,
        holes: [{ hole_number: 1, par: 4, course_id: COURSE_ID }], // vspar = +1
      },
    ];
    const scoresChain = buildChain(rows, null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchHoleDifficulty(supabase as never, TOURNAMENT_ID);
    expect(result).toHaveLength(18);
    expect(result[0].holeNumber).toBe(1);
    expect(result[0].avgVsPar).toBe(1); // (5 - 4) = +1
    // All other holes have no data
    result.slice(1).forEach((h) => {
      expect(h.avgVsPar).toBeNull();
    });
  });

  it('averages vspar across multiple scores on the same hole', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    // Two scores on hole 2: vspar = -1 and +1 → avg = 0
    const rows = [
      { strokes: 3, holes: [{ hole_number: 2, par: 4, course_id: COURSE_ID }] },
      { strokes: 5, holes: [{ hole_number: 2, par: 4, course_id: COURSE_ID }] },
    ];
    const scoresChain = buildChain(rows, null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchHoleDifficulty(supabase as never, TOURNAMENT_ID);
    expect(result[1].holeNumber).toBe(2);
    expect(result[1].avgVsPar).toBe(0);
  });

  it('ignores scores from a different course', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const rows = [{ strokes: 2, holes: [{ hole_number: 1, par: 4, course_id: 'other-course' }] }];
    const scoresChain = buildChain(rows, null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchHoleDifficulty(supabase as never, TOURNAMENT_ID);
    expect(result[0].avgVsPar).toBeNull();
  });

  it('returns 18 null entries when tournament is not found', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: null,
      error: null,
    });

    const supabase = {
      from: jest.fn().mockReturnValue(tournamentChain),
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
  it('returns empty ShotStats when tournament query errors', async () => {
    const supabase = buildMultiMockSupabase({
      tournaments: { data: null, error: { message: 'DB error' } },
    });
    const result = await fetchShotStats(supabase as never, TOURNAMENT_ID);
    expect(result).toEqual({
      longestDriveMeters: null,
      longestDriveTeam: null,
      clubOfDay: null,
      clubOfDayPct: null,
      cleanestTeams: [],
    });
  });

  it('returns empty ShotStats when there are no shots', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const emptyChain = buildChain([], null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : emptyChain
        ),
    };

    const result = await fetchShotStats(supabase as never, TOURNAMENT_ID);
    expect(result).toEqual({
      longestDriveMeters: null,
      longestDriveTeam: null,
      clubOfDay: null,
      clubOfDayPct: null,
      cleanestTeams: [],
    });
  });

  it('returns empty ShotStats when shots query errors', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const errorChain = buildChain(null, { message: 'shots error' });

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : errorChain
        ),
    };

    const result = await fetchShotStats(supabase as never, TOURNAMENT_ID);
    expect(result).toEqual({
      longestDriveMeters: null,
      longestDriveTeam: null,
      clubOfDay: null,
      clubOfDayPct: null,
      cleanestTeams: [],
    });
  });

  it('returns cleanestTeams with badShots=0 when no out_of_bounds shots exist', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });

    // shots: one in_play shot, no GPS coords so no longest drive
    const shots = [
      {
        player_id: 'player-1',
        hole_number: 1,
        club_name: '7 Iron',
        start_lat: 0,
        start_lng: 0,
        outcome: 'in_play',
      },
    ];

    const bbScores = [
      {
        player_id: 'player-1',
        hole_number: 1,
        team_id: 'team-1',
        teams: [{ id: 'team-1', team_name: 'Eagles' }],
      },
    ];

    const teams = [{ id: 'team-1', team_name: 'Eagles' }];
    const players = [{ id: 'player-1', team_id: 'team-1' }];

    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'shots') return buildChain(shots, null);
        if (table === 'holes') return buildChain([], null);
        if (table === 'scores') return buildChain(bbScores, null);
        if (table === 'teams') return buildChain(teams, null);
        if (table === 'players') return buildChain(players, null);
        return buildChain(null, null);
      }),
    };

    const result = await fetchShotStats(supabase as never, TOURNAMENT_ID);
    expect(result.cleanestTeams).toHaveLength(1);
    expect(result.cleanestTeams[0].teamName).toBe('Eagles');
    expect(result.cleanestTeams[0].badShots).toBe(0);
  });

  it('counts out_of_bounds shots as bad shots', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });

    const shots = [
      {
        player_id: 'player-1',
        hole_number: 1,
        club_name: 'Driver',
        start_lat: 0,
        start_lng: 0,
        outcome: 'out_of_bounds',
      },
      {
        player_id: 'player-1',
        hole_number: 2,
        club_name: 'Driver',
        start_lat: 0,
        start_lng: 0,
        outcome: 'out_of_bounds',
      },
    ];

    const teams = [{ id: 'team-1', team_name: 'Rough Riders' }];
    const players = [{ id: 'player-1', team_id: 'team-1' }];

    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournaments') return tournamentChain;
        if (table === 'shots') return buildChain(shots, null);
        if (table === 'holes') return buildChain([], null);
        if (table === 'scores') return buildChain([], null);
        if (table === 'teams') return buildChain(teams, null);
        if (table === 'players') return buildChain(players, null);
        return buildChain(null, null);
      }),
    };

    const result = await fetchShotStats(supabase as never, TOURNAMENT_ID);
    expect(result.cleanestTeams[0].badShots).toBe(2);
  });

  it('detects club of day from best-ball hole shots', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });

    const shots = [
      {
        player_id: 'p1',
        hole_number: 1,
        club_name: 'Driver',
        start_lat: 0,
        start_lng: 0,
        outcome: 'in_play',
      },
      {
        player_id: 'p1',
        hole_number: 1,
        club_name: 'Driver',
        start_lat: 0,
        start_lng: 0,
        outcome: 'in_play',
      },
      {
        player_id: 'p1',
        hole_number: 1,
        club_name: '7 Iron',
        start_lat: 0,
        start_lng: 0,
        outcome: 'in_play',
      },
    ];

    // player p1 hole 1 is in best-ball set
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
    expect(result.clubOfDay).toBe('Driver');
    // 2 out of 3 = 67%
    expect(result.clubOfDayPct).toBe(67);
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
    const result = await fetchBestAchievement(supabase as never, TOURNAMENT_ID);
    expect(result).toBeNull();
  });

  it('returns null when tournament is not found', async () => {
    const supabase = buildMultiMockSupabase({
      tournaments: { data: null, error: null },
    });
    const result = await fetchBestAchievement(supabase as never, TOURNAMENT_ID);
    expect(result).toBeNull();
  });

  it('returns null when there are no scores', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const scoresChain = buildChain([], null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchBestAchievement(supabase as never, TOURNAMENT_ID);
    expect(result).toBeNull();
  });

  it('returns null when all scores are at par or over par (vspar >= 0)', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const rows = [
      {
        strokes: 4,
        hole_number: 1,
        teams: [{ id: 'team-1', team_name: 'Eagles' }],
        holes: [{ hole_number: 1, par: 4, course_id: COURSE_ID }], // vspar = 0
      },
      {
        strokes: 5,
        hole_number: 2,
        teams: [{ id: 'team-1', team_name: 'Eagles' }],
        holes: [{ hole_number: 2, par: 4, course_id: COURSE_ID }], // vspar = +1
      },
    ];
    const scoresChain = buildChain(rows, null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchBestAchievement(supabase as never, TOURNAMENT_ID);
    expect(result).toBeNull();
  });

  it('returns the best birdie (vspar = -1)', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const rows = [
      {
        strokes: 3,
        hole_number: 5,
        teams: [{ id: 'team-1', team_name: 'Eagles' }],
        holes: [{ hole_number: 5, par: 4, course_id: COURSE_ID }], // vspar = -1
      },
    ];
    const scoresChain = buildChain(rows, null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchBestAchievement(supabase as never, TOURNAMENT_ID);
    expect(result).not.toBeNull();
    expect(result!.teamName).toBe('Eagles');
    expect(result!.holeNumber).toBe(5);
    expect(result!.vspar).toBe(-1);
  });

  it('returns the eagle over a birdie (vspar = -2 beats -1)', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const rows = [
      {
        strokes: 3,
        hole_number: 1,
        teams: [{ id: 'team-1', team_name: 'Eagles' }],
        holes: [{ hole_number: 1, par: 4, course_id: COURSE_ID }], // vspar = -1 (birdie)
      },
      {
        strokes: 3,
        hole_number: 7,
        teams: [{ id: 'team-2', team_name: 'Aces' }],
        holes: [{ hole_number: 7, par: 5, course_id: COURSE_ID }], // vspar = -2 (eagle)
      },
    ];
    const scoresChain = buildChain(rows, null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchBestAchievement(supabase as never, TOURNAMENT_ID);
    expect(result!.teamName).toBe('Aces');
    expect(result!.holeNumber).toBe(7);
    expect(result!.vspar).toBe(-2);
  });

  it('returns null when scores query errors', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const scoresChain = buildChain(null, { message: 'scores error' });

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchBestAchievement(supabase as never, TOURNAMENT_ID);
    expect(result).toBeNull();
  });

  it('ignores scores from a different course', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const rows = [
      {
        strokes: 2,
        hole_number: 1,
        teams: [{ id: 'team-1', team_name: 'Eagles' }],
        holes: [{ hole_number: 1, par: 4, course_id: 'other-course' }], // wrong course
      },
    ];
    const scoresChain = buildChain(rows, null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchBestAchievement(supabase as never, TOURNAMENT_ID);
    expect(result).toBeNull();
  });

  it('uses team_name fallback when team_name is null', async () => {
    const tournamentChain = buildChain(null, null);
    (tournamentChain.single as jest.Mock).mockResolvedValue({
      data: mockTournament,
      error: null,
    });
    const rows = [
      {
        strokes: 2,
        hole_number: 3,
        teams: [{ id: 'team-99', team_name: null }], // null name
        holes: [{ hole_number: 3, par: 4, course_id: COURSE_ID }],
      },
    ];
    const scoresChain = buildChain(rows, null);

    const supabase = {
      from: jest
        .fn()
        .mockImplementation((table: string) =>
          table === 'tournaments' ? tournamentChain : scoresChain
        ),
    };

    const result = await fetchBestAchievement(supabase as never, TOURNAMENT_ID);
    expect(result!.teamName).toBe('Team team-99');
  });
});
