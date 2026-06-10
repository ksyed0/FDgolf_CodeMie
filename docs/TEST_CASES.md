# FDgolf — Test Cases

> CIBC Capital Markets Golf Tournament App — Granite Ridge Golf Club, June 22, 2026
>
> Format: PlanVisualizer TC-XXXX. Status starts as `[ ] Not Run`; update to `[x] Pass` or `[x] Fail` after execution.
> All test cases reference ACs from `docs/RELEASE_PLAN.md`.

---

## EPIC-0002 — Registration & Authentication

TC-0001: Player completes 3-step registration (happy path)
Related Story: US-0009
Related Task: TASK-0009
Related AC: AC-0027
Type: Functional
Preconditions: Tournament status is "active"; team number 7 exists; test email not previously registered.
Steps:
  1. Open /register
  2. Enter valid email and password (8+ chars)
  3. Click "Create Account"
  4. Enter display name and phone number on Step 2
  5. Click "Continue"
  6. Enter team number 7 on Step 3
  7. Click "Join Team"
Expected Result: Account created; player linked to team; redirected to /dashboard showing team members.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0002: Registration — duplicate email rejected
Related Story: US-0009
Related Task: TASK-0009
Related AC: AC-0028
Type: Negative
Preconditions: player@example.com already exists in Supabase Auth.
Steps:
  1. Open /register
  2. Enter player@example.com and any password
  3. Click "Create Account"
Expected Result: Error message "Email already registered" shown; user remains on Step 1.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0003: Registration — password validation enforced on Step 1
Related Story: US-0009
Related Task: TASK-0009
Related AC: AC-0029
Type: Negative
Preconditions: None.
Steps:
  1. Open /register
  2. Enter valid email, then enter password "abc" (3 chars)
  3. Attempt to submit Step 1
Expected Result: Validation error displayed before form is submitted; "Create Account" request not sent to Supabase.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0004: Registration Step 2 — profile fields validated (name required)
Related Story: US-0010
Related Task: TASK-0010
Related AC: AC-0030
Type: Negative
Preconditions: Step 1 completed; on Step 2.
Steps:
  1. Leave display name blank
  2. Click "Continue"
Expected Result: Validation error on name field; form not submitted.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0005: Registration Step 3 — invalid team number shows error
Related Story: US-0011
Related Task: TASK-0011
Related AC: AC-0034
Type: Negative
Preconditions: Steps 1 and 2 complete; team 999 does not exist.
Steps:
  1. Enter team number 999 on Step 3
  2. Click "Join Team"
Expected Result: Error message "Team not found"; player not linked to any team.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0006: Registration Step 3 — team at capacity rejected
Related Story: US-0011
Related Task: TASK-0011
Related AC: AC-0034
Type: Edge Case
Preconditions: Team 3 already has max_players (4) members.
Steps:
  1. Reach Step 3 of registration
  2. Enter team number 3
  3. Click "Join Team"
Expected Result: Error "Team is full" displayed; player not linked to team.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0007: Player logs in with valid email and password
Related Story: US-0012
Related Task: TASK-0012
Related AC: AC-0035
Type: Functional
Preconditions: Player account exists for test@example.com with password "correct-password".
Steps:
  1. Open /login
  2. Enter test@example.com and "correct-password"
  3. Click "Sign In"
Expected Result: Session cookie set; redirected to /dashboard.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0008: Login — wrong password shows error
Related Story: US-0012
Related Task: TASK-0012
Related AC: AC-0036
Type: Negative
Preconditions: Player account exists for test@example.com.
Steps:
  1. Open /login
  2. Enter test@example.com and "wrong-password"
  3. Click "Sign In"
Expected Result: Generic error "Invalid email or password" shown; no session created.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0009: Login — unknown email shows generic error (no account enumeration)
Related Story: US-0012
Related Task: TASK-0012
Related AC: AC-0036
Type: Negative
Preconditions: nobody@example.com does not exist in Supabase Auth.
Steps:
  1. Open /login
  2. Enter nobody@example.com and any password
  3. Click "Sign In"
