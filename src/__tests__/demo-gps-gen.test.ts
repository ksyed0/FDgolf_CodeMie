import { generateShots } from '../../scripts/demo/gps-gen';
import type { DemoHole, DemoPlayer, DemoClub } from '../../scripts/demo/types';

const hole: DemoHole = {
  id: 'hole-1',
  holeNumber: 1,
  par: 4,
  pinLat: 43.651,
  pinLng: -79.842,
  teeLat: 43.6498,
  teeLng: -79.8432,
};

const players: DemoPlayer[] = [
  { id: 'p1', name: 'Alice Smith' },
  { id: 'p2', name: 'Bob Jones' },
];

const clubs: DemoClub[] = [
  { id: 'c1', name: 'Driver', category: 'wood' },
  { id: 'c2', name: '7 Iron', category: 'iron' },
  { id: 'c3', name: 'Putter', category: 'putter' },
];

describe('generateShots', () => {
  it('produces one ShotInsert per stroke per player', () => {
    const shots = generateShots('tid', hole, players, [5, 4], clubs);
    expect(shots.filter((s) => s.player_id === 'p1').length).toBe(5);
    expect(shots.filter((s) => s.player_id === 'p2').length).toBe(4);
  });

  it('last shot for each player has outcome sunk', () => {
    const shots = generateShots('tid', hole, players, [5, 4], clubs);
    const p1shots = shots
      .filter((s) => s.player_id === 'p1')
      .sort((a, b) => a.shot_number - b.shot_number);
    const p2shots = shots
      .filter((s) => s.player_id === 'p2')
      .sort((a, b) => a.shot_number - b.shot_number);
    expect(p1shots.at(-1)?.outcome).toBe('sunk');
    expect(p2shots.at(-1)?.outcome).toBe('sunk');
  });

  it('non-last shots have outcome in_play', () => {
    const shots = generateShots('tid', hole, players, [5, 4], clubs);
    const p1shots = shots
      .filter((s) => s.player_id === 'p1')
      .sort((a, b) => a.shot_number - b.shot_number);
    for (const s of p1shots.slice(0, -1)) {
      expect(s.outcome).toBe('in_play');
    }
  });

  it('all shots have valid lat/lng within ~1 degree of pin', () => {
    const shots = generateShots('tid', hole, players, [5, 4], clubs);
    for (const s of shots) {
      expect(Math.abs(s.start_lat - hole.pinLat)).toBeLessThan(1);
      expect(Math.abs(s.start_lng - hole.pinLng)).toBeLessThan(1);
    }
  });

  it('hole-in-one (score=1) produces single sunk shot near pin', () => {
    const shots = generateShots('tid', hole, [players[0]], [1], clubs);
    expect(shots.length).toBe(1);
    expect(shots[0].outcome).toBe('sunk');
    expect(Math.abs(shots[0].start_lat - hole.pinLat)).toBeLessThan(0.001);
  });
});
