# Player Self-Service Magic Link Login — Design Spec

**Date**: 2026-06-24
**Story**: US-0036 (EPIC-0010) — reframed from SMS OTP to magic link as the primary auth posture
**Branch**: `feature/US-0036-magic-link-login`

---

## Context

US-0036 was originally written as "SMS OTP / 2FA via Supabase Auth." After brainstorming, the decision was made to formalise magic link as the primary security mechanism for players rather than adding SMS infrastructure. Magic link provides email-possession proof (something you have) without Twilio costs or SMS delivery risk on tournament day.

Password login remains as a fallback for all users. Admins keep password as their primary path since they need reliable access regardless of email speed.

---

## What Changes

### 1. Login Page (`src/app/(auth)/login/page.tsx`)

The existing email + password form is extended with a second submit action.

**Layout:**
- Email field — shared by both paths, always required
- Password field — always visible, required only when "Sign In with Password" is clicked
- Two buttons at the bottom:
  - **"Send Magic Link"** — primary, outlined or ghost style
  - **"Sign In with Password"** — secondary, solid style
- "Forgot password?" link remains below the buttons

**"Send Magic Link" behaviour:**
1. Validates email is non-empty
2. `POST /api/auth/request-link` with `{ email }`
3. Button shows loading spinner during request
4. On response (always 200): button is replaced with a static "Check your email" confirmation message — no redirect, no toast
5. Password field content is irrelevant and ignored

**"Sign In with Password" behaviour:**
- Unchanged from current implementation — `supabase.auth.signInWithPassword({ email, password })` followed by role-based redirect

---

### 2. New API Route: `POST /api/auth/request-link`

**File**: `src/app/api/auth/request-link/route.ts`

**Auth**: None — public endpoint.

**Request body**: `{ email: string }`

**Server logic:**
```
1. If email missing → return 400 { error: 'email is required' }
2. Query players table: SELECT id WHERE email = $email LIMIT 1
3. If player found:
     supabase.admin.generateLink({ type: 'magiclink', email })
     send the generated link via Supabase mailer
4. If player not found: do nothing (no error, no log)
5. Return 200 { ok: true } — identical response for found and not-found
```

**Anti-enumeration**: The `200 { ok: true }` response is unconditional. A caller cannot distinguish "email not in system" from "link sent" by observing the response.

**Rate limiting**: None for v1. The endpoint is invite-only and scoped to ~125 known players.

**Uses**: `SUPABASE_SERVICE_ROLE_KEY` (server-side only) — same pattern as `/api/magic-link`.

---

### 3. What Is Unchanged

| Area | Status |
|------|--------|
| Admin `/api/magic-link` route | Unchanged — admins still send links from the Players page |
| Magic link landing / token exchange | Unchanged |
| Password reset (`/forgot-password`) | Unchanged |
| Registration flow | Unchanged |
| Middleware / route guards | Unchanged |
| Database schema | Unchanged — `players.email` already exists |

---

## Testing

**New file**: `src/__tests__/api-request-link.test.ts` (`@jest-environment node`)

| Case | Expected |
|------|----------|
| Missing email in body | `400 { error: 'email is required' }` |
| Email not in players table | `200 { ok: true }`, `generateLink` not called |
| Email found in players table | `200 { ok: true }`, `generateLink` called with correct email |

Coverage target: ≥ 80% statements on the new route (consistent with project thresholds).

---

## Acceptance Criteria (updated from RELEASE_PLAN.md)

- [x] AC-0122: Self-service magic link available on login page (replaces "2FA enrollment during registration")
- [ ] AC-0123: `POST /api/auth/request-link` sends link only to enrolled players; always returns 200
- [ ] AC-0124: Password login remains as fallback for all users
