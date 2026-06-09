-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Tournaments
create table tournaments (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  date date not null,
  format text not null default 'best_ball',
  venue text not null,
  status text not null default 'setup' check (status in ('setup', 'active', 'paused', 'completed')),
  created_at timestamptz not null default now()
);

-- Holes
create table holes (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  par int not null check (par between 3 and 6),
  handicap int not null default 0,
  pin_lat double precision not null,
  pin_lng double precision not null,
  unique (tournament_id, hole_number)
);

-- Teams
create table teams (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  team_number int not null,
  team_name text,
  starting_hole int not null check (starting_hole between 1 and 18),
  max_players int not null default 4 check (max_players between 2 and 6),
  captain_id uuid,
  unique (tournament_id, team_number)
);

-- Players
create table players (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique not null,
  name text not null,
  title text not null default '',
  company text not null default '',
  email text unique not null,
  phone text not null default '',
  year_of_birth int,
  gender text check (gender in ('male', 'female', 'prefer_not_to_say')),
  team_id uuid references teams(id) on delete set null,
  role text not null default 'player' check (role in ('player', 'admin', 'tournament_organizer')),
  created_at timestamptz not null default now()
);

-- Deferred FK: teams.captain_id → players (circular dependency resolved after both tables exist)
alter table teams add constraint fk_teams_captain foreign key (captain_id) references players(id) on delete set null;

-- Clubs
create table clubs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null check (category in ('wood', 'hybrid', 'iron', 'wedge', 'putter')),
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- Round State
create table round_states (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references teams(id) on delete cascade,
  current_hole int not null check (current_hole between 1 and 18),
  active_player_id uuid references players(id),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  updated_at timestamptz not null default now(),
  unique (team_id)
);

-- Shots
create table shots (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid not null references players(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  shot_number int not null,
  club_name text not null,
  start_lat double precision not null,
  start_lng double precision not null,
  outcome text not null check (outcome in ('in_play', 'out_of_bounds', 'mulligan', 'sunk')),
  created_at timestamptz not null default now()
);

-- Scores
create table scores (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid not null references players(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  strokes int not null,
  is_best_ball boolean not null default false,
  override_by uuid references players(id),
  override_at timestamptz,
  unique (player_id, tournament_id, hole_number)
);

-- Sponsors
create table sponsors (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  logo_url text not null,
  display_order int not null default 0,
  is_active boolean not null default true
);

-- Indexes
create index idx_shots_player_hole on shots(player_id, tournament_id, hole_number);
create index idx_scores_team on scores(team_id, tournament_id);
create index idx_players_team on players(team_id);
create index idx_holes_tournament on holes(tournament_id);

-- RLS Policies
alter table tournaments enable row level security;
alter table holes enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table clubs enable row level security;
alter table round_states enable row level security;
alter table shots enable row level security;
alter table scores enable row level security;
alter table sponsors enable row level security;

-- Everyone can read tournaments, holes, clubs, sponsors, scores, teams
create policy "Public read" on tournaments for select using (true);
create policy "Public read" on holes for select using (true);
create policy "Public read" on clubs for select using (true);
create policy "Public read" on sponsors for select using (true);
create policy "Public read" on scores for select using (true);
create policy "Public read" on teams for select using (true);

-- Players can read all players (for team display)
create policy "Public read" on players for select using (true);

-- Players can insert their own shots
create policy "Players insert own shots" on shots for insert
  with check (player_id in (
    select id from players where auth_user_id = auth.uid()
  ));

-- Players can also insert shots for teammates (single phone for foursome)
create policy "Players insert team shots" on shots for insert
  with check (player_id in (
    select p.id from players p
    join players me on me.auth_user_id = auth.uid()
    where p.team_id = me.team_id
  ));

-- Players can read shots for their team
create policy "Team read shots" on shots for select
  using (player_id in (
    select p.id from players p
    join players me on me.auth_user_id = auth.uid()
    where p.team_id = me.team_id
  ));

-- Round state: team members can read and update
create policy "Team read round_state" on round_states for select
  using (team_id in (
    select team_id from players where auth_user_id = auth.uid()
  ));
create policy "Team update round_state" on round_states for update
  using (team_id in (
    select team_id from players where auth_user_id = auth.uid()
  ));
create policy "Team insert round_state" on round_states for insert
  with check (team_id in (
    select team_id from players where auth_user_id = auth.uid()
  ));

-- Admin full access (all tables)
create policy "Admin full access" on tournaments for all
  using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'));
create policy "Admin full access" on holes for all
  using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'));
create policy "Admin full access" on teams for all
  using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'));
create policy "Admin full access" on players for all
  using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'));
create policy "Admin full access" on clubs for all
  using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'));
create policy "Admin full access" on round_states for all
  using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'));
create policy "Admin full access" on shots for all
  using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'));
create policy "Admin full access" on scores for all
  using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'));
create policy "Admin full access" on sponsors for all
  using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'));

-- Players can update their own profile
create policy "Players update own profile" on players for update
  using (auth_user_id = auth.uid());

-- Enable Realtime for scores (leaderboard)
alter publication supabase_realtime add table scores;
