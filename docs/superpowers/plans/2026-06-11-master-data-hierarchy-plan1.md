# Master Data Hierarchy — Plan 1: Schema Migration & Code Update

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-tournament hole storage with a Venue → Course → Hole master data hierarchy so that course data is defined once and reused across tournaments, and update every page that queries holes to use the new schema.

**Architecture:** Two new Supabase migrations create `venues`, `courses`, `tee_boxes`, restructure `holes` (course_id replaces tournament_id), and modify `tournaments` (venue_id + course_id FKs, drop text fields). TypeScript types follow. Seven existing pages/components are updated to query holes via `course_id`. The tournament manager form switches from text venue/course inputs to populated dropdowns. Plan 2 (separate) adds the new admin CRUD pages for venues/courses.

**Tech Stack:** PostgreSQL / Supabase, Next.js 14 App Router, TypeScript, `@supabase/ssr`.

**Spec:** `docs/superpowers/specs/2026-06-11-master-data-hierarchy-design.md`

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Create | `supabase/migrations/007_master_data_hierarchy.sql` | New tables, restructure holes, modify tournaments, RLS |
| Create | `supabase/migrations/008_leaderboard_rpc_v2.sql` | Updated `get_leaderboard()` joining holes via course_id |
| Modify | `src/lib/types.ts` | Add `Venue`, `Course`, `TeeBox`; update `Hole`, `Tournament` |
| Modify | `src/app/(player)/round/page.tsx` | Tournament fetch gets `course_id`; holes query uses it |
| Modify | `src/app/(player)/scorecard/page.tsx` | Holes query uses `course_id` via tournament join |
| Modify | `src/app/(player)/dashboard/page.tsx` | Tournament fetch joins venues; display venue name |
| Modify | `src/app/live/[slug]/page.tsx` | Tournament fetch joins venues; display venue name |
| Modify | `src/app/(admin)/admin/holes/page.tsx` | Holes query uses `course_id` via tournament join |
| Modify | `src/app/(admin)/admin/tournament/page.tsx` | Also fetch venues + courses for form dropdowns |
| Modify | `src/app/(admin)/admin/tournament/tournament-manager.tsx` | Replace text venue/course with dropdowns; add new fields; remove hole import |

---

## Task 1: Write migration 007 — master data hierarchy

**Files:**
- Create: `supabase/migrations/007_master_data_hierarchy.sql`

- [ ] **Step 1: Create the migration file**

```sql
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

-- 3. Add course_id to holes (nullable first so we can backfill)
alter table holes add column course_id uuid references courses(id) on delete cascade;

-- 4. Seed venue and course for existing CIBC tournament
insert into venues (id, name, address1, city, province_state, postal_code, country) values
  ('10000000-0000-0000-0000-000000000001',
   'Granite Ridge Golf Club',
   '7441 Bell School Line',
   'Milton', 'ON', 'L9T 2X5', 'CA');

insert into courses (id, venue_id, name, hole_count, par_total) values
  ('20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   'Main Course', 18, 72);

-- 5. Backfill course_id on existing holes
update holes
set course_id = '20000000-0000-0000-0000-000000000001'
where tournament_id = '00000000-0000-0000-0000-000000000001';

-- 6. Make course_id NOT NULL, drop tournament_id, update unique constraint
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

-- 8. Add new columns to tournaments (nullable first for backfill)
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

-- 9. Backfill tournament FKs
update tournaments
set venue_id = '10000000-0000-0000-0000-000000000001',
    course_id = '20000000-0000-0000-0000-000000000001'
where id = '00000000-0000-0000-0000-000000000001';

-- 10. Make venue_id and course_id NOT NULL after backfill, drop old text columns
alter table tournaments alter column venue_id set not null;
alter table tournaments alter column course_id set not null;
alter table tournaments drop column venue;
alter table tournaments drop column course;

-- 11. RLS for new tables
alter table venues enable row level security;
alter table courses enable row level security;
alter table tee_boxes enable row level security;

create policy "Public read" on venues for select using (true);
create policy "Public read" on courses for select using (true);
create policy "Public read" on tee_boxes for select using (true);

create policy "Admin full access" on venues for all
  using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'));
create policy "Admin full access" on courses for all
  using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'));
create policy "Admin full access" on tee_boxes for all
  using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'));
```

