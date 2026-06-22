# Kiosk Demo — Automated Tournament Simulation Design

**Date:** 2026-06-21
**Status:** Approved — ready for implementation planning
**Scope:** Fully automated kiosk demo running an 18-hole best-ball tournament simulation on Lionhead Legends course, displayed across two browser windows side-by-side

---

## Background

FDgolf-CM needs a self-running kiosk demo for trade shows and sales meetings. The demo runs unattended for a full tournament day (~6 hours), displaying a live TV leaderboard on the left and a simulated player experience on the right. When the simulation completes (~12–18 minutes per loop), the display shows a restart button with a 10-minute countdown before automatically cycling again.

---

## Goals

1. Two browser windows open side-by-side from a single command — no manual setup
2. Left window: TV leaderboard filling naturally as 18 teams complete holes
3. Right window: phone-ratio browser showing one team clicking through the real round scoring UI
4. All 18 teams finish roughly simultaneously (shotgun start pacing)
5. Restart via manual button click or automatic 10-minute countdown after completion
6. All data seeded idempotently — re-running the seed script is always safe

---

## Venue & Course Data

**Venue:** Lionhead Golf and Country Club, 8525 Mississauga Rd, Brampton, ON L6Y 0E3
**Course:** Legends Course — Difficulty: Difficult (Global rank 2,729 of 30,508)
**Tee used for demo:** Blue (male) — 6,454 yards, par 71, rating 72.4, slope 139

### Hole Data (Blue tee yardages)

| Hole | Par | Yards (Blue) | Stroke Index |
|------|-----|--------------|--------------|
| 1    | 4   | 415          | 9            |
| 2    | 4   | 390          | 5            |
| 3    | 3   | 185          | 17           |
| 4    | 5   | 510          | 1            |
| 5    | 4   | 405          | 11           |
| 6    | 4   | 360          | 13           |
| 7    | 5   | 530          | 3            |
| 8    | 3   | 170          | 15           |
| 9    | 4   | 394          | 7            |
| 10   | 4   | 370          | 10           |
| 11   | 4   | 400          | 6            |
| 12   | 5   | 500          | 2            |
| 13   | 3   | 175          | 18           |
| 14   | 4   | 385          | 12           |
| 15   | 5   | 460          | 4            |
| 16   | 4   | 415          | 8            |
| 17   | 3   | 165          | 16           |
| 18   | 4   | 420          | 14           |

Note: Stroke index (handicap) values are reasonable estimates; actual published values can be substituted during implementation.

**Par discrepancy:** The hole-by-hole pars sum to 72 (both nines par 36). The Blue tee card shows par 71 — one hole plays as a shorter par from Blue tees. For the demo, seed all 18 holes with the par values above (total 72); the vs-par display will show par-72 calculations throughout, which is acceptable for demo purposes.

### Approximate GPS Coordinates (Lionhead Legends)

Centre of course: 43.6480° N, 79.8390° W. Holes spread across ~800m × 600m footprint. Seed uses these approximate pin positions:

| Hole | Pin lat  | Pin lng   | Tee lat  | Tee lng   |
|------|----------|-----------|----------|-----------|
| 1    | 43.6510  | -79.8420  | 43.6498  | -79.8432  |
| 2    | 43.6525  | -79.8405  | 43.6512  | -79.8418  |
| 3    | 43.6538  | -79.8388  | 43.6530  | -79.8395  |
| 4    | 43.6550  | -79.8370  | 43.6535  | -79.8385  |
| 5    | 43.6542  | -79.8350  | 43.6550  | -79.8363  |
| 6    | 43.6528  | -79.8335  | 43.6540  | -79.8348  |
| 7    | 43.6512  | -79.8318  | 43.6520  | -79.8332  |
| 8    | 43.6498  | -79.8302  | 43.6505  | -79.8315  |
| 9    | 43.6485  | -79.8288  | 43.6492  | -79.8300  |
| 10   | 43.6470  | -79.8305  | 43.6480  | -79.8292  |
| 11   | 43.6458  | -79.8322  | 43.6468  | -79.8310  |
| 12   | 43.6445  | -79.8340  | 43.6455  | -79.8328  |
| 13   | 43.6432  | -79.8358  | 43.6440  | -79.8345  |
| 14   | 43.6420  | -79.8375  | 43.6430  | -79.8362  |
| 15   | 43.6408  | -79.8392  | 43.6418  | -79.8380  |
| 16   | 43.6418  | -79.8410  | 43.6408  | -79.8398  |
| 17   | 43.6432  | -79.8425  | 43.6422  | -79.8415  |
| 18   | 43.6448  | -79.8438  | 43.6438  | -79.8428  |

