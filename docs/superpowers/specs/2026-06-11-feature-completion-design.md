# Feature Completion Design
**Date:** 2026-06-11  
**Status:** Approved  
**Scope:** 6 features required before local testing is complete and cloud deployment begins

---

## Overview

Six features remain unimplemented prior to the June 22 CIBC Capital Markets Golf Tournament. All are local-testable before any cloud deployment. Implementation order follows priority for tournament readiness.

| # | Feature | Story | Files |
|---|---------|-------|-------|
| 1 | Logout (Sign Out tab) | — | `(player)/layout.tsx`, new `SignOutButton` component |
| 2 | Add Team | TC-0056 | `(admin)/admin/teams/teams-manager.tsx`, `teams/page.tsx` |
| 3 | Tournament name edit + Copy URL | TC-0049, TC-0050 | `(admin)/admin/tournament/tournament-controls.tsx`, `tournament/page.tsx` |
| 4 | Hole Summary card | US-0023 | `(player)/round/page.tsx` |
| 5 | Edit Shot (inline history) | US-0021 | `(player)/round/page.tsx` |
| 6 | Password Reset | US-0037 | new `(auth)/forgot-password/page.tsx`, new `(auth)/reset-password/page.tsx`, `(auth)/login/page.tsx` |

---

## Feature 1 — Logout (Sign Out tab)

### Goal
Players have no way to sign out. `/api/auth/signout` currently returns 404. A Sign Out tab must be added to the player bottom nav.

### Decision
Bottom nav 5th tab (chosen over AppHeader dropdown and dashboard-only button). Always accessible, familiar mobile pattern.

### Architecture

**New file:** `src/components/sign-out-button.tsx` — `'use client'` component.  
Calls `supabase.auth.signOut()` then `router.push('/login')`. Uses `LogOut` icon from `lucide-react`. Styled identically to other nav items (flex-col, icon + label, gray text). No API route required — client-side Supabase Auth handles session invalidation and cookie clearing.

**Modified:** `src/app/(player)/layout.tsx`  
Add `<SignOutButton />` as the 5th item in the bottom nav `<div>`. The layout stays a server component; only the button is a client component.

### Error handling
If `signOut()` fails, show a `toast.error` and do not redirect. This should never happen in practice.

### Testing
- Manual: log in as `alice@fdgolf.local`, tap Sign Out tab, verify redirect to `/login` and session cleared.
- E2E TC-0049 (skipped for Radix incompatibility) is unrelated; no new E2E test required — existing auth tests cover session state.

---

## Feature 2 — Add Team

### Goal
Admins cannot create teams from the UI. `TeamsManager` shows and edits existing teams but has no creation path.

### Architecture

**Modified:** `src/app/(admin)/admin/teams/teams-manager.tsx`

Add `tournamentId: string` prop (threaded from the page server component).

Add `showAddForm: boolean` state (default `false`) and `addForm` state object `{ team_name: string, starting_hole: number, max_players: number }`.

**UI:** "Add Team" button (outline, green) at the top of the component. Clicking toggles `showAddForm`. The form renders above the team list:

```
[ Team name (optional)          ]  [Starting hole: 1–18]  [Max: 2–6]
                                              [ Cancel ]  [ Add Team ]
```

**On submit:**
1. Query `max(team_number)` from current `teams` state → `nextNumber = max + 1` (or `1` if no teams).
2. `supabase.from('teams').insert({ tournament_id, team_number: nextNumber, team_name: name || null, starting_hole, max_players })`.
3. On success: append new team to local `teams` state, reset form, hide form, `toast.success('Team added')`.
4. On error: `toast.error(error.message)`.

**Modified:** `src/app/(admin)/admin/teams/page.tsx`  
Pass `tournamentId={tournament?.id ?? ''}` to `<TeamsManager />`.

### Validation
- `starting_hole`: 1–18 (number input, min=1, max=18, required)
- `max_players`: 2–6 (select, default 4)
- `team_name`: optional free text

### Testing
- Manual: create a team, verify it appears in the list with correct team_number, starting hole visible.

---

## Feature 3 — Tournament Name Edit + Copy URL