Expected Result: Same "Invalid email or password" error as TC-0008; no indication account doesn't exist.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0010: Auth middleware — unauthenticated user redirected to /login
Related Story: US-0013
Related Task: TASK-0008
Related AC: AC-0038
Type: Functional
Preconditions: No active session cookie.
Steps:
  1. Open /dashboard in incognito window
Expected Result: Browser redirected to /login immediately.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0011: Auth middleware — logged-in user redirected away from /login
Related Story: US-0013
Related Task: TASK-0008
Related AC: AC-0039
Type: Functional
Preconditions: Valid session cookie active for a player role account.
Steps:
  1. Navigate directly to /login
Expected Result: Redirected to /dashboard; login page not shown.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0012: Auth middleware — player role blocked from /admin routes
Related Story: US-0013
Related Task: TASK-0008
Related AC: AC-0040
Type: Functional
Preconditions: Valid session for a player role account.
Steps:
  1. Navigate to /admin/tournament
Expected Result: Redirected to /dashboard; admin page not shown.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0013: Auth middleware — /live/slug accessible without authentication
Related Story: US-0013
Related Task: TASK-0008
Related AC: AC-0041
Type: Functional
Preconditions: No session cookie; tournament slug "cibc-granite-ridge-2026" exists.
Steps:
  1. Open /live/cibc-granite-ridge-2026 in incognito window
Expected Result: Public leaderboard renders; no redirect to /login.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0014: Magic link — player session created on link click
Related Story: US-0015
Related Task: N/A
Related AC: AC-0047
Type: Functional
Preconditions: Admin has triggered magic link for player email via /admin/players. Email received.
Steps:
  1. Open magic link URL from email in browser
  2. Observe redirect target
Expected Result: Session created; browser lands on /auth/magic-link; player either directed to profile form or /dashboard.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0015: Magic link — profile completion form shown for new player
Related Story: US-0015
Related Task: N/A
Related AC: AC-0048
Type: Functional
Preconditions: Player clicked magic link for first time; no prior profile.
Steps:
  1. Complete magic link auth flow
  2. Observe /auth/magic-link page
Expected Result: Profile form displayed asking for display name; player not yet on /dashboard.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

## EPIC-0003 — Player Dashboard

TC-0016: Dashboard shows team name, members, and starting hole
Related Story: US-0014
Related Task: TASK-0013
Related AC: AC-0042
Type: Functional
Preconditions: Player logged in; assigned to team 5 with starting hole 14; team has 3 other members.
Steps:
  1. Navigate to /dashboard
Expected Result: Team card shows team name, 4 player names, and "Starting Hole: 14".
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0017: Dashboard shows current round status
Related Story: US-0014
Related Task: TASK-0013
Related AC: AC-0043
Type: Functional
Preconditions: Round in progress for team; currently on hole 7.
Steps:
  1. Navigate to /dashboard
Expected Result: Round status shows "In Progress — Hole 7" or equivalent.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0018: Dashboard "Start Round" navigates to /round
Related Story: US-0014
Related Task: TASK-0013
Related AC: AC-0044
Type: Functional
Preconditions: Player logged in; round not yet started (status: not_started).
Steps:
  1. Navigate to /dashboard
  2. Click "Start Round" button
Expected Result: Navigated to /round; round status changes to "in_progress".
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0019: Dashboard shows quick-link to leaderboard
Related Story: US-0014
Related Task: TASK-0013
Related AC: AC-0046
Type: Functional
Preconditions: Player logged in.
Steps:
  1. Navigate to /dashboard
  2. Click leaderboard link
Expected Result: Navigated to /leaderboard; team standings visible.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

## EPIC-0004 — Active Round / Shot Tracking

TC-0020: Round page shows active player indicator
Related Story: US-0017
Related Task: N/A
Related AC: AC-0053
Type: Functional
Preconditions: Player on /round; round in progress; active player is "Alice".
Steps:
  1. Observe /round page
Expected Result: Alice's player card highlighted as active; other players shown as inactive.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0021: Tapping a player card selects that player as active shooter
Related Story: US-0017
Related Task: N/A
Related AC: AC-0054
Type: Functional
Preconditions: On /round; multiple team members visible.
Steps:
  1. Tap on player card for "Bob"
