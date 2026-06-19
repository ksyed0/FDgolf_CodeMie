# Testing Guide

## Quick Reference

| Command | What it runs |
|---------|-------------|
| `npm run test` | Jest unit tests (watch mode) |
| `npm run test:ci` | Jest with coverage report (CI mode) |
| `npx playwright test` | All Playwright E2E projects |
| `npx playwright test --project=chromium-tv` | TV leaderboard tests only (no auth needed) |
| `npx playwright test --project=chromium-mobile` | Player-facing tests (needs local Supabase) |
| `npx playwright test --project=chromium-desktop` | Admin-facing tests (needs local Supabase) |
| `npx playwright test --project=chromium-lifecycle` | Full tournament lifecycle (needs local Supabase + Lionhead reset) |
| `npx playwright show-report` | Open last test report in browser |

---

## Unit Tests (Jest)

Located in `src/__tests__/`. Coverage collected from `src/lib/**/*.ts` and `src/app/api/**/*.ts`.

Thresholds (enforced in CI): **≥80%** statements/functions/lines, **≥70%** branches.

```bash
npm run test:ci        # full run with coverage
npx jest src/__tests__/tv-stats.test.ts --no-coverage   # single file
```

---

## E2E Tests (Playwright)

### Prerequisites

1. Local Supabase running: `supabase start` from repo root
2. `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
3. Dev server running: `npm run dev` in a separate terminal

### Projects

| Project | Auth | Test files | Notes |
|---------|------|------------|-------|
| `chromium-tv` | None (public) | `tv-leaderboard.spec.ts` | Mocked Supabase — no real DB needed |
| `chromium-mobile` | Player session | `round-scoring.spec.ts`, `leaderboard.spec.ts`, `dashboard.spec.ts`, `scorecard.spec.ts` | Requires seeded E2E player |
| `chromium-desktop` | Admin session | `admin.spec.ts` | Requires seeded E2E admin |
| `chromium-lifecycle` | Both | `tournament-lifecycle.spec.ts` | Serial, requires Lionhead reset |

### First-time setup

```bash
# Seed E2E users (creates e2e-player + e2e-admin accounts):
npx playwright test --project=chromium-mobile  # global-setup.ts runs automatically

# For lifecycle tests only — reset Lionhead tournament data:
npx tsx scripts/reset-lionhead.ts
```

### Running specific tests

```bash
# By project
npx playwright test --project=chromium-tv

# By file
npx playwright test tests/e2e/round-scoring.spec.ts

# By test title
npx playwright test -g "TC-0020"

# With browser visible (headed mode)
npx playwright test --project=chromium-mobile --headed
```

---

## Reset & Seed Scripts

Located in `scripts/`.

| Script | Purpose |
|--------|---------|
| `scripts/reset-and-seed.sh` | Full DB reset: drops all data, re-applies migrations + seed.sql, creates dev test users |
| `scripts/reset-lionhead.ts` | Creates/resets Lionhead tournament + lifecycle E2E test accounts |
| `supabase/seed-users.ts` | Creates the 5 dev test users only (no DB reset) |

```bash
# Full reset (destructive — wipes all tournament data):
./scripts/reset-and-seed.sh

# Lifecycle test data only (non-destructive to CIBC data):
npx tsx scripts/reset-lionhead.ts
```

---

## Test Logins

See [TEST_LOGINS.md](./TEST_LOGINS.md) for all credentials.

---

## Screenshots

Playwright lifecycle tests save screenshots to `tests/e2e/screenshots/`. They are gitignored.
