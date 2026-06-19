# Test Logins

All credentials for local testing. These accounts only exist in the **local Supabase instance** — never in production.

---

## Local Dev Users

Seeded by `supabase/seed-users.ts` (or `scripts/reset-and-seed.sh`).

| Email | Password | Role | Team |
|-------|----------|------|------|
| `admin@fdgolf.local` | `Password1!` | Admin | — |
| `alice@fdgolf.local` | `Password1!` | Player | Team Alpha (captain) |
| `john@fdgolf.local` | `Password1!` | Player | Team Alpha |
| `bob@fdgolf.local` | `Password1!` | Player | Team Bravo (captain) |
| `jane@fdgolf.local` | `Password1!` | Player | Team Bravo |

Login at: http://localhost:3000/login

---

## Playwright E2E Users

Created automatically by `tests/e2e/global-setup.ts` when `SUPABASE_SERVICE_ROLE_KEY` is set.

| Email | Password | Role | Used by |
|-------|----------|------|---------|
| `e2e-player@fdgolf.test` | `E2ePassword123!` | Player | `chromium-mobile` project |
| `e2e-admin@fdgolf.test` | `E2eAdminPass456!` | Admin | `chromium-desktop` (admin) project |

---

## Lifecycle E2E Users

Created by `scripts/reset-lionhead.ts` for the tournament lifecycle spec.

| Email | Password | Role | Team |
|-------|----------|------|------|
| `e2e-lion-a@fdgolf.test` | `E2eLionA789!` | Player | Team Alpha (captain) |
| `e2e-lion-b@fdgolf.test` | `E2eLionB789!` | Player | Team Beta |

Run `npx tsx scripts/reset-lionhead.ts` to create/reset these accounts and their tournament data.

---

## Fixture-Only Players (no auth login)

Inserted by `global-setup.ts` for search/filter tests. Not auth accounts — DB records only.

| Name | Email |
|------|-------|
| Alice Nguyen | `alice@fdgolf.test` |
| John Smith | `john.smith@fdgolf.test` |
| Jane Smith | `jane.smith@fdgolf.test` |
