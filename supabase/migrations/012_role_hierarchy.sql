-- supabase/migrations/012_role_hierarchy.sql
-- Adds system_admin and tournament_admin roles; creates tournament_admin_assignments table;
-- rewrites RLS to scope system_admin (platform-wide) vs tournament_admin (per-tournament).

-- 1. Widen the players role check constraint
alter table players drop constraint players_role_check;
alter table players add constraint players_role_check
  check (role in ('player', 'system_admin', 'tournament_admin', 'tournament_organizer'));

-- 2. Rename existing 'admin' rows → 'system_admin'
update players set role = 'system_admin' where role = 'admin';

-- 3. tournament_admin_assignments: scopes a tournament_admin to a specific tournament
create table tournament_admin_assignments (
  id            uuid primary key default uuid_generate_v4(),
  player_id     uuid not null references players(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (player_id, tournament_id)
);

create index idx_taa_player     on tournament_admin_assignments(player_id);
create index idx_taa_tournament on tournament_admin_assignments(tournament_id);

alter table tournament_admin_assignments enable row level security;
create policy "Public read"         on tournament_admin_assignments for select using (true);
create policy "System admin manage" on tournament_admin_assignments for all
  using  (exists (select 1 from players where auth_user_id = auth.uid() and role = 'system_admin'))
  with check (exists (select 1 from players where auth_user_id = auth.uid() and role = 'system_admin'));

-- 4. Security-definer helpers (bypass RLS to avoid recursion on the players table)
create or replace function is_system_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from players where auth_user_id = auth.uid() and role = 'system_admin');
$$;

create or replace function is_tournament_admin(p_tournament_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from tournament_admin_assignments taa
    join players p on p.id = taa.player_id
    where p.auth_user_id = auth.uid()
      and taa.tournament_id = p_tournament_id
  );
$$;

-- 5. Venues — system_admin only (platform resource)
drop policy if exists "Admin full access" on venues;
create policy "System admin full access" on venues for all
  using (is_system_admin()) with check (is_system_admin());

-- 6. Courses — system_admin only (platform resource)
drop policy if exists "Admin full access" on courses;
create policy "System admin full access" on courses for all
  using (is_system_admin()) with check (is_system_admin());

-- 7. Holes — system_admin only (platform resource)
drop policy if exists "Admin full access" on holes;
create policy "System admin full access" on holes for all
  using (is_system_admin()) with check (is_system_admin());

-- 8. Tee boxes — system_admin only
drop policy if exists "Admin full access" on tee_boxes;
create policy "System admin full access" on tee_boxes for all
  using (is_system_admin()) with check (is_system_admin());

-- 9. Clubs — system_admin only
drop policy if exists "Admin full access" on clubs;
create policy "System admin full access" on clubs for all
  using (is_system_admin()) with check (is_system_admin());

-- 10. Tournaments — system_admin full access; tournament_admin can update their own
drop policy if exists "Admin full access" on tournaments;
create policy "System admin full access" on tournaments for all
  using (is_system_admin()) with check (is_system_admin());
create policy "Tournament admin update own" on tournaments for update
  using (is_tournament_admin(id)) with check (is_tournament_admin(id));

-- 11. Teams — system_admin or tournament_admin for that tournament
drop policy if exists "Admin full access" on teams;
create policy "Admin manage teams" on teams for all
  using  (is_system_admin() or is_tournament_admin(tournament_id))
  with check (is_system_admin() or is_tournament_admin(tournament_id));

-- 12. Scores — system_admin or tournament_admin
drop policy if exists "Admin full access" on scores;
create policy "Admin manage scores" on scores for all
  using  (is_system_admin() or is_tournament_admin(tournament_id))
  with check (is_system_admin() or is_tournament_admin(tournament_id));

-- 13. tournament_players — system_admin or tournament_admin
drop policy if exists "Admin full access" on tournament_players;
create policy "Admin manage tournament_players" on tournament_players for all
  using  (is_system_admin() or is_tournament_admin(tournament_id))
  with check (is_system_admin() or is_tournament_admin(tournament_id));

-- 14. Sponsors — system_admin or tournament_admin
drop policy if exists "Admin full access" on sponsors;
create policy "Admin manage sponsors" on sponsors for all
  using  (is_system_admin() or is_tournament_admin(tournament_id))
  with check (is_system_admin() or is_tournament_admin(tournament_id));

-- 15. Players — system_admin full; tournament_admin can update players in their tournaments
drop policy if exists "Admin full access" on players;
create policy "System admin full access" on players for all
  using (is_system_admin()) with check (is_system_admin());
create policy "Tournament admin manage players" on players for update
  using (
    exists (
      select 1 from tournament_players tp
      join tournament_admin_assignments taa on taa.tournament_id = tp.tournament_id
      join players me on me.auth_user_id = auth.uid() and me.id = taa.player_id
      where tp.player_id = players.id
    )
  );

-- 16. Round states — system_admin
drop policy if exists "Admin full access" on round_states;
create policy "System admin full access" on round_states for all
  using (is_system_admin()) with check (is_system_admin());

-- 17. Shots — system_admin
drop policy if exists "Admin full access" on shots;
create policy "System admin full access" on shots for all
  using (is_system_admin()) with check (is_system_admin());
