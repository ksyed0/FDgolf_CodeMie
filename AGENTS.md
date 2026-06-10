# AGENTS.md — AI Agent Operating Standards

This file defines the operational principles, architecture, and collaboration standards for all AI agents working on this project. It is platform-agnostic and applies equally to Claude Code or any other AI coding assistant. Read this file in full at the start of every session, before any code is written or tools are used.

---

## 🟢 Protocol 0: Initialization (Mandatory)

Before any code is written or tools are used:

1. **Verify all project files exist** — Create any that are missing. See the 📂 File & Deliverable Structure table at the end of this document.
2. **Read `MEMORY.md`** — Ensure the knowledge base is loaded before making any architectural decisions.
3. **Halt Execution** — No code or pages may be written until:
   - All Discovery Questions from Phase 1 (Blueprint) are answered
   - The Data Schema in `docs/ARCHITECTURE.md` is confirmed
   - The current phase/story has an approved plan in `progress.md`

---

## 🏗️ Phase 1: B — Blueprint (Vision & Logic)

**Discovery:** At the start of any new Epic or major feature, confirm:

- **North Star:** What is the singular desired outcome for this Epic?
- **Integrations:** Which Supabase tables, Edge Functions, or external services are needed? Are credentials available?
- **Source of Truth:** Which database table(s) own this data? Where does RLS apply?
- **Delivery Payload:** How and where does the result surface — player UI, admin panel, public leaderboard, Realtime broadcast?
- **Behavioral Rules:** Edge cases, offline behavior, "Do Not" rules specific to this feature.

**Data-First Rule:** Define the database schema changes (if any) and API request/response shapes before writing any component or route. Coding only starts once the payload shape is confirmed.

---

## ⚡ Phase 2: L — Link (Connectivity)

1. **Verification:** Test all Supabase connections and `.env.local` credentials before building feature logic.
2. **Handshake:** For any new Edge Function or external integration, write a minimal smoke test in `src/__tests__/` to verify the connection responds correctly. Do not proceed to full implementation if the Link is broken.

---

## ⚙️ Phase 3: A — Architect (3-Layer Build)

Operate within a 3-layer architecture that separates concerns to maximize reliability.

**Layer 1 — Architecture (`docs/`)**

- Technical SOPs written in Markdown. `docs/ARCHITECTURE.md` is the authoritative reference.
- Define goals, inputs, data flow, and edge cases before coding begins.
- **Golden Rule:** If logic changes, update `docs/ARCHITECTURE.md` before updating the code.

**Layer 2 — Navigation (Next.js Server Components + API Routes)**

- Server components fetch data and pass it as props — they are the routing/reasoning layer.
- API route handlers (`src/app/api/`) are the boundary layer — validate input here, never in components.
- Do not perform complex business logic in UI components — call `src/lib/` utilities.

**Layer 3 — Tools (`src/lib/`)**

- Deterministic TypeScript utilities. Atomic and testable.
- `sync-engine.ts`, `scoring.ts`, `gps.ts` are Layer 3 tools. Keep them pure where possible.
- Environment variables live in `.env.local` only. Never in source.

---

## ✨ Phase 4: S — Stylize (Refinement & UI)

1. **Design System:** All new UI must comply with the shadcn/ui + Tailwind v3 design system defined in `PROJECT.md` (or `docs/ARCHITECTURE.md`). Match existing screens automatically — do not invent new patterns.
2. **Mobile-First:** FDgolf is operated on phones during an outdoor golf round. All player-facing UI must be usable one-handed with a large touch target (≥44px). Validate on 390px viewport.
3. **Feedback:** Present stylized results to the user for approval before final deployment.

---

## 🛰️ Phase 5: T — Trigger (Deployment)

1. **Rollback Plan First** — Document the rollback procedure in `progress.md` before any Vercel deployment begins. Do not deploy without it.
2. **Supabase Migrations** — Run `supabase db push` against production only after testing on a local/staging Supabase instance.
3. **Smoke Test** — After deployment, verify: login flow, shot recording, leaderboard update, and admin access.
4. **Tagging** — Tag the release in Git with a semantic version (e.g., `v1.0.0`).

