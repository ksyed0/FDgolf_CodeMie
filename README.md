# FDgolf — built with AI/RUN

Mobile-first tournament golf score tracking. GPS shot capture, Best Ball scoring, real-time leaderboards, and an admin panel — built to run a live tournament.

**First live event:** CIBC ARC Golf 2024 · Granite Ridge Golf Club, Milton ON · 22 June 2026
125 players · 32 teams · Best Ball · shotgun start · 18 holes

---

## Repository layout

```
FDgolf/
├── Claude/              # FDgolf tournament app + project management
│   ├── fdgolf-app/      # Next.js 14 App Router — the shipping app
│   └── docs/            # Specs, plans, release plan, PlanVisualizer output
└── CodeMie/             # Independent app (separate project)
```

`Claude/fdgolf-app/` is the deployable artifact. `Claude/docs/` holds the spec, release plan, and PlanVisualizer tooling. `CodeMie/` is an independent app sharing the same monorepo.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 App Router (TypeScript strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | Supabase — PostgreSQL, Auth, Realtime, Storage |
| Mapping | Mapbox GL JS with custom golf course style |
| Client state | Zustand (round tracking only) |
| Offline | IndexedDB shot queue (Phase 1); Service Worker (Phase 2) |

---

## Getting started

### Prerequisites

- Node.js 20+
- npm 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- A Mapbox account with a public token

### Local dev setup

```bash
# 1. Install dependencies
cd Claude/fdgolf-app
npm install

# 2. Configure environment
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_MAPBOX_TOKEN

# 3. Start Supabase locally
supabase start
# Outputs local URL + anon key — paste these into .env.local

# 4. Run migrations
supabase db push

# 5. Start the dev server
npm run dev
# → http://localhost:3000
```

### Useful commands

```bash
# Run from Claude/fdgolf-app/
npm run dev        # dev server with HMR
npm run build      # production build
npx tsc --noEmit   # type-check without building
supabase start     # local Supabase (Postgres + Auth + Storage)
supabase stop      # stop local Supabase

# Run from Claude/ for project management
npm run plan:generate    # regenerate plan-status.html
npm run dashboard:watch  # live SDLC dashboard
```

---

## Features (Phase 1)

### Round tracking
- GPS shot capture with club selection
- Outcomes: In Play · Out of Bounds (+1 penalty, rehit prompt) · Mulligan (no stroke) · Shot Sunk
- Shot edit with full audit trail
- Foursome turn picker — auto-selects farthest player from pin; manual override

### Scoring
- Best Ball engine as PostgreSQL RPC functions
- Provisional vs final hole states
- Real-time team standings
- Variable team size (2–5 players)

### Leaderboard
- Post-login view with sticky current-team card
- Public shareable URL at `/t/[slug]/leaderboard` (no auth required)
- Supabase Realtime channel subscription with client coalescing
- 30-second polling fallback when websocket disconnects

### Admin panel
- Live ops dashboard: players active, avg pace, sync issues
- Score editor with per-shot audit trail
- Player management: search, edit, team assignment
- Tournament setup wizard: course holes, satellite pin drop, activation checklist
- Master club list management

### Offline
- IndexedDB write-through: shots written locally first, then synced to Supabase
- `updated_at`-newer-wins conflict resolution (admin edits always win)
- Offline banner with queue depth indicator

---

## App routes

| Route | Access | Notes |
|---|---|---|
| `/` | Public | Tournament list / landing |
| `/t/[slug]/leaderboard` | Public | Shareable leaderboard, SSR |
| `/login` | Public | Email + password |
| `/register/[slug]` | Public | 4-step invite-driven registration |
| `/round` | Auth | Active round tracking (PWA shell) |
| `/admin/*` | Admin role | Tournament ops, scores, players |
| `/profile` | Auth | Player profile + history |

---

## Data model highlights

Core entities: `tournaments` · `courses` · `holes` · `players` · `teams` · `rounds` · `shots` · `hole_scores` · `team_hole_scores` · `clubs`

- Row Level Security on every table — tournament isolation built-in
- `shot_edits` audit table on every score change
- `team_hole_scores` maintained by a trigger calling `calc_best_ball_for_hole(team_id, hole_number)`
- Public leaderboard endpoint exposes name + company only (email, phone, DOB stripped server-side)

---

## Project status

| Epic | Scope | Status |
|---|---|---|
| E1 Foundation & Infrastructure | Scaffold, schema, auth, Mapbox, clubs | In progress |
| E2 Tournament Setup | Create / configure / activate tournament | Planned |
| E3 Registration & Profile | 4-step registration, captain mode | Planned |
| E4 Pre-Round Setup | Tournament home, bag confirmation | Planned |
| E5 Round Tracking | GPS, shots, outcomes, turn picker | Planned |
| E6 Scoring Engine | Best Ball RPC, standings view | Planned |
| E7 Leaderboard | Public + post-login, Realtime | Planned |
| E8 Admin Operations | Dashboard, players, score editor | Planned |
| E9 Offline & Sync | IndexedDB queue, sync-on-reconnect | Planned |
| E10 Security & 2FA | SMS 2FA, audit log, disputes | Phase 2 |

89 user stories · 273 tasks · **hard ship date: 2026-06-22**

---

## Project management

Implementation is driven by an agentic pipeline. Specs, plans, and the release plan live in `Claude/`:

```
Claude/
├── docs/RELEASE_PLAN.md             # all epics, stories, ACs, tasks
├── docs/superpowers/specs/          # per-story design specs
├── docs/superpowers/plans/          # per-story implementation plans
├── progress.md                      # session log
└── docs/ID_REGISTRY.md              # artefact ID sequences (never skip)
```

To regenerate the visual plan dashboard:

```bash
cd Claude
npm run plan:generate
# → docs/plan-status.html
```

---

## Phase 2 (post-tournament)

SMS 2FA · Stroke Gross / Net / Stableford formats · Score attestation · Service Worker (background sync) · Stats page + CSV export · QR code for public leaderboard · Individual leaderboard toggle · Sponsor logo upload UI