Expected Result: Bob's card highlighted; club selector updates to Bob's last-used club.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0022: Club selector shows clubs grouped by category
Related Story: US-0018
Related Task: N/A
Related AC: AC-0057
Type: Functional
Preconditions: On /round; clubs seeded with 21 active clubs across 5 categories.
Steps:
  1. Open club selector dropdown
Expected Result: Clubs grouped into: Woods, Hybrids, Irons, Wedges, Putter.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0023: Inactive club not shown in player club selector
Related Story: US-0018
Related Task: N/A
Related AC: AC-0057
Type: Edge Case
Preconditions: "3 Wood" club is deactivated in admin clubs table.
Steps:
  1. Open club selector dropdown on /round
Expected Result: "3 Wood" does not appear in the dropdown list.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0024: GPS position captured on "Capture Shot" tap
Related Story: US-0019
Related Task: TASK-0006
Related AC: AC-0059
Type: Functional
Preconditions: Device has geolocation permission granted; on /round.
Steps:
  1. Select active player and club
  2. Tap "Capture Shot"
Expected Result: GPS lat/lng captured and shown; player pin appears on map at captured position.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0025: GPS permission prompt shown on first use
Related Story: US-0019
Related Task: N/A
Related AC: AC-0062
Type: Functional
Preconditions: Browser geolocation permission not yet granted.
Steps:
  1. Navigate to /round for the first time
Expected Result: Browser geolocation permission dialog appears with explanation text.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0026: Shot recorded offline — queued in SyncEngine
Related Story: US-0008
Related Task: TASK-0006
Related AC: AC-0060
Type: Edge Case
Preconditions: On /round; device network disconnected (airplane mode).
Steps:
  1. Capture shot with GPS
  2. Select "In Play" outcome
Expected Result: Shot accepted in UI without error; offline indicator shows "1 pending"; entry in localStorage.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0027: SyncEngine flushes queue on network reconnect
Related Story: US-0008
Related Task: TASK-0006
Related AC: AC-0060
Type: Edge Case
Preconditions: 2 shots queued in localStorage while offline.
Steps:
  1. Reconnect device to network
  2. Wait up to 10 seconds
Expected Result: Offline indicator clears to 0 pending; both shots appear in Supabase shots table.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0028: SyncEngine drops entry after 5 consecutive failures
Related Story: US-0008
Related Task: TASK-0006
Related AC: AC-0060
Type: Edge Case
Preconditions: Shot in SyncEngine queue; /api/shots returns 500 on every attempt.
Steps:
  1. Trigger 5 flush attempts (wait ~50s with 10s interval)
Expected Result: Entry removed from queue; no further API calls for that entry.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0029: In-Play outcome records shot and rotates to next player
Related Story: US-0020
Related Task: N/A
Related AC: AC-0064
Type: Functional
Preconditions: On /round; Alice is active player; 3 other players in team.
Steps:
  1. Capture shot for Alice
  2. Tap "In Play" outcome button
Expected Result: Shot written to DB; rotation moves to next player; Alice's card no longer highlighted.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0030: OOB outcome adds +1 penalty stroke and shows rehit prompt
Related Story: US-0020
Related Task: N/A
Related AC: AC-0065
Type: Functional
Preconditions: On /round; Alice is active player.
Steps:
  1. Capture shot for Alice
  2. Tap "Out of Bounds" outcome
Expected Result: Penalty shot added (stroke count +1); prompt shown to capture rehit from same position.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0031: Mulligan outcome discards shot — no stroke counted
Related Story: US-0020
Related Task: N/A
Related AC: AC-0066
Type: Functional
Preconditions: On /round; Bob is active player; mulligans available.
Steps:
  1. Capture shot for Bob
  2. Tap "Mulligan" outcome
Expected Result: Shot record discarded; Bob's stroke count unchanged; Bob remains active to reshoot.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0032: Sunk outcome closes hole for that player
Related Story: US-0020
Related Task: N/A
Related AC: AC-0067
Type: Functional
Preconditions: On /round; Carol is active player.
Steps:
  1. Capture shot for Carol
  2. Tap "Sunk" outcome