---

## Tournament & Player Seed Data

- **Tournament slug:** `lionhead-legends-demo`
- **Tournament name:** Lionhead Legends Demo Tournament
- **Format:** `best_ball`
- **Status on seed:** `setup` (orchestrator sets to `active` at demo start)
- **`is_demo`:** `true`
- **Teams:** 18 teams × 4 players = 72 players total
- **Team names:** Eagle Squadron, Birdie Brigade, Par Patrol, Bogey Busters, Fairway Falcons, Iron Rangers, Wedge Warriors, Chip Shots, Bunker Boys, Driver's Club, Green Machines, Sand Savers, Back Nine, Front Runners, Links Lions, Turf Tigers, Pin Seekers, Rough Riders
- **Player names:** Generated as "FirstName LastName" — 4 per team, 72 total. Use common first names (James, Sarah, Michael, Emma, David, Olivia, Ryan, Sophie, etc.) and common last names (Smith, Johnson, Williams, Brown, Jones, Davis, etc.)
- **Foreground team auth account:** The seed creates one real Supabase auth user for Team 1's captain: `demo-captain@fdgolf.demo` / `DemoKiosk2026!`. This account logs into the round scoring UI. The other 71 players are DB-only records (no auth needed — their scores are submitted via the captain's session or injected directly).
- **Clubs:** Standard 21-club set (same as existing `seed.sql` clubs — Driver through Putter)

---

## Architecture

```
npx tsx scripts/demo/run.ts              ← single entry point
  │
  ├── seed-lionhead.ts                   idempotent: venue, course, holes, tee boxes,
  │                                      players, teams, tournament, clubs
  │
  ├── reset()                            wipe scores + shots, set tournament → 'active'
  │
  ├── [async] foreground sim             chromium #1 — 1280×810, left, x=0
  │   │  /live/lionhead-legends-demo/tv  display only, no interaction
  │   │
  │   └── chromium #2 — 390×844, right, x=1290
  │       logs in as Team 1 captain
  │       holes 1 → 18 via round scoring UI
  │       4 players per hole, 5s delay between players
  │       post-submit GPS injection via Supabase service-role client
  │
  ├── [async] background.ts              Teams 2–18, shotgun start
  │   Supabase service-role inserts, paced to HOLE_DELAY_MS
  │   GPS injected with each score batch
  │
  └── completion watcher                 polls scores count every 10s
      1,296 rows → set tournament → 'completed'
      orchestrator waits for status → 'active'  (restart API or 10-min timer)
      on 'active': reset() and loop
```

**Window layout on a 1920×1080 display:**
- Left (TV): `--window-position=0,60 --window-size=1270,980`
- Right (phone): `--window-position=1280,60 --window-size=390,844`

---

## Score Generation

Amateur score distribution — each player's score is independently random within range:

| Par | Min | Max | Notes |
|-----|-----|-----|-------|
| 3   | 3   | 7   | avg ~4.5, allows aces and blow-up holes |
| 4   | 4   | 8   | avg ~5.5 |
| 5   | 5   | 9   | avg ~6.5 |

