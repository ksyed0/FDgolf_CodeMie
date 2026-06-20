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
./scripts/reset-and-seed.sh         # full reset + all migrations + master seed + test users
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
├── migrations/         # 001 schema → 010 public read shots (10 total)
├── functions/          # calculate-best-ball Deno Edge Function
├── seed.sql            # CIBC tournament, 18 holes, 21 clubs, 18 tee boxes, 3 sponsors
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

## Local Database

### Reset and seed

```bash
./scripts/reset-and-seed.sh
```

Drops all data, re-applies all migrations, then loads:

| What | Source |
|------|--------|
| 1 venue (Granite Ridge Golf Club) | migration 007 |
| 1 course (Main Course, 18 holes, par 72) | migration 007 |
| 18 holes with GPS pins + Blue tee boxes | `seed.sql` |
| 21 clubs (all categories) | `seed.sql` |
| 3 sponsors (CIBC Capital Markets, Deloitte, Manulife) | `seed.sql` |
| 1 tournament (CIBC 2026, activated) | `seed.sql` + `seed-users.ts` |
| 5 test users + 2 teams | `seed-users.ts` |

Test credentials (password `Password1!`):

```
admin@fdgolf.local   →  /admin dashboard
alice@fdgolf.local   →  Team Alpha (captain)
john@fdgolf.local    →  Team Alpha
bob@fdgolf.local     →  Team Bravo (captain)
jane@fdgolf.local    →  Team Bravo
```

### Play simulation (scores + shots)

After a fresh reset the leaderboard is empty — no scores or shots exist yet. Two ways to populate them:

**Option A — Demo seed script** (fast, 4 teams, 9 holes of data):

```bash
npx tsx scripts/seed-tv-data.ts
```

Inserts 4 additional teams, 8 demo players, 72 best-ball scores across 9 holes, and ~50 GPS shots with realistic club distribution and 5 OB outcomes. All TV leaderboard panels (birdies, hole difficulty, shot stats, team spotlight) become populated immediately.

**Option B — Playwright lifecycle test** (full end-to-end, 2 teams, 3 holes each):

```bash
# Prerequisite: SUPABASE_SERVICE_ROLE_KEY set in .env.local
npx tsx scripts/reset-lionhead.ts    # seeds a separate Lionhead tournament fixture
npx playwright test --project=chromium-lifecycle
```

Drives a real browser through the full admin → player flow: venue → course → holes → tournament → teams → players → shot recording → leaderboard verification. Use `--headed` to watch it run.

### What gets created by actual gameplay

Once players are in the app, the following populate automatically — no seeding needed:

| Table | Created by |
|-------|-----------|
| `shots` | Player taps shot outcome on `/round` (via SyncEngine → `POST /api/shots`) |
| `scores` | `calculate-best-ball` Edge Function fires after each sunk shot |
| `round_states` | Created on-demand when a player opens the round page |

`sponsors` and `tee_boxes` are the only tables that must be seeded or configured by an admin before the event — they are never created by gameplay.

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

./scripts/reset-and-seed.sh         # full DB reset + seed (local Supabase)
npx tsx scripts/seed-tv-data.ts     # optional: add demo scores + shots for TV panels
npx tsx scripts/reset-lionhead.ts   # seed Lionhead fixture for lifecycle E2E tests
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

### Unit tests (Jest)

```bash
npm run test:ci
```

```
Test suites: 8 passed
Tests:       145 passed
Coverage:    stmts 92% | branches 80% | fns 90% | lines 97%
```

Coverage targets (CI enforced): ≥80% statements/functions/lines, ≥70% branches.

### E2E tests (Playwright)

**Prerequisites**: local Supabase running + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

```bash
# Install browsers (first time only)
npx playwright install chromium

# Reset + seed the database
./scripts/reset-and-seed.sh

# Run all non-lifecycle specs (auth, admin, players, round, leaderboard, TV)
npx playwright test --project=chromium-desktop --project=chromium-mobile \
                    --project=chromium-auth --project=chromium-tv

# Run only the admin page tests
npx playwright test --project=chromium-desktop tests/e2e/admin.spec.ts

# Run with visible browser
npx playwright test --headed
```

E2E projects and what they cover:

| Project | Spec files | Auth |
|---------|-----------|------|
| `chromium-auth` | `auth.spec.ts` | Login / register / middleware guards |
| `chromium-desktop` | `admin.spec.ts` | All 7 admin pages (TC-0047–TC-0089) |
| `chromium-mobile` | `dashboard`, `leaderboard`, `round-scoring`, `scorecard` | Player flows |
| `chromium-tv` | `tv-leaderboard.spec.ts` | Public TV display (1920×1080) |
| `chromium-lifecycle` | `tournament-lifecycle.spec.ts` | Full admin→player flow (serial) |

### Tournament Lifecycle E2E

Full end-to-end flow against a real local database — venue → course → holes → tournament → teams → players → scoring → leaderboard:

```bash
npx tsx scripts/reset-lionhead.ts   # seed Lionhead fixture (idempotent)
npx playwright test --project=chromium-lifecycle
npx playwright test --project=chromium-lifecycle --headed   # with visible browser
```