Expected Result: Carol's hole marked complete; remaining players still active for this hole.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

## EPIC-0005 — Hole & Round Completion

TC-0033: Hole completes when all team members have sunk
Related Story: US-0022
Related Task: N/A
Related AC: AC-0071
Type: Functional
Preconditions: On /round hole 3; Alice, Bob, Carol previously sunk; Dave is last active player.
Steps:
  1. Capture Dave's shot and tap "Sunk"
Expected Result: Hole completion detected; hole summary screen displayed.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0034: Best Ball Edge Function called on hole completion
Related Story: US-0022
Related Task: N/A
Related AC: AC-0072
Type: Functional
Preconditions: All 4 players have sunk on hole 3.
Steps:
  1. Observe response after last Sunk outcome
Expected Result: calculate-best-ball Edge Function invoked; scores.is_best_ball set for minimum stroke player.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0035: Hole summary shows each player's stroke count
Related Story: US-0023
Related Task: N/A
Related AC: AC-0074
Type: Functional
Preconditions: Hole 3 completed; Alice 4, Bob 3, Carol 5, Dave 4 strokes.
Steps:
  1. View hole summary screen
Expected Result: Summary shows Alice: 4, Bob: 3, Carol: 5, Dave: 4.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0036: Best ball highlighted with star on hole summary
Related Story: US-0023
Related Task: N/A
Related AC: AC-0075
Type: Functional
Preconditions: Hole summary showing; Bob has lowest stroke count (3) — is_best_ball = true.
Steps:
  1. Observe hole summary screen
Expected Result: Bob's row shows ★ indicator; other rows do not.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0037: Score vs par label shown on hole summary (birdie/par/bogey)
Related Story: US-0023
Related Task: N/A
Related AC: AC-0076
Type: Functional
Preconditions: Hole 3 par is 4; best ball score is 3.
Steps:
  1. View hole summary
Expected Result: Score label shows "Birdie" or "-1" for the best ball result.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0038: Shotgun wraparound — hole 18 advances to hole 1
Related Story: US-0024
Related Task: N/A
Related AC: AC-0078
Type: Edge Case
Preconditions: Team starting hole is 14; currently on hole 18 (last before wrap).
Steps:
  1. Complete hole 18
  2. Tap "Next Hole"
Expected Result: Current hole becomes 1; hole counter shows 1, not 19.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0039: Round complete summary shown after 18 holes
Related Story: US-0024
Related Task: N/A
Related AC: AC-0079
Type: Functional
Preconditions: Team has completed exactly 18 holes.
Steps:
  1. Tap "Next Hole" after completing the 18th hole
Expected Result: "Round Complete" screen displayed with total team score; no further hole navigation.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

## EPIC-0006 — Leaderboard

TC-0040: Leaderboard ranks teams by best-ball score vs par
Related Story: US-0025
Related Task: N/A
Related AC: AC-0080
Type: Functional
Preconditions: Player logged in; 5+ teams with varying scores in database.
Steps:
  1. Navigate to /leaderboard
Expected Result: Teams ordered ascending by (total_best_ball_score - par_total); lowest score at top.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0041: "Your Team ★" row pinned with green highlight outside top 20
Related Story: US-0025
Related Task: N/A
Related AC: AC-0082
Type: Edge Case
Preconditions: Player's team is ranked 24th; top 20 visible.
Steps:
  1. Navigate to /leaderboard
Expected Result: Top 20 teams shown; player's team appears below as pinned entry with ★ and green highlight.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0042: Leaderboard "Thru" column shows holes completed per team
Related Story: US-0025
Related Task: N/A
Related AC: AC-0083
Type: Functional
Preconditions: Team A: 9 holes complete; Team B: 0 holes complete.
Steps:
  1. Navigate to /leaderboard
Expected Result: Team A shows "9" in Thru column; Team B shows "0" or "-".
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0043: Public leaderboard loads without authentication
Related Story: US-0026
Related Task: N/A
Related AC: AC-0085
Type: Functional
Preconditions: No session cookie; tournament slug cibc-granite-ridge-2026 exists and is active.
Steps:
  1. Open /live/cibc-granite-ridge-2026 in incognito window