---

## PlanVisualizer Format Requirements

This project uses PlanVisualizer. Read **plan_visualizer.md** (in this project root) for the exact document formats required for `RELEASE_PLAN.md`, `TEST_CASES.md`, `BUGS.md`, `AI_COST_LOG.md`, and `progress.md`. Consult it whenever creating or updating any of these files.

---

## Agent Registry

| Agent | Role | Instruction File |
|-------|------|-----------------|
| Ops | DevOps | `docs/agents/DEVOPS_AGENT.md` |

---

## 🪪 ID Registry & Identifier Standards

All project artefacts — epics, stories, tasks, bugs, test cases, acceptance criteria — must have a globally unique, permanent, human-readable identifier. IDs are assigned sequentially, zero-padded to 4 digits, and **never reused or reassigned**, even if the artefact is deleted or retired.

| Artefact             | Format        | Example     | Where Tracked                   |
| -------------------- | ------------- | ----------- | ------------------------------- |
| Epic                 | `EPIC-[0001]` | `EPIC-0001` | `docs/RELEASE_PLAN.md`          |
| User Story           | `US-[0001]`   | `US-0042`   | `docs/RELEASE_PLAN.md`          |
| Task                 | `TASK-[0001]` | `TASK-0007` | `docs/RELEASE_PLAN.md`          |
| Acceptance Criterion | `AC-[0001]`   | `AC-0003`   | Inline within the US definition |
| Test Case            | `TC-[0001]`   | `TC-0015`   | `docs/TEST_CASES.md`            |
| Bug / Defect         | `BUG-[0001]`  | `BUG-0002`  | `docs/BUGS.md`                  |

**ID Registry file:** `docs/ID_REGISTRY.md` is the single source of truth for the next available ID in each sequence. Update it immediately whenever a new artefact is created.

**Rules:**

- Always consult `docs/ID_REGISTRY.md` before creating any new artefact to get the next available ID.
- Update `docs/ID_REGISTRY.md` immediately after assigning a new ID — before writing the artefact content.
- IDs are permanent. Retired or deleted artefacts retain their ID and are marked `Status: Retired` or `Status: Cancelled` — never deleted from the record.
- All cross-references between artefacts must use their full ID (e.g., `US-0003` not just "the login story").
- Git branch names, commit messages, PR titles, and log entries must all reference the relevant artefact ID.

> **Rule:** An artefact without a unique ID cannot be tracked, referenced, or audited. Assign the ID first, write the content second.

---

## 🛠️ Operating Principles

### 1. Persistent Memory

Maintain `MEMORY.md` organised **by topic**, not chronologically. Use separate topic files for detailed notes where needed.

- Update or remove memories that are wrong or outdated. Do not write duplicates.
- Read `MEMORY.md` and all linked topic files at session startup.
- Store: API signatures, scoring algorithms, schema facts, hard-won lessons, active dependency registry.

The goal is a curated knowledge base, not a dump log.

---

### 2. Migration Tracking

Every time a change is made that must propagate to other layers (e.g., a schema change that affects the Edge Function, a type change that affects both the API route and the player UI), log it immediately in `MIGRATION_LOG.md`. Include:

- **Date** of the change
- **Files changed**
- **Which layers or modules it applies to**
- **What specifically changed** (old vs. new values, code snippets where helpful)
- **Notes** on platform-specific adaptations completed and/or still needed

Every change generates a technical debt ticket for every affected layer that has not yet been updated. Do not let layers drift out of parity silently.

---

### 3. Prompt Logging as Audit Trail

Every session, after reading these instructions, log each user prompt to `PROMPT_LOG.md` with a timestamp. This gives a complete, replayable record of every instruction across all sessions — enabling reconstruction when things go wrong, tracing how features evolved, and picking up precisely where the last session ended.

After any meaningful task, also update:

- `progress.md` — what happened and any errors
- `MEMORY.md` — discoveries and constraints that must persist
- `docs/ARCHITECTURE.md` — only when a schema changes, a rule is added, or architecture is modified

---

### 4. User Profile as a Design Constraint

