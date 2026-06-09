# FDgolf — Release Plan

> CIBC Capital Markets Golf Tournament App — Granite Ridge Golf Club, June 22, 2026

---

## Epics

```
EPIC-0001: Project Setup & Infrastructure
Description: Initialize Next.js 14 project with Supabase, deploy pipeline, shared components, and offline sync engine as foundation layer.
Release Target: MVP (v0.1)
Status: Planned
Dependencies: None
Start Date: 2026-06-08
```

```
EPIC-0002: Registration & Authentication
Description: Player self-registration (3-step wizard), email/password login, auth middleware, and role-based access control.
Release Target: MVP (v0.1)
Status: Planned
Dependencies: EPIC-0001
```

```
EPIC-0003: Player Dashboard
Description: Post-login hub showing tournament info, team members, round status, and quick-access leaderboard link.
Release Target: MVP (v0.1)
Status: Planned
Dependencies: EPIC-0002
```

```
EPIC-0004: Active Round — Shot Tracking
Description: Core gameplay: GPS shot capture, club selection, shot outcomes (In-Play, OOB, Mulligan, Sunk), player rotation within foursome, and offline resilience.
Release Target: MVP (v0.1)
Status: Planned
Dependencies: EPIC-0001, EPIC-0003
```

```
EPIC-0005: Hole & Round Completion
Description: Detect hole completion, calculate Best Ball via Edge Function, display hole summary, and navigate through 18-hole wraparound sequence.
Release Target: MVP (v0.1)
Status: Planned
Dependencies: EPIC-0004
```

```
EPIC-0006: Leaderboard
Description: Real-time team leaderboard (authenticated + public shareable URL), sponsor logo banner, Supabase Realtime subscription.
Release Target: MVP (v0.1)
Status: Planned
Dependencies: EPIC-0005
```

```
EPIC-0007: Admin — Tournament & Course Setup
Description: Admin layout with sidebar, tournament configuration, hole management (par, GPS pins), and club list management.
Release Target: MVP (v0.1)
Status: Planned
Dependencies: EPIC-0001
```

```
EPIC-0008: Admin — Player & Team Management
Description: Player CRUD with team assignment, team creation with starting holes, search unassigned players, auto-assign starting holes.
Release Target: MVP (v0.1)
Status: Planned
Dependencies: EPIC-0007
```

```
EPIC-0009: Admin — Scores & Sponsors
Description: Score override with audit trail, Best Ball recalculation, sponsor logo upload and ordering, CSV export.
Release Target: MVP (v0.1)
Status: Planned
Dependencies: EPIC-0007
```

```
EPIC-0010: Security & 2FA
Description: Phone-based 2FA enrollment, SMS OTP verification, rate limiting, session hardening. Deferred post-tournament.
Release Target: v0.2
Status: Planned
Dependencies: EPIC-0002
```

---

## User Stories

```
US-0001 (EPIC-0001): As a developer, I want the Next.js project initialized with Tailwind and shadcn/ui, so that I can build UI components rapidly.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0001-project-init
Dependencies: None
Acceptance Criteria:
  - [ ] AC-0001: Next.js 14 App Router project runs with `npm run dev`
  - [ ] AC-0002: Tailwind CSS classes render correctly
  - [ ] AC-0003: shadcn/ui Button component renders without errors
```

```
US-0002 (EPIC-0001): As a developer, I want Supabase configured with browser and server clients, so that I can query the database from any context.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0002-supabase-setup
Dependencies: US-0001
Acceptance Criteria:
  - [ ] AC-0004: Browser client connects to Supabase project
  - [ ] AC-0005: Server client works in Server Components
  - [ ] AC-0006: .env.local.example documents required env vars
```

```
US-0003 (EPIC-0001): As a developer, I want the database schema deployed with all tables, RLS policies, and indexes, so that the app has a complete data layer.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0003-database-schema
Dependencies: US-0002
Acceptance Criteria:
  - [ ] AC-0007: All 9 tables created (tournaments, holes, players, teams, clubs, round_state, shots, scores, sponsors)
  - [ ] AC-0008: RLS policies enforce player vs admin separation
  - [ ] AC-0009: Realtime enabled on scores table
  - [ ] AC-0010: Unique constraints prevent duplicate entries
```

