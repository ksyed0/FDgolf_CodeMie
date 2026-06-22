export interface DemoHole {
  id: string;
  holeNumber: number;
  par: number;
  pinLat: number;
  pinLng: number;
  teeLat: number;
  teeLng: number;
}

export interface DemoPlayer {
  id: string;
  name: string;
}

export interface DemoTeam {
  id: string;
  name: string;
  startingHole: number;
  players: DemoPlayer[];
}

export interface DemoClub {
  id: string;
  name: string;
  category: string;
}

export interface DemoConfig {
  tournamentId: string;
  holes: DemoHole[];
  teams: DemoTeam[];
  clubs: DemoClub[];
}

export interface ShotInsert {
  player_id: string;
  tournament_id: string;
  hole_number: number;
  shot_number: number;
  club_name: string;
  start_lat: number;
  start_lng: number;
  outcome: 'in_play' | 'sunk';
}