FDgolf is built for **125 non-technical golf players** at a corporate tournament. Before any design or UX decision, internalize this profile:

- **Context:** Outdoors on a golf course; sunlight glare; one hand in use; potential time pressure between shots.
- **Technical comfort:** Low. Players must not encounter errors they can't recover from, menus with more than 3 choices, or text smaller than 16px.
- **Connectivity:** Unreliable — course tunnels, crowd congestion, and dead zones are expected. All shot actions must work offline.
- **Device:** Personal iPhone (standard size). No Android assumption.

**Rules:**
- Align all UI decisions with the profile above.
- If asked to recall the user profile, restate it explicitly before proceeding.
- Do not design for an abstract "mobile user" — design for a corporate golfer in the middle of a round.

---

### 5. Design System Compliance

All UI work must comply with the FDgolf design system:

- **Component library:** shadcn/ui (Radix-based, default style — not new-york)
- **Styling:** Tailwind CSS v3 only. No inline styles, no CSS modules unless required for third-party integration.
- **Colours:** Defined in `tailwind.config.ts` and `globals.css`. Match existing screens — do not introduce new palette values.
- **Typography:** System font stack. Minimum 16px body text. Buttons ≥44px touch target.
- **Icons:** `lucide-react` only. No icon font libraries.
- **Branding:** FDgolf logo + "AI/Run™" pill in `app-header.tsx`. First Derivative wordmark at bottom of admin sidebar. Do not modify branding without explicit instruction.

Every new screen must match existing screens automatically. Use `docs/ARCHITECTURE.md` as the reference — not memory of what was built last session.

---

### 6. Hard-Won Lessons as Permanent Rules

When a bug is resolved after significant debugging, encode the fix as a permanent rule in `docs/LESSONS.md`. Format:

> **"[Never/Always] [specific behaviour].** *Learned when [brief description of failure].*"

Apply the Self-Annealing loop for all tool failures:

1. **Analyze** — Read the stack trace. Do not guess.
2. **Patch** — Fix the code.
3. **Test** — Verify the fix works.
4. **Encode** — Record the learning in `docs/LESSONS.md` so the error never repeats.

Every AI mistake should only happen once. Bug fixes become development DNA.

---

### 3. Unit Testing & Build Quality

Every piece of code generated or updated must have corresponding unit tests written or updated in the same session:

- **Minimum coverage:** ≥80% statements/functions/lines, ≥70% branches. Verified and reported to `progress.md` before the session closes.
- **All tests must pass:** A failing test is a build blocker. Fix the code or the test before proceeding — never commit with a failing suite.
- **Test location:** `src/__tests__/` mirroring source structure.
- **Test naming:** `describe('<module>') > it('<behaviour> <expected outcome>')`

---

### 4. Release Planning & Backlog Management

The release plan lives in `docs/RELEASE_PLAN.md` and must be updated whenever scope, priorities, or architecture change.

**Epic format:**

```
EPIC-[0001]: [Short descriptive title]
Description: [What this epic delivers and why it matters]
Release Target: [MVP / Release 1.x / etc.]
Status: [Planned | In Progress | Complete]
Dependencies: [EPIC-XXXX, or "None"]
```

**User Story format:**

```
US-[0001] (EPIC-[0001]): As a [persona], I want to [action], so that [outcome].
Description: [Additional context, edge cases, constraints]
Priority: [High | Medium | Low]
Estimate: [T-shirt size]
Status: [Planned | In Progress | Done | Blocked]
Acceptance Criteria:
  - [ ] AC-[0001]: [Specific, testable condition]
Dependencies: [US-XXXX, EPIC-XXXX, or "None"]
Definition of Ready (DOR):
  - [ ] Story is understood and estimated
  - [ ] Acceptance criteria are defined and agreed
  - [ ] Dependencies are identified and resolved or planned
  - [ ] No blockers exist to begin work
Definition of Done (DOD):
  - [ ] All acceptance criteria are met
  - [ ] All linked tasks (TASK-XXXX) are complete
  - [ ] Unit tests written and passing with ≥80% coverage
  - [ ] Test cases created or updated in TEST_CASES.md
  - [ ] No regressions introduced
  - [ ] No secrets or PII in code, logs, or committed files
  - [ ] Documentation updated
  - [ ] Session Close Checklist completed (see CLAUDE.md)
```

