#!/usr/bin/env bash
#
# Reset the local Supabase database, apply all migrations, seed master data,
# and create test users. Run from the repo root:
#
#   ./scripts/reset-and-seed.sh
#
# Prerequisites:
#   - supabase CLI installed
#   - Local Supabase running (`supabase start` from repo root)
#   - .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "═══════════════════════════════════════════════════════"
echo "  FDgolf — Database Reset & Seed"
echo "═══════════════════════════════════════════════════════"
echo ""

cd "$REPO_ROOT"

# Step 1: Reset database (drops all data, re-applies migrations + seed.sql)
echo "Step 1: Resetting database (supabase db reset)..."
supabase db reset --debug 2>&1 | grep -E "Applied|Seeding|Finished|Error" || true
echo "  ✓ Database reset complete — all migrations applied + seed.sql loaded"
echo ""

# Step 2: Create test auth users + player rows + teams
echo "Step 2: Creating test users (admin + 4 players)..."
npx tsx supabase/seed-users.ts
echo ""

# Step 3: Activate tournament for testing
echo "Step 3: Tournament activated by seed-users.ts"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  Reset complete!"
echo ""
echo "  Master data loaded:"
echo "    • 1 venue (Granite Ridge Golf Club)"
echo "    • 1 course (Main Course, 18 holes, par 72)"
echo "    • 18 holes with GPS pins"
echo "    • 21 clubs"
echo "    • 1 tournament (CIBC 2026, active)"
echo ""
echo "  Test users (password: Password1!):"
echo "    • admin@fdgolf.local   → Admin dashboard"
echo "    • alice@fdgolf.local   → Team Alpha (captain)"
echo "    • john@fdgolf.local    → Team Alpha"
echo "    • bob@fdgolf.local     → Team Bravo (captain)"
echo "    • jane@fdgolf.local    → Team Bravo"
echo ""
echo "  Sample import file:"
echo "    • scripts/sample-data/players-import.csv"
echo "═══════════════════════════════════════════════════════"
