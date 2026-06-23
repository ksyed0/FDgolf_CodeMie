import { generateScore } from '../../scripts/demo/score-gen';

describe('generateScore', () => {
  // Distribution: eagle 3%, birdie 25%, par 52%, bogey 17%, double 3%
  // Score = max(1, par + vspar), so minimum is always at least 1

  it('par 3: returns value in [1, 5] (eagle through double)', () => {
    for (let i = 0; i < 500; i++) {
      const s = generateScore(3);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(5);
    }
  });

  it('par 4: returns value in [2, 6] (eagle through double)', () => {
    for (let i = 0; i < 500; i++) {
      const s = generateScore(4);
      expect(s).toBeGreaterThanOrEqual(2);
      expect(s).toBeLessThanOrEqual(6);
    }
  });

  it('par 5: returns value in [3, 7] (eagle through double)', () => {
    for (let i = 0; i < 500; i++) {
      const s = generateScore(5);
      expect(s).toBeGreaterThanOrEqual(3);
      expect(s).toBeLessThanOrEqual(7);
    }
  });

  it('returns an integer', () => {
    expect(Number.isInteger(generateScore(4))).toBe(true);
  });

  it('produces sub-par scores across a large sample', () => {
    // With 28% sub-par probability, the chance of zero birdies in 200 trials is negligible
    const scores = Array.from({ length: 200 }, () => generateScore(4));
    const subPar = scores.filter((s) => s < 4).length;
    expect(subPar).toBeGreaterThan(0);
  });
});
