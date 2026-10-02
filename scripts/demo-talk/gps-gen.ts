import type { DemoHole, DemoPlayer, DemoClub, ShotInsert } from './types';

function jitter(): number {
  return (Math.random() - 0.5) * 0.0004; // ±0.0002°, ~20m spread
}

function pickClub(shotNumber: number, totalShots: number, par: number, clubs: DemoClub[]): string {
  const byName = (name: string) => clubs.find((c) => c.name === name)?.name ?? clubs[0].name;
  if (shotNumber === totalShots) return byName('Putter');
  if (shotNumber === 1 && par >= 4) return byName('Driver');
  if (shotNumber === 1 && par === 3) return byName('9 Iron');
  return byName('7 Iron');
}

export function generateShots(
  tournamentId: string,
  hole: DemoHole,
  players: DemoPlayer[],
  scores: number[],
  clubs: DemoClub[]
): ShotInsert[] {
  const shots: ShotInsert[] = [];

  players.forEach((player, idx) => {
    const totalShots = scores[idx];
    for (let shotNum = 1; shotNum <= totalShots; shotNum++) {
      const isLast = shotNum === totalShots;
      const progress = totalShots === 1 ? 1 : (shotNum - 1) / (totalShots - 1);

      const lat =
        hole.teeLat +
        (hole.pinLat - hole.teeLat) * progress +
        (isLast ? (Math.random() - 0.5) * 0.0001 : jitter());
      const lng =
        hole.teeLng +
        (hole.pinLng - hole.teeLng) * progress +
        (isLast ? (Math.random() - 0.5) * 0.0001 : jitter());

      shots.push({
        player_id: player.id,
        tournament_id: tournamentId,
        hole_number: hole.holeNumber,
        shot_number: shotNum,
        club_name: pickClub(shotNum, totalShots, hole.par, clubs),
        start_lat: lat,
        start_lng: lng,
        outcome: isLast ? 'sunk' : 'in_play',
      });
    }
  });

  return shots;
}
