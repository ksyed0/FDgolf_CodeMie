/** Shared test fixtures for E2E tests */

export const fakeUser = {
  id: 'user-001',
  email: 'alice@example.com',
  role: 'authenticated',
}

export const fakeSession = {
  access_token: 'fake-access-token',
  refresh_token: 'fake-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: fakeUser,
}

export const fakeAdminUser = {
  id: 'admin-001',
  email: 'admin@fdgolf.com',
  role: 'authenticated',
}

export const fakeAdminSession = {
  access_token: 'fake-admin-token',
  refresh_token: 'fake-admin-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: fakeAdminUser,
}

export const fakePlayer = {
  id: 'player-001',
  auth_user_id: 'user-001',
  name: 'Alice Nguyen',
  email: 'alice@example.com',
  team_id: 'team-001',
  role: 'player',
}

export const fakeAdminPlayer = {
  id: 'admin-player-001',
  auth_user_id: 'admin-001',
  name: 'Tournament Admin',
  email: 'admin@fdgolf.com',
  team_id: null,
  role: 'admin',
}

export const fakeTeam = {
  id: 'team-001',
  tournament_id: 'tournament-001',
  team_number: 7,
  team_name: 'Eagles',
  starting_hole: 14,
  max_players: 4,
  captain_id: 'player-001',
}

export const fakePlayers = [
  fakePlayer,
  { id: 'player-002', name: 'Bob Chen', email: 'bob@example.com', team_id: 'team-001', role: 'player' },
  { id: 'player-003', name: 'Carol Davis', email: 'carol@example.com', team_id: 'team-001', role: 'player' },
  { id: 'player-004', name: 'Dave Wilson', email: 'dave@example.com', team_id: 'team-001', role: 'player' },
]

export const fakeTournament = {
  id: 'tournament-001',
  name: 'CIBC Capital Markets Golf Tournament 2026',
  slug: 'cibc-granite-ridge-2026',
  date: '2026-06-22',
  format: 'best_ball',
  venue: 'Granite Ridge Golf Club',
  status: 'active',
}

export const fakeRoundState = {
  id: 'round-001',
  team_id: 'team-001',
  current_hole: 14,
  active_player_id: 'player-001',
  status: 'in_progress',
}

export const fakeClubs = [
  { id: 'club-001', name: 'Driver', category: 'wood', sort_order: 1, is_active: true },
  { id: 'club-002', name: '3 Wood', category: 'wood', sort_order: 2, is_active: true },
  { id: 'club-003', name: '5 Iron', category: 'iron', sort_order: 10, is_active: true },
  { id: 'club-004', name: 'Pitching Wedge', category: 'wedge', sort_order: 15, is_active: true },
  { id: 'club-005', name: 'Putter', category: 'putter', sort_order: 21, is_active: true },
]

export const fakeHoles = Array.from({ length: 18 }, (_, i) => ({
  id: `hole-${i + 1}`,
  tournament_id: 'tournament-001',
  hole_number: i + 1,
  par: [4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4][i] ?? 4,
  handicap: i + 1,
  pin_lat: 43.5 + i * 0.001,
  pin_lng: -79.9 + i * 0.001,
}))

export const fakeLeaderboard = [
  { team_id: 'team-001', team_name: 'Eagles', total_score: -5, holes_completed: 12, rank: 1 },
  { team_id: 'team-002', team_name: 'Birdies', total_score: -3, holes_completed: 11, rank: 2 },
  { team_id: 'team-003', team_name: 'Pars', total_score: 0, holes_completed: 10, rank: 3 },
]
