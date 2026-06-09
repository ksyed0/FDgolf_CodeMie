import type { Score, Hole } from '@/lib/types';

export interface TeamHoleResult {
  hole_number: number;
  par: number;
  best_ball_strokes: number | null;
  strokes_vs_par: number | null;
}

export function buildTeamCard(
  scores: Score[],
  holes: Hole[],
  teamId: string
): TeamHoleResult[] {
  return holes.map((hole) => {
    const teamScores = scores.filter(
      (s) => s.team_id === teamId && s.hole_number === hole.hole_number && s.is_best_ball
    );
    const best = teamScores[0] ?? null;
    return {
      hole_number: hole.hole_number,
      par: hole.par,
      best_ball_strokes: best?.strokes ?? null,
      strokes_vs_par: best ? best.strokes - hole.par : null,
    };
  });
}

export function totalVsPar(card: TeamHoleResult[]): number {
  return card.reduce((sum, h) => sum + (h.strokes_vs_par ?? 0), 0);
}

export function formatVsPar(n: number): string {
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : `${n}`;
}