Best-ball team score per hole = `min(player1, player2, player3, player4)`.

The foreground team (Team 1) generates scores at hole-start time and uses them to drive Playwright clicks. Background teams generate scores at injection time.

---

## Simulation Flow

### Foreground Team (Playwright — right window)

```
for hole in 1..18:
  navigate to /round/[hole]
  scores = generateScores(hole.par)  // 4 random values in range
  for (player, score) in zip(players, scores):
    click stroke counter to `score`
    wait SHOT_DELAY_MS (5000)
  submit hole
  injectShots(hole, players, scores)  // GPS records via service-role client
  navigate to next hole (or complete round on hole 18)
```

### Background Teams (async, same process)

Each of teams 2–18 runs as an independent async loop:

```
startHole = teamIndex + 1  // team 2 → hole 2, team 18 → hole 18
for i in 0..17:
  hole = ((startHole - 1 + i) % 18) + 1
  scores = generateScores(hole.par)  // 4 independent random values
  insertScores(teamId, hole, scores)
  injectShots(hole, teamPlayers, scores)
  wait HOLE_DELAY_MS (20000)  // matches foreground pace (4 players × 5s)
```

All 17 background teams start simultaneously with the foreground team.

---

## GPS Shot Injection

After each hole is scored (both foreground and background), shot records are inserted via Supabase service-role client. No browser geolocation mocking needed.

**Shot sequence per player per hole** (N shots = stroke count):

```
for shot in 1..N:
  progress = (shot - 1) / (N - 1)   // 0.0 at tee, 1.0 at pin
  lat = tee.lat + (pin.lat - tee.lat) * progress + jitter()
  lng = tee.lng + (pin.lng - tee.lng) * progress + jitter()
```

Where `jitter()` returns a random value in `[-0.0002, +0.0002]` (~20m spread).

Special cases:
- N = 1 (hole-in-one): single shot at pin position
- Last shot always placed at pin ± tiny jitter (0.00005°) — represents putted in

**Shot record fields:**
- `player_id`: from team roster
- `hole_id`: current hole
- `club_id`: randomly selected appropriate club (driver for shot 1 on par 4/5, iron for mid, putter for last)
- `lat`, `lng`: computed above
- `created_at`: `now()` (insertion time, not simulated time)

---

## Completion & Restart

**Completion detection** (orchestrator, every 10s):
```sql
SELECT COUNT(*) FROM scores
WHERE tournament_id = $demoTournamentId
```
Target: 18 teams × 18 holes × 4 players = **1,296 rows**

On reaching 1,296: `UPDATE tournaments SET status = 'completed'`

**TV leaderboard restart UI** (shown when `is_demo = true AND status = 'completed'`):

Overlay at bottom of TV display:
```
[ 🏆 Tournament Complete ]
[ Restart Demo ]   Restarting automatically in  MM:SS
```

- Countdown starts at 10:00 and ticks down client-side
- Clicking "Restart Demo" calls `POST /api/demo/restart` immediately
- Countdown reaching 0:00 calls `POST /api/demo/restart` automatically

**`POST /api/demo/restart`:**
```
1. Verify tournament.is_demo = true
2. DELETE FROM shots WHERE player_id IN
     (SELECT player_id FROM tournament_players WHERE tournament_id = $id)
3. DELETE FROM scores WHERE tournament_id = $id
4. UPDATE tournaments SET status = 'active' WHERE id = $id
```

**Orchestrator restart detection:**
- Polls `tournament.status` every 10s
- On `'active'` (after having seen `'completed'`): calls `reset()` and re-enters the simulation loop (both foreground Playwright and background injector)

---

## Database Changes

### Migration: `is_demo` column

```sql
-- supabase/migrations/013_demo_tournament_flag.sql
ALTER TABLE tournaments
  ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
```

No RLS changes needed — `is_demo` is read-only from the client (TV display reads it via public SELECT).

---

## New Files