```
US-0004 (EPIC-0001): As a developer, I want the project deployed to Vercel, so that we have a production URL for players to register.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0004-vercel-deploy
Dependencies: US-0002
Acceptance Criteria:
  - [ ] AC-0011: Production deployment accessible via public URL
  - [ ] AC-0012: Supabase env vars configured in Vercel
```

```
US-0005 (EPIC-0001): As a developer, I want a Google Maps wrapper component, so that I can display holes and player positions.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0005-google-maps
Dependencies: US-0001
Acceptance Criteria:
  - [ ] AC-0013: Map renders with satellite view centered on pin coordinates
  - [ ] AC-0014: Pin marker displays at hole location
  - [ ] AC-0015: Player position marker updates on GPS capture
```

```
US-0006 (EPIC-0001): As a developer, I want clubs and Granite Ridge hole data seeded, so that the app has course data on first run.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0006-seed-data
Dependencies: US-0003
Acceptance Criteria:
  - [ ] AC-0016: 21 clubs seeded across 5 categories
  - [ ] AC-0017: 18 holes seeded with par values and approximate GPS
  - [ ] AC-0018: Tournament record created for CIBC 2026 event
```

```
US-0007 (EPIC-0001): As a player, I want consistent FDgolf + AI/Run branding on every screen, so that the app feels professional.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0007-header-branding
Dependencies: US-0001
Acceptance Criteria:
  - [ ] AC-0019: Full header shows "FDgolf | created by AI/Run™" with gradient icon
  - [ ] AC-0020: Compact header shows condensed branding + hole info
  - [ ] AC-0021: Dark green (#1a472a) consistent across all variants
```

```
US-0008 (EPIC-0001): As a developer, I want an offline sync engine that queues all writes to localStorage, so that shots are never lost.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0008-sync-engine
Dependencies: US-0001
Acceptance Criteria:
  - [ ] AC-0022: Writes enqueue to localStorage regardless of connectivity
  - [ ] AC-0023: Queue flushes automatically when online
  - [ ] AC-0024: Failed writes retry up to 5 times
  - [ ] AC-0025: Offline indicator shows pending count
  - [ ] AC-0026: Online event triggers immediate flush
```

```
US-0009 (EPIC-0002): As a player, I want to create an account with email and password, so that I can register for the tournament.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0009-registration-step1
Dependencies: US-0002
Acceptance Criteria:
  - [ ] AC-0027: Email/password form validates input (min 6 chars, matching passwords)
  - [ ] AC-0028: Supabase Auth account created on submit
  - [ ] AC-0029: Error displayed for duplicate emails
```

```
US-0010 (EPIC-0002): As a player, I want to enter my profile information, so that tournament organizers know who I am.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0010-registration-step2
Dependencies: US-0009
Acceptance Criteria:
  - [ ] AC-0030: Form captures name, title, company, phone (required) and YOB, gender (optional)
  - [ ] AC-0031: Player record created in players table linked to auth user
```

```
US-0011 (EPIC-0002): As a player, I want to link to my assigned team during registration, so that I can see my teammates.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0011-registration-step3
Dependencies: US-0010
Acceptance Criteria:
  - [ ] AC-0032: Team number input validates against existing teams
  - [ ] AC-0033: Teammates displayed after lookup
  - [ ] AC-0034: Player's team_id updated on registration complete
```

```
US-0012 (EPIC-0002): As a player, I want to log in with my email and password, so that I can access the app.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0012-login
Dependencies: US-0002
Acceptance Criteria:
  - [ ] AC-0035: Email/password form authenticates via Supabase
  - [ ] AC-0036: Successful login redirects to /dashboard
  - [ ] AC-0037: Error message shown for invalid credentials
```

```
US-0013 (EPIC-0002): As a developer, I want auth middleware that protects routes and redirects unauthenticated users, so that player data is secure.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0013-auth-middleware
Dependencies: US-0002
Acceptance Criteria:
  - [ ] AC-0038: Unauthenticated users redirected to /login
  - [ ] AC-0039: Authenticated users on /login redirected to /dashboard
  - [ ] AC-0040: Admin routes check player role before access
  - [ ] AC-0041: Public /live/[slug] route accessible without auth
```

