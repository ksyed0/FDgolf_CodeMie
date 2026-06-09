# FDgolf — Design Specification

> Web-based golf score tracking app for the CIBC Capital Markets Golf Tournament at Granite Ridge Golf Club, Milton, ON — June 22, 2026.

---

## 1. Overview

**App name:** FDgolf  
**Tagline:** "Created by AI/Run™"  
**Format:** Best Ball, Shotgun Start, 18 holes  
**Scale:** ~125 players, ~31 teams of 4  
**Platform:** Mobile-first (iOS/Android browsers), responsive for tablet/desktop admin  
**Stack:** Next.js 14 (App Router) + Supabase (Postgres, Auth, Realtime, Storage) + Google Maps JS API + Vercel  

---

## 2. Architecture

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 App Router | React, file-based routing, SSR for public leaderboard |
| UI | shadcn/ui + Tailwind CSS | Mobile-first components, rapid iteration |
| Backend/DB | Supabase (Postgres + Auth + Realtime + Storage) | Auth, real-time leaderboard, file uploads (sponsor logos) |
| Maps | Google Maps JS API | GPS pins, hole layout, shot paths |
| Deploy | Vercel | One-push deploy, preview URLs |

### Routes

```
/                        → redirect based on auth state
/register                → player self-registration (3-step wizard)
/login                   → email/password login
/dashboard               → post-login hub (team info, round status, leaderboard link)
/round                   → active round tracking (main gameplay)
/leaderboard             → full tournament leaderboard (authenticated)
/live/[slug]             → public real-time leaderboard (no auth)
/admin                   → admin dashboard
/admin/tournament        → tournament configuration
/admin/players           → manage players, reset passwords, assign teams
/admin/teams             → create/edit teams, assign starting holes
/admin/holes             → configure par values, pin GPS coordinates
/admin/clubs             → manage club list
/admin/scores            → edit/override scores
/admin/sponsors          → upload logos, set display order
```

---

## 3. Data Model

```sql
tournaments
  id              uuid PK
  name            text
  slug            text UNIQUE        -- for public leaderboard URL
  date            date
  format          text               -- 'best_ball'
  venue           text
  status          text               -- 'setup' | 'active' | 'completed'
  created_at      timestamptz

holes
  id              uuid PK
  tournament_id   uuid FK → tournaments
  hole_number     int (1-18)
  par             int
  handicap        int
  pin_lat         float
  pin_lng         float

players
  id              uuid PK
  auth_user_id    uuid FK → auth.users
  name            text
  title           text
  company         text
  email           text UNIQUE
  phone           text
  year_of_birth   int (nullable)
  gender          text (nullable)    -- 'male' | 'female' | 'prefer_not_to_say'
  team_id         uuid FK → teams (nullable)
  role            text               -- 'player' | 'admin'
  created_at      timestamptz

teams
  id              uuid PK
  tournament_id   uuid FK → tournaments
  team_number     int
  team_name       text (nullable)
  starting_hole   int (1-18)

clubs
  id              uuid PK
  name            text
  category        text               -- 'wood' | 'hybrid' | 'iron' | 'wedge' | 'putter'
  sort_order      int
  is_active       boolean

round_state
  id              uuid PK
  team_id         uuid FK → teams
  current_hole    int
  active_player_id uuid FK → players (nullable)
  status          text               -- 'not_started' | 'in_progress' | 'completed'
  updated_at      timestamptz

shots
  id              uuid PK
  player_id       uuid FK → players
  tournament_id   uuid FK → tournaments
  hole_number     int
  shot_number     int
  club_name       text               -- denormalized from clubs at time of shot
  start_lat       float
  start_lng       float
  outcome         text               -- 'in_play' | 'out_of_bounds' | 'mulligan' | 'sunk'
  created_at      timestamptz

scores
  id              uuid PK
  player_id       uuid FK → players
  team_id         uuid FK → teams
  tournament_id   uuid FK → tournaments
  hole_number     int
  strokes         int
  is_best_ball    boolean
  override_by     uuid FK → players (nullable)  -- admin who overrode
  override_at     timestamptz (nullable)

sponsors
  id              uuid PK
  tournament_id   uuid FK → tournaments
  name            text
  logo_url        text               -- Supabase Storage public URL
  display_order   int
  is_active       boolean
```