| File | Purpose |
|------|---------|
| `scripts/demo/run.ts` | Entry point — seed, reset, orchestrate, loop |
| `scripts/demo/seed-lionhead.ts` | Idempotent seed: venue, course, holes, tee boxes, players, teams, tournament |
| `scripts/demo/foreground.ts` | Playwright browser controller — two windows, round scoring automation |
| `scripts/demo/background.ts` | Async score + GPS injector for teams 2–18 |
| `scripts/demo/score-gen.ts` | `generateScore(par): number` — random within range |
| `scripts/demo/gps-gen.ts` | `generateShots(hole, players, scores): Shot[]` |
| `scripts/demo/types.ts` | Shared types for demo (DemoHole, DemoTeam, DemoPlayer) |
| `src/app/api/demo/restart/route.ts` | Reset endpoint |
| `supabase/migrations/013_demo_tournament_flag.sql` | `is_demo` column |

### Modified Files

| File | Change |
|------|--------|
| `src/app/live/[slug]/tv/page.tsx` (or TV client component) | Read `is_demo` + `status`; render restart overlay when both true |

---

## Bundled E2E Fixes

These fixes ship in the same PR (they unblock the existing broken admin E2E tests).

### Fix 1: `global-setup.ts` role constraint

`tests/e2e/global-setup.ts` line 36: change `role: 'player' | 'admin'` → `role: 'player' | 'system_admin'`.
Also update the upsert call for the admin user to use `role: 'system_admin'`.

This fixes a DB constraint violation (migration 012 removed `'admin'` as a valid role value) that causes all admin-dependent E2E tests to fail when `SUPABASE_SERVICE_ROLE_KEY` is set.

### Fix 2: Tournament admin test user

In `global-setup.ts`, seed a third E2E user:
- Email: `e2e-tournament-admin@fdgolf.test`
- Password: `E2eTournamentAdmin789!`
- Role: `tournament_admin`
- Insert one row into `tournament_admin_assignments` for the CIBC tournament (`00000000-0000-0000-0000-000000000001`)

Add to `tests/TEST_LOGINS.md`.

### Fix 3: TC-0047 updated

Update expected sidebar links to include `'roster'` and `'tournaments'` (added by PR #38).

### Fix 4: New `tests/e2e/admin-roles.spec.ts`

Six new test cases (all gated on `hasRealSupabase`):

| TC | Description |
|----|-------------|
| TC-0090 | `system_admin` sidebar shows Global section with Tournaments, Players, Venues, Courses, Clubs links |
| TC-0091 | `tournament_admin` sidebar has no Global section (no Tournaments/Players/Venues/Courses/Clubs links) |
| TC-0092 | `tournament_admin` navigating to `/admin/tournaments` is redirected to `/admin/tournament` |
| TC-0093 | `tournament_admin` navigating to `/admin/players` is redirected to `/admin/tournament` |
| TC-0094 | `/admin/tournaments` renders tournament card list for `system_admin` |
| TC-0095 | `/admin/roster` renders "Roster" heading for `system_admin` |

---

## Timing Reference

| Parameter | Value | Configurable constant |
|-----------|-------|-----------------------|
| Delay between player shots | 5,000ms | `SHOT_DELAY_MS` |
| Delay between holes (background) | 20,000ms | `HOLE_DELAY_MS` |
| Completion poll interval | 10,000ms | `POLL_INTERVAL_MS` |
| Auto-restart countdown | 600,000ms (10 min) | `RESTART_COUNTDOWN_MS` |
| Estimated loop duration | ~12–18 min | — |

---

## Out of Scope

- Score randomization between demo runs (Phase 2 — once base simulation is working)
- Team roster randomization between loops
- Handicap-adjusted scoring
- Real Lionhead GPS pin coordinates (approximate values sufficient for stats)
- Multi-monitor support (single screen, side-by-side layout)
- Demo mode for non-Lionhead tournaments
