export type TournamentStatus = 'setup' | 'active' | 'paused' | 'completed';
export type RoundStatus = 'not_started' | 'in_progress' | 'completed';
export type ShotOutcome = 'in_play' | 'out_of_bounds' | 'mulligan' | 'sunk';
export type PlayerRole = 'player' | 'admin' | 'tournament_organizer';
export type Gender = 'male' | 'female' | 'prefer_not_to_say';
export type ClubCategory = 'wood' | 'hybrid' | 'iron' | 'wedge' | 'putter';

export interface Tournament {
  id: string;
  name: string;
  slug: string;
  date: string;
  format: string;
  venue: string;
  status: TournamentStatus;
  created_at: string;
}

export interface Hole {
  id: string;
  tournament_id: string;
  hole_number: number;
  par: number;
  handicap: number;
  pin_lat: number;
  pin_lng: number;
}

export interface Player {
  id: string;
  auth_user_id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  year_of_birth: number | null;
  gender: Gender | null;
  team_id: string | null;
  role: PlayerRole;
  created_at: string;
}

export interface Team {
  id: string;
  tournament_id: string;
  team_number: number;
  team_name: string | null;
  starting_hole: number;
  max_players: number;
  captain_id: string | null;
}

export interface Club {
  id: string;
  name: string;
  category: ClubCategory;
  sort_order: number;
  is_active: boolean;
}

export interface RoundState {
  id: string;
  team_id: string;
  current_hole: number;
  active_player_id: string | null;
  status: RoundStatus;
  updated_at: string;
}

export interface Shot {
  id: string;
  player_id: string;
  tournament_id: string;
  hole_number: number;
  shot_number: number;
  club_name: string;
  start_lat: number;
  start_lng: number;
  outcome: ShotOutcome;
  created_at: string;
}

export interface Score {
  id: string;
  player_id: string;
  team_id: string;
  tournament_id: string;
  hole_number: number;
  strokes: number;
  is_best_ball: boolean;
  override_by: string | null;
  override_at: string | null;
}

export interface Sponsor {
  id: string;
  tournament_id: string;
  name: string;
  logo_url: string;
  display_order: number;
  is_active: boolean;
}

export interface PendingShot {
  id: string;
  payload: Omit<Shot, 'id' | 'created_at'>;
  synced: boolean;
  created_at: number;
}
