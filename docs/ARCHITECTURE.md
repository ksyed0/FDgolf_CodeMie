# FDgolf — Architecture

CIBC Capital Markets Golf Tournament · June 22 2026 · Granite Ridge Golf Club, Milton ON

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Tech Stack](#tech-stack)
3. [Application Architecture](#application-architecture)
4. [Route & Auth Flow](#route--auth-flow)
5. [Database Schema](#database-schema)
6. [Shot Recording Flow](#shot-recording-flow)
7. [Offline Sync Engine](#offline-sync-engine)
8. [Real-time Leaderboard](#real-time-leaderboard)
9. [User Journeys](#user-journeys)
10. [Key Design Decisions](#key-design-decisions)

---

## System Overview

FDgolf is a mobile-first tournament scoring app. One phone per foursome records shots during a shotgun-start Best Ball round; scores propagate in real time to a public leaderboard projected at the clubhouse.

```mermaid
graph TD
    P[Player Phone\nNext.js PWA] -->|Shot data| SE[SyncEngine\nlocalStorage queue]
    SE -->|POST /api/shots| SB_REST[Supabase REST]
    SB_REST -->|insert| DB[(Postgres)]
    DB -->|trigger| EF[calculate-best-ball\nDeno Edge Function]
    EF -->|UPDATE scores.is_best_ball| DB
    DB -->|broadcast| RT[Supabase Realtime]
    RT -->|5 s debounce| LB[Leaderboard UI\n/live/slug]
    P -->|GPS position| GM[Google Maps\nHaversine distance]
    ADMIN[Admin Browser] -->|manage tournament| SB_REST
```

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 14 App Router + TypeScript | Server components for data fetching; client components for interactive UI |
| Styling | Tailwind CSS v3 + shadcn/ui | Radix-based components; default style (not new-york) for Tailwind v3 compatibility |
| Auth | Supabase Auth + `@supabase/ssr` | Cookie-based sessions; magic link for player registration |
| Database | Supabase Postgres | RLS on all tables; service role key used only in Edge Function |
| Realtime | Supabase Realtime | Scores channel with 5 s client-side debounce |
| Offline | `localStorage` write queue | `SyncEngine` singleton; auto-flush on reconnect; max 5 retries |
| GPS | Google Maps JS API v2 + Haversine | SSR-safe dynamic import; `useRef` cache prevents re-loads |
| Deploy | Vercel | ISR on `/live/[slug]` (revalidate 30 s) |

---

## Application Architecture

Route groups map to user roles:

```mermaid
graph LR
    subgraph Public
        LIVE["/live/[slug]\nLeaderboard ISR"]
        LOGIN["/login\n/register\n/auth/magic-link"]
    end

    subgraph Player [Player — authenticated]
        DASH["/dashboard\nTeam + tournament info"]
        ROUND["/round\nShot recording"]
        LB["/leaderboard\nReal-time scores"]
        SC["/scorecard\nHole-by-hole view"]
    end

    subgraph Admin [Admin role only]
        AT["/admin/tournament"]
        AP["/admin/players"]
        ATE["/admin/teams"]
        AH["/admin/holes"]
        AC["/admin/clubs"]
        AS["/admin/scores"]
        ASP["/admin/sponsors"]
    end

    subgraph API
        SHOTS["POST /api/shots"]
        ML["POST /api/magic-link"]
    end
```

### Component Layers

```
src/
├── app/                    # Pages (server components by default)
│   ├── (auth)/             # Login, register, magic-link handler
│   ├── (player)/           # Dashboard, round, leaderboard, scorecard
│   ├── (admin)/            # 7 admin management pages
│   ├── api/                # Route handlers (Node.js runtime)
│   └── live/[slug]/        # Public leaderboard (ISR, no auth)
├── components/             # Shared UI
│   ├── app-header.tsx      # Full/compact variants + AI/Run™ pill
│   ├── hole-map.tsx        # Google Maps (dynamic import, SSR-safe)
│   ├── leaderboard-table.tsx
│   ├── offline-indicator.tsx
│   └── ...
├── hooks/
│   ├── use-gps.ts          # navigator.geolocation wrapper
│   ├── use-realtime-scores.ts  # Supabase channel + 5 s debounce
│   └── use-sync-engine.ts  # useSyncExternalStore adapter
└── lib/
    ├── types.ts            # All 9 entity interfaces
    ├── scoring.ts          # Best Ball calculation utilities
    ├── sync-engine.ts      # Offline write queue singleton
    ├── gps.ts              # GpsPosition + Haversine
    └── supabase/           # client.ts, server.ts, middleware.ts
```

---

## Route & Auth Flow

Middleware (`src/lib/supabase/middleware.ts`) runs on every non-static request:

```mermaid
flowchart TD
    REQ[Incoming Request] --> CHK{Authenticated?}

    CHK -- No --> ISPUB{Public route?\n/live/* or /login or /register}
    ISPUB -- Yes --> ALLOW[Allow]
    ISPUB -- No --> REDIR_LOGIN[Redirect → /login]

    CHK -- Yes --> ISAUTH{Auth route?\n/login or /register}
    ISAUTH -- Yes --> REDIR_DASH[Redirect → /dashboard]
    ISAUTH -- No --> ISADMIN{/admin/* ?}

    ISADMIN -- No --> ALLOW
    ISADMIN -- Yes --> ROLECHECK{players.role\n= 'admin'?}
    ROLECHECK -- Yes --> ALLOW
    ROLECHECK -- No --> REDIR_DASH
```

### Magic Link Registration Flow

```mermaid
sequenceDiagram
    participant A as Admin
    participant API as POST /api/magic-link
    participant SB as Supabase Auth
    participant E as Player Email
    participant P as Player Browser

    A->>API: POST {email, player_id}
    API->>SB: generateLink (service role key)
    SB-->>API: magic link URL
    API->>E: Send email with link
    P->>SB: Click link → session created
    P->>P: Redirect to /auth/magic-link
    P->>P: Complete profile → /dashboard
```

---

## Database Schema

9 tables. All have RLS enabled; all reads are public; writes are restricted by role.

```mermaid
erDiagram
    tournaments {
        uuid id PK
        text name
        text slug UK
        date date
        text format
        text venue
        text status "setup|active|paused|completed"
    }

    holes {
        uuid id PK
        uuid tournament_id FK
        int hole_number
        int par
        int handicap
        float pin_lat
        float pin_lng
    }

    teams {
        uuid id PK
        uuid tournament_id FK
        int team_number
        text team_name
        int starting_hole
        int max_players "2..6 default 4"
        uuid captain_id FK "deferred → players"
    }

    players {
        uuid id PK
        uuid auth_user_id UK
        text name
        text email UK
        uuid team_id FK
        text role "player|admin|tournament_organizer"
    }

    clubs {
        uuid id PK
        text name
        text category "wood|hybrid|iron|wedge|putter"
        int sort_order
        bool is_active
    }

    round_states {
        uuid id PK
        uuid team_id FK UK
        int current_hole
        uuid active_player_id FK
        text status "not_started|in_progress|completed"
    }

    shots {
        uuid id PK
        uuid player_id FK
        uuid tournament_id FK
        int hole_number
        int shot_number
        text club_name
        float start_lat
        float start_lng
        text outcome "in_play|out_of_bounds|mulligan|sunk"
    }

    scores {
        uuid id PK
        uuid player_id FK
        uuid team_id FK
        uuid tournament_id FK
        int hole_number
        int strokes
        bool is_best_ball
        uuid override_by FK
    }

    sponsors {
        uuid id PK
        uuid tournament_id FK
        text name
        text logo_url
        int display_order
        bool is_active
    }

    tournaments ||--o{ holes : "has"
    tournaments ||--o{ teams : "has"
    tournaments ||--o{ scores : "has"
    tournaments ||--o{ sponsors : "has"
    teams ||--o{ players : "contains"
    teams ||--|| round_states : "has"
    teams ||--o{ scores : "receives"
    players ||--o{ shots : "records"
    players ||--o{ scores : "has"
    players }o--|| teams : "captains"
```

### Key Database Notes

- **`teams.captain_id`** has no inline FK. The constraint `fk_teams_captain` is added via `ALTER TABLE` after both `teams` and `players` exist (circular dependency).
- **`scores.is_best_ball`** is set exclusively by the `calculate-best-ball` Deno Edge Function using the service role key — never set directly by the client.
- **`scores.override_by` / `override_at`** provide an audit trail for admin score corrections.
- **`get_leaderboard(tournament_id)`** RPC joins `teams → scores (is_best_ball=true) → holes` and returns rows sorted ascending by `(total_score - par_total)`.

---

## Shot Recording Flow

The round page is the core user interaction. One phone per foursome records every shot.

```mermaid
sequenceDiagram
    participant U as Player UI
    participant GE as SyncEngine
    participant LS as localStorage
    participant API as POST /api/shots
    participant DB as Supabase DB
    participant EF as calculate-best-ball\nEdge Function
    participant RT as Supabase Realtime

    U->>U: Select active player, club, outcome
    U->>GE: syncEngine.enqueue('shots', payload)
    GE->>LS: Persist queue entry {id, retries:0}
    GE->>API: flush() → POST /api/shots
    API->>DB: Insert into shots
    DB-->>API: {id}
    API->>EF: Invoke calculate-best-ball
    EF->>DB: SELECT shots WHERE team+hole
    EF->>DB: UPDATE scores SET is_best_ball
    DB->>RT: Broadcast scores change
    RT->>U: useRealtimeScores fires (after 5 s debounce)
    U->>DB: get_leaderboard() RPC
    DB-->>U: Updated standings
```

---

## Offline Sync Engine

`SyncEngine` (`src/lib/sync-engine.ts`) is a singleton that survives page refreshes via `localStorage`.

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Queued : enqueue(table, payload)
    note right of Queued : Persisted to localStorage\nflush() called immediately

    Queued --> Flushing : online + not processing
    Flushing --> Idle : All items synced
    Flushing --> Retry : Supabase error
    Retry --> Flushing : retries < 5
    Retry --> Dropped : retries ≥ 5
    Dropped --> Idle : Entry removed from queue
```

- Auto-flush triggers: `window.addEventListener('online', ...)` and a 10 s `setInterval`.
- `OfflineIndicator` component reads `pendingCount` via `useSyncExternalStore` — no polling.

---

## Real-time Leaderboard

```mermaid
sequenceDiagram
    participant A as Any Client\n(player or /live)
    participant SB as Supabase Realtime\n(scores channel)
    participant DB as Postgres

    A->>SB: Subscribe to scores channel
    DB->>SB: Row change event (is_best_ball updated)
    SB->>A: Broadcast
    note over A: 5 s debounce — ignores\nsubsequent events
    A->>DB: get_leaderboard(tournament_id)
    DB-->>A: Ranked team standings
    A->>A: Re-render leaderboard table
```

The 5 s debounce in `useRealtimeScores` prevents a 125-client storm from all firing simultaneous RPC calls when a single score update arrives.

---

## User Journeys

### 1. Admin: Tournament Setup (June 21)

```mermaid
journey
    title Admin — Tournament Setup
    section Create Tournament
      Open /admin/tournament: 5: Admin
      Fill name, date, venue, slug: 4: Admin
      Set status to "setup": 5: Admin
    section Configure Course
      Add 18 holes with par + GPS pin coords: 3: Admin
      Verify hole map renders on HoleMap: 4: Admin
    section Manage Players
      Import player list /admin/players: 4: Admin
      Assign players to teams /admin/teams: 4: Admin
      Set starting holes per team: 5: Admin
    section Send Invites
      /admin/players → Send Magic Link per player: 4: Admin
      Players receive email, complete profiles: 5: Player
    section Go Live
      Set tournament status to "active": 5: Admin
```

### 2. Player: Tournament Day (June 22)

```mermaid
journey
    title Player — Tournament Day
    section Arrival
      Open magic link email: 5: Player
      Complete profile on own device: 4: Player
      Land on /dashboard, see team + starting hole: 5: Player
    section Shotgun Start
      Tap "Start Round" on /round: 5: Player
      GPS auto-fills position: 4: Player
    section Scoring (per shot)
      Select who hit the shot: 5: Player
      Choose club from grouped selector: 4: Player
      Tap outcome button (In Play/OOB/Mulligan/Sunk): 5: Player
      Shot queued + synced (or held offline): 4: Player
    section Hole Completion
      Last shot outcome "Sunk": 5: Player
      Advance to next hole: 5: Player
    section Finish
      All 18 holes recorded: 5: Player
      View /scorecard for hole-by-hole review: 4: Player
```

### 3. Clubhouse: Live Leaderboard

```mermaid
journey
    title Clubhouse — Leaderboard Display
    section Setup
      Open /live/slug on projector browser: 5: Organizer
      Page loads via ISR (no auth required): 5: Organizer
    section During Round
      Scores update automatically every 5 s: 5: Everyone
      Top-3 teams highlighted with colour borders: 4: Everyone
      Sponsor logos displayed in banner: 3: Sponsor
    section Post-Round
      Admin marks tournament "completed": 5: Admin
      Final standings frozen: 5: Everyone
```

### 4. Admin: Score Override

```mermaid
flowchart TD
    A[Admin opens /admin/scores] --> B[Finds incorrect score row]
    B --> C[Edits strokes value]
    C --> D[Save → POST to Supabase\nwith override_by + override_at]
    D --> E[calculate-best-ball re-runs for that team+hole]
    E --> F[is_best_ball flags recalculated]
    F --> G[Realtime broadcast → leaderboard updates]
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Best Ball calculated server-side (Deno Edge Function) | Min-stroke selection requires seeing all players' scores for a hole simultaneously; client can't do this safely without race conditions. Service role key bypasses RLS. |
| `SyncEngine` localStorage queue, max 5 retries | Offline-first: phone tunnels, crowd congestion, or bad signal on course. Queue survives page refresh. Items dropped after 5 failures to prevent infinite retry on bad data. |
| 5 s debounce on `useRealtimeScores` | 125 concurrent clients on a single Supabase Realtime channel; one score update would trigger 125 simultaneous `get_leaderboard()` RPC calls without it. |
| `supabase/functions` excluded from `tsconfig.json` | Deno Edge Functions use CDN imports (`https://esm.sh/...`) that are invalid in Node.js TypeScript. Separate compilation context required. |
| Deferred `fk_teams_captain` via `ALTER TABLE` | `teams` references `players` (captain) and `players` references `teams` (team_id) — a circular FK that can't be resolved with inline constraints. |
| Google Maps SDK loaded via `useRef` cache | The `@googlemaps/js-api-loader` is a stateful singleton; calling `load()` twice on the same page triggers billing events and console errors. `useRef` ensures a single load per component mount. |
| `live/[slug]` uses ISR (`revalidate: 30`) | Public leaderboard is projector-facing — must work even if the Supabase Realtime WebSocket drops. 30 s fallback ensures the page stays reasonably fresh without a persistent connection. |
| `scores` readable without auth (RLS public select) | The `/live/[slug]` route is unauthenticated; server component must be able to read scores to render the initial HTML for ISR. |
