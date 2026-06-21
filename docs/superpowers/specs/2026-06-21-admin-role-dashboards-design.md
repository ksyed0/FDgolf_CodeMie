# Design: System Admin UI & Scoped Tournament Admin Dashboard

**Date:** 2026-06-21  
**Status:** Approved — ready for implementation planning  
**Scope:** Role-differentiated admin experience for `system_admin` and `tournament_admin`

---

## Background

v0.6 introduced `system_admin` and `tournament_admin` roles with `tournament_admin_assignments(player_id, tournament_id)` as the scoping table and `is_system_admin()` / `is_tournament_admin(uuid)` as RLS helper functions. Both roles currently see the same admin sidebar and pages with no visual or data scoping.

---

## Goals

1. System admins can manage global entities (venues, courses, tournaments, clubs) and assign tournament admins to tournaments
2. Tournament admins can manage only their tournament's roster, teams, scores, and sponsors
3. A player assigned to 2+ tournaments as tournament admin sees a picker before entering the admin
4. No new route prefix — both roles use `/admin/`

---

## Architecture

### Approach: Role-aware single layout + active-tournament cookie

`AdminLayout` (server component) fetches the player's `role` and their `tournament_admin_assignments` in one query. It drives all routing and scoping decisions at the layout boundary:

```
AdminLayout (server)
  ├─ fetch player: { id, role }
  ├─ if system_admin
  │    └─ render full sidebar + page (no tournament scoping required)
  ├─ if tournament_admin
  │    ├─ fetch tournament_admin_assignments → [{ tournament_id, name }]
  │    ├─ 0 assignments  → redirect /dashboard
  │    ├─ 1 assignment   → set x-active-tournament cookie, render scoped sidebar
  │    └─ 2+ assignments → redirect /admin/select-tournament (picker)
  └─ AdminSidebar receives: { role, activeTournament?: { id, name } }
```

**Active tournament cookie:** `x-active-tournament` (httpOnly, same-site, no expiry). Set by the layout for single-assignment admins and by the `/admin/select-tournament` page for multi-assignment admins. System admins can override it via a sidebar tournament switcher dropdown. All server pages read it via `cookies()` to scope queries.

---

## Sidebar Structure

### System admin sidebar

```
GLOBAL
  Tournaments     /admin/tournaments    ← new
  Players         /admin/players        ← global registry
  Venues          /admin/venues
  Courses         /admin/courses
  Clubs           /admin/clubs

THIS TOURNAMENT   [switcher dropdown]
  Roster          /admin/roster         ← new
  Teams           /admin/teams
  Scores          /admin/scores
  Sponsors        /admin/sponsors
```

### Tournament admin sidebar (same component, shorter)

```
THIS TOURNAMENT   [tournament name, read-only]
  Roster          /admin/roster
  Teams           /admin/teams
  Scores          /admin/scores
  Sponsors        /admin/sponsors
```

`AdminSidebar` is a single component. It receives `role` and `activeTournament` as props and conditionally renders the Global section.

---

## New & Modified Pages

### New: `/admin/tournaments` (system admin only)

- Card list of all tournaments ordered by date desc
- Each card: name, date, status badge, venue name, team count, player count
- Inline create form (slide-down): name, slug, date, venue (dropdown), course (dropdown), format, status
- Card links through to existing `/admin/tournament` detail page

### New: `/admin/roster` (both roles, scoped)

Tournament-scoped player roster for the active tournament. Three actions:

1. **Add existing player** — search modal queries global `players` table (name/email), shows result list, clicking a player assigns them: picks team (dropdown of tournament's teams) → inserts into `tournament_players`
2. **New player & enroll** — inline form: name, email, company, title → creates `players` row + inserts into `tournament_players` in a single operation (with team assignment)
3. **Remove from tournament** — removes from `tournament_players` only; player record stays in global registry; requires confirmation

Displays: player name, email, company, team name, edit (inline fields), remove.

### New: `/admin/select-tournament` (tournament admin with 2+ assignments only)

Simple picker screen shown before entering the admin. Lists the tournament admin's assigned tournaments (name, date, status). Clicking one sets `x-active-tournament` cookie and redirects to `/admin/roster`.

### Modified: `/admin/tournament` — Admins panel

New section at the bottom of the existing tournament detail page (system admin only):

- **Current admins list:** player name, email, role tag, "Remove" button (deletes from `tournament_admin_assignments`)
- **Add admin:** player search input → inserts `{ player_id, tournament_id }` into `tournament_admin_assignments`; if the selected player's role is not `tournament_admin`, also updates `players.role` to `tournament_admin`

### Modified: `AdminLayout`

- Fetches `tournament_admin_assignments` for `tournament_admin` users
- Handles picker redirect
- Sets `x-active-tournament` cookie for single-assignment admins

### Modified: `AdminSidebar`

- Accepts `{ role, activeTournament?: { id, name } }` props
- Renders Global section only for `system_admin`
- Renders tournament switcher dropdown for `system_admin` (calls a server action to update the cookie)
- Renders tournament name label (read-only) for `tournament_admin`
- Roster link replaces the old Players link in the "This Tournament" section

### Modified: `/admin/players`

- Remains global registry (system admin only — hidden from tournament admin sidebar)
- Adds "Tournaments" column: comma-separated list of tournament names the player is enrolled in (via `tournament_players` join)

---

## Data Flow: Roster Enrollment

```
"Add Existing" flow:
  search input → GET /admin/roster?q=name (server action or client fetch)
    → SELECT * FROM players WHERE name ILIKE '%q%'
  select player + team → server action:
    → INSERT INTO tournament_players (player_id, team_id, tournament_id) ON CONFLICT DO NOTHING

"New Player" flow:
  fill form → server action:
    → INSERT INTO players (name, email, company, title, role='player')
    → INSERT INTO tournament_players (player_id, team_id, tournament_id)
```

---

## Access Control Summary

| Page | system_admin | tournament_admin |
|---|---|---|
| `/admin/tournaments` | ✅ | ❌ (not in sidebar) |
| `/admin/players` | ✅ | ❌ (not in sidebar) |
| `/admin/venues` | ✅ | ❌ |
| `/admin/courses` | ✅ | ❌ |
| `/admin/clubs` | ✅ | ❌ |
| `/admin/roster` | ✅ (active tournament) | ✅ (assigned tournament) |
| `/admin/teams` | ✅ | ✅ |
| `/admin/scores` | ✅ | ✅ |
| `/admin/sponsors` | ✅ | ✅ |
| `/admin/tournament` | ✅ (incl. Admins panel) | ✅ (no Admins panel) |
| `/admin/select-tournament` | ❌ | ✅ (2+ assignments only) |

RLS enforces all boundaries server-side regardless of UI access.

---

## Out of Scope

- Holes admin page (exists but not linked in sidebar — system admin only if added later)
- Email notifications when a tournament admin is assigned
- Tournament admin creating new venues or courses
- Audit log of admin actions