```
US-0014 (EPIC-0003): As a player, I want a dashboard showing my team, tournament info, and a Start Round button, so that I have a clear home screen.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0014-dashboard
Dependencies: US-0013
Acceptance Criteria:
  - [ ] AC-0042: Welcome message with player's first name
  - [ ] AC-0043: Tournament name, venue, and countdown displayed
  - [ ] AC-0044: Team number, starting hole, and teammates listed
  - [ ] AC-0045: "Start Round" button visible when tournament is active
  - [ ] AC-0046: Leaderboard link accessible from dashboard
```

```
US-0015 (EPIC-0004): As a player, I want to start my round and confirm my starting hole, so that shot tracking begins correctly.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0015-start-round
Dependencies: US-0014
Acceptance Criteria:
  - [ ] AC-0047: Starting hole pre-filled from team assignment
  - [ ] AC-0048: round_state record created with status 'in_progress'
  - [ ] AC-0049: Player redirected to shot tracking screen
```

```
US-0016 (EPIC-0004): As a player, I want to see a map of the current hole with the pin location, so that I know where to aim.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0016-hole-map
Dependencies: US-0005, US-0015
Acceptance Criteria:
  - [ ] AC-0050: Google Maps satellite view centered on current hole pin
  - [ ] AC-0051: Pin marker visible with distinct color
  - [ ] AC-0052: Map occupies top ~35% of screen on mobile
```

```
US-0017 (EPIC-0004): As a player, I want to select which team member is taking the current shot, so that we can track all four players from one phone.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0017-player-selector
Dependencies: US-0015
Acceptance Criteria:
  - [ ] AC-0053: Player pills show all team members
  - [ ] AC-0054: Active player highlighted in green
  - [ ] AC-0055: Completed players (hole sunk) shown with strikethrough
  - [ ] AC-0056: Tapping a pill switches active player
```

```
US-0018 (EPIC-0004): As a player, I want to select my club from a grouped dropdown, so that my club choice is recorded per shot.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0018-club-selector
Dependencies: US-0006
Acceptance Criteria:
  - [ ] AC-0057: Dropdown shows active clubs grouped by category (Woods, Hybrids, Irons, Wedges, Putter)
  - [ ] AC-0058: Selected club name stored on shot record
```

```
US-0019 (EPIC-0004): As a player, I want to tap "Capture Shot" to record my GPS position, so that my shot location is tracked.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0019-capture-shot
Dependencies: US-0008, US-0017, US-0018
Acceptance Criteria:
  - [ ] AC-0059: GPS position captured via browser Geolocation API
  - [ ] AC-0060: Shot record written through sync engine (offline-safe)
  - [ ] AC-0061: Player pin appears on map at captured position
  - [ ] AC-0062: GPS permission requested with clear explanation
```

```
US-0020 (EPIC-0004): As a player, I want to choose the outcome of my shot (In-Play, OOB, Mulligan, Sunk), so that scoring is accurate.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0020-shot-outcomes
Dependencies: US-0019
Acceptance Criteria:
  - [ ] AC-0063: Four outcome buttons displayed after shot capture
  - [ ] AC-0064: In-Play records shot and moves to next player
  - [ ] AC-0065: OOB adds +1 penalty stroke and allows rehit
  - [ ] AC-0066: Mulligan discards shot (no stroke counted)
  - [ ] AC-0067: Sunk closes hole for that player
```

```
US-0021 (EPIC-0004): As a player, I want to edit a previous shot, so that I can correct mistakes.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0021-edit-shot
Dependencies: US-0019
Acceptance Criteria:
  - [ ] AC-0068: Shot history visible for current hole
  - [ ] AC-0069: Tapping a previous shot opens edit mode
  - [ ] AC-0070: Modified shot updates in database and recalculates sequence
```

```
US-0022 (EPIC-0005): As a player, I want the hole to complete automatically when all team members have sunk, so that we can see results.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0022-hole-completion
Dependencies: US-0020
Acceptance Criteria:
  - [ ] AC-0071: System detects when all active players have outcome 'sunk'
  - [ ] AC-0072: Best Ball Edge Function called automatically
  - [ ] AC-0073: Hole summary screen displayed
```

```
US-0023 (EPIC-0005): As a player, I want to see a hole summary with everyone's strokes and the best ball highlighted, so that we know team performance.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0023-hole-summary
Dependencies: US-0022
Acceptance Criteria:
  - [ ] AC-0074: Each player's stroke count displayed
  - [ ] AC-0075: Best ball score highlighted with star indicator
  - [ ] AC-0076: Score relative to par shown (birdie, bogey, etc.)
```

