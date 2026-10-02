import type { ShotOutcome } from '@/lib/types';

export interface ShotEditCascade {
  /** What to do to the player's `scores` row for this hole. */
  scoreAction: 'upsert' | 'delete' | 'none';
  /** Strokes to write when `scoreAction === 'upsert'` (equals the edited shot's number). */
  strokes?: number;
  /** Delete shots with `shot_number` greater than this value (they followed a sink that no longer happened). */
  deleteShotsAfter?: number;
  /** Whether `calculate-best-ball` must be re-invoked. */
  recalculateBestBall: boolean;
  /** New `holeSunk` value to apply if the edited shot belongs to the active player; `undefined` = no change. */
  holeSunk?: boolean;
}

/**
 * Decides the score/best-ball/hole-state side effects of editing a shot's outcome.
 *
 * The only state transitions that matter are into or out of `'sunk'` — editing between
 * the other three outcomes (`in_play`, `out_of_bounds`, `mulligan`) never changes whether
 * the hole is complete, so it has no cascade.
 */
export function computeShotEditCascade(
  previousOutcome: ShotOutcome,
  newOutcome: ShotOutcome,
  editedShotNumber: number
): ShotEditCascade {
  const wasSunk = previousOutcome === 'sunk';
  const isSunk = newOutcome === 'sunk';

  if (!wasSunk && isSunk) {
    return {
      scoreAction: 'upsert',
      strokes: editedShotNumber,
      deleteShotsAfter: editedShotNumber,
      recalculateBestBall: true,
      holeSunk: true,
    };
  }

  if (wasSunk && !isSunk) {
    return {
      scoreAction: 'delete',
      recalculateBestBall: true,
      holeSunk: false,
    };
  }

  return { scoreAction: 'none', recalculateBestBall: false };
}
