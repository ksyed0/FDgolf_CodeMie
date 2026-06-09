import { distanceMeters } from '@/lib/gps';
import type { GpsPosition } from '@/lib/gps';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pos(lat: number, lng: number): GpsPosition {
  return { lat, lng, accuracy: 5 };
}

// ---------------------------------------------------------------------------
// distanceMeters — Haversine
// ---------------------------------------------------------------------------

describe('distanceMeters', () => {
  describe('same point returns zero', () => {
    it('returns 0 when both points are identical', () => {
      const p = pos(43.6532, -79.3832);
      expect(distanceMeters(p, p)).toBe(0);
    });

    it('returns 0 for any identical coordinate pair', () => {
      const p = pos(0, 0);
      expect(distanceMeters(p, p)).toBe(0);
    });
  });

  describe('known real-world pair — Toronto City Hall to Granite Ridge Golf Club', () => {
    // Toronto City Hall: 43.6532° N, 79.3832° W
    // Granite Ridge Golf Club (Milton, ON): 43.5257° N, 79.8816° W
    // Haversine gives ~42,570 m straight-line (not 48 km — that was the wrong reference)
    const torontoCityHall = pos(43.6532, -79.3832);
    const graniteRidge = { lat: 43.5257, lng: -79.8816 };
    const expectedDistanceMeters = 42_500; // ~42.5 km Haversine result
    const tolerancePercent = 0.05; // ±5%

    it('returns a distance within ±5% of the known straight-line distance', () => {
      const distance = distanceMeters(torontoCityHall, graniteRidge);
      const lower = expectedDistanceMeters * (1 - tolerancePercent);
      const upper = expectedDistanceMeters * (1 + tolerancePercent);
      expect(distance).toBeGreaterThan(lower);
      expect(distance).toBeLessThan(upper);
    });

    it('returns a distance in metres (not kilometres), i.e. greater than 1000', () => {
      const distance = distanceMeters(torontoCityHall, graniteRidge);
      expect(distance).toBeGreaterThan(1000);
    });
  });

  describe('north/south symmetry', () => {
    it('returns the same distance when a and b are swapped', () => {
      const a = pos(43.6532, -79.3832);
      const b = { lat: 43.5257, lng: -79.8816 };
      const dAB = distanceMeters(a, b);
      const dBA = distanceMeters({ ...b, accuracy: 5 }, { lat: a.lat, lng: a.lng });
      expect(dAB).toBeCloseTo(dBA, 5);
    });

    it('is symmetric for two poles', () => {
      const northPole = pos(90, 0);
      const southPole = { lat: -90, lng: 0 };
      const d1 = distanceMeters(northPole, southPole);
      const d2 = distanceMeters({ lat: -90, lng: 0, accuracy: 5 }, { lat: 90, lng: 0 });
      expect(d1).toBeCloseTo(d2, 3);
    });

    it('is symmetric for two points on the equator', () => {
      const a = pos(0, 10);
      const b = { lat: 0, lng: -10 };
      const d1 = distanceMeters(a, b);
      const d2 = distanceMeters({ lat: 0, lng: -10, accuracy: 5 }, { lat: 0, lng: 10 });
      expect(d1).toBeCloseTo(d2, 3);
    });
  });

  describe('short distances (within a golf course)', () => {
    it('returns a small distance for two nearby GPS pins on the same hole', () => {
      // Two pins ~150m apart on Granite Ridge
      const tee = pos(43.5257, -79.8816);
      const pin = { lat: 43.527, lng: -79.8816 }; // ~145m north
      const distance = distanceMeters(tee, pin);
      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(300);
    });
  });
});