- [ ] **Step 2: Verify the file exists**

```bash
ls -la supabase/migrations/007_master_data_hierarchy.sql
```
Expected: file shown with non-zero size.

---

## Task 2: Write migration 008 — leaderboard RPC update

**Files:**
- Create: `supabase/migrations/008_leaderboard_rpc_v2.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/008_leaderboard_rpc_v2.sql
-- Update get_leaderboard() to join holes via course_id (was tournament_id)

create or replace function get_leaderboard(p_tournament_id uuid)
returns table (
  team_id uuid,
  team_number int,
  team_name text,
  total_score bigint,
  holes_completed bigint,
  par_total bigint
) language sql stable as $$
  select
    t.id as team_id,
    t.team_number,
    t.team_name,
    coalesce(sum(s.strokes), 0) as total_score,
    count(distinct s.hole_number) as holes_completed,
    coalesce(sum(h.par), 0) as par_total
  from teams t
  left join scores s on s.team_id = t.id
    and s.tournament_id = p_tournament_id
    and s.is_best_ball = true
  left join tournaments trn on trn.id = p_tournament_id
  left join holes h on h.course_id = trn.course_id
    and h.hole_number = s.hole_number
  where t.tournament_id = p_tournament_id
  group by t.id, t.team_number, t.team_name
  order by (coalesce(sum(s.strokes), 0) - coalesce(sum(h.par), 0)) asc;
$$;
```

- [ ] **Step 2: Verify the file exists**

```bash
ls -la supabase/migrations/008_leaderboard_rpc_v2.sql
```

---

## Task 3: Apply both migrations to the local Supabase database

**Files:** none (DB-only changes)

The local Supabase DB runs on port 54342 with the default postgres password. Run migrations directly via psql since `supabase db push` runs all pending migrations at once.

- [ ] **Step 1: Apply migration 007**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54342/postgres \
  -f supabase/migrations/007_master_data_hierarchy.sql
```

Expected: series of `ALTER TABLE`, `CREATE TABLE`, `INSERT 0 1`, `UPDATE N` lines with no `ERROR:` lines.

- [ ] **Step 2: Apply migration 008**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54342/postgres \
  -f supabase/migrations/008_leaderboard_rpc_v2.sql
```

Expected: `CREATE FUNCTION` with no errors.

- [ ] **Step 3: Verify the schema**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54342/postgres -c "
  select table_name from information_schema.tables
  where table_schema = 'public'
  order by table_name;
"
```

Expected output includes: `courses`, `holes`, `players`, `round_states`, `scores`, `shots`, `sponsors`, `teams`, `tee_boxes`, `tournaments`, `venues`.

- [ ] **Step 4: Verify holes now have course_id (not tournament_id)**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54342/postgres -c "
  select column_name from information_schema.columns
  where table_name = 'holes' order by ordinal_position;
"
```

Expected: `id`, `course_id`, `hole_number`, `par`, `handicap`, `pin_lat`, `pin_lng`. `tournament_id` must NOT appear.

- [ ] **Step 5: Verify tournament has venue_id and course_id (no text venue/course)**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54342/postgres -c "
  select column_name from information_schema.columns
  where table_name = 'tournaments' order by ordinal_position;
"
```

Expected: includes `venue_id`, `course_id`, `holes_played`, `nine_hole_selection`, `start_time`. Must NOT include `venue` or `course`.

---

## Task 4: Update TypeScript types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Replace the file contents**

Full replacement of `src/lib/types.ts`:

```ts
export type TournamentStatus = 'setup' | 'active' | 'paused' | 'completed';
export type RoundStatus = 'not_started' | 'in_progress' | 'completed';
export type ShotOutcome = 'in_play' | 'out_of_bounds' | 'mulligan' | 'sunk';
export type PlayerRole = 'player' | 'admin' | 'tournament_organizer';
export type Gender = 'male' | 'female' | 'prefer_not_to_say';
export type ClubCategory = 'wood' | 'hybrid' | 'iron' | 'wedge' | 'putter';

export interface Venue {
  id: string;
  name: string;
  address1: string;
  address2: string | null;
  city: string;
  province_state: string;
  postal_code: string;
  country: string;
  created_at: string;
}

