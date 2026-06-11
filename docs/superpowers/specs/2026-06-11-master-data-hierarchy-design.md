# Master Data Hierarchy — Venue / Course / Hole Redesign

**Goal:** Replace the flat, per-tournament hole storage with a proper Venue → Course → Hole → TeeBox master data hierarchy so that course data is defined once and reused across many tournaments.

**Architecture:** Three new tables (`venues`, `courses`, `tee_boxes`) plus a restructured `holes` table (re-keyed from `tournament_id` to `course_id`). Tournaments reference a venue and a course by FK instead of storing free-text venue/course strings. Scores, shots, and teams are unchanged — they still reference `tournament_id` and `hole_number` (integer) as before.

**Tech Stack:** PostgreSQL / Supabase, Next.js 14 App Router, TypeScript, Supabase Row-Level Security.

---

## 1. New master data tables

### `venues`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid PK` | `uuid_generate_v4()` |
| `name` | `text NOT NULL` | e.g. "Granite Ridge Golf Club" |
| `address1` | `text NOT NULL` | Street line 1 |
| `address2` | `text` | Suite / unit (nullable) |
| `city` | `text NOT NULL` | |
| `province_state` | `text NOT NULL` | e.g. "ON", "CA" |
| `postal_code` | `text NOT NULL` | |
| `country` | `text NOT NULL DEFAULT 'CA'` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

### `courses`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid PK` | |
| `venue_id` | `uuid NOT NULL FK → venues(id) ON DELETE CASCADE` | |
| `name` | `text NOT NULL` | e.g. "North Course" |
| `hole_count` | `int NOT NULL CHECK (hole_count IN (9, 18))` | |
| `par_total` | `int NOT NULL` | Total par for all holes on this course |
| `course_rating` | `numeric(4,1)` | e.g. 72.1 (nullable — not always known) |
| `slope_rating` | `int` | e.g. 126 (nullable) |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

### `tee_boxes`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid PK` | |
| `hole_id` | `uuid NOT NULL FK → holes(id) ON DELETE CASCADE` | |
| `name` | `text NOT NULL` | Free-form: "Blue", "White", "Red", "Gold", etc. |
| `lat` | `double precision NOT NULL` | Tee start latitude |
| `lng` | `double precision NOT NULL` | Tee start longitude |
| `distance_yards` | `int NOT NULL` | Distance from this tee to the pin |
| UNIQUE | `(hole_id, name)` | One tee name per hole |

---

## 2. Restructured `holes` table

The `holes` table is migrated in-place using `ALTER TABLE`: add `course_id`, backfill it from the seed venue/course data, drop `tournament_id`, and update the unique constraint. Existing hole rows are preserved.

| Column | Type | Change |
|--------|------|--------|
| `id` | `uuid PK` | unchanged |
| `course_id` | `uuid NOT NULL FK → courses(id) ON DELETE CASCADE` | **replaces `tournament_id`** |
| `hole_number` | `int NOT NULL CHECK (1–18)` | unchanged |
| `par` | `int NOT NULL CHECK (3–6)` | unchanged |
| `handicap` | `int NOT NULL` | unchanged (hole difficulty ranking 1–18) |
| `pin_lat` | `double precision NOT NULL` | unchanged |
| `pin_lng` | `double precision NOT NULL` | unchanged |
| UNIQUE | `(course_id, hole_number)` | replaces `(tournament_id, hole_number)` |

---

## 3. Modified `tournaments` table

| Column | Change | Type |
|--------|--------|------|
| `venue_id` | **NEW** FK | `uuid NOT NULL FK → venues(id)` |
| `course_id` | **NEW** FK | `uuid NOT NULL FK → courses(id)` |
| `start_time` | **NEW** | `time` (nullable — some events are TBD on time) |
| `holes_played` | **NEW** | `int NOT NULL DEFAULT 18 CHECK (holes_played IN (9, 18))` |
| `nine_hole_selection` | **NEW** | `text CHECK (nine_hole_selection IN ('front', 'back')) NULL` — null when holes_played = 18 |
| `venue` | **REMOVED** | was `text` |
| `course` | **REMOVED** | was `text` (added in migration 006) |

All other columns (`id`, `name`, `slug`, `date`, `format`, `status`, `created_at`) are unchanged.

