# Contributing to FDgolf

---

## Contributing with Claude Code

[Claude Code](https://claude.ai/code) is the AI coding assistant used to build and maintain this project. All context it needs is already wired up in `CLAUDE.md`, `AGENTS.md`, and `MEMORY.md` at the repo root.

### Install

**macOS / Linux / WSL:**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**macOS (Homebrew):**
```bash
brew install --cask claude-code
```

**Windows PowerShell:**
```powershell
irm https://claude.ai/install.ps1 | iex
```

### Authenticate

```bash
claude          # opens browser for one-time login with your Anthropic account
```

Requires a Pro, Max, Team, or Enterprise Claude.ai subscription.

### Update

Native installs auto-update in the background. To force an immediate update:
```bash
claude update
```

Homebrew installs require `brew upgrade --cask claude-code`.

### Start contributing

```bash
git clone git@github.com:ksyed0/FDgolf_CodeMie.git   # SSH (contributors with access)
# or
git clone https://github.com/ksyed0/FDgolf_CodeMie.git  # HTTPS (read-only / fork)

cd FDgolf_CodeMie
npm install
claude                      # Claude Code reads CLAUDE.md automatically
```

To request contributor access, open an issue on GitHub with the subject **"Contributor access request"**.

---

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- [Docker](https://www.docker.com/) (required for local Supabase containers)

---

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/ksyed0/FDgolf_CodeMie.git
cd FDgolf_CodeMie
npm install
```

### 2. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54341   # local Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key>    # printed by `supabase start`
SUPABASE_SERVICE_ROLE_KEY=<local service role key> # printed by `supabase start`
NEXT_PUBLIC_MAPBOX_TOKEN=<your Mapbox public token>
```

### 3. Start local Supabase

This project uses port offset +20 to avoid conflicts with other local Supabase projects (ports 54341–54349 instead of the default 54321–54327).

```bash
supabase start
```

This applies all migrations in `supabase/migrations/` automatically. Studio is at http://127.0.0.1:54343.

### 4. Seed test users

```bash
npx tsx supabase/seed-users.ts
```

Creates 5 auth users + 2 teams + activates the tournament:

| Email | Password | Role |
|-------|----------|------|
| admin@fdgolf.local | Password1! | admin |
| alice@fdgolf.local | Password1! | player (Team Alpha, captain) |
| john@fdgolf.local | Password1! | player (Team Alpha) |
| bob@fdgolf.local | Password1! | player (Team Bravo, captain) |
| jane@fdgolf.local | Password1! | player (Team Bravo) |

### 5. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000. Log in as `admin@fdgolf.local` / `Password1!` to access the admin dashboard.

---

## Git Workflow

```
feature/US-XXXX-short-name   → squash-merge into develop via PR
bugfix/BUG-XXXX-short-name   → squash-merge into develop via PR
docs/short-name              → squash-merge into develop via PR
release/X.Y.Z                → merge into main via PR
```

**Never push directly to `develop` or `main`** — both branches are protected.

Commit format:
```
[type] SHORT-ID: Short imperative description (max 72 chars)
```

Types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `style`, `perf`

---

## Running Tests

```bash
npm run test:ci        # runs all tests with coverage report
npm run type-check     # TypeScript strict check (no emit)
npm run lint           # ESLint
```

Coverage thresholds (enforced in CI): ≥80% statements/functions/lines, ≥70% branches.

To run a single test file:
```bash
npx jest src/__tests__/scoring.test.ts --no-coverage
```

---

## Applying Database Migrations

Migrations in `supabase/migrations/` are applied automatically by `supabase start`. To apply a new migration to the local DB manually:

```bash
supabase db push
```

To apply to the cloud project (production):
```bash
supabase db push --db-url <production-db-url>
```

---

## Deploying

Any push to `develop` triggers a Vercel **preview** deployment.
Any push to `main` (via PR) triggers a Vercel **production** deployment at https://fdgolfcm.vercel.app.

To deploy manually from the CLI:
```bash
vercel deploy --prod
```

---

## Project Conventions

- **No comments** unless the WHY is non-obvious (hidden constraint, workaround, surprising behaviour)
- **No `any`** unless unavoidable — use proper types from `src/lib/types.ts`
- **Server components fetch, client components mutate** — follow the `TournamentManager` / `VenueManager` pattern
- **Supabase client**: use `createClient()` from `@/lib/supabase/client` in client components; `createServerClient()` from `@/lib/supabase/server` in server components and route handlers
- **`supabase/functions/`** is excluded from `tsconfig.json` — Deno CDN imports break the Next.js TS compiler