**Task format:**

```
TASK-[0001] (US-[0001]): [Short imperative description of the work]
Type: [Dev | Test | Design | Docs | Infra | Bug]
Assignee: [Agent / Human]
Status: [To Do | In Progress | Done | Blocked]
Branch: [feature/US-0001-short-description]
Notes: [Any implementation notes or constraints]
```

**Bug format:**

```
BUG-[0001]: [Short description of the defect]
Severity: [Critical | High | Medium | Low]
Related Story: US-[XXXX]
Steps to Reproduce:
  1. [Step]
  2. [Step]
Expected: [What should happen]
Actual: [What actually happened]
Status: [Open | In Progress | Fixed | Verified | Closed]
Fix Branch: [bugfix/BUG-0001-short-description]
Lesson Encoded: [Yes — see docs/LESSONS.md | No]
```

> **Rule:** No story may be worked on unless it meets the DOR. No story may be closed unless it meets the DOD.

---

### 5. Test Case Management

Whenever code is generated or updated, corresponding test cases must be created or updated in `docs/TEST_CASES.md`. Test cases are distinct from unit tests — they are human-readable descriptions of expected system behaviour used for verification and QA.

**Test Case format:**

```
TC-[0001]: [Short descriptive title]
Related Story: US-[XXXX]
Related Task: TASK-[XXXX]
Related AC: AC-[XXXX]
Type: [Functional | Regression | Edge Case | Negative | Performance]
Preconditions: [System state required before the test is run]
Steps:
  1. [Action]
  2. [Action]
Expected Result: [What should happen if the system is working correctly]
Actual Result: [Filled in during test execution — leave blank until executed]
Status: [ ] Not Run / [ ] Pass / [ ] Fail
Defect Raised: [BUG-XXXX or "None"]
```

**Rules:**

- Every user story must have at least one test case covering its primary acceptance criterion.
- Every acceptance criterion (AC-XXXX) must have a corresponding test case (TC-XXXX).
- Edge cases and negative paths must have their own uniquely identified test cases.
- Failed test cases must raise a BUG-XXXX entry and be logged in `progress.md`.
- Test case IDs are permanent — never reuse or renumber a TC-XXXX. Mark deleted cases as `Status: Retired`.

---

### 6. Git Workflow Rules

- Never commit directly to `main` or `develop`. Always use a branch.
- Every feature branch maps to exactly one user story.
- Commits must be atomic — one logical change per commit. Do not bundle unrelated changes.
- All unit tests must pass locally before any push to remote.
- Squash and merge feature branches into `develop` to keep history clean.
- Tag every release branch merge to `main` with a semantic version (e.g., `v1.0.0`).
- PRs must reference the related artefact ID in the title and description.
- No PR may be merged with failing checks or unresolved review comments.

---

### 7. Security & Secrets Standards

**Secrets & Credentials:**

- All secrets, API keys, tokens, and credentials must live exclusively in `.env.local`. Never in code, comments, config files, or logs.
- `.env.local` must be listed in `.gitignore` and must never be committed under any circumstances.
- Keep `.env.local.example` updated whenever new variables are added.
- Never log secrets, tokens, or sensitive user data — not even partially.
- Rotate any secret that is accidentally exposed immediately. Log the incident in `progress.md`.

**Input Validation & Injection Prevention:**

- Validate and sanitize all external input at the boundary — before it touches business logic, the database, or any external service.
- Never construct database queries or API calls using raw string concatenation with user input. Use Supabase's parameterized client methods.
- Reject unexpected input shapes early and return structured error responses — never expose stack traces to end users.

**Data Handling:**

- PII must never be stored in `.tmp/`, logs, or memory files.
- Minimize data collection — only store what is explicitly needed for the feature.

---

### 8. Error Handling Standard

All application code must implement consistent, structured error handling.

**Error hierarchy:**

- `ValidationError` — Bad input from the user or external system.
- `IntegrationError` — External service (Supabase, Google Maps) failed.
- `BusinessLogicError` — A rule or constraint of the domain was violated.
- `SystemError` — Unexpected internal failure (catch-all; should be rare).

