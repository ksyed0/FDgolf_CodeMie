/**
 * Creates test auth users + player/team records in the local Supabase instance.
 * Run: npx tsx supabase/seed-users.ts
 *
 * Users created:
 *   admin@fdgolf.local   / Password1!   (role: admin)
 *   alice@fdgolf.local   / Password1!   (Team Alpha — captain)
 *   john@fdgolf.local    / Password1!   (Team Alpha)
 *   bob@fdgolf.local     / Password1!   (Team Bravo — captain)
 *   jane@fdgolf.local    / Password1!   (Team Bravo)
 */

import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54341";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const TOURNAMENT_ID = "00000000-0000-0000-0000-000000000001";
const PASSWORD = "Password1!";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = admin as any;

async function getOrCreateAuthUser(
  existingUsers: Array<{ id: string; email?: string }>,
  email: string
): Promise<string> {
  const existing = existingUsers.find((u) => u.email === email);
  if (existing) {
    console.log(`  → auth user already exists: ${email}`);
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  console.log(`  + created auth user: ${email} (${data.user.id})`);
  return data.user.id;
}

async function upsertPlayer(params: {
  auth_user_id: string;
  name: string;
  email: string;
  role: "player" | "admin" | "tournament_organizer";
  team_id?: string;
}): Promise<string> {
  const { data, error } = await db
    .from("players")
    .upsert(params, { onConflict: "auth_user_id" })
    .select("id")
    .single();
  if (error) throw new Error(`upsertPlayer(${params.email}): ${error.message}`);
  return data.id as string;
}

async function upsertTeam(params: {
  tournament_id: string;
  team_number: number;
  team_name: string;
  starting_hole: number;
}): Promise<string> {
  const { data, error } = await db
    .from("teams")
    .upsert(params, { onConflict: "tournament_id,team_number" })
    .select("id")
    .single();
  if (error) throw new Error(`upsertTeam(${params.team_name}): ${error.message}`);
  return data.id as string;
}

async function main() {
  console.log(`Connecting to ${SUPABASE_URL}\n`);

  // ── 1. Auth users ────────────────────────────────────────────────────────
  console.log("Step 1: Auth users");
  const { data: { users } } = await admin.auth.admin.listUsers();

  const [adminUid, aliceUid, johnUid, bobUid, janeUid] = await Promise.all([
    getOrCreateAuthUser(users, "admin@fdgolf.local"),
    getOrCreateAuthUser(users, "alice@fdgolf.local"),
    getOrCreateAuthUser(users, "john@fdgolf.local"),
    getOrCreateAuthUser(users, "bob@fdgolf.local"),
    getOrCreateAuthUser(users, "jane@fdgolf.local"),
  ]);

  // ── 2. Teams (no captain yet — circular FK) ──────────────────────────────
  console.log("\nStep 2: Teams");
  const [teamAId, teamBId] = await Promise.all([
    upsertTeam({ tournament_id: TOURNAMENT_ID, team_number: 1, team_name: "Team Alpha", starting_hole: 1 }),
    upsertTeam({ tournament_id: TOURNAMENT_ID, team_number: 2, team_name: "Team Bravo", starting_hole: 10 }),
  ]);
  console.log(`  + Team Alpha: ${teamAId}`);
  console.log(`  + Team Bravo: ${teamBId}`);

  // ── 3. Players ───────────────────────────────────────────────────────────
  console.log("\nStep 3: Players");
  const [, alicePid, johnPid, bobPid, janePid] = await Promise.all([
    upsertPlayer({ auth_user_id: adminUid, name: "Tournament Admin", email: "admin@fdgolf.local", role: "admin" }),
    upsertPlayer({ auth_user_id: aliceUid, name: "Alice Smith", email: "alice@fdgolf.local", role: "player", team_id: teamAId }),
    upsertPlayer({ auth_user_id: johnUid, name: "John Doe", email: "john@fdgolf.local", role: "player", team_id: teamAId }),
    upsertPlayer({ auth_user_id: bobUid, name: "Bob Johnson", email: "bob@fdgolf.local", role: "player", team_id: teamBId }),
    upsertPlayer({ auth_user_id: janeUid, name: "Jane Lee", email: "jane@fdgolf.local", role: "player", team_id: teamBId }),
  ]);
  console.log("  + 5 player records upserted");

  // ── 4. Set captains ──────────────────────────────────────────────────────
  console.log("\nStep 4: Team captains");
  await Promise.all([
    db.from("teams").update({ captain_id: alicePid }).eq("id", teamAId),
    db.from("teams").update({ captain_id: bobPid }).eq("id", teamBId),
  ]);
  console.log("  + captains set");

  // ── 5. Activate tournament ───────────────────────────────────────────────
  console.log("\nStep 5: Tournament");
  const { error: tErr } = await db
    .from("tournaments")
    .update({ status: "active" })
    .eq("id", TOURNAMENT_ID);
  if (tErr) console.warn("  ! could not activate tournament:", tErr.message);
  else console.log("  + tournament set to active");

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`
Done! Log in at http://localhost:3000/login  (password: ${PASSWORD})

  admin@fdgolf.local   →  /admin dashboard
  alice@fdgolf.local   →  Team Alpha (captain)
  john@fdgolf.local    →  Team Alpha
  bob@fdgolf.local     →  Team Bravo (captain)
  jane@fdgolf.local    →  Team Bravo

Supabase Studio: http://127.0.0.1:54343
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