### Best Ball Trigger Logic

When the last player on a team marks "Shot Sunk" on a hole:
1. Supabase Edge Function fires
2. Counts total strokes per player for that hole (excluding mulligans, including OOB penalties)
3. Lowest stroke count → `is_best_ball = true`
4. Broadcasts updated team score via Realtime
5. Leaderboard recalculates team position

---

## 4. Feature List

### 4.1 Registration & Auth

| # | Feature | Priority |
|---|---|---|
| 1.1 | Player self-registration (name, title, company, email, phone, gender, YOB) | P0 |
| 1.2 | Email/password login | P0 |
| 1.3 | Post-login redirect to dashboard | P0 |
| 1.4 | Admin-assigned roles (player vs admin) | P0 |
| 1.5 | Password reset (email link) | P1 |
| 1.6 | Phone-based 2FA (SMS OTP) | P2 |
| 1.7 | Magic link login (passwordless) | P2 |

### 4.2 Team Management

| # | Feature | Priority |
|---|---|---|
| 2.1 | Admin creates teams and assigns starting holes | P0 |
| 2.2 | Admin assigns players to teams | P0 |
| 2.3 | Player searches for and links to teammates during registration | P1 |
| 2.4 | Player can view their team and teammates from dashboard | P0 |
| 2.5 | Admin bulk "auto-assign starting holes" across 18 holes | P0 |

### 4.3 Active Round — Shot Tracking

| # | Feature | Priority |
|---|---|---|
| 3.1 | "Start Round" — confirms starting hole, initializes round state | P0 |
| 3.2 | GPS capture of current position on each shot | P0 |
| 3.3 | Google Maps display of player pin relative to hole | P0 |
| 3.4 | Club selection dropdown (from admin-managed list) | P0 |
| 3.5 | Shot outcome: In-Play, Out of Bounds, Mulligan, Shot Sunk | P0 |
| 3.6 | OOB logic: +1 penalty stroke, rehit from current or OOB position | P0 |
| 3.7 | Mulligan: no stroke counted, redo from same position | P0 |
| 3.8 | Shot Sunk: closes hole for that player | P0 |
| 3.9 | Edit/re-enter a previous shot (correct mistakes) | P0 |
| 3.10 | Auto-select next player (farthest from pin) | P1 |
| 3.11 | Manual player selection override (tap to switch active player) | P0 |
| 3.12 | Offline buffer: store shots in localStorage, sync when connectivity returns | P0 |
| 3.13 | Visual shot trail on map (shot-by-shot path per player for current hole) | P1 |

### 4.4 Hole & Round Flow

| # | Feature | Priority |
|---|---|---|
| 4.1 | Hole completion detection: all team members sunk | P0 |
| 4.2 | Best Ball auto-calculation on hole completion | P0 |
| 4.3 | Hole summary screen: each player's strokes, best ball highlighted | P0 |
| 4.4 | "Next Hole" advance (wraparound: start hole 10 → plays 10→18→1→9) | P0 |
| 4.5 | Round complete summary: all 18 holes, team total vs par | P0 |
| 4.6 | Mid-round access to tournament leaderboard | P0 |

### 4.5 Leaderboard

| # | Feature | Priority |
|---|---|---|
| 5.1 | Team leaderboard: ranked by cumulative best-ball score vs par | P0 |
| 5.2 | Top 20 teams displayed by default | P0 |
| 5.3 | Current player's team position always visible (even outside top 20) | P0 |
| 5.4 | Real-time updates via Supabase Realtime subscriptions | P0 |
| 5.5 | Individual player stats view (personal stroke count across all holes) | P1 |
| 5.6 | Hole-by-hole scorecard view per team | P1 |
| 5.7 | Public leaderboard: shareable URL, no auth required, real-time | P0 |
| 5.8 | Public URL format: `/live/{tournament-slug}` | P0 |
| 5.9 | Public view shows team rankings only (no player PII) | P0 |
| 5.10 | Sponsor logo banner on leaderboard (authenticated + public) | P0 |

### 4.6 Admin Dashboard

