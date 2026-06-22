import { generateScore } from '../../scripts/demo/score-gen';

describe('generateScore', () => {
  it('par 3: always returns value in [3, 7]', () => {
    for (let i = 0; i < 200; i++) {
      const s = generateScore(3);
      expect(s).toBeGreaterThanOrEqual(3);
      expect(s).toBeLessThanOrEqual(7);
    }
  });

  it('par 4: always returns value in [4, 8]', () => {
    for (let i = 0; i < 200; i++) {
      const s = generateScore(4);
      expect(s).toBeGreaterThanOrEqual(4);
      expect(s).toBeLessThanOrEqual(8);
    }
  });

  it('par 5: always returns value in [5, 9]', () => {
    for (let i = 0; i < 200; i++) {
      const s = generateScore(5);
      expect(s).toBeGreaterThanOrEqual(5);
      expect(s).toBeLessThanOrEqual(9);
    }
  });

  it('returns an integer', () => {
    expect(Number.isInteger(generateScore(4))).toBe(true);
  });
});
