# FDgolf — CodeMie

Tournament scoring app for the **CIBC Capital Markets Golf Tournament**
June 22 2026 · Granite Ridge Golf Club, Milton ON · 125 players · Best Ball + Shotgun Start

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | Supabase (Postgres, Auth, Realtime, Edge Functions) |
| Offline | localStorage sync queue with retry backoff |
| GPS | Google Maps JS API + Haversine distance |
| Deploy | Vercel |

---

## Quick Start

```bash
cd CodeMie
cp .env.local.example .env.local   # fill in Supabase + Google Maps keys
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-side only (magic link API)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

---

## Project Structure

```
CodeMie/
├── src/
│   ├── app/
│   │   ├── (auth)/         # Login, register, magic-link landing
│   │   ├── (player)/       # Dashboard, round scoring, leaderboard, scorecard
│   │   ├── (admin)/        # Tournament, players, teams, holes, clubs, sponsors, scores
│   │   ├── api/            # Route handlers (shots, magic-link)
│   │   └── live/[slug]/    # Public leaderboard (no auth)
│   ├── components/         # Shared UI components
│   ├── hooks/              # use-gps, use-realtime-scores, use-sync-engine
│   └── lib/
│       ├── gps.ts          # Haversine distance util
│       ├── scoring.ts      # Best Ball + vs-par formatting
│       ├── sync-engine.ts  # Offline write queue (singleton)
│       ├── types.ts        # All TypeScript entity types
│       └── supabase/       # SSR client, server client, middleware
├── supabase/
│   ├── migrations/         # 001 schema, 002 leaderboard RPC, 003 pause state
│   ├── functions/          # calculate-best-ball Deno Edge Function
│   └── seed.sql            # CIBC tournament seed data
└── docs/
    ├── ux-review/          # UX review HTML for stakeholder walkthrough
    └── sdlc-status.json    # Live SDLC phase tracker
```

---

## Database Schema

9 tables: `tournaments`, `holes`, `teams`, `players`, `clubs`, `round_state`, `shots`, `scores`, `sponsors`

Key design decisions:
- **Best Ball** is calculated server-side via a Deno Edge Function (bypasses RLS with service role key)
- **Offline-first**: all shot writes go through the `SyncEngine` localStorage queue; flushes on reconnect
- **Realtime leaderboard**: 5-second debounce on the Supabase channel subscription to prevent 125-client storm

---

## Scripts

```bash
npm run dev           # dev server
npm run build         # production build
npm run test          # Jest unit tests (watch)
npm run test:ci       # Jest with coverage (CI)
npm run plan:generate # regenerate docs/plan-status.html dashboard
```

---

## Architecture

```
Player phone
  └─ (browser) Next.js App
       ├─ localStorage queue (SyncEngine) ──► Supabase REST
       ├─ GPS (navigator.geolocation + Google Maps)
       └─ Realtime subscription ◄── Supabase Realtime
                                        └─ Edge Function (Best Ball calc)
```

---

## Tournament Day Flow

1. **Setup** (June 21): Admin creates tournament, configures 18 holes + GPS pins, imports player list, assigns teams + starting holes
2. **Registration** (morning of June 22): Admin sends magic link to each player's email; players complete profile on their own device
3. **Shotgun Start**: All 32 teams tee off simultaneously from their assigned hole
4. **Scoring**: One phone per foursome; player selects who hit, records club + outcome, GPS auto-fills position
5. **Leaderboard**: Live updates every 5s on `/live/<slug>` — projectable at the clubhouse
6. **Completion**: Admin marks tournament complete; scores archived; CSV export available

---

## Testing

```
Tests:    59 passing
Coverage: stmts 86.9% | branches 89.74% | fns 80.95% | lines 89.47%
```

Coverage targets: ≥80% statements/functions/lines, ≥70% branches (CI enforced).