### Goal
TC-0049: No way to edit tournament name from the admin UI.  
TC-0050: No "Copy URL" button to share the live leaderboard link.

### Architecture

**Name editing — new file:** `src/app/(admin)/admin/tournament/tournament-name-editor.tsx` — `'use client'` component.

Props: `tournamentId: string`, `initialName: string`.

State: `editing: boolean`, `name: string`.

Render: when not editing, shows `<h2>{name}</h2>` with a small pencil icon (`Pencil` from lucide) on hover. When editing, shows an `<Input>` with the current name + Save (`Check`) and Cancel (`X`) icon buttons inline.

On save: `supabase.from('tournaments').update({ name }).eq('id', tournamentId)`. On success: set local name, exit editing, `toast.success('Name saved')`.

**Modified:** `src/app/(admin)/admin/tournament/page.tsx`  
Replace `<h2>{tournament.name}</h2>` with `<TournamentNameEditor tournamentId={tournament.id} initialName={tournament.name} />`.

**Copy URL — modified:** `src/app/(admin)/admin/tournament/tournament-controls.tsx`

Add `slug: string` prop. Add a "Copy live URL" button (outline, with `Copy` icon from lucide) visible in all tournament statuses. On click: `navigator.clipboard.writeText(window.location.origin + '/live/' + slug)` + `toast.success('Link copied!')`.

**Modified:** `src/app/(admin)/admin/tournament/page.tsx`  
Pass `slug={tournament.slug}` to `<TournamentControls />`.

### Testing
- Manual: edit name, refresh page, verify persisted. Copy URL, paste into browser, verify live leaderboard loads.

---

## Feature 4 — Hole Summary Card

### Goal
US-0023: After a player sinks on a hole, show all teammates' stroke counts with the best ball result highlighted. Current UI shows only the active player's score.

ACs:
- AC-0074: Each player's stroke count displayed
- AC-0075: Best ball score highlighted with star indicator

### Architecture

**Modified:** `src/app/(player)/round/page.tsx`

**New state:** `holeSummaryScores: Score[] | null` (null = not yet fetched), `summaryLoading: boolean`.

**Trigger:** When `outcome === 'sunk'` is recorded in `recordShot`, after the upsert succeeds, fetch all scores for `(tournament_id, hole_number)` where `team_id = roundState.team_id`:

```ts
const { data } = await supabase
  .from('scores')
  .select('*')
  .eq('tournament_id', tournament.id)
  .eq('hole_number', roundState.current_hole)
  .in('player_id', teammates.map(p => p.id));
setHoleSummaryScores(data ?? []);
```

Compute best ball client-side as the score with the lowest `strokes` value. The `is_best_ball` DB flag is not relied on for the summary — it is set async by the edge function for leaderboard accuracy and may not be ready yet.

**Replacement card (when `holeSunk === true`):**

```
┌──────────────────────────────────┐
│ ⛳ Hole {N} Complete              │
│ Best Ball: {strokes} ({+/-N} par) │
│                                  │
│ [green row] Alice   3 ★          │
│ [gray row]  John    4            │
│ [gray row]  Bob     —            │
│                                  │
│        [ Next Hole → ]           │
└──────────────────────────────────┘
```

Best ball row: `bg-green-50 border border-green-500 text-green-700 font-bold`.  
Unscored player row: shows `—` in gray (`text-gray-400`).  
Loading state: spinner with "Calculating…" while `summaryLoading`.

**On `nextHole()`:** reset `holeSummaryScores` to `null`.

### Testing
- Manual golden path: record shots, sink, verify summary shows all teammates with correct stroke counts and best ball highlight.

---

## Feature 5 — Edit Shot (Inline History)

### Goal
US-0021: Shot history visible for current hole; tapping a shot opens edit mode.

ACs:
- AC-0068: Shot history visible for current hole
- AC-0069: Tapping a previous shot opens edit mode

### Architecture

**Modified:** `src/app/(player)/round/page.tsx`

**New state:**
- `dbShots: Shot[]` — shots loaded from Supabase for the current hole
- `editingShot: string | null` — ID of the shot currently in edit mode
- `editClub: string`, `editOutcome: ShotOutcome` — edit form state

