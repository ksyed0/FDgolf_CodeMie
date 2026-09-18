import { computeShotEditCascade } from '@/lib/shot-edit';

describe('computeShotEditCascade', () => {
  it('upserts the score, trims trailing shots, and opens the hole as sunk when a shot becomes sunk', () => {
    const result = computeShotEditCascade('in_play', 'sunk', 3);
    expect(result).toEqual({
      scoreAction: 'upsert',
      strokes: 3,
      deleteShotsAfter: 3,
      recalculateBestBall: true,
      holeSunk: true,
    });
  });

  it('treats out_of_bounds -> sunk the same as in_play -> sunk', () => {
    const result = computeShotEditCascade('out_of_bounds', 'sunk', 5);
    expect(result.scoreAction).toBe('upsert');
    expect(result.strokes).toBe(5);
    expect(result.deleteShotsAfter).toBe(5);
    expect(result.holeSunk).toBe(true);
  });

  it('treats mulligan -> sunk the same as in_play -> sunk', () => {
    const result = computeShotEditCascade('mulligan', 'sunk', 2);
    expect(result.scoreAction).toBe('upsert');
    expect(result.strokes).toBe(2);
  });

  it('deletes the score and reopens the hole when a sunk shot is un-sunk', () => {
    const result = computeShotEditCascade('sunk', 'in_play', 4);
    expect(result).toEqual({
      scoreAction: 'delete',
      recalculateBestBall: true,
      holeSunk: false,
    });
  });

  it('has no cascade when neither the old nor new outcome is sunk', () => {
    const result = computeShotEditCascade('in_play', 'out_of_bounds', 2);
    expect(result).toEqual({
      scoreAction: 'none',
      recalculateBestBall: false,
    });
  });

  it('has no cascade when neither outcome changes relative to sunk (mulligan -> in_play)', () => {
    const result = computeShotEditCascade('mulligan', 'in_play', 1);
    expect(result.scoreAction).toBe('none');
    expect(result.recalculateBestBall).toBe(false);
    expect(result.holeSunk).toBeUndefined();
  });

  it('has no cascade when the outcome is unchanged and already sunk', () => {
    const result = computeShotEditCascade('sunk', 'sunk', 3);
    expect(result.scoreAction).toBe('none');
    expect(result.recalculateBestBall).toBe(false);
  });
});
