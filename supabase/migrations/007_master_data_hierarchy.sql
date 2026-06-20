-- supabase/migrations/007_master_data_hierarchy.sql

-- 1. Venues
create table venues (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address1 text not null default '',
  address2 text,
  city text not null default '',
  province_state text not null default '',
  postal_code text not null default '',
  country text not null default 'CA',
  created_at timestamptz not null default now()
);

-- 2. Courses
create table courses (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues(id) on delete cascade,
  name text not null,
  hole_count int not null check (hole_count in (9, 18)),
  par_total int not null,
  course_rating numeric(4,1),
  slope_rating int,
  created_at timestamptz not null default now()
);

-- 3. Add course_id to holes (nullable first; seed.sql backfills after all migrations run)
alter table holes add column course_id uuid references courses(id) on delete cascade;

-- 4. Make course_id NOT NULL, drop tournament_id, update unique constraint
-- (course_id is populated by seed.sql; on a fresh db reset no rows exist here)
alter table holes alter column course_id set not null;
alter table holes drop column tournament_id;
alter table holes drop constraint if exists holes_tournament_id_hole_number_key;
alter table holes add constraint holes_course_id_hole_number_key unique (course_id, hole_number);

-- 7. Tee boxes
create table tee_boxes (
  id uuid primary key default uuid_generate_v4(),
  hole_id uuid not null references holes(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  distance_yards int not null,
  unique (hole_id, name)
);

-- 8. Add new columns to tournaments; seed.sql inserts the tournament with these values set directly
alter table tournaments add column venue_id uuid references venues(id);
alter table tournaments add column course_id uuid references courses(id);
alter table tournaments add column start_time time;
alter table tournaments add column holes_played int not null default 18 check (holes_played in (9, 18));
alter table tournaments add column nine_hole_selection text check (nine_hole_selection in ('front', 'back'));
alter table tournaments add constraint tournaments_nine_hole_check
  check (
    (holes_played = 18 and nine_hole_selection is null)
    or (holes_played = 9 and nine_hole_selection in ('front', 'back'))
  );

-- 9. Make venue_id/course_id NOT NULL (no rows exist at migration time — seed.sql inserts with both set)
alter table tournaments alter column venue_id set not null;
alter table tournaments alter column course_id set not null;
alter table tournaments drop column if exists venue;
alter table tournaments drop column if exists course;

-- 11. RLS for new tables
alter table venues enable row level security;
alter table courses enable row level security;
alter table tee_boxes enable row level security;

create policy "Public read" on venues for select using (true);
create policy "Public read" on courses for select using (true);
create policy "Public read" on tee_boxes for select using (true);

create policy "Admin full access" on venues for all
  using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'));
create policy "Admin full access" on courses for all
  using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'));
create policy "Admin full access" on tee_boxes for all
  using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'));
