# FDgolf — Bug Tracker

BUG-0001: E2E TC-0049 selector matched pencil button instead of name input
Severity: Low
Related Story: US-0023
Status: Fixed
Fix Branch: develop (direct commit f4ca356)
Lesson Encoded: No

The TC-0049 test used `getByLabel(/tournament name|name/i)` which resolved to the
`<button aria-label="Edit tournament name">` pencil icon rather than the text input.
Fix: click the pencil button first to enter edit mode, then target `getByRole('textbox')`.
The component's `<Input>` has no associated label — tests must follow the two-step
click-to-edit interaction pattern.

BUG-0002: E2E TC-0056 referenced non-existent "team number" form field
Severity: Low
Related Story: US-0021
Status: Fixed
Fix Branch: develop (direct commit f4ca356)
Lesson Encoded: No

The TC-0056 test called `getByLabel(/team number/i)` but `team_number` is auto-generated
(max existing + 1) and has no input in the Add Team form. The form uses a `placeholder`
attribute (not `htmlFor` label association) for team name, and a bare `<label>` without
`htmlFor` for starting hole. Fix: use `getByPlaceholder(/team name/i)` and
`locator('input[type="number"]')`.

BUG-0003: Sunk shot written twice — SyncEngine queue + direct Supabase upsert
Severity: Medium
Related Story: US-0021
Status: Fixed
Fix Branch: develop (direct commit 251c366)
Lesson Encoded: No

In `src/app/(player)/round/page.tsx`, when `outcome === 'sunk'` is recorded, the score
row is (1) enqueued to the SyncEngine offline write queue AND (2) immediately upserted
directly via `supabase.from('scores').upsert(...)`. The direct upsert is idempotent
(ON CONFLICT on player_id + tournament_id + hole_number), so the database result is
correct. However the SyncEngine will also flush the same row on its next retry cycle,
causing a redundant write. In a network-degraded environment this means two inflight
requests for the same row. Fix: skip the SyncEngine enqueue when `outcome === 'sunk'`
(since the direct upsert is already the canonical path for score submission), or
remove the direct upsert and rely solely on the SyncEngine.