Expected Result: Leaderboard renders with team standings; no login prompt; no "Your Team" pin row.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0044: LIVE badge visible on public leaderboard header
Related Story: US-0026
Related Task: N/A
Related AC: AC-0087
Type: Functional
Preconditions: Tournament status is "active".
Steps:
  1. Open /live/cibc-granite-ridge-2026
Expected Result: Header shows "LIVE" badge.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0045: Sponsor logos visible on public leaderboard
Related Story: US-0027
Related Task: N/A
Related AC: AC-0089
Type: Functional
Preconditions: 3 active sponsors with logos configured.
Steps:
  1. Open /live/cibc-granite-ridge-2026
Expected Result: Sponsor logos displayed below header in configured display_order.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0046: Leaderboard updates in real-time after score change
Related Story: US-0025
Related Task: N/A
Related AC: AC-0084
Type: Functional
Preconditions: /leaderboard open; another device completes a hole.
Steps:
  1. Wait up to 10 seconds after a hole is completed on another device
Expected Result: Leaderboard re-renders with updated score within ~6 seconds (5 s debounce + query time).
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

## EPIC-0007 — Admin: Tournament & Course Setup

TC-0047: Admin sidebar shows all 7 management sections
Related Story: US-0028
Related Task: N/A
Related AC: AC-0092
Type: Functional
Preconditions: Logged in as admin role.
Steps:
  1. Navigate to /admin/tournament
Expected Result: Left sidebar shows: Tournament, Holes, Clubs, Players, Teams, Scores, Sponsors.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0048: Non-admin user cannot reach admin routes
Related Story: US-0028
Related Task: TASK-0008
Related AC: AC-0095
Type: Functional
Preconditions: Logged in as player role.
Steps:
  1. Navigate to /admin/tournament
Expected Result: Redirected to /dashboard.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0049: Tournament config edits saved to database
Related Story: US-0029
Related Task: N/A
Related AC: AC-0096
Type: Functional
Preconditions: Admin on /admin/tournament.
Steps:
  1. Edit tournament name to "CIBC 2026 Updated"
  2. Click Save
Expected Result: tournaments.name updated in Supabase; page shows updated value after save.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0050: Copy public leaderboard URL to clipboard
Related Story: US-0029
Related Task: N/A
Related AC: AC-0097
Type: Functional
Preconditions: Admin on /admin/tournament; tournament has slug.
Steps:
  1. Click "Copy Leaderboard URL" button
Expected Result: Clipboard contains https://<domain>/live/<slug>; success toast shown.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0051: Hole par values editable inline and saved
Related Story: US-0030
Related Task: N/A
Related AC: AC-0100
Type: Functional
Preconditions: Admin on /admin/holes.
Steps:
  1. Click par value cell for hole 7
  2. Change value from 4 to 5
  3. Click Save
Expected Result: holes.par = 5 for hole 7 updated in Supabase.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0052: Club deactivation hides club from player selector
Related Story: US-0031
Related Task: N/A
Related AC: AC-0104
Type: Functional
Preconditions: "Pitching Wedge" is active in clubs table.
Steps:
  1. Admin on /admin/clubs — toggle "Pitching Wedge" to inactive
  2. Player on /round opens club selector
Expected Result: "Pitching Wedge" does not appear in club dropdown.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

## EPIC-0008 — Admin: Players & Teams

TC-0053: Player table filtered by search term
Related Story: US-0032
Related Task: N/A
Related AC: AC-0105
Type: Functional
Preconditions: Admin on /admin/players; 125 players in table.
Steps:
  1. Type "Smith" in search field
Expected Result: Table filters to rows where name contains "Smith".
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0054: Edit player modal updates name and team assignment
Related Story: US-0032
Related Task: N/A
Related AC: AC-0106
Type: Functional
Preconditions: Admin on /admin/players; player "John Doe" exists.
Steps:
  1. Click edit icon for "John Doe"
  2. Change name to "John Smith"
  3. Change team assignment to team 12
  4. Click Save