| # | Feature | Priority |
|---|---|---|
| 6.1 | Player management: view, edit details, reset passwords, assign teams | P0 |
| 6.2 | Score editing: override/correct any player's hole score | P0 |
| 6.3 | Club list management: add, edit, reorder, deactivate | P0 |
| 6.4 | Team management: create teams, assign players, assign starting holes | P0 |
| 6.5 | Tournament configuration: name, date, venue, format, slug | P0 |
| 6.6 | Hole setup: par values, pin GPS coordinates for all 18 holes | P0 |
| 6.7 | Sponsor management: upload logos, set display order, toggle visibility | P0 |
| 6.8 | Generate tournament stats (avg scores, longest drives, etc.) | P1 |
| 6.9 | Export scores to CSV | P1 |

### 4.7 Course & GPS Infrastructure

| # | Feature | Priority |
|---|---|---|
| 7.1 | Pre-seeded Granite Ridge hole data (par, approximate pin locations) | P0 |
| 7.2 | Google Maps embed showing current hole with pin location | P0 |
| 7.3 | Distance-to-pin calculation from player's GPS position | P1 |
| 7.4 | Admin can adjust pin GPS coordinates per hole | P0 |

---

## 5. UX Journeys

### 5.1 Registration (Pre-Tournament)

**Step 1 — Account:** Email, password, confirm password → "Continue"  
**Step 2 — Profile:** Name, title, company, mobile phone, year of birth (optional), gender (optional) → "Continue"  
**Step 3 — Team:** Enter team # (pre-assigned by admin) → teammates auto-populate; optional search to verify → "Complete Registration"  
**Post-registration:** Redirect to Dashboard with tournament countdown and team info.

### 5.2 Active Round — Shot Tracking (Core Gameplay)

```
START ROUND → confirm starting hole → init round state
    ↓
SELECT PLAYER → auto: farthest from pin | manual: tap pill
    ↓
SELECT CLUB → dropdown grouped by category
    ↓
CAPTURE SHOT → tap button → GPS recorded → pin on map
    ↓
SHOT OUTCOME → In-Play | Out of Bounds | Mulligan | Shot Sunk
    ↓
    ├── IN-PLAY → record → next player or walk to ball
    ├── OOB → +1 penalty → rehit (from OOB spot or original)
    ├── MULLIGAN → no stroke → redo from same spot
    └── SUNK → hole closed for player → next player or hole done
    ↓
All players sunk → HOLE SUMMARY → each player's strokes, best ball highlighted
    ↓
NEXT HOLE → advance → back to SELECT PLAYER
```

**Mobile layout:** Compact header (FDgolf | AI/Run | hole info) → Map (top 35%) → Player pills → Club dropdown → Action button (bottom 60% thumb zone).

**Two-tap flow:** Capture GPS → Outcome. Minimal interaction under sun glare.

**Offline resilience:** localStorage buffer, sync on reconnect, visual indicator when offline.

### 5.3 Leaderboard

**Authenticated view:** Header → Sponsor bar → Live indicator → Team rankings (top 20) → "Your Team ★" pinned with green highlight (even if outside top 20). Tap team to expand individual scores.

**Public view (`/live/slug`):** Same layout, no user avatar (replaced with LIVE badge), no "Your Team" pin. Shareable URL for spectators and venue screens.

**Score display:** Relative to par (−8 = 8 under). Green = under, red = over. "Thru" column shows holes completed for fairness context.

**Real-time:** Supabase Realtime subscription pushes scores as holes complete.

### 5.4 Admin Dashboard

**Layout:** Desktop-first sidebar navigation. FDgolf + AI/Run branding at top, First Derivative logo at bottom.

**Sections:** Tournament, Players, Teams, Holes, Clubs, Scores, Sponsors, Leaderboard.

**Player management:** Searchable table (125 players), edit modal (all fields + team assignment dropdown + password reset).

**Team management:** List of teams with player pills, starting hole, open slots highlighted. Edit modal: add/remove players (search unassigned), set starting hole, optional team name.

**Score override:** Select team → select hole → edit individual strokes → "Recalculate Best Ball" → changes push immediately to live leaderboard. All overrides logged (audit trail).

