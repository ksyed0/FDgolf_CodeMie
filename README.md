# FDgolf — CodeMie

Tournament scoring app for the **CIBC Capital Markets Golf Tournament**
June 22 2026 · Granite Ridge Golf Club, Milton ON · 125 players · Best Ball + Shotgun Start

**Live app**: https://fdgolfcm.vercel.app
**Live leaderboard**: https://fdgolfcm.vercel.app/live/cibc-granite-ridge-2026

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | Supabase (Postgres, Auth, Realtime, Edge Functions) |
| Maps | Mapbox (`react-map-gl`) — satellite view for shot tracking + pin editor |
| Offline | localStorage sync queue with retry backoff |
| GPS | `navigator.geolocation` + Haversine distance |
| Deploy | Vercel |

---

## Quick Start

```bash
cp .env.local.example .env.local   # fill in keys (see Environment Variables)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For local Supabase (optional — required for E2E tests):

```bash
supabase start                      # starts local containers on ports 54341–54349
npx tsx supabase/seed-users.ts      # creates 5 test users + teams
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full local setup and [Claude Code setup instructions](CONTRIBUTING.md#contributing-with-claude-code).

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=           # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # public anon key
SUPABASE_SERVICE_ROLE_KEY=          # server-side only (magic link API + Edge Function)
NEXT_PUBLIC_MAPBOX_TOKEN=           # public token — satellite map in shot tracking + pin editor
```

Copy `.env.local.example` and fill in values. Production values are set in Vercel.

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/         # Login, register, magic-link landing
│   ├── (player)/       # Dashboard, round scoring, leaderboard, scorecard
│   ├── (admin)/        # Tournament, venues, courses, players, teams, holes, clubs, sponsors, scores
│   ├── api/            # Route handlers (shots, magic-link)
│   └── live/[slug]/    # Public leaderboard (no auth)
├── components/         # Shared UI components
├── hooks/              # use-gps, use-realtime-scores, use-sync-engine
└── lib/
    ├── gps.ts          # Haversine distance util
    ├── scoring.ts      # Best Ball + vs-par formatting
    ├── sync-engine.ts  # Offline write queue (singleton)
    ├── types.ts        # All TypeScript entity types
    └── supabase/       # SSR browser + server clients, middleware helper
supabase/
├── migrations/         # 001 schema → 008 leaderboard RPC update (8 total)
├── functions/          # calculate-best-ball Deno Edge Function
├── seed.sql            # CIBC tournament, 18 holes, 21 clubs
└── seed-users.ts       # Creates 5 test auth users + teams (local + cloud)
docs/
├── ARCHITECTURE.md     # Detailed system architecture
├── RELEASE_PLAN.md     # Feature backlog + AC tracking
└── AI_COST_LOG.md      # Per-session token cost log
```

---

## Database Schema

12 tables across two logical groups:

**Master data** (venue → course → hole → tee box):
`venues`, `courses`, `holes`, `tee_boxes`

**Tournament data**:
`tournaments`, `teams`, `players`, `clubs`, `round_state`, `shots`, `scores`, `sponsors`

Key design decisions:
- **Best Ball** calculated server-side via Deno Edge Function (bypasses RLS with service role key)
- **Offline-first**: all shot writes queue through `SyncEngine` → localStorage; flushes on reconnect, max 5 retries
- **Realtime leaderboard**: 5-second debounce on Supabase channel to prevent 125-client subscription storm
- **Deferred captain FK**: `teams.captain_id` → `players` added via `ALTER TABLE` after both tables exist (circular reference)

---

## Scripts

```bash
npm run dev             # dev server (http://localhost:3000)
npm run build           # production build (type-check + compile)
npm run lint            # ESLint via next lint
npm run type-check      # tsc --noEmit
npm run test            # Jest watch
npm run test:ci         # Jest --ci --coverage --forceExit
npm run plan:generate   # regenerate docs/plan-status.html dashboard
```

---

## Architecture

```
Player phone
  └─ Next.js browser
       ├─ SyncEngine (localStorage queue) ──► Supabase REST ──► DB
       ├─ GPS (navigator.geolocation + Haversine)
       └─ useRealtimeScores (5s debounce) ◄── Supabase Realtime
                                                  └─ calculate-best-ball (Deno Edge Fn)
```

---

## Tournament Day Flow

1. **Setup** (June 21): Admin creates tournament, configures 18 holes + GPS pins via Courses admin, imports player list, assigns teams + starting holes
2. **Registration** (morning of June 22): Admin sends magic link to each player's phone; players complete profile on their own device
3. **Shotgun Start**: All teams tee off simultaneously from assigned holes
4. **Scoring**: One phone per foursome; player records club + outcome, GPS auto-fills shot position
5. **Leaderboard**: Live updates on `/live/cibc-granite-ridge-2026` — projectable at the clubhouse
6. **Completion**: Admin marks tournament complete; scores archived

---

## Testing

```
Test suites: 6 passed
Tests:       81 passed
Coverage:    stmts 84.28% | branches 86.20% | fns 80% | lines 87.09%
```

Coverage targets (CI enforced): ≥80% statements/functions/lines, ≥70% branches.