```
US-0024 (EPIC-0005): As a player, I want to advance to the next hole with wraparound (e.g., hole 10 start → 10→18→1→9), so that the shotgun format works correctly.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0024-next-hole
Dependencies: US-0023
Acceptance Criteria:
  - [ ] AC-0077: "Next Hole" button advances correctly in sequence
  - [ ] AC-0078: After hole 18, wraps to hole 1
  - [ ] AC-0079: After completing 18 holes total, shows round complete summary
```

```
US-0025 (EPIC-0006): As a player, I want a live team leaderboard showing rankings vs par, so that I can track my team's position.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0025-leaderboard
Dependencies: US-0022
Acceptance Criteria:
  - [ ] AC-0080: Teams ranked by cumulative best-ball score vs par
  - [ ] AC-0081: Top 20 teams shown by default
  - [ ] AC-0082: "Your Team ★" pinned with green highlight (even outside top 20)
  - [ ] AC-0083: "Thru" column shows holes completed per team
  - [ ] AC-0084: Scores update in real-time via Supabase Realtime
```

```
US-0026 (EPIC-0006): As a spectator, I want a public leaderboard URL that works without login, so that I can follow the tournament.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0026-public-leaderboard
Dependencies: US-0025
Acceptance Criteria:
  - [ ] AC-0085: /live/cibc-granite-ridge-2026 loads without authentication
  - [ ] AC-0086: Same leaderboard UI without "Your Team" pin
  - [ ] AC-0087: LIVE badge displayed in header
  - [ ] AC-0088: Sponsor logos visible below header
```

```
US-0027 (EPIC-0006): As a sponsor, I want my logo displayed on the leaderboard, so that I get visibility.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0027-sponsor-banner
Dependencies: US-0025
Acceptance Criteria:
  - [ ] AC-0089: Sponsor logos fetched from sponsors table
  - [ ] AC-0090: Displayed in admin-set order below header
  - [ ] AC-0091: Visible on both authenticated and public leaderboard
```

```
US-0028 (EPIC-0007): As an admin, I want a sidebar navigation with FDgolf + AI/Run branding, so that I can access all admin functions.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0028-admin-layout
Dependencies: US-0007
Acceptance Criteria:
  - [ ] AC-0092: Sidebar shows all 7 admin sections
  - [ ] AC-0093: FDgolf + AI/Run at top, First Derivative at bottom
  - [ ] AC-0094: Active section highlighted with green border
  - [ ] AC-0095: Non-admin users redirected away
```

```
US-0029 (EPIC-0007): As an admin, I want to configure tournament details, so that the event information is correct.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0029-tournament-config
Dependencies: US-0028
Acceptance Criteria:
  - [ ] AC-0096: Edit tournament name, date, venue, format, slug
  - [ ] AC-0097: Copy public leaderboard URL to clipboard
  - [ ] AC-0098: Change tournament status (setup/active/completed)
```

```
US-0030 (EPIC-0007): As an admin, I want to edit hole par values and pin GPS coordinates, so that scoring is accurate.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0030-hole-management
Dependencies: US-0028
Acceptance Criteria:
  - [ ] AC-0099: 18-row table showing hole number, par, handicap, pin lat/lng
  - [ ] AC-0100: Inline editing of par and GPS values
  - [ ] AC-0101: Changes saved to database on submit
```

```
US-0031 (EPIC-0007): As an admin, I want to manage the club list, so that players see the correct clubs.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0031-club-management
Dependencies: US-0028
Acceptance Criteria:
  - [ ] AC-0102: Add, edit, delete clubs
  - [ ] AC-0103: Reorder clubs via sort_order
  - [ ] AC-0104: Activate/deactivate toggle (inactive clubs hidden from players)
```

```
US-0032 (EPIC-0008): As an admin, I want to view and edit player details including team assignment, so that registrations are correct.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0032-player-management
Dependencies: US-0028
Acceptance Criteria:
  - [ ] AC-0105: Searchable player table (125 rows)
  - [ ] AC-0106: Edit modal with all player fields + team dropdown
  - [ ] AC-0107: Password reset button sends reset email
  - [ ] AC-0108: Status indicators (active/pending)
```

