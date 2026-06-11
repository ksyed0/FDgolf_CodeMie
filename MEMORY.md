# MEMORY.md — FDgolf Cross-Session Context

> Read this at the start of every session before writing any code.
> Update before ending every session.

---

## Project

**CIBC Capital Markets Golf Tournament — June 22 2026**
Granite Ridge Golf Club, Milton ON · 125 players · Best Ball + Shotgun Start
Stack: Next.js 14 App Router · TypeScript · Tailwind CSS · shadcn/ui · Supabase · **Mapbox** · Vercel

---

## Branch State (as of Session 18 — 2026-06-11)

| Branch | Status | Notes |
|--------|--------|-------|
| `main` | **→ PR #10 merged** | all develop work shipped to prod via PR #10 |
| `develop` | HEAD `8f744e2` | `continue-on-error` on GitHub Pages deploy step |
| `feature/plan2-admin-venues-courses` | **merged PR #8** | Admin venues, courses, tee boxes — 4 new/modified files |
| `feature/plan1-master-data-hierarchy` | **merged PR #7** | Master data hierarchy — migrations 007/008, types, 7 pages, add-player tests |
| `feature/feature-completion-2026-06-11` | **merged PR #3** | 6 features: sign-out, add team, tournament controls, hole summary, edit shot, password reset |
| `feature/e2e-playwright-full-suite` | **merged PR #2** | Mapbox + pin editor + scores RLS fix + E2E suite |
| `feature/phase6-po-items` | **merged PR #1** | Phase 6 complete |

**Monorepo**: `ksyed0/FDgolf` on GitHub — `CodeMie/` is a plain subdirectory (no nested git). Bare backup at `CodeMie-origin.git/`.

**Next action**: Tournament day preparation — invite real players via magic link (admin dashboard → Players → Send Invite) and run pre-tournament smoke test on June 22.

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

## Key Schema Facts

- **`teams.captain_id`**: `uuid` column with NO inline FK. Deferred FK added via `ALTER TABLE` after `players` is defined (circular reference pattern).
- **`teams.max_players`**: `int not null default 4 check (max_players between 2 and 6)` — variable team size.
- **`PlayerRole`**: `'player' | 'admin' | 'tournament_organizer'` — three roles.
- **`scores.override_by` / `override_at`**: audit trail columns for admin overrides.

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

1. **Create GitHub labels** on `ksyed0/FDgolf_CodeMie`: `critical`, `high`, `medium`, `low`, `planvisualizer`
2. **Invite real tournament players** via magic link (admin dashboard → Players → Send Invite)
3. **Pre-tournament smoke test** on tournament day (June 22): confirm login, score submission, leaderboard update end-to-end
