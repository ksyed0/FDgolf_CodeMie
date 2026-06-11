import { buildTeamCard, totalVsPar, formatVsPar, TeamHoleResult } from '@/lib/scoring';
import type { Score, Hole } from '@/lib/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeHole(hole_number: number, par: number): Hole {
  return {
    id: `hole-${hole_number}`,
    course_id: 'course-1',
    hole_number,
    par,
    handicap: hole_number,
    pin_lat: 43.0,
    pin_lng: -79.0,
  };
}

function makeScore(
  overrides: Partial<Score> & {
    player_id: string;
    hole_number: number;
    strokes: number;
    is_best_ball?: boolean;
  }
): Score {
  return {
    id: `score-${overrides.player_id}-${overrides.hole_number}`,
    player_id: overrides.player_id,
    team_id: overrides.team_id ?? 'team-1',
    tournament_id: overrides.tournament_id ?? 'tournament-1',
    hole_number: overrides.hole_number,
    strokes: overrides.strokes,
    is_best_ball: overrides.is_best_ball ?? false,
    override_by: null,
    override_at: null,
  };
}

// ---------------------------------------------------------------------------
// buildTeamCard
// ---------------------------------------------------------------------------

describe('buildTeamCard', () => {
  const holes: Hole[] = [makeHole(1, 4), makeHole(2, 3), makeHole(3, 5)];

  describe('returns correct strokes_vs_par for each hole', () => {
    it('returns strokes_vs_par as strokes minus par for a best-ball score', () => {
      const scores: Score[] = [
        makeScore({ player_id: 'p1', hole_number: 1, strokes: 5, is_best_ball: true }),
        makeScore({ player_id: 'p1', hole_number: 2, strokes: 3, is_best_ball: true }),
        makeScore({ player_id: 'p1', hole_number: 3, strokes: 4, is_best_ball: true }),
      ];

      const card = buildTeamCard(scores, holes, 'team-1');

      expect(card[0].strokes_vs_par).toBe(1); // 5 - 4
      expect(card[1].strokes_vs_par).toBe(0); // 3 - 3
      expect(card[2].strokes_vs_par).toBe(-1); // 4 - 5
    });

    it('returns par correctly for each hole', () => {
      const scores: Score[] = [
        makeScore({ player_id: 'p1', hole_number: 1, strokes: 4, is_best_ball: true }),
      ];
      const card = buildTeamCard(scores, holes, 'team-1');
      expect(card[0].par).toBe(4);
      expect(card[1].par).toBe(3);
      expect(card[2].par).toBe(5);
    });

    it('returns hole_number for each entry', () => {
      const card = buildTeamCard([], holes, 'team-1');
      expect(card.map((h) => h.hole_number)).toEqual([1, 2, 3]);
    });
  });

  describe('marks is_best_ball on the minimum-stroke score per hole', () => {
    it('uses only scores where is_best_ball is true', () => {
      const scores: Score[] = [
        makeScore({ player_id: 'p1', hole_number: 1, strokes: 4, is_best_ball: true }),
        makeScore({ player_id: 'p2', hole_number: 1, strokes: 6, is_best_ball: false }),
      ];

      const card = buildTeamCard(scores, holes, 'team-1');
      // Only the is_best_ball score (4 strokes) counts
      expect(card[0].best_ball_strokes).toBe(4);
      expect(card[0].strokes_vs_par).toBe(0); // 4 - 4
    });

    it('does not count non-best-ball scores', () => {
      const scores: Score[] = [
        makeScore({ player_id: 'p1', hole_number: 1, strokes: 3, is_best_ball: false }),
        makeScore({ player_id: 'p2', hole_number: 1, strokes: 6, is_best_ball: false }),
      ];

      const card = buildTeamCard(scores, holes, 'team-1');
      expect(card[0].best_ball_strokes).toBeNull();
      expect(card[0].strokes_vs_par).toBeNull();
    });

    it('picks the first best-ball score when two players tie on a hole', () => {
      // Both marked is_best_ball = true (edge case: tie)
      const scores: Score[] = [
        makeScore({
          id: 'score-p1-1',
          player_id: 'p1',
          hole_number: 1,
          strokes: 4,
          is_best_ball: true,
        }),
        makeScore({
          id: 'score-p2-1',
          player_id: 'p2',
          hole_number: 1,
          strokes: 4,
          is_best_ball: true,
        }),
      ];

      const card = buildTeamCard(scores, holes, 'team-1');
      // With a tie, the first is_best_ball score is used
      expect(card[0].best_ball_strokes).toBe(4);
      expect(card[0].strokes_vs_par).toBe(0);
    });
  });

  describe('hole with no scores', () => {
    it('produces null best_ball_strokes and null strokes_vs_par for holes with no scores', () => {
      const card = buildTeamCard([], holes, 'team-1');

      card.forEach((h) => {
        expect(h.best_ball_strokes).toBeNull();
        expect(h.strokes_vs_par).toBeNull();
      });
    });

    it('returns an entry for every hole even when some holes have no scores', () => {
      const scores: Score[] = [
        makeScore({ player_id: 'p1', hole_number: 2, strokes: 2, is_best_ball: true }),
      ];

      const card = buildTeamCard(scores, holes, 'team-1');
      expect(card).toHaveLength(3);
      expect(card[0].best_ball_strokes).toBeNull(); // hole 1 — no score
      expect(card[1].best_ball_strokes).toBe(2); // hole 2 — has score
      expect(card[2].best_ball_strokes).toBeNull(); // hole 3 — no score
    });
  });

  describe('filters by teamId', () => {
    it('ignores scores that belong to a different team', () => {
      const scores: Score[] = [
        makeScore({
          player_id: 'p1',
          hole_number: 1,
          strokes: 4,
          is_best_ball: true,
          team_id: 'team-2',
        }),
      ];

      const card = buildTeamCard(scores, holes, 'team-1');
      expect(card[0].best_ball_strokes).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// totalVsPar
// ---------------------------------------------------------------------------

describe('totalVsPar', () => {
  it('sums positive strokes_vs_par values correctly', () => {
    const card: TeamHoleResult[] = [
      { hole_number: 1, par: 4, best_ball_strokes: 5, strokes_vs_par: 1 },
      { hole_number: 2, par: 3, best_ball_strokes: 5, strokes_vs_par: 2 },
    ];
    expect(totalVsPar(card)).toBe(3);
  });

  it('sums negative strokes_vs_par values correctly (under par)', () => {
    const card: TeamHoleResult[] = [
      { hole_number: 1, par: 4, best_ball_strokes: 3, strokes_vs_par: -1 },
      { hole_number: 2, par: 5, best_ball_strokes: 4, strokes_vs_par: -1 },
    ];
    expect(totalVsPar(card)).toBe(-2);
  });

  it('returns zero when all holes are even par', () => {
    const card: TeamHoleResult[] = [
      { hole_number: 1, par: 4, best_ball_strokes: 4, strokes_vs_par: 0 },
      { hole_number: 2, par: 3, best_ball_strokes: 3, strokes_vs_par: 0 },
    ];
    expect(totalVsPar(card)).toBe(0);
  });

  it('treats null strokes_vs_par as zero (hole not yet played)', () => {
    const card: TeamHoleResult[] = [
      { hole_number: 1, par: 4, best_ball_strokes: 3, strokes_vs_par: -1 },
      { hole_number: 2, par: 3, best_ball_strokes: null, strokes_vs_par: null },
    ];
    expect(totalVsPar(card)).toBe(-1);
  });

  it('returns zero for an empty card', () => {
    expect(totalVsPar([])).toBe(0);
  });

  it('handles mixed positive, negative, and null values', () => {
    const card: TeamHoleResult[] = [
      { hole_number: 1, par: 4, best_ball_strokes: 5, strokes_vs_par: 1 },
      { hole_number: 2, par: 5, best_ball_strokes: 4, strokes_vs_par: -1 },
      { hole_number: 3, par: 3, best_ball_strokes: null, strokes_vs_par: null },
    ];
    expect(totalVsPar(card)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatVsPar
// ---------------------------------------------------------------------------

describe('formatVsPar', () => {
  it('returns E for even par (zero)', () => {
    expect(formatVsPar(0)).toBe('E');
  });

  it('returns +N for positive (over par)', () => {
    expect(formatVsPar(1)).toBe('+1');
    expect(formatVsPar(5)).toBe('+5');
    expect(formatVsPar(10)).toBe('+10');
  });

  it('returns -N for negative (under par)', () => {
    expect(formatVsPar(-1)).toBe('-1');
    expect(formatVsPar(-5)).toBe('-5');
    expect(formatVsPar(-10)).toBe('-10');
  });

  it('handles large positive values', () => {
    expect(formatVsPar(72)).toBe('+72');
  });

  it('handles large negative values', () => {
    expect(formatVsPar(-72)).toBe('-72');
  });
});
