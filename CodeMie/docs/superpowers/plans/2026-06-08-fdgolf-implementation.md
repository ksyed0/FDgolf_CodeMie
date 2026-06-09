# FDgolf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working golf score tracking app for 125 players at Granite Ridge Golf Club by June 22, 2026.

**Architecture:** Next.js 14 App Router with Supabase (Postgres + Auth + Realtime + Storage) as the backend. Offline-first sync engine as foundation layer — all writes go through it regardless of connectivity. Deployed on Vercel.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Supabase (@supabase/ssr), Google Maps JS API, Vercel

---

## Sprint Structure

**Week 1 (June 8–15):** Infrastructure, Auth, Admin setup, Teams, Sponsors  
**Week 2 (June 15–22):** Active Round, Scoring, Leaderboard, Polish

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout (fonts, providers)
│   ├── page.tsx                      # Redirect based on auth
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (player)/
│   │   ├── layout.tsx               # Auth-protected layout with header
│   │   ├── dashboard/page.tsx
│   │   ├── round/page.tsx
│   │   └── leaderboard/page.tsx
│   ├── (admin)/
│   │   ├── layout.tsx               # Admin layout with sidebar
│   │   └── admin/
│   │       ├── page.tsx             # Admin home (redirect to tournament)
│   │       ├── tournament/page.tsx
│   │       ├── players/page.tsx
│   │       ├── teams/page.tsx
│   │       ├── holes/page.tsx
│   │       ├── clubs/page.tsx
│   │       ├── scores/page.tsx
│   │       └── sponsors/page.tsx
│   └── live/
│       └── [slug]/page.tsx          # Public leaderboard (no auth)
├── components/
│   ├── ui/                          # shadcn/ui components
│   ├── app-header.tsx               # FDgolf + AI/Run branded header
│   ├── admin-sidebar.tsx            # Admin navigation sidebar
│   ├── sponsor-banner.tsx           # Sponsor logo row
│   ├── player-pills.tsx             # Player selector for round
│   ├── club-selector.tsx            # Club dropdown grouped by category
│   ├── shot-outcome-buttons.tsx     # In-Play, OOB, Mulligan, Sunk
│   ├── hole-map.tsx                 # Google Maps wrapper for hole view
│   ├── leaderboard-table.tsx        # Shared leaderboard UI
│   └── offline-indicator.tsx        # Connectivity status badge
├── lib/
│   ├── supabase/
│   │   ├── client.ts                # Browser Supabase client
│   │   ├── server.ts                # Server Supabase client
│   │   └── middleware.ts            # Auth middleware helper
│   ├── sync-engine.ts               # Offline-first write queue
│   ├── gps.ts                       # Geolocation API wrapper
│   ├── scoring.ts                   # Score calculation utilities
│   └── types.ts                     # Shared TypeScript types
├── hooks/
│   ├── use-sync-engine.ts           # React hook for sync engine
│   ├── use-gps.ts                   # React hook for GPS position
│   └── use-realtime-scores.ts       # Supabase Realtime subscription
└── middleware.ts                    # Next.js middleware (auth redirect)

supabase/
├── migrations/
│   └── 001_initial_schema.sql       # All tables, RLS, indexes
├── seed.sql                         # Clubs + Granite Ridge holes
└── functions/
    └── calculate-best-ball/
        └── index.ts                 # Edge Function: best ball logic
```

---

## Task 1: Next.js Project Initialization

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `tailwind.config.ts`
- Create: `src/lib/types.ts`

- [ ] **Step 1: Create Next.js project**

Run:
```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

Expected: Project scaffolded in current directory.

- [ ] **Step 2: Install shadcn/ui**

Run:
```bash
npx shadcn@latest init -d
```

Expected: `components.json` created, `src/components/ui/` directory ready.

- [ ] **Step 3: Install required shadcn components**

Run:
```bash
npx shadcn@latest add button input label card select dialog table badge dropdown-menu sheet tabs toast
```

- [ ] **Step 4: Install additional dependencies**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr @googlemaps/js-api-loader
```

- [ ] **Step 5: Create shared TypeScript types**

Write `src/lib/types.ts`:
```typescript
export type TournamentStatus = 'setup' | 'active' | 'completed';
export type RoundStatus = 'not_started' | 'in_progress' | 'completed';
export type ShotOutcome = 'in_play' | 'out_of_bounds' | 'mulligan' | 'sunk';
export type PlayerRole = 'player' | 'admin';
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

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js 14 project with shadcn/ui and types"
```

---

## Task 2: Supabase Configuration

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/middleware.ts`
- Create: `.env.local.example`

- [ ] **Step 1: Create env example file**

Write `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-key
```

- [ ] **Step 2: Create browser Supabase client**

Write `src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Create server Supabase client**

Write `src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: Create middleware helper**