**Sponsor management:** Drag-to-reorder list, logo upload (PNG/SVG → Supabase Storage), live preview of leaderboard sponsor bar.

---

## 6. Branding

| Element | Treatment |
|---|---|
| App name | "FDgolf" — bold white, always leftmost in header |
| Attribution | "created by AI/Run™" with glowing ring icon, adjacent to app name |
| Header bar | Dark green (#1a472a), consistent on every screen |
| Full header | Dashboard, Leaderboard, Login — full "FDgolf | created by AI/Run™" |
| Compact header | Active Round — condensed "FDgolf [dot] AI/Run™" + hole info |
| Public view | Same header, LIVE badge replaces user avatar |
| Admin sidebar | FDgolf + AI/Run at top, First Derivative wordmark at bottom |
| Sponsor bar | Below header on leaderboards, logos from admin-managed list |

---

## 7. Epics & Stories

### EPIC-1: Project Setup & Infrastructure

| Story | Description | Size |
|---|---|---|
| US-1.1 | Initialize Next.js 14 project with App Router, Tailwind, shadcn/ui | S |
| US-1.2 | Set up Supabase project (Postgres, Auth, Realtime, Storage) | S |
| US-1.3 | Create database schema (all tables, RLS policies, indexes) | M |
| US-1.4 | Configure Vercel deployment with Supabase env vars | S |
| US-1.5 | Set up Google Maps JS API key and wrapper component | S |
| US-1.6 | Seed clubs table with standard club list | XS |
| US-1.7 | Seed Granite Ridge hole data (par values, approximate pin GPS) | S |
| US-1.8 | Create shared header component (FDgolf + AI/Run branding, two sizes) | S |

### EPIC-2: Registration & Authentication

| Story | Description | Size |
|---|---|---|
| US-2.1 | Registration page — Step 1: email/password account creation via Supabase Auth | S |
| US-2.2 | Registration page — Step 2: profile info (name, title, company, phone, YOB, gender) | S |
| US-2.3 | Registration page — Step 3: team linking (enter team #, see teammates) | M |
| US-2.4 | Login page with email/password | S |
| US-2.5 | Auth middleware: protect routes, redirect unauthenticated users | S |
| US-2.6 | Role-based access: admin vs player route guards | S |
| US-2.7 | Password reset flow (email link) | S |
| US-2.8 | Phone-based 2FA via Supabase Auth (SMS OTP) | M |

### EPIC-3: Player Dashboard

| Story | Description | Size |
|---|---|---|
| US-3.1 | Dashboard page: welcome, tournament info, team display | S |
| US-3.2 | "Start Round" button with starting hole confirmation | S |
| US-3.3 | Quick-access leaderboard link from dashboard | XS |

### EPIC-4: Active Round — Shot Tracking

| Story | Description | Size |
|---|---|---|
| US-4.1 | Round initialization: create round_state record, set starting hole | S |
| US-4.2 | Google Maps component showing current hole with pin marker | M |
| US-4.3 | GPS location capture (browser Geolocation API) with permission handling | M |
| US-4.4 | Player selector (pills showing team members, active state, completed state) | S |
| US-4.5 | Club selection dropdown grouped by category | S |
| US-4.6 | "Capture Shot" button: record GPS + create shot record | M |
| US-4.7 | Shot outcome buttons (In-Play, OOB, Mulligan, Sunk) with logic | M |
| US-4.8 | OOB handling: +1 penalty stroke, rehit position selection | M |
| US-4.9 | Mulligan handling: discard shot, re-do from same position | S |
| US-4.10 | Shot Sunk: close hole for player, update scores table | S |
| US-4.11 | Edit/re-enter previous shot (tap shot history, modify) | M |
| US-4.12 | Auto-select next player based on distance to pin | M |
| US-4.13 | Offline buffer: localStorage write on capture, background sync | L |
| US-4.14 | Visual shot trail on map (polyline per player) | M |

### EPIC-5: Hole & Round Completion

| Story | Description | Size |
|---|---|---|
| US-5.1 | Hole completion detection (all team members sunk) | S |
| US-5.2 | Best Ball calculation Edge Function | M |
| US-5.3 | Hole summary screen (strokes per player, best ball highlighted) | S |
| US-5.4 | "Next Hole" navigation (wraparound: team starting hole 10 plays 10→18→1→9) | S |
| US-5.5 | Round complete summary (all 18 holes, team total vs par) | M |

### EPIC-6: Leaderboard

| Story | Description | Size |
|---|---|---|
| US-6.1 | Team leaderboard page: ranked list, score vs par, holes completed | M |
| US-6.2 | "Your Team" pinned row (always visible for logged-in player) | S |
| US-6.3 | Supabase Realtime subscription for live score updates | M |
| US-6.4 | Public leaderboard route `/live/[slug]` — no auth, same UI | S |
| US-6.5 | Sponsor logo banner component (fetches from sponsors table) | S |
| US-6.6 | Individual player stats view | M |
| US-6.7 | Hole-by-hole scorecard view per team | M |

### EPIC-7: Admin — Tournament & Course Setup

| Story | Description | Size |
|---|---|---|
| US-7.1 | Admin layout: sidebar navigation with branding | S |
| US-7.2 | Tournament configuration page (name, date, venue, format, slug) | S |
| US-7.3 | Hole management page: edit par, handicap, pin GPS per hole | M |
| US-7.4 | Club management page: CRUD, reorder, activate/deactivate | S |

### EPIC-8: Admin — Player & Team Management

| Story | Description | Size |
|---|---|---|
| US-8.1 | Player list page: searchable table, status indicators | M |
| US-8.2 | Player edit modal: all fields + team assignment dropdown | S |
| US-8.3 | Admin password reset for players | S |
| US-8.4 | Team list page: teams with player pills, starting holes, open slots | M |
| US-8.5 | Team edit modal: add/remove players (search unassigned), set starting hole | M |
| US-8.6 | "Auto-assign starting holes" bulk action | S |

### EPIC-9: Admin — Scores & Sponsors

| Story | Description | Size |
|---|---|---|
| US-9.1 | Score override page: select team → hole → edit strokes | M |
| US-9.2 | "Recalculate Best Ball" button with immediate leaderboard push | S |
| US-9.3 | Score edit audit trail (log who changed what) | S |
| US-9.4 | Sponsor management page: upload logo, name, reorder, toggle | M |
| US-9.5 | Export scores to CSV | S |
| US-9.6 | Tournament stats page (avg scores, longest drives) | M |

### EPIC-10: Security & 2FA (Post-Tournament)

| Story | Description | Size |
|---|---|---|
| US-10.1 | Phone-based 2FA enrollment during registration | M |
| US-10.2 | SMS OTP verification on login | M |
| US-10.3 | Rate limiting on auth endpoints | S |
| US-10.4 | Session management and token refresh hardening | S |

---

## 8. Technical Decisions

| Decision | Rationale |
|---|---|
| Club name stored on shot (not FK) | Historical shots unaffected if admin edits club list |
| Offline-first shot capture | Cell coverage at Granite Ridge may be patchy; localStorage buffer syncs when connectivity returns |
| Edge Function for best ball | Server-side calculation ensures consistency; client can't manipulate scores |
| Slug-based public leaderboard | Clean shareable URL; no auth check on that route |
| Supabase RLS for admin/player separation | Database-level enforcement; even if client code has bugs, data stays protected |
| Compact header in Active Round | Maximizes screen real estate for map + controls during play |

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Cell coverage at Granite Ridge | Players lose shots | Offline buffer (localStorage) with sync indicator |
| 125 concurrent Supabase Realtime connections | Hits free tier limit | Supabase Pro plan (~$25/mo) supports 500 connections |
| GPS accuracy under tree cover | Shots placed inaccurately | Allow manual shot position adjustment; distance is informational not official |
| 14-day build timeline | Features cut | P0 features only for June 22; P1/P2 deferred |
| Admin not available during round | Scores can't be corrected | Any admin-role player can access admin from phone |

---

## 10. Success Criteria

1. 125 players can register, log in, and see their team before June 22
2. All foursomes can track shots with GPS for 18 holes without data loss
3. Live leaderboard updates within 30 seconds of hole completion
4. Admin can correct any score and see it reflected on leaderboard immediately
5. Public leaderboard URL works on venue screens for sponsors/spectators
