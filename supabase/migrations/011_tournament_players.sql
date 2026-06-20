-- Replace players.team_id (global FK) with a tournament-scoped join table so
-- a player can be on different teams across multiple tournaments.

-- ── 1. Create join table ─────────────────────────────────────────────────────

create table tournament_players (
  id            uuid primary key default uuid_generate_v4(),
  player_id     uuid not null references players(id)     on delete cascade,
  team_id       uuid not null references teams(id)       on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (player_id, tournament_id)
);

create index idx_tournament_players_player on tournament_players(player_id, tournament_id);
create index idx_tournament_players_team   on tournament_players(team_id,   tournament_id);

-- ── 2. Migrate existing assignments ─────────────────────────────────────────

insert into tournament_players (player_id, team_id, tournament_id)
select p.id, p.team_id, t.tournament_id
from   players p
join   teams   t on t.id = p.team_id
where  p.team_id is not null
on conflict (player_id, tournament_id) do nothing;

-- ── 3. RLS on new table ──────────────────────────────────────────────────────

alter table tournament_players enable row level security;

create policy "Public read"       on tournament_players for select using (true);
create policy "Admin full access" on tournament_players for all
  using (exists (
    select 1 from players where auth_user_id = auth.uid() and role = 'admin'
  ));

-- ── 4. Drop old RLS policies that referenced players.team_id ─────────────────
-- (from migrations 001 and 005)

drop policy if exists "Players insert team shots"  on shots;
drop policy if exists "Team read shots"             on shots;
drop policy if exists "Players insert team score"   on scores;
drop policy if exists "Players update team score"   on scores;
drop policy if exists "Team read round_state"       on round_states;
drop policy if exists "Team update round_state"     on round_states;
drop policy if exists "Team insert round_state"     on round_states;

-- ── 5. Re-create RLS using tournament_players ─────────────────────────────────

-- Shots: a player may insert shots for any teammate (same team+tournament)
create policy "Players insert team shots" on shots for insert
  with check (
    player_id in (
      select tp.player_id
      from   tournament_players tp
      join   tournament_players me on  me.team_id      = tp.team_id
                                   and me.tournament_id = tp.tournament_id
      join   players p             on  p.auth_user_id  = auth.uid()
                                   and p.id            = me.player_id
    )
  );

create policy "Team read shots" on shots for select
  using (
    player_id in (
      select tp.player_id
      from   tournament_players tp
      join   tournament_players me on  me.team_id      = tp.team_id
                                   and me.tournament_id = tp.tournament_id
      join   players p             on  p.auth_user_id  = auth.uid()
                                   and p.id            = me.player_id
    )
  );

-- Scores: teammates may insert/update each other's scores
create policy "Players insert team score" on scores for insert
  with check (
    player_id in (
      select tp.player_id
      from   tournament_players tp
      join   tournament_players me on  me.team_id      = tp.team_id
                                   and me.tournament_id = tp.tournament_id
      join   players p             on  p.auth_user_id  = auth.uid()
                                   and p.id            = me.player_id
    )
  );

create policy "Players update team score" on scores for update
  using (
    player_id in (
      select tp.player_id
      from   tournament_players tp
      join   tournament_players me on  me.team_id      = tp.team_id
                                   and me.tournament_id = tp.tournament_id
      join   players p             on  p.auth_user_id  = auth.uid()
                                   and p.id            = me.player_id
    )
  );

-- Round states: any team member may read/write their team's round state
create policy "Team read round_state" on round_states for select
  using (team_id in (
    select tp.team_id from tournament_players tp
    join   players p on p.auth_user_id = auth.uid() and p.id = tp.player_id
  ));

create policy "Team update round_state" on round_states for update
  using (team_id in (
    select tp.team_id from tournament_players tp
    join   players p on p.auth_user_id = auth.uid() and p.id = tp.player_id
  ));

create policy "Team insert round_state" on round_states for insert
  with check (team_id in (
    select tp.team_id from tournament_players tp
    join   players p on p.auth_user_id = auth.uid() and p.id = tp.player_id
  ));

-- ── 6. Drop players.team_id ───────────────────────────────────────────────────

drop index if exists idx_players_team;
alter table players drop column team_id;