Write `src/lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path === '/login' || path === '/register';
  const isPublicRoute = path.startsWith('/live/');
  const isAdminRoute = path.startsWith('/admin');

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  if (isAdminRoute && user) {
    const { data: player } = await supabase
      .from('players')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (player?.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
```

- [ ] **Step 5: Create Next.js middleware**

Write `src/middleware.ts`:
```typescript
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: configure Supabase clients and auth middleware"
```

---

## Task 3: Database Schema & Seeds

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/seed.sql`

- [ ] **Step 1: Write initial migration**

Write `supabase/migrations/001_initial_schema.sql`:
```sql
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
  status text not null default 'setup' check (status in ('setup', 'active', 'completed')),
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
  role text not null default 'player' check (role in ('player', 'admin')),
  created_at timestamptz not null default now()
);

-- Clubs
create table clubs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null check (category in ('wood', 'hybrid', 'iron', 'wedge', 'putter')),
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- Round State
create table round_state (
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
alter table round_state enable row level security;
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
create policy "Team read round_state" on round_state for select
  using (team_id in (
    select team_id from players where auth_user_id = auth.uid()
  ));
create policy "Team update round_state" on round_state for update
  using (team_id in (
    select team_id from players where auth_user_id = auth.uid()
  ));
create policy "Team insert round_state" on round_state for insert
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
create policy "Admin full access" on round_state for all
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
```

- [ ] **Step 2: Write seed data**

Write `supabase/seed.sql`:
```sql
-- Seed tournament
insert into tournaments (id, name, slug, date, format, venue, status) values
  ('00000000-0000-0000-0000-000000000001', 'CIBC Capital Markets Golf Tournament 2026', 'cibc-granite-ridge-2026', '2026-06-22', 'best_ball', 'Granite Ridge Golf Club, Milton, ON', 'setup');

-- Seed clubs
insert into clubs (name, category, sort_order) values
  ('Driver (1W)', 'wood', 1),
  ('3-Wood', 'wood', 2),
  ('5-Wood', 'wood', 3),
  ('7-Wood', 'wood', 4),
  ('2 Hybrid', 'hybrid', 5),
  ('3 Hybrid', 'hybrid', 6),
  ('4 Hybrid', 'hybrid', 7),
  ('5 Hybrid', 'hybrid', 8),
  ('2 Iron', 'iron', 9),
  ('3 Iron', 'iron', 10),
  ('4 Iron', 'iron', 11),
  ('5 Iron', 'iron', 12),
  ('6 Iron', 'iron', 13),
  ('7 Iron', 'iron', 14),
  ('8 Iron', 'iron', 15),
  ('9 Iron', 'iron', 16),
  ('Pitching Wedge', 'wedge', 17),
  ('Gap Wedge', 'wedge', 18),
  ('Sand Wedge', 'wedge', 19),
  ('Lob Wedge', 'wedge', 20),
  ('Putter', 'putter', 21);

-- Seed Granite Ridge holes (approximate GPS based on course layout)
-- Course center: 43.5184° N, 79.9072° W
insert into holes (tournament_id, hole_number, par, handicap, pin_lat, pin_lng) values
  ('00000000-0000-0000-0000-000000000001', 1, 4, 7, 43.5191, -79.9085),
  ('00000000-0000-0000-0000-000000000001', 2, 3, 15, 43.5188, -79.9078),
  ('00000000-0000-0000-0000-000000000001', 3, 5, 1, 43.5182, -79.9071),
  ('00000000-0000-0000-0000-000000000001', 4, 4, 9, 43.5176, -79.9063),
  ('00000000-0000-0000-0000-000000000001', 5, 3, 17, 43.5170, -79.9056),
  ('00000000-0000-0000-0000-000000000001', 6, 4, 5, 43.5164, -79.9049),
  ('00000000-0000-0000-0000-000000000001', 7, 4, 3, 43.5158, -79.9042),
  ('00000000-0000-0000-0000-000000000001', 8, 5, 11, 43.5152, -79.9035),
  ('00000000-0000-0000-0000-000000000001', 9, 4, 13, 43.5146, -79.9028),
  ('00000000-0000-0000-0000-000000000001', 10, 4, 8, 43.5193, -79.9060),
  ('00000000-0000-0000-0000-000000000001', 11, 3, 16, 43.5199, -79.9053),
  ('00000000-0000-0000-0000-000000000001', 12, 5, 2, 43.5205, -79.9046),
  ('00000000-0000-0000-0000-000000000001', 13, 4, 10, 43.5211, -79.9039),
  ('00000000-0000-0000-0000-000000000001', 14, 4, 4, 43.5217, -79.9032),
  ('00000000-0000-0000-0000-000000000001', 15, 3, 18, 43.5223, -79.9025),
  ('00000000-0000-0000-0000-000000000001', 16, 4, 6, 43.5229, -79.9018),
  ('00000000-0000-0000-0000-000000000001', 17, 5, 12, 43.5235, -79.9011),
  ('00000000-0000-0000-0000-000000000001', 18, 4, 14, 43.5241, -79.9004);
```

- [ ] **Step 3: Apply migration to Supabase**

Run via Supabase Dashboard SQL Editor or:
```bash
npx supabase db push
```

- [ ] **Step 4: Run seed**

Run via Supabase Dashboard SQL Editor or:
```bash
npx supabase db seed
```

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema, RLS policies, and seed data"
```

---

## Task 4: Offline Sync Engine (Foundation Layer)

**Files:**
- Create: `src/lib/sync-engine.ts`
- Create: `src/hooks/use-sync-engine.ts`
- Create: `src/components/offline-indicator.tsx`

- [ ] **Step 1: Write sync engine**

Write `src/lib/sync-engine.ts`:
```typescript
import { createClient } from '@/lib/supabase/client';

const QUEUE_KEY = 'fdgolf_sync_queue';

interface QueueEntry {
  id: string;
  table: string;
  payload: Record<string, unknown>;
  created_at: number;
  retries: number;
}

export class SyncEngine {
  private processing = false;
  private listeners: Set<() => void> = new Set();

  getQueue(): QueueEntry[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  private saveQueue(queue: QueueEntry[]) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    this.notify();
  }

  enqueue(table: string, payload: Record<string, unknown>): string {
    const entry: QueueEntry = {
      id: crypto.randomUUID(),
      table,
      payload,
      created_at: Date.now(),
      retries: 0,
    };
    const queue = this.getQueue();
    queue.push(entry);
    this.saveQueue(queue);
    this.flush();
    return entry.id;
  }

  async flush(): Promise<void> {
    if (this.processing) return;
    if (!navigator.onLine) return;

    this.processing = true;
    const supabase = createClient();
    const queue = this.getQueue();
    const failed: QueueEntry[] = [];

    for (const entry of queue) {
      const { error } = await supabase.from(entry.table).insert(entry.payload);
      if (error) {
        entry.retries++;
        if (entry.retries < 5) {
          failed.push(entry);
        }
      }
    }

    this.saveQueue(failed);
    this.processing = false;
  }

  get pendingCount(): number {
    return this.getQueue().length;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  startAutoSync() {
    window.addEventListener('online', () => this.flush());
    const interval = setInterval(() => this.flush(), 10000);
    return () => {
      window.removeEventListener('online', () => this.flush());
      clearInterval(interval);
    };
  }
}

export const syncEngine = new SyncEngine();
```

- [ ] **Step 2: Write React hook for sync engine**

Write `src/hooks/use-sync-engine.ts`:
```typescript
'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { syncEngine } from '@/lib/sync-engine';

export function useSyncEngine() {
  useEffect(() => {
    const cleanup = syncEngine.startAutoSync();
    return cleanup;
  }, []);

  const pendingCount = useSyncExternalStore(
    (cb) => syncEngine.subscribe(cb),
    () => syncEngine.pendingCount,
    () => 0
  );

  const isOnline = useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
      };
    },
    () => navigator.onLine,
    () => true
  );

  return { pendingCount, isOnline, flush: () => syncEngine.flush() };
}
```

- [ ] **Step 3: Write offline indicator component**

Write `src/components/offline-indicator.tsx`:
```typescript
'use client';

import { useSyncEngine } from '@/hooks/use-sync-engine';

export function OfflineIndicator() {
  const { pendingCount, isOnline } = useSyncEngine();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-md">
      {!isOnline && (
        <>
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Offline
        </>
      )}
      {pendingCount > 0 && (
        <span>{pendingCount} shot{pendingCount > 1 ? 's' : ''} pending sync</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/sync-engine.ts src/hooks/use-sync-engine.ts src/components/offline-indicator.tsx
git commit -m "feat: add offline-first sync engine with localStorage queue"
```

---

## Task 5: App Header Component (Branding)

**Files:**
- Create: `src/components/app-header.tsx`

- [ ] **Step 1: Write header component**

Write `src/components/app-header.tsx`:
```typescript
'use client';

import Link from 'next/link';

interface AppHeaderProps {
  variant?: 'full' | 'compact';
  holeInfo?: string;
  showAvatar?: boolean;
  userName?: string;
  showLive?: boolean;
}

export function AppHeader({
  variant = 'full',
  holeInfo,
  showAvatar = true,
  userName,
  showLive = false,
}: AppHeaderProps) {
  const initial = userName?.charAt(0)?.toUpperCase() ?? '?';

  if (variant === 'compact') {
    return (
      <header className="bg-[#1a472a] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-extrabold text-white tracking-tight">FDgolf</span>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500" />
            <span className="text-[9px] text-white/50">AI/Run™</span>
          </div>
        </div>
        {holeInfo && (
          <span className="text-xs text-white/80">{holeInfo}</span>
        )}
      </header>
    );
  }

  return (
    <header className="bg-[#1a472a] px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xl font-extrabold text-white tracking-tight">FDgolf</span>
        <div className="w-px h-5 bg-white/30" />
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 border border-white/30" />
          <span className="text-[10px] text-white/60">created by AI/Run™</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {showLive && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] text-white/70">LIVE</span>
          </div>
        )}
        {showAvatar && (
          <>
            <Link href="/leaderboard" className="text-sm text-white/80">🏆</Link>
            <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-xs text-white">
              {initial}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/app-header.tsx
git commit -m "feat: add branded app header (full + compact variants)"
```

---

## Task 6: Registration & Login

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/register/page.tsx`
- Create: `src/app/(auth)/layout.tsx`

- [ ] **Step 1: Create auth layout**

Write `src/app/(auth)/layout.tsx`:
```typescript
import { AppHeader } from '@/components/app-header';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader showAvatar={false} />
      <main className="flex items-center justify-center px-4 py-12">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create login page**

Write `src/app/(auth)/login/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-center">Sign In</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full bg-[#2d6b45] hover:bg-[#1a472a]" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
          <p className="text-center text-sm text-gray-600">
            No account? <Link href="/register" className="text-[#2d6b45] font-medium">Register</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create registration page (3-step wizard)**

Write `src/app/(auth)/register/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Step 1
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [yearOfBirth, setYearOfBirth] = useState('');
  const [gender, setGender] = useState('');

  // Step 3
  const [teamNumber, setTeamNumber] = useState('');
  const [teammates, setTeammates] = useState<string[]>([]);

  async function handleStep1() {
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setStep(2);
  }

  async function handleStep2() {
    if (!name || !company) {
      setError('Name and Company are required');
      return;
    }
    setError('');
    setStep(3);
  }

  async function handleStep3() {
    setLoading(true);
    setError('');
    const supabase = createClient();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      setError(authError?.message ?? 'Registration failed');
      setLoading(false);
      return;
    }

    // Find team by number
    let teamId: string | null = null;
    if (teamNumber) {
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('team_number', parseInt(teamNumber))
        .single();
      teamId = team?.id ?? null;
    }

    // Create player record
    const { error: playerError } = await supabase.from('players').insert({
      auth_user_id: authData.user.id,
      name,
      title,
      company,
      email,
      phone,
      year_of_birth: yearOfBirth ? parseInt(yearOfBirth) : null,
      gender: gender || null,
      team_id: teamId,
      role: 'player',
    });

    if (playerError) {
      setError(playerError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  async function lookupTeam() {
    if (!teamNumber) return;
    const supabase = createClient();
    const { data: team } = await supabase
      .from('teams')
      .select('id')
      .eq('team_number', parseInt(teamNumber))
      .single();

    if (!team) {
      setTeammates([]);
      return;
    }

    const { data: players } = await supabase
      .from('players')
      .select('name')
      .eq('team_id', team.id);

    setTeammates(players?.map((p) => p.name) ?? []);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-center">
          Register — Step {step} of 3
        </CardTitle>
      </CardHeader>
      <CardContent>
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password *</Label>
              <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={handleStep1} className="w-full bg-[#2d6b45] hover:bg-[#1a472a]">Continue →</Button>
            <p className="text-center text-sm text-gray-600">
              Already registered? <Link href="/login" className="text-[#2d6b45] font-medium">Sign In</Link>
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Job Title *</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company *</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile Phone *</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yob">Year of Birth (optional)</Label>
              <Input id="yob" type="number" value={yearOfBirth} onChange={(e) => setYearOfBirth(e.target.value)} placeholder="1985" />
            </div>
            <div className="space-y-2">
              <Label>Gender (optional)</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue placeholder="Prefer not to say" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">← Back</Button>
              <Button onClick={handleStep2} className="flex-1 bg-[#2d6b45] hover:bg-[#1a472a]">Continue →</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team">Team # (assigned by admin)</Label>
              <div className="flex gap-2">
                <Input id="team" type="number" value={teamNumber} onChange={(e) => setTeamNumber(e.target.value)} placeholder="e.g. 3" />
                <Button variant="outline" onClick={lookupTeam} type="button">Lookup</Button>
              </div>
            </div>
            {teammates.length > 0 && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3">
                <p className="text-xs text-green-800 font-medium mb-1">Your teammates:</p>
                {teammates.map((t) => (
                  <p key={t} className="text-sm text-green-700">✓ {t}</p>
                ))}
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">← Back</Button>
              <Button onClick={handleStep3} className="flex-1 bg-[#2d6b45] hover:bg-[#1a472a]" disabled={loading}>
                {loading ? 'Creating...' : 'Complete Registration ✓'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/
git commit -m "feat: add login and 3-step registration pages"
```

---

## Task 7: Player Dashboard

**Files:**
- Create: `src/app/(player)/layout.tsx`
- Create: `src/app/(player)/dashboard/page.tsx`

- [ ] **Step 1: Create player layout**

Write `src/app/(player)/layout.tsx`:
```typescript
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { OfflineIndicator } from '@/components/offline-indicator';

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: player } = await supabase
    .from('players')
    .select('name')
    .eq('auth_user_id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader userName={player?.name} />
      <main>{children}</main>
      <OfflineIndicator />
    </div>
  );
}
```

- [ ] **Step 2: Create dashboard page**

Write `src/app/(player)/dashboard/page.tsx`:
```typescript
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: player } = await supabase
    .from('players')
    .select('*, teams(team_number, team_name, starting_hole)')
    .eq('auth_user_id', user.id)
    .single();

  if (!player) redirect('/login');

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .single();

  const { data: teammates } = player.team_id
    ? await supabase
        .from('players')
        .select('name, company')
        .eq('team_id', player.team_id)
        .neq('id', player.id)
    : { data: [] };

  const daysUntil = tournament
    ? Math.ceil((new Date(tournament.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <h1 className="text-lg font-semibold">Welcome back, {player.name.split(' ')[0]}</h1>

      {tournament && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">{tournament.name}</p>
            <p className="text-xs text-gray-500">{tournament.venue}</p>
            {daysUntil !== null && daysUntil > 0 && (
              <div className="bg-green-50 rounded-lg p-3 text-center text-sm text-green-800">
                🏌️ Tournament starts in {daysUntil} day{daysUntil > 1 ? 's' : ''}
              </div>
            )}
            {tournament.status === 'active' && (
              <Link href="/round">
                <Button className="w-full bg-[#1a472a] hover:bg-[#2d6b45]">Start Round</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {player.teams && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">
              Team {player.teams.team_number}
              {player.teams.team_name && ` — ${player.teams.team_name}`}
            </p>
            <p className="text-xs text-gray-500">Starting Hole: {player.teams.starting_hole}</p>
            {teammates && teammates.length > 0 && (
              <div className="space-y-1 mt-2">
                {teammates.map((t) => (
                  <p key={t.name} className="text-sm text-gray-700">• {t.name} ({t.company})</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Link href="/leaderboard">
        <Button variant="outline" className="w-full">🏆 View Leaderboard</Button>
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(player\)/
git commit -m "feat: add player dashboard with team info and tournament status"
```

---

## Task 8: Admin Layout & Tournament Config

**Files:**
- Create: `src/components/admin-sidebar.tsx`
- Create: `src/app/(admin)/layout.tsx`
- Create: `src/app/(admin)/admin/page.tsx`
- Create: `src/app/(admin)/admin/tournament/page.tsx`

- [ ] **Step 1: Create admin sidebar**

Write `src/components/admin-sidebar.tsx`:
```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/admin/tournament', label: '🏆 Tournament', icon: '🏆' },
  { href: '/admin/players', label: '👥 Players', icon: '👥' },
  { href: '/admin/teams', label: '🏌️ Teams', icon: '🏌️' },
  { href: '/admin/holes', label: '⛳ Holes', icon: '⛳' },
  { href: '/admin/clubs', label: '🏑 Clubs', icon: '🏑' },
  { href: '/admin/scores', label: '📊 Scores', icon: '📊' },
  { href: '/admin/sponsors', label: '🤝 Sponsors', icon: '🤝' },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-[#1a472a] min-h-screen flex flex-col text-white">
      <div className="p-4 border-b border-white/10">
        <div className="text-xl font-extrabold">FDgolf</div>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 border border-white/30" />
          <span className="text-[10px] text-white/60">created by AI/Run™</span>
        </div>
      </div>
      <nav className="flex-1 py-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-5 py-2.5 text-sm transition-colors ${
              pathname === item.href
                ? 'bg-white/10 border-l-[3px] border-green-500'
                : 'opacity-70 hover:opacity-100 border-l-[3px] border-transparent'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10">
        <div className="text-[11px] font-bold tracking-wide leading-tight">
          <span>F</span><span className="text-green-400">/</span><span>RST</span><br />
          <span>DER</span><span className="text-green-400">/</span><span>V</span><br />
          <span>AT</span><span className="text-green-400">/</span><span>VE</span>
        </div>
        <div className="text-[8px] text-white/40 mt-1">AN EPAM COMPANY</div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create admin layout**

Write `src/app/(admin)/layout.tsx`:
```typescript
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminSidebar } from '@/components/admin-sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: player } = await supabase
    .from('players')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();

  if (player?.role !== 'admin') redirect('/dashboard');

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6 bg-gray-50">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create admin redirect page**

Write `src/app/(admin)/admin/page.tsx`:
```typescript
import { redirect } from 'next/navigation';

export default function AdminPage() {
  redirect('/admin/tournament');
}
```

- [ ] **Step 4: Create tournament config page**

Write `src/app/(admin)/admin/tournament/page.tsx`:
```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Tournament } from '@/lib/types';

export default function TournamentPage() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from('tournaments').select('*').single();
      if (data) setTournament(data);
    }
    load();
  }, []);

  async function save() {
    if (!tournament) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from('tournaments').update({
      name: tournament.name,
      slug: tournament.slug,
      date: tournament.date,
      venue: tournament.venue,
      status: tournament.status,
    }).eq('id', tournament.id);
    setSaving(false);
  }

  if (!tournament) return <p>Loading...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold">Tournament Setup</h1>
        <Button onClick={save} disabled={saving} className="bg-green-600 hover:bg-green-700">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
      <Card>
        <CardContent className="p-6 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tournament Name</Label>
            <Input value={tournament.name} onChange={(e) => setTournament({ ...tournament, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={tournament.date} onChange={(e) => setTournament({ ...tournament, date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Venue</Label>
            <Input value={tournament.venue} onChange={(e) => setTournament({ ...tournament, venue: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Format</Label>
            <Input value={tournament.format} disabled />
          </div>
          <div className="space-y-2">
            <Label>Public Leaderboard URL</Label>
            <div className="flex gap-2 items-center">
              <Input value={`/live/${tournament.slug}`} onChange={(e) => setTournament({ ...tournament, slug: e.target.value.replace('/live/', '') })} />
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/live/${tournament.slug}`)}>
                📋
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              value={tournament.status}
              onChange={(e) => setTournament({ ...tournament, status: e.target.value as Tournament['status'] })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="setup">Setup</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/admin-sidebar.tsx src/app/\(admin\)/
git commit -m "feat: add admin layout, sidebar, and tournament config page"
```

---

## Task 9: Admin — Teams & Players Management

**Files:**
- Create: `src/app/(admin)/admin/teams/page.tsx`
- Create: `src/app/(admin)/admin/players/page.tsx`

Due to length constraints, these follow the same pattern as Task 8: data table with search, edit modal with team assignment dropdown, "Auto-assign starting holes" button on teams page. Implementation uses `supabase.from('teams')` and `supabase.from('players')` with the same CRUD pattern.

- [ ] **Step 1: Write teams management page** (table + create/edit modal + auto-assign bulk action)
- [ ] **Step 2: Write players management page** (searchable table + edit modal with team dropdown + password reset button)
- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/teams/ src/app/\(admin\)/admin/players/
git commit -m "feat: add admin team and player management pages"
```

---

## Task 10: Admin — Clubs, Holes, Sponsors

**Files:**
- Create: `src/app/(admin)/admin/clubs/page.tsx`
- Create: `src/app/(admin)/admin/holes/page.tsx`
- Create: `src/app/(admin)/admin/sponsors/page.tsx`

- [ ] **Step 1: Write clubs management page** (CRUD, reorder via sort_order, activate/deactivate toggle)
- [ ] **Step 2: Write holes management page** (18-row table, edit par/handicap/pin GPS per hole)
- [ ] **Step 3: Write sponsors management page** (upload logo to Supabase Storage, drag-to-reorder, preview bar)
- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/clubs/ src/app/\(admin\)/admin/holes/ src/app/\(admin\)/admin/sponsors/
git commit -m "feat: add admin clubs, holes, and sponsors management"
```

---

## Task 11: GPS & Maps Infrastructure

**Files:**
- Create: `src/lib/gps.ts`
- Create: `src/hooks/use-gps.ts`
- Create: `src/components/hole-map.tsx`

- [ ] **Step 1: Write GPS utility**

Write `src/lib/gps.ts`:
```typescript
export interface GpsPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export function getCurrentPosition(): Promise<GpsPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  });
}

export function distanceMeters(a: GpsPosition, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function metersToYards(m: number): number {
  return Math.round(m * 1.09361);
}
```

- [ ] **Step 2: Write GPS hook**

Write `src/hooks/use-gps.ts`:
```typescript
'use client';

import { useState, useCallback } from 'react';
import { getCurrentPosition, type GpsPosition } from '@/lib/gps';

export function useGps() {
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const capture = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pos = await getCurrentPosition();
      setPosition(pos);
      return pos;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'GPS unavailable';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { position, error, loading, capture };
}
```

- [ ] **Step 3: Write hole map component**

Write `src/components/hole-map.tsx`:
```typescript
'use client';

import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import type { GpsPosition } from '@/lib/gps';

interface HoleMapProps {
  pinLat: number;
  pinLng: number;
  playerPosition?: GpsPosition | null;
  shots?: Array<{ lat: number; lng: number }>;
}

export function HoleMap({ pinLat, pinLng, playerPosition, shots = [] }: HoleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
      version: 'weekly',
    });

    loader.importLibrary('maps').then(({ Map }) => {
      if (!mapRef.current) return;
      const map = new Map(mapRef.current, {
        center: { lat: pinLat, lng: pinLng },
        zoom: 17,
        mapTypeId: 'satellite',
        disableDefaultUI: true,
        zoomControl: true,
      });
      mapInstance.current = map;

      new google.maps.Marker({
        position: { lat: pinLat, lng: pinLng },
        map,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#f59e0b', fillOpacity: 1, strokeWeight: 2, strokeColor: '#fff' },
        title: 'Pin',
      });
    });
  }, [pinLat, pinLng]);

  useEffect(() => {
    if (!mapInstance.current || !playerPosition) return;
    new google.maps.Marker({
      position: { lat: playerPosition.lat, lng: playerPosition.lng },
      map: mapInstance.current,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#3b82f6', fillOpacity: 1, strokeWeight: 2, strokeColor: '#fff' },
      title: 'You',
    });
  }, [playerPosition]);

  return <div ref={mapRef} className="w-full h-[200px] rounded-lg overflow-hidden" />;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/gps.ts src/hooks/use-gps.ts src/components/hole-map.tsx
git commit -m "feat: add GPS utilities, hook, and Google Maps hole component"
```

---

## Task 12: Active Round — Core Shot Tracking

**Files:**
- Create: `src/app/(player)/round/page.tsx`
- Create: `src/components/player-pills.tsx`
- Create: `src/components/club-selector.tsx`
- Create: `src/components/shot-outcome-buttons.tsx`
- Create: `src/lib/scoring.ts`

This is the largest task — the core gameplay screen. Due to length, the key implementation points:

- [ ] **Step 1: Write scoring utilities** (`src/lib/scoring.ts` — compute strokes for a hole, determine next player by distance to pin, wraparound hole navigation)
- [ ] **Step 2: Write player pills component** (shows team members with active/waiting/done states, "Enter shot for [name]" on tap)
- [ ] **Step 3: Write club selector** (dropdown grouped by category, fetches active clubs from Supabase)
- [ ] **Step 4: Write shot outcome buttons** (4 buttons: In-Play, OOB, Mulligan, Sunk — each triggers appropriate logic)
- [ ] **Step 5: Write round page** (state machine: SELECT_PLAYER → SELECT_CLUB → CAPTURE → OUTCOME → repeat/hole_done. Uses sync engine for all shot writes. Compact header variant.)
- [ ] **Step 6: Commit**

```bash
git add src/app/\(player\)/round/ src/components/player-pills.tsx src/components/club-selector.tsx src/components/shot-outcome-buttons.tsx src/lib/scoring.ts
git commit -m "feat: add active round page with shot tracking state machine"
```

---

## Task 13: Best Ball Edge Function & Hole Completion

**Files:**
- Create: `supabase/functions/calculate-best-ball/index.ts`
- Modify: `src/app/(player)/round/page.tsx` (add hole summary + next hole)

- [ ] **Step 1: Write Edge Function**

Write `supabase/functions/calculate-best-ball/index.ts`:
```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { team_id, tournament_id, hole_number } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get all team members
  const { data: players } = await supabase
    .from('players')
    .select('id')
    .eq('team_id', team_id);

  if (!players || players.length === 0) {
    return new Response(JSON.stringify({ error: 'No players found' }), { status: 400 });
  }

  // Calculate strokes per player (exclude mulligans, count OOB penalty)
  const scores: Array<{ player_id: string; strokes: number }> = [];

  for (const player of players) {
    const { data: shots } = await supabase
      .from('shots')
      .select('outcome')
      .eq('player_id', player.id)
      .eq('tournament_id', tournament_id)
      .eq('hole_number', hole_number);

    if (!shots) continue;

    let strokes = 0;
    for (const shot of shots) {
      if (shot.outcome === 'mulligan') continue;
      strokes++;
      if (shot.outcome === 'out_of_bounds') strokes++; // penalty stroke
    }

    scores.push({ player_id: player.id, strokes });
  }

  if (scores.length === 0) {
    return new Response(JSON.stringify({ error: 'No scores' }), { status: 400 });
  }

  // Find best ball (lowest strokes)
  const bestScore = Math.min(...scores.map((s) => s.strokes));

  // Upsert scores
  for (const score of scores) {
    await supabase.from('scores').upsert({
      player_id: score.player_id,
      team_id,
      tournament_id,
      hole_number,
      strokes: score.strokes,
      is_best_ball: score.strokes === bestScore,
    }, { onConflict: 'player_id,tournament_id,hole_number' });
  }

  return new Response(JSON.stringify({ best_ball: bestScore, scores }), { status: 200 });
});
```

- [ ] **Step 2: Add hole summary and next-hole navigation to round page**
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ src/app/\(player\)/round/
git commit -m "feat: add best ball Edge Function and hole completion flow"
```

---

## Task 14: Leaderboard (Authenticated + Public)

**Files:**
- Create: `src/components/leaderboard-table.tsx`
- Create: `src/components/sponsor-banner.tsx`
- Create: `src/hooks/use-realtime-scores.ts`
- Create: `src/app/(player)/leaderboard/page.tsx`
- Create: `src/app/live/[slug]/page.tsx`

- [ ] **Step 1: Write realtime scores hook**

Write `src/hooks/use-realtime-scores.ts`:
```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface TeamScore {
  team_id: string;
  team_number: number;
  team_name: string | null;
  total_score: number;
  holes_completed: number;
  par_total: number;
}

export function useRealtimeScores(tournamentId: string) {
  const [scores, setScores] = useState<TeamScore[]>([]);

  useEffect(() => {
    const supabase = createClient();

    async function fetchScores() {
      const { data } = await supabase.rpc('get_leaderboard', { t_id: tournamentId });
      if (data) setScores(data);
    }

    fetchScores();

    const channel = supabase
      .channel('scores-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
        fetchScores();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId]);

  return scores;
}
```

- [ ] **Step 2: Write sponsor banner component**

Write `src/components/sponsor-banner.tsx`:
```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Sponsor } from '@/lib/types';

export function SponsorBanner({ tournamentId }: { tournamentId: string }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('sponsors')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('is_active', true)
        .order('display_order');
      if (data) setSponsors(data);
    }
    load();
  }, [tournamentId]);

  if (sponsors.length === 0) return null;

  return (
    <div className="bg-white border-b px-4 py-2 flex justify-center gap-6 items-center">
      {sponsors.map((s) => (
        <img key={s.id} src={s.logo_url} alt={s.name} className="h-6 object-contain" />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Write leaderboard table component** (shared between authenticated and public views)
- [ ] **Step 4: Write authenticated leaderboard page** (uses player layout, shows "Your Team ★" pin)
- [ ] **Step 5: Write public leaderboard page** (`/live/[slug]` — no auth, AppHeader with `showLive`, fetches tournament by slug)
- [ ] **Step 6: Commit**

```bash
git add src/components/leaderboard-table.tsx src/components/sponsor-banner.tsx src/hooks/use-realtime-scores.ts src/app/\(player\)/leaderboard/ src/app/live/
git commit -m "feat: add real-time leaderboard (authenticated + public)"
```

---

## Task 15: Admin — Score Overrides

**Files:**
- Create: `src/app/(admin)/admin/scores/page.tsx`

- [ ] **Step 1: Write score override page** (select team → select hole → show individual strokes → edit → "Recalculate Best Ball" button calls Edge Function → audit trail via override_by/override_at fields)
- [ ] **Step 2: Commit**

```bash
git add src/app/\(admin\)/admin/scores/
git commit -m "feat: add admin score override with best ball recalculation"
```

---

## Task 16: Root Redirect & Final Wiring

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/layout.tsx` (if not already complete)

- [ ] **Step 1: Wire root redirect**

Write `src/app/page.tsx`:
```typescript
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: player } = await supabase
    .from('players')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();

  if (player?.role === 'admin') redirect('/admin');
  redirect('/dashboard');
}
```

- [ ] **Step 2: Verify all routes work end-to-end**

Run:
```bash
npm run dev
```

Test: `/login`, `/register`, `/dashboard`, `/round`, `/leaderboard`, `/live/cibc-granite-ridge-2026`, `/admin`

- [ ] **Step 3: Deploy to Vercel**

Run:
```bash
npx vercel --prod
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: wire root redirect and finalize routing"
```

---

## Task 17: Supabase Leaderboard RPC Function

**Files:**
- Add to: `supabase/migrations/001_initial_schema.sql` (or create `002_leaderboard_rpc.sql`)

- [ ] **Step 1: Write leaderboard RPC**

```sql
create or replace function get_leaderboard(t_id uuid)
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
  left join scores s on s.team_id = t.id and s.tournament_id = t_id and s.is_best_ball = true
  left join holes h on h.tournament_id = t_id and h.hole_number = s.hole_number
  where t.tournament_id = t_id
  group by t.id, t.team_number, t.team_name
  order by (coalesce(sum(s.strokes), 0) - coalesce(sum(h.par), 0)) asc;
$$;
```

- [ ] **Step 2: Apply to Supabase**
- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: add leaderboard RPC function for ranked team scores"
```

---

## Summary

| Week | Tasks | Outcome |
|---|---|---|
| Week 1 (June 8–15) | Tasks 1–10, 17 | Infrastructure, auth, admin (tournament, teams, players, clubs, holes, sponsors) — tournament fully configurable |
| Week 2 (June 15–22) | Tasks 11–16 | GPS, round tracking, scoring, leaderboard — gameplay working end-to-end |

**P1 features deferred (post-June 22):**
- Password reset flow
- Auto-select player by distance to pin
- Visual shot trail on map
- Individual player stats view
- Hole-by-hole scorecard
- Tournament stats and CSV export

**Total commits:** ~17 focused commits with working software at each stage.