**Loading:** On mount (after `loadData()`), and after each successful `recordShot`, fetch:

```ts
const { data } = await supabase
  .from('shots')
  .select('*')
  .eq('tournament_id', tournamentId)
  .eq('hole_number', currentHole)
  .in('player_id', teammates.map(p => p.id))
  .order('shot_number');
setDbShots(data ?? []);
```

**UI — "This hole" section** (rendered above the club selector when `dbShots.length > 0` and `!holeSunk`):

```
THIS HOLE
┌─────────────────────────────────────┐
│ Shot 1 · Alice · 7-Iron · In Play  ✏ │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐  ← expanded when editing
│ Shot 2 · John · Driver · OOB       ✏ │
│  Club: [Driver ▾]                    │
│  [In Play] [OOB] [Mulligan]          │
│  [Cancel]              [Save]        │
└─────────────────────────────────────┘
```

Tapping a row sets `editingShot = shot.id`, initialises `editClub` and `editOutcome` from the shot.

**Edit constraints:** Only `in_play`, `out_of_bounds`, `mulligan` outcomes are available in the editor. The `sunk` outcome is intentionally excluded — hole completion is a one-way action. Changing to `sunk` would require re-running score/best-ball logic and is out of scope.

**On save:**
```ts
await supabase.from('shots').update({ club_name: editClub, outcome: editOutcome }).eq('id', editingShot);
setDbShots(prev => prev.map(s => s.id === editingShot ? { ...s, club_name: editClub, outcome: editOutcome } : s));
setEditingShot(null);
toast.success('Shot updated');
```

**On hole advance (`nextHole()`):** reset `dbShots = []`, `editingShot = null`.

### Testing
- Manual: record 2 shots, tap shot 1 row, change club, save, verify row updates. Verify sunk is not an option in edit mode.

---

## Feature 6 — Password Reset

### Goal
US-0037: Players who forget their password can request a reset email.

ACs:
- AC-0125: "Forgot password?" link on login page
- AC-0126: Reset email sent via Supabase Auth

### Architecture

**Modified:** `src/app/(auth)/login/page.tsx`  
Add `<Link href="/forgot-password">` below the password field: `"Forgot password?"` in green (`text-[#1a472a]`).

**New file:** `src/app/(auth)/forgot-password/page.tsx` — `'use client'`  
Email input + submit button. On submit: `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`. Always shows success message ("If that email is registered, you'll receive a reset link") regardless of whether the email exists (security best practice — no user enumeration). Link back to login.

**New file:** `src/app/(auth)/reset-password/page.tsx` — `'use client'`  
New password input + confirm password input + submit button. Validates passwords match client-side. On submit: `supabase.auth.updateUser({ password })`. On success: `toast.success('Password updated')` + redirect to `/dashboard`. On error: `toast.error(error.message)`.

The Supabase PKCE flow handles the `?code=` param on the redirect automatically via the existing middleware — no middleware changes needed.

**Note:** The existing magic link flow (`/api/auth/magic-link`) is unaffected. Password reset is an additional, independent path.

### Testing
- Manual (local): request reset for `alice@fdgolf.local`, check Inbucket at `http://127.0.0.1:54344` for the reset email, follow link, set new password, log in.

---

## Data Flow Summary

No new database tables or migrations required. All features use existing tables via the Supabase JS client.

| Feature | DB operation |
|---------|-------------|
| Logout | `supabase.auth.signOut()` — client-side |
| Add Team | `INSERT INTO teams` |
| Name edit | `UPDATE tournaments SET name` |
| Copy URL | clipboard only — no DB |
| Hole Summary | `SELECT FROM scores WHERE team_id + hole_number` |
| Edit Shot | `SELECT FROM shots`, `UPDATE shots SET club_name, outcome` |
| Password Reset | Supabase Auth built-ins only |

---

## Out of Scope

- 2FA (US-0036) — cut for June 22 deadline
- Editing a shot's outcome to/from `sunk` — requires re-running score + best-ball logic; deferred
- New DB migrations — none required for any of these 6 features