**Rules:**

- Every function that can fail must have explicit error handling — no silent failures, no bare empty `catch` blocks.
- Do not let raw Supabase errors surface to the UI layer — transform at the boundary.
- End-user-facing error messages must be human-readable and actionable.
- Transient errors (network timeouts, rate limits) should implement retry logic with a defined maximum retry count.

---

### 9. Performance Budgets

| Metric                 | Target                              |
| ---------------------- | ----------------------------------- |
| API response time (p95) | < 500ms                            |
| Page initial load      | < 3 seconds on a standard connection|
| Database query (p95)   | < 100ms                             |

**Rules:**

- Any new endpoint or screen must be manually verified against these baselines before the story is closed.
- Avoid N+1 query patterns — review database access patterns when building new data-fetching logic.
- Use pagination or lazy loading for any data set that could exceed 100 records.
- Document caching strategies (what is cached, TTL, invalidation) in `MEMORY.md`.

---

### 10. Dependency Management

- Pin all dependencies to an exact version in `package.json`. No floating ranges (`^`, `~`, `*`).
- Every new dependency must be justified: package name, version, purpose, and licence.
- Prefer well-maintained packages with clear licences (MIT, Apache 2.0, BSD preferred).
- Remove unused dependencies immediately — they are attack surface with no benefit.

---

### 11. API Design & Versioning

All API routes exposed by this project must follow consistent design standards.

**Design Standards:**

- All internal API endpoints follow RESTful conventions. `src/app/api/` is the only route handler location.
- Endpoint naming: lowercase, hyphenated paths. e.g., `/api/v1/magic-link`, not `/api/v1/magicLink`.
- All responses use a consistent envelope:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

- HTTP status codes must be used semantically: `200` (OK), `201` (Created), `400` (Validation), `401` (Unauth), `403` (Forbidden), `500` (Server error).
- All request and response shapes must be documented in `docs/ARCHITECTURE.md` under the API section.

**Versioning Rules:**

- All new API routes must include a version prefix from day one: `/api/v1/`.
- Never modify the request or response shape of an existing versioned endpoint — create a new version (`/api/v2/`) instead.
- Deprecated endpoints must be flagged in `MEMORY.md` and kept for at least one full release cycle before removal.
- Any breaking API change must be documented in `MIGRATION_LOG.md`.

---

### 12. Concurrency Safety

When multiple operations write to shared state concurrently (e.g., parallel admin edits, SyncEngine flush + UI update), shared files and records must be accessed safely.

**For file-based shared state** (project docs, JSON outputs):

| Concern | Rule |
|---------|------|
| `docs/ID_REGISTRY.md` | Always consult and update atomically — read, increment, write in one operation. Never leave a gap. |
| `progress.md` | Append-only during a session. Never overwrite the full file. |
| `docs/BUGS.md`, `docs/AI_COST_LOG.md` | Append-only ledgers. Never edit or delete rows. |

**For database-level concurrency** (Supabase):

- The `scores.is_best_ball` flag is set exclusively by the `calculate-best-ball` Edge Function. No client code may write this column directly — this is enforced by RLS.
- The `scores.override_by` / `override_at` columns provide an audit trail for admin overrides. Never overwrite them — only the admin score override endpoint may set them.
- The SyncEngine (`src/lib/sync-engine.ts`) is the sole write path for shot data on the client. Do not bypass it with direct Supabase calls from UI components.

---

### 13. Rollback & Recovery Plan

Every deployment to Vercel production must have a documented rollback plan before it begins.

**Pre-Deployment Checklist:**

- [ ] Current production version is tagged in Git so it can be restored instantly.
- [ ] Database migrations are reversible — every schema change must be undoable.
- [ ] Rollback procedure is documented for this release.
- [ ] A smoke test plan is defined — the minimum set of checks to verify the deployment succeeded.

**Post-rollback:**

- Log the incident in `progress.md` with timeline, root cause, and resolution.
- Open a `bugfix/*` branch to address the root cause before re-attempting deployment.
- Add a post-mortem entry to `docs/LESSONS.md`.