```
US-0033 (EPIC-0008): As an admin, I want to create teams, assign players, and set starting holes, so that foursomes are organized.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0033-team-management
Dependencies: US-0028
Acceptance Criteria:
  - [ ] AC-0109: Create new team with team number and optional name
  - [ ] AC-0110: Search and assign unassigned players to team
  - [ ] AC-0111: Set starting hole per team
  - [ ] AC-0112: "Auto-assign starting holes" distributes teams across 1–18
```

```
US-0034 (EPIC-0009): As an admin, I want to override any player's score, so that I can correct errors.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0034-score-override
Dependencies: US-0028
Acceptance Criteria:
  - [ ] AC-0113: Select team → select hole → view individual strokes
  - [ ] AC-0114: Edit stroke count for any player
  - [ ] AC-0115: "Recalculate Best Ball" updates is_best_ball flag
  - [ ] AC-0116: Override logged with admin ID and timestamp
  - [ ] AC-0117: Leaderboard updates immediately after save
```

```
US-0035 (EPIC-0009): As an admin, I want to upload sponsor logos and set their display order, so that sponsors are visible on the leaderboard.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0035-sponsor-management
Dependencies: US-0028
Acceptance Criteria:
  - [ ] AC-0118: Upload PNG/SVG logo to Supabase Storage
  - [ ] AC-0119: Set sponsor name and display order
  - [ ] AC-0120: Toggle sponsor visibility
  - [ ] AC-0121: Preview sponsor bar as it appears on leaderboard
```

```
US-0036 (EPIC-0010): As an admin, I want players to verify their identity via SMS OTP, so that accounts are secure.
Priority: Medium
Estimate: M
Status: Planned
Branch: feature/US-0036-2fa
Dependencies: US-0009
Acceptance Criteria:
  - [ ] AC-0122: 2FA enrollment during registration (optional)
  - [ ] AC-0123: SMS OTP sent via Supabase Auth on login
  - [ ] AC-0124: User can disable 2FA from profile
```

```
US-0037 (EPIC-0002): As a player, I want to reset my password via email, so that I can recover access.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0037-password-reset
Dependencies: US-0012
Acceptance Criteria:
  - [ ] AC-0125: "Forgot password" link on login page
  - [ ] AC-0126: Reset email sent via Supabase Auth
  - [ ] AC-0127: New password accepted after clicking reset link
```

---

## Tasks

```
TASK-0001 (US-0001): Run create-next-app with TypeScript, Tailwind, App Router, src directory
Type: Infra
Assignee: Agent
Status: To Do
Branch: feature/US-0001-project-init
Notes: Use --no-git flag since repo already initialized
```

```
TASK-0002 (US-0001): Install and initialize shadcn/ui with required components
Type: Infra
Assignee: Agent
Status: To Do
Branch: feature/US-0001-project-init
Notes: Components needed: button, input, label, card, select, dialog, table, badge, dropdown-menu, sheet, tabs, toast
```

```
TASK-0003 (US-0002): Create Supabase browser and server client helpers
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0002-supabase-setup
Notes: Follow @supabase/ssr pattern for Next.js App Router
```

```
TASK-0004 (US-0003): Write and apply database migration with all tables, RLS, and indexes
Type: Infra
Assignee: Agent
Status: To Do
Branch: feature/US-0003-database-schema
Notes: 9 tables, enable Realtime on scores table
```

```
TASK-0005 (US-0006): Write and apply seed SQL for clubs, holes, and tournament
Type: Infra
Assignee: Agent
Status: To Do
Branch: feature/US-0006-seed-data
Notes: 21 clubs, 18 holes for Granite Ridge, 1 tournament record
```

```
TASK-0006 (US-0008): Implement offline sync engine with localStorage queue and auto-flush
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0008-sync-engine
Notes: All writes go through sync engine — online or offline. React hook with useSyncExternalStore.
```

```
TASK-0007 (US-0007): Create AppHeader component (full and compact variants)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0007-header-branding
Notes: FDgolf + AI/Run gradient icon + "created by AI/Run™" text
```

```
TASK-0008 (US-0013): Create Next.js middleware with auth session refresh and route protection
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0013-auth-middleware
Notes: Protect all routes except /login, /register, /live/[slug]
```

```
TASK-0009 (US-0009): Build registration Step 1 (email/password with Supabase Auth signUp)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0009-registration-step1
Notes:
```

```
TASK-0010 (US-0010): Build registration Step 2 (profile form → players table insert)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0010-registration-step2
Notes:
```

