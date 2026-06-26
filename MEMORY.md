# MEMORY.md — FDgolf Cross-Session Context

> Read this at the start of every session before writing any code.
> Update before ending every session.

---

## Project

**CIBC Capital Markets Golf Tournament — June 22 2026**
Granite Ridge Golf Club, Milton ON · 125 players · Best Ball + Shotgun Start
Stack: Next.js 16 App Router · TypeScript · Tailwind CSS · shadcn/ui · Supabase · **Mapbox** · Vercel

---

## Branch State (as of Session 35 close — 2026-06-26)

| Branch | Status | Notes |
|--------|--------|-------|
| `main` | **v0.7 released** | Kiosk demo improvements live |
| `develop` | HEAD `bd6ff8f` | fix/longest-drive-gps merged (PR #42) |

**Current open PRs**: None

**GPS / longest-drive fix (Session 35)**

- `tv-stats.ts`: longest drive now measures `distance(tee, shot_2.start)` (ball landing position), not `distance(shot_1.start, tee)` (always ~0). 550m sanity cap filters GPS outliers.
- `foreground.ts`: Playwright phone context mocks geolocation at each hole's tee coords (`browser.newContext({ geolocation })` + `context.setGeolocation()` per hole).
- Tests: 170/170 passing.

**Kiosk demo GPS model (confirmed this session):**
- `shots.start_lat/lng` = where the player stands to make the shot = ball's resting spot before the shot
- Shot 1: player at tee → `start_lat/lng = tee coords`
- Shot 2: player walked to where ball landed → `start_lat/lng = ball landing position`
- Longest drive = `distance(tee, shot_2.start)` ✓

---

## Branch State (as of Session 34 close — 2026-06-25)

| Branch | Status | Notes |
|--------|--------|-------|
| `main` | **v0.7 released** | Kiosk demo improvements live |
| `develop` | HEAD `dc038a8` | US-0036 spec + plan docs; US-0036 feature in PR |
| `feature/US-0036-magic-link-login` | **PR #41 open** | Magic link login — awaiting CI + merge |

**Current open PRs**: PR #41 — `feature/US-0036-magic-link-login` → `develop` (US-0036 magic link login)

**US-0036 — Player self-service magic link login (DONE — PR #41)**

Shipped this session:
- `src/app/api/auth/request-link/route.ts` — POST endpoint, service role client, `signInWithOtp({ shouldCreateUser: false })`, email trim+lowercase, OTP error logging, anti-enumeration 200
- `src/__tests__/api-request-link.test.ts` — 4 unit tests (missing email, unknown email, enrolled player, missing env vars → 500)
- `src/app/(auth)/login/page.tsx` — `handleSendLink`, `linkSent`/`linkLoading` state, Send Magic Link button (`type="button"`), confirmation swap, `linkSent` resets on email edit, fetch guard with error toast

**Next action (Session 34 close):** Monitor CI on PR #41; merge once green. Then invite 125 players via magic link/CSV.

---

## Branch State (as of Session 32 close — 2026-06-23)

| Branch | Status | Notes |
|--------|--------|-------|
| `main` | **v0.6 released** | Multi-tournament + role hierarchy + redesigns live |
| `develop` | HEAD `6a719a5` + test fixes | kiosk demo improvements — persistent browsers, stop button, realistic scoring |

**Current open PRs**: None (develop ready to merge → main as v0.7).

**Kiosk demo — merged on develop (PR #39 + direct commits)**

Key changes this session:
- `foreground.ts`: module-level browser singletons — windows persist across rounds
- `score-gen.ts`: weighted distribution (eagle 3%, birdie 25%, par 52%, bogey 17%, double 3%)
- `TvDisplay.tsx`: STOP DEMO button + DEMO PAUSED badge in header (demo mode only)
- `src/app/api/demo/stop/route.ts`: NEW — sets `status = paused`, validates `is_demo`
- `run.ts`: exits loop on stop signal, 2-min auto-restart window (was 20 min)
- Tests: 165/165 passing, all thresholds met

**Next action (Session 32 close):** Develop → main PR #40; tag v0.7.

---

## Branch State (as of Session 31 close — 2026-06-22)

| Branch | Status | Notes |
|--------|--------|-------|
| `main` | **v0.6 released** | Multi-tournament + role hierarchy + redesigns live |
| `develop` | HEAD `05a33ec` | post PR #38 merge — admin role dashboards live |
| `feature/kiosk-demo` | **open PR #39** | 26 commits — full kiosk demo automation |
| `feature/admin-role-dashboards` | **merged PR #38** | admin UI + system_admin + tournament_admin dashboards |

**Current open PRs**: PR #39 (`feature/kiosk-demo` → `develop`).

**Kiosk demo — PR #39 (feature/kiosk-demo)**

Key technical facts:
- `is_demo` boolean column on `tournaments` (migration 013) — guards `TvRestartOverlay`
- `TvRestartOverlay` renders ONLY when `isDemoMode && tournamentStatus === 'completed'` — NOT on `'paused'`
- `useRef` guard in `TvRestartOverlay.triggerRestart` prevents stale-closure countdown reset
- `scripts/demo/` files use RELATIVE imports only — `tsx`-compatible, no `@/` aliases
- `ShotInsert` uses `start_lat`/`start_lng` (not `lat`/`lng`)
- Demo captain: `demo-captain@fdgolf.demo`, password from `DEMO_CAPTAIN_PASSWORD` env var (fallback `DemoKiosk2026!`)
- Seed script: `npx tsx scripts/demo/seed-lionhead.ts` — idempotent (check-before-insert)
- Run demo: `npx tsx scripts/demo/run.ts` — needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`
- `background.ts` uses `team.startingHole` (1-based) for hole rotation: `(team.startingHole - 1 + i) % 18`
- `run.ts` poll limits: `waitForCompletion` 180×10s=30min, `waitForRestart` 120×10s=20min
- Minor known items: `captain_id` only set on team 0; non-captain players use fake UUIDs (may need FK relaxation)

**v0.6 tag** on `main` — includes PRs #32–#36 (TV stats fix, design redesigns, multi-tournament, role hierarchy).

**Playwright E2E suite state (as of Session 27):** 61/61 passing, 2 skipped.

**Admin role dashboards — PR #38 (feature/admin-role-dashboards)**

Key technical facts to know for next session:
- `x-active-tournament` cookie (`httpOnly: true, sameSite: lax, path: /`) is the single source of truth for active tournament across all admin pages
- `getActiveTournamentId()` in `src/lib/active-tournament.ts` — all server pages use this to read the cookie
- `setActiveTournamentAction()` in `src/lib/actions/set-active-tournament.ts` — server action to set the cookie
- `src/app/(admin)/layout.tsx` — role-aware: system_admin reads/falls back to most-recent tournament; tournament_admin: 0 assignments → redirect `/dashboard`, 1 → auto-set cookie, 2+ → redirect `/admin/select-tournament`
- `src/app/(tournament-select)/admin/select-tournament/page.tsx` — INTENTIONALLY outside `(admin)` route group (no layout) to break infinite redirect loop for multi-assignment tournament admins
- `src/app/(admin)/admin/tournaments/page.tsx` and `src/app/(admin)/admin/players/page.tsx` — both have role guards; redirect non-system_admin to `/admin/tournament`
- All client components (`tournament-admins.tsx`, `roster-manager.tsx`, `tournaments-list.tsx`) use `const supabase = createClient()` at MODULE LEVEL outside the component — prevents infinite useEffect re-fires

**Admin DESIGN_STANDARDS.md** — lives at `docs/DESIGN_STANDARDS.md`. Always reference before writing admin UI. Key rules:
- PROHIBITED: `text-sm`, `text-xs`, `text-lg`, `text-2xl`, `text-gray-*`, `rounded-lg`
- Typography: `text-[13px]`, `text-[17px]`, `text-[28px]` only
- Cards: `rounded-2xl`, buttons: `rounded-xl`
- Every client page must use `<AdminTopBar eyebrow="UPPERCASE" title="Title">`
- Design tokens: dark text `#15241c`, primary green `#1a472a`, secondary `#6b7a70`, muted `#90a094`

**Seed state after `supabase db reset` + `npx tsx supabase/seed-users.ts`:**
- Venue (Granite Ridge) + Course (Main Course) now inserted by `seed.sql` (NOT migration 007 — fixed in Session 28)
- 18 tee boxes (Blue tee, all holes) — TV longest-drive resolves for all 18 holes
- 5 sponsors (CIBC Capital Markets, Deloitte, Manulife, EPAM, First Derivative, all active)
- Scores and shots still require `npx tsx scripts/seed-tv-data.ts` OR real gameplay

**TV display route**: `/live/cibc-granite-ridge-2026/tv` — public, no auth. Polling 30s, panel rotation 15s.

**Design system (Session 25)**:
- Barlow Condensed font via `next/font/google` — CSS var `--font-barlow`, Tailwind utility `font-barlow`, weights 500/600/700/800
- Brand colors: `#1a472a` course green, `#c0392b` under-par red, `#e7c66b` gold, `#f4f7f1` panel surface
- AppHeader provides FDgolf/AI/Run™ brand on all player pages via `(player)/layout.tsx` — page-level headers should NOT repeat the wordmark
- 5-panel TV rotator: 0=Birdies, 1=HoleDifficulty, 2=ShotStats, 3=MomentOfDay, 4=TeamSpotlight

**Critical schema fact**: `scores.hole_number` is a plain `integer` (no FK to `holes.id`).
PostgREST `holes!inner(...)` joins from scores will FAIL with PGRST200. Always use `fetchParMap()`
pattern (fetch holes separately, build in-memory map) when you need par data alongside scores.

**PostgREST schema cache**: After applying migrations via raw `psql`, run
`psql ... -c "NOTIFY pgrst, 'reload schema';"` or restart Supabase — otherwise the REST API
won't see the new policy/FK/function until cache refresh.

**Seed data in local DB** (`00000000-0000-0000-0000-000000000001`):
- 4 teams: Fairway Falcons, Birdie Brigade, Eagle Eye, Par Hunters (seeded by seed-tv-data.ts)
- 16 players, 18 holes, 400 shots with GPS, 144 scores — all seeded by `npx tsx scripts/seed-tv-data.ts`
- Migration 010: `Public read shots` policy — shots readable by anon client
- `tournament_players` rows created by seed-tv-data.ts (one per player per tournament)

**Kiosk demo — spec + plan ready (Session 30)**
- Spec: `docs/superpowers/specs/2026-06-21-kiosk-demo-design.md`
- Plan: `docs/superpowers/plans/2026-06-21-kiosk-demo.md` — 8 tasks, ready to execute with subagent-driven-development
- Demo slug: `lionhead-legends-demo`, captain: `demo-captain@fdgolf.demo` / `DemoKiosk2026!`
- New `is_demo` column on tournaments (migration 013) — guards TV restart overlay
- Round page is SHOT-BY-SHOT (not stroke counter): `(score-1) × "In Play"` + `"⛳ Sunk"`; `holeSunk=true` disables buttons after first sink
- `shots.start_lat`/`start_lng` are the GPS fields (NOT `lat`/`lng`)
- Foreground Playwright: captain only records their own shots; other 3 players injected to DB
- Background teams: 17 × async loops, each starts at `teamIndex+1` hole (shotgun), HOLE_DELAY_MS=20000

**Next action (Session 31 close):** Monitor PR #39 CI, fix any failures, merge when green. Then run kiosk demo locally against local Supabase.

---

## Branch State (as of Session 23 close — 2026-06-18)

| Branch | Status | Notes |
|--------|--------|-------|
| `main` | production | Next.js 16 + E2E suite live |
| `develop` | HEAD (post PR #21 merge) | TV leaderboard feature merged |
| `feature/tv-leaderboard` | **merged PR #21** | 12 commits — TV display at `/live/[slug]/tv` |

**Current open PRs**: None (PR #21 merged, PR develop→main pending this session).

**TV display route**: `/live/cibc-granite-ridge-2026/tv` — public, no auth. Polling 30s, panel rotation 15s.

**New unit tests**: `src/__tests__/tv-stats.test.ts` — 35 tests, 128 total suite. Coverage ≥80% maintained.

**Next action**: Invite 125 players via CSV → set real GPS pins for Ruby holes → smoke test June 22

---

## Branch State (as of Session 22 close — 2026-06-18)

| Branch | Status | Notes |
|--------|--------|-------|
| `main` | production | Next.js 16 + CSV import live |
| `develop` | HEAD `f6638d0` | PR #20 merged — full tournament lifecycle E2E test suite |
| `feature/tournament-lifecycle-e2e` | **merged PR #20** | 10-step serial Playwright spec + reset-lionhead.ts |

**Current open PRs**: None.

**Supabase local**: migrated to new machine (192.168.1.100), port offset +20. `.env.local` still needs to be copied to new machine.

**New E2E test accounts** (seeded by `scripts/reset-lionhead.ts`):
- `e2e-lion-a@fdgolf.test` / `E2eLionA789!` (Alex Lion — Team Alpha captain)
- `e2e-lion-b@fdgolf.test` / `E2eLionB789!` (Blake Lion — Team Beta)

**Run lifecycle tests**: `npx tsx scripts/reset-lionhead.ts && npx playwright test --project=chromium-lifecycle`

**Next action**: Set real pin GPS for Ruby holes → invite 125 players via CSV → smoke test June 22

---

## Branch State (as of Session 21 close — 2026-06-17)

| Branch | Status | Notes |
|--------|--------|-------|
| `main` | production | Next.js 16 + CSV import live |
| `develop` | HEAD `4dc0a76` | No new code — DB migration session only |

**New machine setup**: Supabase DB migrated to 192.168.1.100 via `pg_dump | ssh pg_restore`. Still need to copy `.env.local` to new machine.

---

## Branch State (as of Session 20 close — 2026-06-16)

| Branch | Status | Notes |
|--------|--------|-------|
| `main` | production | Next.js 16 + CSV import live |
| `develop` | HEAD `4d3f45c` | PR #18 merged — holes UI overhaul, Ruby scorecard, migration 009 |
| `feature/US-holes-generator-csv` | **merged PR #18** | Course/holes UI + Ruby data + nullable tee GPS |

**Current open PRs**: None.

**Next action**: Invite 125 players via CSV import → smoke test June 22 (login, score, leaderboard)

---

## Branch State (as of Session 19 — 2026-06-12)

| Branch | Status | Notes |
|--------|--------|-------|
| `main` | **→ PR #15 merged** | Next.js 16 upgrade + CI security hardening live in prod |
| `develop` | HEAD `acccf61` | synced with main; Next.js 16.2.9, audit gate `--audit-level=high` |
| `feature/upgrade-nextjs-16` | **merged PR #14** | Next.js 14→16 upgrade, .npmrc legacy-peer-deps |
| `feature/ci-security-format` | **merged PR #11** | format+audit+CodeQL CI jobs, Husky pre-commit |
| `feature/plan2-admin-venues-courses` | **merged PR #8** | Admin venues, courses, tee boxes |
| `feature/plan1-master-data-hierarchy` | **merged PR #7** | Master data hierarchy — migrations 007/008 |
| `feature/feature-completion-2026-06-11` | **merged PR #3** | 6 features: sign-out, add team, tournament controls, hole summary, edit shot, password reset |
| `feature/e2e-playwright-full-suite` | **merged PR #2** | Mapbox + pin editor + scores RLS fix + E2E suite |
| `feature/phase6-po-items` | **merged PR #1** | Phase 6 complete |

**Monorepo**: `ksyed0/FDgolf` on GitHub (PUBLIC) — `CodeMie/` is a plain subdirectory (no nested git). Bare backup at `CodeMie-origin.git/`.

**Current open PRs**: None.

**Next action**: Invite real players via magic link (admin dashboard → Players → Send Invite) and run pre-tournament smoke test on June 22.

**Post-tournament backlog**: Upgrade eslint from v8 → v9 (removes `legacy-peer-deps` workaround). Consider flat config migration.

---

## Workflow Rule (CRITICAL)

`feature/* → develop` (PR) → `main` (PR)  
**Never merge directly to main.** `develop` is the integration branch.

---

## E2E Test Status (Session 14 — 2026-06-11)

**31 passed, 2 skipped (conditional), 0 failed.** After PR #3 merges, TC-0049/0050/0056 move from unconditional skip to conditional (`test.skip(!hasRealSupabase, '...')`).

Remaining unconditional skips: TC-0045 (no sponsor logo_url seeded), TC-0058 (Radix Select incompatible with `.selectOption()` — backlog).

Local Supabase: must run `supabase start` from `FDgolf_CodeMie/` before tests. The previous conflicting container was `supabase_db_fdgolf` (old project name); stop with `supabase stop --project-id fdgolf` if port conflict on 54322.

---

## RLS Infinite Recursion Bug — FIXED (migration 004)

**Root cause**: `"Admin full access" FOR ALL` policy on `players` table:
```sql
using (exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin'))
```
This queries `players` from within a `players` policy → PostgreSQL evaluates the same policy again → infinite recursion (error `42P17`). Cascaded to ALL tables with admin policies that checked `players`.

**Fix**: `supabase/migrations/004_fix_admin_rls.sql` — replaced `FOR ALL` with `FOR INSERT/UPDATE/DELETE` only. The existing `"Public read"` policy (`using (true)`) handles SELECT, so removing SELECT from the admin policy is safe.

**Must apply to production** before deploy: `supabase db push --db-url <prod-url>`

---

## Ruby Course (production — as of Session 20)

- **Course ID**: `20000000-0000-0000-0000-000000000001` (renamed from "Main Course" to "Ruby")
- **Par**: 70 · **Stroke index**: official values from Granite Ridge scorecard
- **Tee sets**: Blue, Blue/White, White, White/Red, Red — all 18 holes populated
- **Pin GPS**: placeholder estimated values — real coordinates not yet set; HoleMap guards against 0,0
- **Migrations applied to prod**: 001–009 ✓
- **Migration 009**: `tee_boxes.lat` and `tee_boxes.lng` are nullable (no scoring logic uses them)

---

## Key Schema Facts

- **`teams.captain_id`**: `uuid` column with NO inline FK. Deferred FK added via `ALTER TABLE` after `players` is defined (circular reference pattern).
- **`teams.max_players`**: `int not null default 4 check (max_players between 2 and 6)` — variable team size.
- **`PlayerRole`**: `'player' | 'system_admin' | 'tournament_admin' | 'tournament_organizer'` — `'admin'` no longer exists (renamed to `'system_admin'` in migration 012).
- **`scores.override_by` / `override_at`**: audit trail columns for admin overrides.
- **`tournament_players(player_id, team_id, tournament_id)`**: join table replacing `players.team_id`. `unique(player_id, tournament_id)` — one team per player per tournament. Added in migration 011.
- **`tournament_admin_assignments(player_id, tournament_id)`**: scoping table for tournament-admin role. `unique(player_id, tournament_id)`. Added in migration 012. **No UI yet — schema is ready.**
- **`is_system_admin()`**: security-definer SQL function — returns true if calling user has `role = 'system_admin'`. Runs as DB owner to avoid RLS recursion.
- **`is_tournament_admin(uuid)`**: security-definer SQL function — returns true if calling user has a row in `tournament_admin_assignments` for the given tournament_id.
- **Seed UUIDs** (in `seed.sql` — NOT in migrations after Session 28 cleanup):
  - Venue: `10000000-0000-0000-0000-000000000001` — Granite Ridge Golf Club
  - Course: `20000000-0000-0000-0000-000000000001` — Main Course (18 holes, par 72)
  - Tournament: `00000000-0000-0000-0000-000000000001` — CIBC Capital Markets Golf Tournament 2026

---

## Master Data Hierarchy — Design Approved (Session 15)

Venue → Course → Hole → TeeBox fully normalized schema. **Plan 1 ready to execute.**

Spec: `docs/superpowers/specs/2026-06-11-master-data-hierarchy-design.md`
Plan: `docs/superpowers/plans/2026-06-11-master-data-hierarchy-plan1.md`

**Seed UUIDs (hardcoded in migration 007):**
- Venue ID: `10000000-0000-0000-0000-000000000001` — Granite Ridge Golf Club, 7441 Bell School Line, Milton, ON, L9T 2X5
- Course ID: `20000000-0000-0000-0000-000000000001` — Main Course (18 holes, par 72)

**Leaderboard RPC must change** from `h.tournament_id = p_tournament_id` to joining via `trn.course_id`. Handled in migration 008.

**`nine_hole_selection` field** — stored in schema and settable via tournament form. Round page navigation logic (stopping at hole 9 vs 18) is Plan 2.

**PlanVisualizer GitHub sync** — now enabled for `ksyed0/FDgolf_CodeMie`. Labels `critical`, `high`, `medium`, `low`, `planvisualizer` must exist on the GitHub repo before sync runs correctly.

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 5s debounce on `useRealtimeScores` | Prevents 125-client storm on single Supabase channel |
| `localStorage` write-queue in sync engine | Offline-first; survives page refresh, max 5 retries |
| Deno Edge Function for best-ball calc | Server-side min-stroke per team+hole; bypasses RLS with service role key |
| `supabase/functions` excluded from tsconfig | Deno CDN imports (`https://esm.sh/...`) break Next.js TS compiler |
| `docs/dashboard.html` in .gitignore | Auto-generated by `tools/watch-dashboard.js`; causes continuous merge conflicts |
| **Mapbox** via `react-map-gl/mapbox` | Replaced Google Maps; satellite-v9 style; `interactive={false}` on shot tracker, `interactive={true}` on pin editor |
| `key={lat,lng}` re-mount pattern | Re-centers Mapbox map when switching holes in `HoleMap` |
| `EMPTY_FORM.importFromId = '__none__'` sentinel | Radix `<Select.Item>` crashes on `value=""` — use a non-empty sentinel and guard downstream logic with `!== '__none__'` |

---

## Agents Completed

- **Compass** — backlog priority order confirmed (Session 1)
- **Keystone** — scaffold, types, schema, sync engine, leaderboard RPC (Session 2)
- **Lens** — reviewed EPIC-0001, approved with amendments (Session 3)
- **Forge** — best-ball edge function, GPS utils, realtime hook, scoring utils (Session 3)
- **Pixel** — all auth/player/admin/live pages, 38 files (Session 4-5)
- **Sentinel** — 59 unit tests: scoring, GPS, sync-engine, API shots (Session 6-7)
- **Circuit** — Jest config, coverage thresholds, GitHub Actions CI (Session 6-7)

## Phase 6 Status — COMPLETE

All PO-answer stories shipped in PR #1 (`feature/phase6-po-items` → `develop`):
- Magic link API + Send Invite UI
- Pause/resume state (migration 003 + controls + player overlay)
- Hole-by-hole scorecard page + bottom nav link
- Editable team names
- Mulligan report in admin scores
- Dashboard path fix + README

**Outstanding**: merge PR #1, Vercel deploy (target June 20), apply migration 003 to prod.

---

## Files Created This Project

```
src/
  lib/types.ts                          # all 9 entity interfaces
  lib/supabase/client.ts / server.ts    # SSR Supabase clients
  lib/gps.ts                            # GPS position + Haversine distance
  lib/scoring.ts                        # Best Ball scoring utilities
  lib/sync-engine.ts                    # Offline write queue (singleton)
  middleware.ts                         # Next.js auth + role guard
  hooks/use-sync-engine.ts
  hooks/use-gps.ts
  hooks/use-realtime-scores.ts          # 5s debounce
  components/offline-indicator.tsx
supabase/
  migrations/001_initial_schema.sql     # 9 tables, RLS, deferred captain FK
  migrations/002_leaderboard_rpc.sql    # get_leaderboard() RPC
  seed.sql                              # CIBC tournament, 21 clubs, 18 holes
  functions/calculate-best-ball/        # Deno Edge Function
docs/
  ux-review/fdgolf-ux-review.html       # UX review for external PO (self-contained)
  ux-review/fdgolf-ux-review.zip        # 15K zip, ready to email
```

---

## PO Answers (Session 7)

| Q | Answer |
|---|--------|
| 1. Attestation | Not required |
| 2. Concierge registration | Magic link |
| 3. Pause state | Yes — add `'paused'` to tournament status enum |
| 4. Score preservation | Yes — archive/history view after event |
| 5. Per-hole scorecard | Yes — hole-by-hole view |
| 6. Team naming | Yes — custom team names |
| 7. Mulligan tracking | Yes — tracked + reportable |

---

## Scores RLS Gap — FIXED (migration 005)

`scores` table only had admin write + public read. Players were blocked (403) when submitting hole scores from the client. Added:
- `"Players insert own score"` — player can insert score where player_id matches their auth_user_id
- `"Players insert team score"` — player can insert score for any teammate (same pattern as shots table)
- `"Players update team score"` — required for `.upsert()` conflict resolution

Must apply `005_scores_player_rls.sql` to all Supabase instances (local ✓, staging/prod pending).

---

## Vercel Project

- **Project ID**: `prj_2ekiP2phChQuxw2cTsCWSumIHhUL`
- **Team**: `ksyed0s-projects` (`team_1GYxYGIISutKRyI2KzwcYq29`)
- **Project name**: `fdgolf_cm`
- **Production URL**: `https://fdgolfcm.vercel.app` ✓ LIVE
- **Live leaderboard**: `https://fdgolfcm.vercel.app/live/cibc-granite-ridge-2026`
- **Deployment ID**: `dpl_HygpvMZA4ijh3zTfQk5wLeMW7ziC`
- **Env vars**: All 4 set for both **Production** and **Preview** scopes ✓
- **GitHub integration**: Connected (`ksyed0/FDgolf_CodeMie`) — `develop` → preview auto-deploy, `main` → production auto-deploy ✓
- **To redeploy manually**: `vercel deploy --prod` from repo root (or push to `main` via PR).

---

## Local Dev Setup

- **Supabase instance**: containers running on ports 54341–54349 (`supabase_*_FDgolf_CodeMie` on OrbStack)
- **Studio**: http://127.0.0.1:54343
- **DB**: `postgresql://postgres:postgres@127.0.0.1:54342/postgres`
- **Seed test users**: `npx tsx supabase/seed-users.ts` (5 users, password: `Password1!`)
- **Start instance**: `supabase start` from `FDgolf_CodeMie/` directory
- **Port conflict note**: default ports 54321–54327 used by another project; FDgolf_CodeMie uses +20 offset

---

## Supabase Cloud Project

- **Project ID**: `jsinxqmbkowigeyihhdv`
- **Project name**: `fdgolf-production`
- **Region**: `ca-central-1`
- **URL**: `https://jsinxqmbkowigeyihhdv.supabase.co`
- **Migrations applied**: 001–008 (all 8) ✓
- **Seed applied**: CIBC tournament, Granite Ridge venue/course, 18 holes, 21 clubs ✓
- **Test users seeded**: 5 users (`admin@fdgolf.local` + 4 players), password `Password1!` ✓
- **Edge Function**: `calculate-best-ball` deployed and ACTIVE ✓
- **Tournament slug**: `cibc-granite-ridge-2026`

## Next Steps

1. **Invite real tournament players** via CSV import (`scripts/sample-data/players-import.csv` as template) or individual magic link
2. **Pre-tournament smoke test** on tournament day (June 22): confirm login, submit score, verify leaderboard end-to-end
3. **Post-tournament**: upgrade eslint v8 → v9 (flat config), remove `.npmrc` legacy-peer-deps workaround
