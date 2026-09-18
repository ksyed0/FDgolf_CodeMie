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
  team_name: 'Hawks',
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

// Migration 011 (tournament_players) replaced the players.team_id direct FK with a join table.
// Tests that load /round, /leaderboard, or /dashboard now query tournament_players to find
// team membership; without this mock the page redirects with "not assigned to a team".
export const fakeTournamentMembership = [
  { player_id: 'player-001', team_id: 'team-001', tournament_id: 'tournament-001' },
  { player_id: 'player-002', team_id: 'team-001', tournament_id: 'tournament-001' },
  { player_id: 'player-003', team_id: 'team-001', tournament_id: 'tournament-001' },
  { player_id: 'player-004', team_id: 'team-001', tournament_id: 'tournament-001' },
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

export const fakeSponsors = [
  { id: 'sponsor-001', name: 'CIBC Capital Markets', logo_url: null, display_order: 1, is_active: true, tournament_id: 'tournament-001' },
  { id: 'sponsor-002', name: 'Deloitte', logo_url: null, display_order: 2, is_active: false, tournament_id: 'tournament-001' },
]

// Team names intentionally avoid scoring-term collisions (Eagles, Birdies, Pars,
// Bogeys) — the TV stat-rotator has panels with those exact labels, and a fixture
// team named "Eagles" makes `getByText('Eagles')` ambiguous (matches the stat
// panel header AND the leaderboard row), causing TC-0067-style failures.
// par_total mirrors LeaderboardRow (src/lib/types.ts) — required for vs-par math in
// TvLeaderboard.tsx (formatScore(total_score - par_total)). Omitting it produces
// `total_score - undefined` = NaN, which renders as "+NaN" in the Sc column; that
// extra-wide text overflows the column's fixed 46px grid track and squeezes the
// adjacent `1fr` Team column down to ~4px, making the team-name span effectively
// zero-width and reported as hidden by Playwright (a second, fixture-driven cause
// behind BUG-0008, distinct from the rotator-panel timing/scoping issue).
// total_score is cumulative strokes taken (not vs-par); par_total is cumulative
// par for the holes_completed so far (~4 strokes/hole) — vsParVal stays small
// (single/double digit with sign), matching realistic in-round leaderboard text.
export const fakeLeaderboard = [
  { team_id: 'team-001', team_name: 'Hawks', total_score: 43, par_total: 48, holes_completed: 12, rank: 1 },
  { team_id: 'team-002', team_name: 'Falcons', total_score: 41, par_total: 44, holes_completed: 11, rank: 2 },
  { team_id: 'team-003', team_name: 'Owls', total_score: 40, par_total: 40, holes_completed: 10, rank: 3 },
]
