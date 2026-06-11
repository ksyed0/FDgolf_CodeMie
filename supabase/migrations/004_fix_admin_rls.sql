-- Migration 004: Fix infinite RLS recursion on the players table
--
-- Root cause: The "Admin full access" policy on `players` was declared FOR ALL
-- (which includes SELECT). Its USING clause queries `players` itself:
--
--   exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin')
--
-- Any query on `players` would trigger RLS, evaluate that policy, run the
-- subquery on `players`, trigger RLS again → infinite recursion (PG error 42P17).
-- This cascaded to ALL tables whose admin policy checked players (tournaments, etc.)
-- because querying those tables also triggered the players recursive policy.
--
-- Fix: Replace the single FOR ALL policy with separate DML-only policies.
-- The existing "Public read" policy (using (true)) already covers SELECT,
-- so removing SELECT from the admin policy has no functional impact.
-- The DML-only policies' subqueries on players now only trigger "Public read"
-- (no SELECT admin policy exists), breaking the recursion.

-- ── players ──────────────────────────────────────────────────────────────────

drop policy if exists "Admin full access" on players;

create policy "Admin insert" on players
  for insert
  with check (
    exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin')
  );

create policy "Admin update" on players
  for update
  using (
    exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin')
  );

create policy "Admin delete" on players
  for delete
  using (
    exists (select 1 from players where auth_user_id = auth.uid() and role = 'admin')
  );