---

## 🤖 Orchestration Engine

This project uses the **PlanVisualizer orchestration engine** as an opt-in quality gate for agentic sessions. The engine prevents silent failures by adding spec/plan gates before code is written and review gates before tasks are marked done.

**Core principle:** every story goes through a pre-dispatch spec/plan gate → every dispatched task goes through a per-task lifecycle → every task completion goes through a review gate before being marked done.

**When to use it:**

- Use when running an AI agent autonomously on a story (spec gates, context curation, and review gates prevent silent failures).
- Bypass it (work directly) when a human is driving — the engine is opt-in and never required.

**Iteration caps** (configured in `plan-visualizer.config.json`):

```json
"orchestration": {
  "iterationCap": {
    "spec": 3,
    "plan": 3,
    "taskReview": 2
  }
}
```

**Lifecycle states for dispatched tasks:**

`pending` → `in_progress` → `done` / `done_with_concerns` / `needs_context` / `blocked`

**Review gate verdicts:**

- **APPROVE** — All acceptance criteria met; tests pass; design system compliant.
- **REQUEST CHANGES** — Missing error states, test coverage gaps, naming issues. Agent fixes and resubmits.
- **BLOCK** — Security vulnerability, data loss risk, or fundamental architecture violation. Requires human intervention.

**Pending approvals directory:** `docs/pending-approvals/` — spec/plan documents waiting for PO sign-off live here. Never delete files from this directory; mark them approved or rejected instead.

---

## 🔍 Fresh-Eyes Code Review

Periodically, at the start of a new session, analyze the entire project and all its files **before** reading instruction files and memory. Flag issues, inconsistencies, or problems — treat it as an independent code audit. After the review is complete, proceed with the normal session startup sequence.

---

## 📂 File & Deliverable Structure

| Location | Purpose |
|----------|---------|
| `src/lib/` | Deterministic TypeScript utilities (Layer 3 tools). Atomic and testable. |
| `src/app/api/` | API route handlers (Next.js App Router). Boundary layer — validate input here. |
| `src/app/(auth)/` | Public auth pages: login, register, magic-link handler. |
| `src/app/(player)/` | Authenticated player pages: dashboard, round, leaderboard, scorecard. |
| `src/app/(admin)/` | Admin-role-only pages: 7 management sections. |
| `src/app/live/[slug]/` | Public leaderboard (ISR, no auth). |
| `src/__tests__/` | Jest unit tests mirroring source structure. Must maintain ≥80% coverage. |
| `tests/e2e/` | Playwright E2E tests covering critical user journeys. |
| `supabase/migrations/` | Database migrations. Every `up` must have a corresponding rollback path. |
| `supabase/functions/` | Deno Edge Functions. Separate TypeScript context — not in `tsconfig.json`. |
| `docs/RELEASE_PLAN.md` | Epics, user stories, tasks, MVP definition, release milestones. |
| `docs/TEST_CASES.md` | Human-readable test cases (TC-XXXX) linked to user stories and ACs. |
| `docs/BUGS.md` | Bug and defect register with BUG-XXXX identifiers and status. |
| `docs/ID_REGISTRY.md` | Single source of truth for next available ID in every sequence. |
| `docs/LESSONS.md` | Encoded hard-won lessons and permanent guardrail rules. |
| `docs/ARCHITECTURE.md` | Full system architecture, Mermaid diagrams, user journeys. |
| `docs/AI_COST_LOG.md` | Append-only ledger of AI session costs. Never edit or delete rows. |
| `docs/pending-approvals/` | Spec/plan documents awaiting PO sign-off. Never delete. |
| `MEMORY.md` | Persistent semantic knowledge base, organized by topic. |
| `PROMPT_LOG.md` | Timestamped log of every user prompt across all sessions. |
| `MIGRATION_LOG.md` | Cross-layer change tracking (schema → Edge Function → UI). |
| `progress.md` | Running log of session activity, errors, test results, and blockers. |
| `.env.local` | Environment variables and Supabase credentials. Never committed. |
| `.env.local.example` | Placeholder template of all required environment variables. Committed. |