```
TASK-0011 (US-0011): Build registration Step 3 (team lookup and linking)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0011-registration-step3
Notes: Query teams by team_number, display teammates, update team_id
```

```
TASK-0012 (US-0012): Build login page with Supabase signInWithPassword
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0012-login
Notes:
```

```
TASK-0013 (US-0014): Build player dashboard page
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0014-dashboard
Notes: Server Component fetching player, team, tournament data
```

```
TASK-0014 (US-0005): Create Google Maps wrapper component with pin and player markers
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0005-google-maps
Notes: Uses @googlemaps/js-api-loader, satellite view, markers for pin and player
```

```
TASK-0015 (US-0019): Implement GPS capture utility and React hook
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0019-capture-shot
Notes: High accuracy, 10s timeout, distance calculation (Haversine)
```

```
TASK-0016 (US-0017): Build player pills component for team member selection
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0017-player-selector
Notes: Active/waiting/done states, tap to switch, "Enter shot for [name]" semantics
```

```
TASK-0017 (US-0018): Build club selector dropdown grouped by category
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0018-club-selector
Notes: Fetch active clubs, group by category, sorted by sort_order
```

```
TASK-0018 (US-0020): Build shot outcome buttons with scoring logic
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0020-shot-outcomes
Notes: In-Play (record), OOB (+1 penalty), Mulligan (discard), Sunk (close hole)
```

```
TASK-0019 (US-0015): Build round page state machine (capture → outcome → next player loop)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0015-start-round
Notes: Integrates map, player pills, club selector, capture button, outcome buttons, sync engine
```

```
TASK-0020 (US-0022): Implement hole completion detection and Best Ball Edge Function
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0022-hole-completion
Notes: Supabase Edge Function calculates strokes, marks is_best_ball, broadcasts via Realtime
```

```
TASK-0021 (US-0023): Build hole summary screen
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0023-hole-summary
Notes: Show each player's strokes, highlight best ball, score vs par
```

```
TASK-0022 (US-0024): Implement next-hole navigation with wraparound
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0024-next-hole
Notes: Starting hole 10 → plays 10,11,...18,1,2,...9. Detect round complete after 18 holes.
```

```
TASK-0023 (US-0025): Build authenticated leaderboard with Realtime subscription
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0025-leaderboard
Notes: Uses get_leaderboard RPC, Supabase Realtime channel on scores table
```

```
TASK-0024 (US-0026): Build public leaderboard page at /live/[slug]
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0026-public-leaderboard
Notes: No auth, fetches tournament by slug, same leaderboard UI, LIVE badge
```

```
TASK-0025 (US-0027): Build sponsor banner component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0027-sponsor-banner
Notes: Fetch active sponsors ordered by display_order, display logos
```

```
TASK-0026 (US-0028): Build admin sidebar navigation and layout
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0028-admin-layout
Notes: Branding, nav items, role check, First Derivative logo footer
```

```
TASK-0027 (US-0029): Build tournament configuration admin page
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0029-tournament-config
Notes: Edit name, date, venue, format, slug, status. Copy public URL button.
```

```
TASK-0028 (US-0030): Build hole management admin page
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0030-hole-management
Notes: 18-row table, inline edit par/handicap/GPS
```

```
TASK-0029 (US-0031): Build club management admin page
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0031-club-management
Notes: CRUD table, reorder, activate/deactivate
```

```
TASK-0030 (US-0032): Build player management admin page with team assignment
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0032-player-management
Notes: Searchable table, edit modal with team dropdown, password reset
```

```
TASK-0031 (US-0033): Build team management admin page
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0033-team-management
Notes: Team list, create/edit modal, player search, auto-assign starting holes
```

```
TASK-0032 (US-0034): Build score override admin page
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0034-score-override
Notes: Select team → hole → edit strokes → recalculate best ball → audit trail
```

```
TASK-0033 (US-0035): Build sponsor management admin page
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0035-sponsor-management
Notes: Upload to Supabase Storage, reorder, toggle visibility, live preview
```

```
TASK-0034 (US-0025): Write get_leaderboard Postgres RPC function
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0025-leaderboard
Notes: Aggregates best-ball scores per team, ranks by score vs par
```

```
TASK-0035 (US-0021): Implement shot edit/re-enter functionality
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0021-edit-shot
Notes: Shot history list, tap to edit, update via sync engine
```
