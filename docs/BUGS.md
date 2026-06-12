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

BUG-0004: glob HIGH CVE (GHSA-5j98-mcp5-4vw2) via eslint-config-next dev dependency
Severity: High
Related Story: N/A (CI security scan)
Status: Fixed — resolved by upgrading eslint-config-next to 16.2.9 (PR #14)
Fix Branch: feature/upgrade-nextjs-16 (squash-merged to develop)
Lesson Encoded: No

`glob@10.2.0 - 10.4.5` bundled inside `@next/eslint-plugin-next` (a transitive dep of
`eslint-config-next@14.x`) contains a CLI command injection vulnerability: when the
`-c/--cmd` flag is used with shell:true, an attacker can inject arbitrary shell commands
via glob pattern input. The affected code path only runs in the ESLint toolchain during
development builds — it is never present in the production bundle and is not reachable
at runtime on Vercel.

Fixed by upgrading `eslint-config-next` from 14.x to 16.2.9 in PR #14.

Advisory: https://github.com/advisories/GHSA-5j98-mcp5-4vw2

BUG-0005: next@14.x — 14 HIGH-severity CVEs with no non-breaking patch
Severity: High
Related Story: N/A (CI security scan)
Status: Fixed — resolved by upgrading next to 16.2.9 (PR #14)
Fix Branch: feature/upgrade-nextjs-16 (squash-merged to develop)
Lesson Encoded: No

`next@14.2.35` (latest 14.x) contained 14 HIGH-severity advisories. All are fixed in
`next@16.2.9`. The resolved CVEs:

- GHSA-9g9p-9gw9-jx7f  DoS via Image Optimizer remotePatterns (self-hosted)
- GHSA-h25m-26qc-wcjf  HTTP request deserialization DoS via RSC (self-hosted)
- GHSA-ggv3-7p47-pfv8  HTTP request smuggling in rewrites (self-hosted)
- GHSA-3x4c-7xq6-9pq8  Unbounded next/image disk cache growth (self-hosted)
- GHSA-q4gf-8mx6-v5v3  DoS via Server Components (self-hosted)
- GHSA-8h8q-6873-q5fj  DoS via Server Components (self-hosted)
- GHSA-3g8h-86w9-wvmq  Middleware/Proxy redirect cache-poisoning
- GHSA-ffhc-5mcf-pf4q  XSS in App Router apps using CSP nonces
- GHSA-vfv6-92ff-j949  Cache poisoning via RSC cache-busting collisions
- GHSA-gx5p-jg67-6x7h  XSS in beforeInteractive scripts with untrusted input
- GHSA-h64f-5h5j-jqjh  DoS in Image Optimization API
- GHSA-c4j6-fc7j-m34r  SSRF via WebSocket upgrades
- GHSA-wfc6-r584-vfw7  Cache poisoning in RSC responses
- GHSA-36qx-fr4f-26g5  Middleware/Proxy bypass in Pages Router i18n

Fixed by upgrading `next` from 14.2.35 to 16.2.9 and `eslint-config-next` from 14.2.35
to 16.2.9 in PR #14. `npm audit --audit-level=high` now exits 0 (only 2 moderate remain).

BUG-0006: CodeQL SARIF upload fails — Advanced Security requires GitHub Organization account
Severity: Low
Related Story: N/A (CI setup)
Status: Fixed — repo made public; continue-on-error removed; CodeQL now blocks PRs
Fix Branch: develop (direct commit)
Lesson Encoded: No

The `codeql.yml` workflow fails with:
  "Code scanning is not enabled for this repository. Please enable code scanning in
   the repository settings."

Root cause: GitHub Code Scanning / Advanced Security is only available on Organization
accounts (Team or Enterprise plan). The repo is on a personal GitHub Pro account —
the Security Overview page shows "Advanced Security is only available for Organizations"
with no enable option. This is a billing tier restriction, not a configuration gap.

The CodeQL analysis steps run successfully and surface findings in the workflow logs,
but cannot POST SARIF results to the GitHub Security tab without an org-level GHAS license.

Resolution: `continue-on-error: true` on the `analyze` job is the correct permanent state.
CodeQL runs as a best-effort scan on every PR; PRs are not blocked. Dependabot alerts
(free on all plans) enabled separately to cover the same CVE surface in the Security tab.

Options if full SARIF dashboard is needed in future:
  1. Transfer repo to a GitHub Organization + upgrade to Team plan
  2. Make repo public — unlocks Code Scanning at no cost
  3. Use a third-party SAST tool (Semgrep, Snyk) that reports outside GitHub Security tab