export interface Course {
  id: string;
  venue_id: string;
  name: string;
  hole_count: 9 | 18;
  par_total: number;
  course_rating: number | null;
  slope_rating: number | null;
  created_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  slug: string;
  venue_id: string;
  course_id: string;
  date: string;
  start_time: string | null;
  format: string;
  holes_played: 9 | 18;
  nine_hole_selection: 'front' | 'back' | null;
  status: TournamentStatus;
  created_at: string;
}

export interface Hole {
  id: string;
  course_id: string;
  hole_number: number;
  par: number;
  handicap: number;
  pin_lat: number;
  pin_lng: number;
}

export interface TeeBox {
  id: string;
  hole_id: string;
  name: string;
  lat: number;
  lng: number;
  distance_yards: number;
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
```

- [ ] **Step 2: Run type-check — expect errors in pages that use old fields (we'll fix them next)**

```bash
npm run type-check 2>&1 | grep "error TS" | head -30
```

Expected: errors mentioning `venue`, `course`, `tournament_id` on `Hole`. These are the exact files to fix in Tasks 5–10.

---

## Task 5: Update round/page.tsx — holes query

**Files:**
- Modify: `src/app/(player)/round/page.tsx`

The round page fetches `{ id, status }` from tournaments and then queries holes by `tournament_id`. After the migration, it needs `course_id` from the tournament and queries holes by `course_id`.

- [ ] **Step 1: Update the tournament select to include course_id**

Find this block (around line 86–91):
```ts
        supabase
          .from('tournaments')
          .select('id, status')
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
```

Replace with:
```ts
        supabase
          .from('tournaments')
          .select('id, status, course_id, holes_played, nine_hole_selection')
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
```

- [ ] **Step 2: Update the tournament state type**

Find (around line 39):
```ts
  const [tournament, setTournament] = useState<{ id: string; status: string } | null>(null);
```

Replace with:
```ts
  const [tournament, setTournament] = useState<{
    id: string;
    status: string;
    course_id: string;
    holes_played: 9 | 18;
    nine_hole_selection: 'front' | 'back' | null;
  } | null>(null);
```

- [ ] **Step 3: Update the holes query**

Find (around line 108–113):
```ts
      const { data: holeData } = await supabase
        .from('holes')
        .select('*')
        .eq('tournament_id', tournamentData.id)
        .order('hole_number');
      setHoles((holeData as Hole[]) ?? []);
```

Replace with:
```ts
      const { data: holeData } = await supabase
        .from('holes')
        .select('*')
        .eq('course_id', tournamentData.course_id)
        .order('hole_number');
      setHoles((holeData as Hole[]) ?? []);
```

- [ ] **Step 4: Run type-check on this file**

```bash
npx tsc --noEmit 2>&1 | grep "round/page"
```

Expected: no errors for `round/page.tsx`.

---

## Task 6: Update scorecard/page.tsx — holes query

**Files:**
- Modify: `src/app/(player)/scorecard/page.tsx`

- [ ] **Step 1: Update the tournament fetch to include course_id**

Find (around line 24–30):
```ts
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single<{ id: string }>();
```

Replace with:
```ts
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, course_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single<{ id: string; course_id: string }>();
```

- [ ] **Step 2: Update the holes query**

Find (around line 39–40):
```ts
    supabase.from('holes').select('*').eq('tournament_id', tournament.id).order('hole_number'),
```

Replace with:
```ts
    supabase.from('holes').select('*').eq('course_id', tournament.course_id).order('hole_number'),
```

- [ ] **Step 3: Run type-check on this file**

```bash
npx tsc --noEmit 2>&1 | grep "scorecard/page"
```

Expected: no errors.

---

## Task 7: Update dashboard/page.tsx — venue display

**Files:**
- Modify: `src/app/(player)/dashboard/page.tsx`

The dashboard currently displays `{tournament.venue}` (a text string). After the migration the tournament has `venue_id`. We fetch the venue name via a Supabase join.

- [ ] **Step 1: Update the tournament select to join venues**

Find the tournament query (look for `.from('tournaments').select(`):
```ts
      .from('tournaments')
      .select('*')
```

Replace with:
```ts
      .from('tournaments')
      .select('*, venue:venues!venue_id(name, city, province_state)')
```

- [ ] **Step 2: Update the display of venue**

Find (around line 98):
```tsx
          <p className="mt-1 text-sm text-gray-500">{tournament.venue}</p>
```

Replace with:
```tsx
          <p className="mt-1 text-sm text-gray-500">
            {(tournament as Tournament & { venue: { name: string; city: string; province_state: string } }).venue?.name}
            {' · '}
            {(tournament as Tournament & { venue: { name: string; city: string; province_state: string } }).venue?.city}
          </p>
```

Note: the cast is needed because `Tournament` doesn't include the embedded relation in its base type. If this feels repetitive, extract a local type at the top of the function:
```ts
type TournamentWithVenue = Tournament & {
  venue: { name: string; city: string; province_state: string } | null;
};
```
Then cast the fetched tournament to `TournamentWithVenue` and use `tournament.venue?.name`.

- [ ] **Step 3: Run type-check on this file**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard/page"
```

Expected: no errors.

---

## Task 8: Update live/[slug]/page.tsx — venue display

**Files:**
- Modify: `src/app/live/[slug]/page.tsx`

- [ ] **Step 1: Update the tournament select to join venues**

Find:
```ts
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', params.slug)
    .single();
```

Replace with:
```ts
  type TournamentWithVenue = Tournament & {
    venue: { name: string; city: string; province_state: string } | null;
  };

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*, venue:venues!venue_id(name, city, province_state)')
    .eq('slug', params.slug)
    .single<TournamentWithVenue>();
```

- [ ] **Step 2: Update the venue display line**

Find (around line 45):
```tsx
          <p className="text-sm text-gray-500">{tournament.venue} · Live Leaderboard</p>
```

Replace with:
```tsx
          <p className="text-sm text-gray-500">
            {tournament.venue?.name}{tournament.venue?.city ? ` · ${tournament.venue.city}` : ''} · Live Leaderboard
          </p>
```

- [ ] **Step 3: Add the Tournament import if not present**

Ensure the file imports `Tournament` from `@/lib/types`:
```ts
import type { Tournament } from '@/lib/types';
```

- [ ] **Step 4: Run type-check on this file**

```bash
npx tsc --noEmit 2>&1 | grep "live/"
```

Expected: no errors.

---

## Task 9: Update admin/holes/page.tsx — holes query

**Files:**
- Modify: `src/app/(admin)/admin/holes/page.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { createClient } from '@/lib/supabase/server';
import { HolesEditor } from './holes-editor';
import type { Hole } from '@/lib/types';

export default async function HolesAdminPage() {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, course_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single<{ id: string; course_id: string }>();

  const { data: holes } = await supabase
    .from('holes')
    .select('*')
    .eq('course_id', tournament?.course_id ?? '')
    .order('hole_number');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Holes</h1>
      <div className="rounded-xl border bg-white shadow-sm">
        <HolesEditor holes={(holes as Hole[]) ?? []} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type-check on this file**

```bash
npx tsc --noEmit 2>&1 | grep "admin/holes/page"
```

Expected: no errors.

---

## Task 10: Update tournament/page.tsx — fetch venues and courses for dropdowns

**Files:**
- Modify: `src/app/(admin)/admin/tournament/page.tsx`

The tournament manager form needs venue and course dropdowns populated from the DB.

- [ ] **Step 1: Replace the file contents**

```tsx
import { createClient } from '@/lib/supabase/server';
import type { Tournament, Venue, Course } from '@/lib/types';
import { TournamentManager } from './tournament-manager';

export type TournamentRow = Tournament & { venue_name: string; course_name: string };

export default async function TournamentAdminPage() {
  const supabase = await createClient();

  const [{ data: rawTournaments }, { data: venues }, { data: courses }] = await Promise.all([
    supabase
      .from('tournaments')
      .select('*, venue:venues!venue_id(name), course:courses!course_id(name)')
      .order('created_at', { ascending: false }),
    supabase.from('venues').select('*').order('name'),
    supabase.from('courses').select('*').order('name'),
  ]);

  const rows: TournamentRow[] = ((rawTournaments as (Tournament & {
    venue: { name: string } | null;
    course: { name: string } | null;
  })[]) ?? []).map((t) => ({
    ...t,
    venue_name: t.venue?.name ?? '',
    course_name: t.course?.name ?? '',
  }));

  return (
    <div className="max-w-4xl">
      <TournamentManager
        tournaments={rows}
        venues={(venues as Venue[]) ?? []}
        courses={(courses as Course[]) ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run type-check — expect errors in tournament-manager.tsx (fixed in Task 11)**

```bash
npx tsc --noEmit 2>&1 | grep "tournament/page\|tournament-manager"
```

---

## Task 11: Update tournament-manager.tsx — dropdowns, new fields, remove hole import

**Files:**
- Modify: `src/app/(admin)/admin/tournament/tournament-manager.tsx`

This is the largest change. The component receives `venues` and `courses` as new props, shows cascading dropdowns (course filters to selected venue), adds `start_time`/`holes_played`/`nine_hole_selection` fields, and removes the hole-import panel.

- [ ] **Step 1: Update imports and prop types at the top of the file**

Replace the existing `TournamentRow` interface and component signature:

```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Tournament, TournamentStatus, Venue, Course } from '@/lib/types';

export type TournamentRow = Tournament & { venue_name: string; course_name: string };

interface TournamentManagerProps {
  tournaments: TournamentRow[];
  venues: Venue[];
  courses: Course[];
}
```

- [ ] **Step 2: Update EMPTY_FORM and form state shape**

Replace the `EMPTY_FORM` constant and `FormState` type:

```tsx
interface FormState {
  name: string;
  slug: string;
  venueId: string;
  courseId: string;
  date: string;
  startTime: string;
  format: string;
  holesPlayed: string; // '9' | '18'
  nineHoleSelection: string; // 'front' | 'back' | ''
  status: TournamentStatus;
}

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  venueId: '',
  courseId: '',
  date: '',
  startTime: '',
  format: 'best_ball',
  holesPlayed: '18',
  nineHoleSelection: '',
  status: 'setup',
};
```

- [ ] **Step 3: Update the component body — state and helpers**

Replace the component declaration and state setup:

```tsx
export function TournamentManager({ tournaments: initial, venues, courses }: TournamentManagerProps) {
  const router = useRouter();
  const supabase = createClient();
  const [tournaments, setTournaments] = useState<TournamentRow[]>(initial);
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function toSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      if (key === 'name' && typeof value === 'string') {
        const wasAuto = prev.slug === toSlug(prev.name);
        return { ...prev, name: value, slug: wasAuto ? toSlug(value) : prev.slug };
      }
      if (key === 'holesPlayed') {
        return { ...prev, holesPlayed: value as string, nineHoleSelection: value === '18' ? '' : prev.nineHoleSelection };
      }
      return { ...prev, [key]: value };
    });
  }

  // Courses filtered to the selected venue
  const venueCourses = form.venueId
    ? courses.filter((c) => c.venue_id === form.venueId)
    : courses;
```

- [ ] **Step 4: Update the save (add) function**

Replace the `async function save()` for the add case:

```tsx
  async function save() {
    if (!form.name.trim() || !form.venueId || !form.courseId || !form.date) {
      toast.error('Name, venue, course, and date are required');
      return;
    }
    setSaving(true);

    if (mode === 'add') {
      const { data: created, error } = await supabase
        .from('tournaments')
        .insert({
          name: form.name.trim(),
          slug: form.slug.trim(),
          venue_id: form.venueId,
          course_id: form.courseId,
          date: form.date,
          start_time: form.startTime || null,
          format: form.format,
          holes_played: parseInt(form.holesPlayed, 10),
          nine_hole_selection: form.nineHoleSelection || null,
        })
        .select('*, venue:venues!venue_id(name), course:courses!course_id(name)')
        .single();

      if (error) { toast.error(error.message); setSaving(false); return; }

      const venue = venues.find((v) => v.id === form.venueId);
      const course = courses.find((c) => c.id === form.courseId);
      setTournaments((prev) => [{
        ...(created as Tournament),
        venue_name: venue?.name ?? '',
        course_name: course?.name ?? '',
      }, ...prev]);
      toast.success('Tournament created');
      setMode('list');
    } else if (mode === 'edit' && editingId) {
      const { error } = await supabase
        .from('tournaments')
        .update({
          name: form.name.trim(),
          slug: form.slug.trim(),
          venue_id: form.venueId,
          course_id: form.courseId,
          date: form.date,
          start_time: form.startTime || null,
          format: form.format,
          holes_played: parseInt(form.holesPlayed, 10),
          nine_hole_selection: form.nineHoleSelection || null,
          status: form.status,
        })
        .eq('id', editingId);

      if (error) { toast.error(error.message); setSaving(false); return; }

      const venue = venues.find((v) => v.id === form.venueId);
      const course = courses.find((c) => c.id === form.courseId);
      setTournaments((prev) => prev.map((t) =>
        t.id === editingId
          ? { ...t, ...form, venue_id: form.venueId, course_id: form.courseId,
              holes_played: parseInt(form.holesPlayed, 10) as 9 | 18,
              nine_hole_selection: (form.nineHoleSelection as 'front' | 'back') || null,
              venue_name: venue?.name ?? '',
              course_name: course?.name ?? '' }
          : t
      ));
      toast.success('Tournament updated');
      setMode('list');
    }
    setSaving(false);
  }
```

- [ ] **Step 5: Update startEdit to populate the new form fields**

Replace the `startEdit` function:

```tsx
  function startEdit(t: TournamentRow) {
    setForm({
      name: t.name,
      slug: t.slug,
      venueId: t.venue_id,
      courseId: t.course_id,
      date: t.date,
      startTime: t.start_time ?? '',
      format: t.format,
      holesPlayed: String(t.holes_played),
      nineHoleSelection: t.nine_hole_selection ?? '',
      status: t.status,
    });
    setEditingId(t.id);
    setMode('edit');
  }
```

- [ ] **Step 6: Update the list view to show venue_name and course_name**

In the tournament list table, replace the venue column cell. Find the cell that renders `{t.venue}`:
```tsx
<div>{t.venue}</div>
```
Replace with:
```tsx
<div>{t.venue_name}{t.course_name ? ` — ${t.course_name}` : ''}</div>
```

- [ ] **Step 7: Update the form JSX — replace text venue/course inputs with dropdowns, add new fields, remove hole import**

Replace the form fields section (everything between the slug field and the Format select). The complete form body should be:

```tsx
{/* Venue */}
<div>
  <Label htmlFor="t-venue">Venue *</Label>
  <Select value={form.venueId} onValueChange={(v) => { setField('venueId', v); setField('courseId', ''); }}>
    <SelectTrigger id="t-venue" className="mt-1">
      <SelectValue placeholder="Select a venue…" />
    </SelectTrigger>
    <SelectContent>
      {venues.map((v) => (
        <SelectItem key={v.id} value={v.id}>{v.name} — {v.city}, {v.province_state}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

{/* Course */}
<div>
  <Label htmlFor="t-course">Course *</Label>
  <Select
    value={form.courseId}
    onValueChange={(v) => setField('courseId', v)}
    disabled={!form.venueId}
  >
    <SelectTrigger id="t-course" className="mt-1">
      <SelectValue placeholder={form.venueId ? 'Select a course…' : 'Select a venue first'} />
    </SelectTrigger>
    <SelectContent>
      {venueCourses.map((c) => (
        <SelectItem key={c.id} value={c.id}>{c.name} ({c.hole_count} holes)</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

{/* Date */}
<div>
  <Label htmlFor="t-date">Date *</Label>
  <Input id="t-date" type="date" className="mt-1" value={form.date} onChange={(e) => setField('date', e.target.value)} />
</div>

{/* Start time */}
<div>
  <Label htmlFor="t-time">Start time</Label>
  <Input id="t-time" type="time" className="mt-1" value={form.startTime} onChange={(e) => setField('startTime', e.target.value)} />
</div>

{/* Format */}
<div>
  <Label>Format *</Label>
  <Select value={form.format} onValueChange={(v) => setField('format', v)}>
    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="best_ball">Best Ball</SelectItem>
      <SelectItem value="stroke_play">Stroke Play</SelectItem>
      <SelectItem value="scramble">Scramble</SelectItem>
    </SelectContent>
  </Select>
</div>

{/* Holes played */}
<div>
  <Label>Holes played *</Label>
  <Select value={form.holesPlayed} onValueChange={(v) => setField('holesPlayed', v)}>
    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="18">18 holes</SelectItem>
      <SelectItem value="9">9 holes</SelectItem>
    </SelectContent>
  </Select>
</div>

{/* Nine-hole selection — only shown when holesPlayed === '9' */}
{form.holesPlayed === '9' && (
  <div>
    <Label>Which 9 holes? *</Label>
    <Select value={form.nineHoleSelection} onValueChange={(v) => setField('nineHoleSelection', v)}>
      <SelectTrigger className="mt-1"><SelectValue placeholder="Front or back 9?" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="front">Front 9 (holes 1–9)</SelectItem>
        <SelectItem value="back">Back 9 (holes 10–18)</SelectItem>
      </SelectContent>
    </Select>
  </div>
)}

{/* Status — edit only */}
{mode === 'edit' && (
  <div>
    <Label>Status</Label>
    <Select value={form.status} onValueChange={(v) => setField('status', v as TournamentStatus)}>
      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="setup">Setup</SelectItem>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="paused">Paused</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
      </SelectContent>
    </Select>
  </div>
)}
```

- [ ] **Step 8: Run type-check — expect clean output**

```bash
npm run type-check 2>&1 | grep "error TS"
```

Expected: no errors.

---

## Task 12: Final verification and commit

**Files:** none (build + test)

- [ ] **Step 1: Run the full type-check**

```bash
npm run type-check
```

Expected: `Found 0 errors.`

- [ ] **Step 2: Run ESLint**

```bash
npm run lint 2>&1 | tail -10
```

Expected: no errors (warnings about `any` are acceptable if they're pre-existing).

- [ ] **Step 3: Run tests**

```bash
npm run test:ci 2>&1 | tail -20
```

Expected: all tests pass, coverage thresholds met (≥80% statements/functions/lines, ≥70% branches).

- [ ] **Step 4: Start the dev server and test the golden path**

```bash
npm run dev
```

Open http://localhost:3000 and verify:

1. Log in as admin (admin@fdgolf.com / Admin1234!) → redirects to `/admin/tournament`
2. The tournament list shows the CIBC tournament with venue name and course name
3. Click Edit on the CIBC tournament → form loads with Granite Ridge pre-selected in the venue dropdown, Main Course in the course dropdown
4. Click Cancel → back to list
5. Click Add Tournament → empty form with venue dropdown populated
6. Log out, log in as player (alice@fdgolf.com / Player1234!) → dashboard shows venue name (not blank)
7. Start Round → holes load (18 holes, no errors in browser console)
8. Open http://localhost:3000/live/cibc-granite-ridge-2026 → venue name displays

- [ ] **Step 5: Commit**

```bash
git add \
  supabase/migrations/007_master_data_hierarchy.sql \
  supabase/migrations/008_leaderboard_rpc_v2.sql \
  src/lib/types.ts \
  "src/app/(player)/round/page.tsx" \
  "src/app/(player)/scorecard/page.tsx" \
  "src/app/(player)/dashboard/page.tsx" \
  "src/app/live/[slug]/page.tsx" \
  "src/app/(admin)/admin/holes/page.tsx" \
  "src/app/(admin)/admin/tournament/page.tsx" \
  "src/app/(admin)/admin/tournament/tournament-manager.tsx"

git commit -m "feat: master data hierarchy — Venue/Course/Hole schema + code migration

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Next: Plan 2 — Admin Master Data UI

Plan 2 (to be written separately) delivers:
- `/admin/venues` — CRUD page for venues (list, add, edit, delete)
- `/admin/courses` — CRUD page for courses, cascading from venue
- `/admin/courses/[courseId]/holes` — holes table + tee box editor per hole, replaces `/admin/holes` long-term
- Nav sidebar link updates

Plan 2 is independent of Plan 1 (the app is fully functional without it; admins manage venues/courses directly in the DB until the UI is built).

> **Note — nine_hole_selection round navigation:** Plan 1 stores `nine_hole_selection` in the DB and sets it via the form, but does NOT add front/back-9 filtering to the round page navigation (which holes the player advances through). That behaviour change belongs in a follow-up task: when `holes_played = 9`, the round should refuse to advance past hole 9 (front) or past hole 18 after hole 10 (back). This is new behaviour, not a migration concern.