**Constraint:** `CHECK ((holes_played = 18 AND nine_hole_selection IS NULL) OR (holes_played = 9 AND nine_hole_selection IN ('front', 'back')))`

---

## 4. Unchanged tables

`teams`, `scores`, `shots`, `round_states`, `players`, `clubs`, `sponsors` — **no schema changes.**

`scores.hole_number` and `shots.hole_number` remain plain integers. Application code resolves which holes are in scope for a tournament by querying `holes WHERE course_id = tournament.course_id` filtered by `hole_number` range based on `holes_played` + `nine_hole_selection`.

| `holes_played` | `nine_hole_selection` | Holes in scope |
|---|---|---|
| 18 | null | 1–18 |
| 9 | 'front' | 1–9 |
| 9 | 'back' | 10–18 |

---

## 5. Leaderboard RPC update

`get_leaderboard()` in `supabase/migrations/002_leaderboard_rpc.sql` currently joins:
```sql
left join holes h on h.tournament_id = p_tournament_id and h.hole_number = s.hole_number
```

After the migration it must join via the tournament's `course_id`:
```sql
left join tournaments trn on trn.id = p_tournament_id
left join holes h on h.course_id = trn.course_id and h.hole_number = s.hole_number
```

This change ships as a new migration file (`008_...`) that replaces the RPC with `CREATE OR REPLACE FUNCTION`.

---

## 6. RLS policies

All new tables (`venues`, `courses`, `tee_boxes`) follow the same pattern as existing tables:

- **Public read** — `FOR SELECT USING (true)` so the live leaderboard and player app can read course data without auth.
- **Admin full access** — `FOR ALL USING (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'))`.

`holes` policies are updated: the existing `"Public read"` and `"Admin full access"` policies on `holes` are dropped and recreated (same logic, no change to the policy body — the table structure changes, not the auth rules).

---

## 7. TypeScript types (`src/lib/types.ts`)

Four interfaces added / modified:

```ts
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

// Hole: course_id replaces tournament_id
export interface Hole {
  id: string;
  course_id: string;          // was tournament_id
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

// Tournament: venue_id + course_id replace text fields; new scheduling fields
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
```

---

## 8. Admin UI changes

### Venues admin page (`/admin/venues`) — NEW
CRUD for venues. Simple list + add/edit/delete form (same pattern as tournament manager). Fields: name, address1, address2, city, province_state, postal_code, country.

### Courses admin page (`/admin/courses`) — NEW
CRUD for courses. Fields: venue (dropdown), name, hole_count (9/18), par_total, course_rating, slope_rating. Navigates to a holes sub-page for pin/tee editing.

### Holes + tee boxes editor (`/admin/courses/[courseId]/holes`) — NEW
Replaces the per-tournament pin editor. Displays all holes for the course on a Mapbox map. Admin can drag pins and edit tee box positions and distances per hole.

### Tournament manager updates (`/admin/tournament`) — MODIFIED
- Replace free-text venue/course inputs with dropdowns populated from `venues` and `courses` tables.
- Courses dropdown filters to courses belonging to the selected venue.
- Add `start_time`, `holes_played`, and `nine_hole_selection` fields.
- Remove "Import holes" panel (holes now live on the course, not the tournament).

---

## 9. Migration sequence

Delivered as three new migration files:

| File | Contents |
|------|----------|
| `007_master_data_hierarchy.sql` | Create `venues`, `courses`, `tee_boxes`; restructure `holes` (add `course_id`, migrate data, drop `tournament_id`); modify `tournaments` (add `venue_id`, `course_id`, `start_time`, `holes_played`, `nine_hole_selection`; drop text `venue`, `course`); add RLS policies for all new tables |
| `008_leaderboard_rpc_v2.sql` | `CREATE OR REPLACE FUNCTION get_leaderboard(...)` with updated `holes` join |
| `seed_venues_courses.sql` | Seed script (not a migration) — populates Granite Ridge Golf Club venue + course row; seeds tee boxes for the 18 existing holes (lat/lng/distance_yards to be filled with real data) |

---

## 10. Out of scope

- Player handicap index storage and stroke adjustments (not currently in the app).
- Multiple tee sets on the leaderboard display (leaderboard uses par from holes, not tee distances).
- Course photos / media uploads.
- Venue contact details (phone, website) — can be added in a future migration as optional columns without schema breakage.