Expected Result: players.name and players.team_id updated; table reflects new values.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0055: Magic link sent to player from admin players page
Related Story: US-0016
Related Task: N/A
Related AC: AC-0050
Type: Functional
Preconditions: Admin on /admin/players; player has valid email.
Steps:
  1. Click "Send Magic Link" for a player
Expected Result: POST /api/magic-link called; success toast shown.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0056: New team created with starting hole
Related Story: US-0033
Related Task: N/A
Related AC: AC-0109
Type: Functional
Preconditions: Admin on /admin/teams.
Steps:
  1. Click "New Team"
  2. Enter team number 32, name "Eagles", starting hole 5
  3. Click Create
Expected Result: New team row appears in table; teams record created in Supabase.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0057: Auto-assign starting holes distributes teams across 1–18
Related Story: US-0033
Related Task: N/A
Related AC: AC-0112
Type: Functional
Preconditions: 36 teams created with no starting holes set.
Steps:
  1. Admin on /admin/teams
  2. Click "Auto-Assign Starting Holes"
Expected Result: Teams receive starting holes 1–18 cycling evenly (2 teams per hole for 36 teams).
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

## EPIC-0009 — Admin: Score Override & Sponsors

TC-0058: Admin overrides player stroke count and best ball recalculates
Related Story: US-0034
Related Task: N/A
Related AC: AC-0113
Type: Functional
Preconditions: Admin on /admin/scores; Team 7 Hole 5 has scores recorded.
Steps:
  1. Select Team 7 and Hole 5
  2. Edit Alice's stroke count from 5 to 4
  3. Click "Recalculate Best Ball"
Expected Result: scores.strokes updated to 4; is_best_ball recalculated; leaderboard reflects change.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0059: Score override logged with admin ID and timestamp
Related Story: US-0034
Related Task: N/A
Related AC: AC-0116
Type: Functional
Preconditions: Admin override performed as per TC-0058.
Steps:
  1. Check scores row in Supabase after override
Expected Result: scores.override_by = admin's player ID; scores.override_at = current timestamp.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0060: Sponsor logo uploaded and visible on leaderboard
Related Story: US-0035
Related Task: N/A
Related AC: AC-0118
Type: Functional
Preconditions: Admin on /admin/sponsors; valid PNG file available.
Steps:
  1. Click "Add Sponsor", upload logo PNG, set display order 1, click Save
Expected Result: Logo uploaded to Supabase Storage; visible on /live/slug in sponsor banner.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

---

## Phase 6 — Scorecard, Pause State, Mulligans

TC-0061: Scorecard shows hole-by-hole best-ball view
Related Story: US-0016
Related Task: N/A
Related AC: AC-0052
Type: Functional
Preconditions: Player on /scorecard; team has 9 holes complete.
Steps:
  1. Navigate to /scorecard
Expected Result: 18-row table shows hole number, par, best-ball strokes, and score vs par per hole. Incomplete holes show "-".
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0062: Tournament pause state — shot recording disabled
Related Story: US-0013
Related Task: N/A
Related AC: AC-0041
Type: Edge Case
Preconditions: Admin has set tournament status to "paused".
Steps:
  1. Player on /round attempts to capture a shot
Expected Result: "Tournament paused" message shown; "Capture Shot" button disabled or absent.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0063: Mulligan allowance enforced — cannot take more than allowed
Related Story: US-0020
Related Task: N/A
Related AC: AC-0066
Type: Edge Case
Preconditions: Team has used all allocated mulligans.
Steps:
  1. Capture shot and tap "Mulligan" after allowance exhausted
Expected Result: Mulligan button disabled or error "No mulligans remaining" shown.
Actual Result:
Status: [ ] Not Run
Defect Raised: None

TC-0064: Offline indicator reflects pending shot count
Related Story: US-0008
Related Task: TASK-0006
Related AC: AC-0060
Type: Functional
Preconditions: 3 shots queued offline.
Steps:
  1. Observe OfflineIndicator component
Expected Result: Component shows "3 pending" and wifi-off icon.
Actual Result:
Status: [ ] Not Run
Defect Raised: None
