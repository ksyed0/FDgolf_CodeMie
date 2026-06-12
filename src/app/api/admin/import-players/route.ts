export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

interface ImportRow {
  name: string;
  email: string;
  company?: string;
  title?: string;
  team?: string;
  starting_hole?: number;
}

interface RowError {
  row: number;
  email: string;
  error: string;
}

interface Invite {
  name: string;
  email: string;
  link: string;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('tournamentId' in body) ||
    !('rows' in body) ||
    !Array.isArray((body as Record<string, unknown>).rows)
  ) {
    return NextResponse.json(
      { error: 'Missing required fields: tournamentId, rows[]' },
      { status: 400 }
    );
  }

  const { tournamentId, rows } = body as { tournamentId: string; rows: ImportRow[] };

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
  }

  if (rows.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 players per import' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();

  if (sessionError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from('players')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();

  if (!caller || caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminClient = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: tournament } = await adminClient
    .from('tournaments')
    .select('id')
    .eq('id', tournamentId)
    .single();

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  // Collect unique team names and create missing ones
  const teamNames = [...new Set(rows.map((r) => r.team?.trim()).filter(Boolean))] as string[];
  const { data: existingTeams } = await adminClient
    .from('teams')
    .select('id, team_name, team_number')
    .eq('tournament_id', tournamentId);

  const teamMap = new Map<string, string>();
  const teamsCreated: string[] = [];

  for (const t of existingTeams ?? []) {
    if (t.team_name) teamMap.set(t.team_name.toLowerCase(), t.id);
  }

  let nextTeamNumber =
    existingTeams && existingTeams.length > 0
      ? Math.max(...existingTeams.map((t) => t.team_number)) + 1
      : 1;

  for (const teamName of teamNames) {
    if (teamMap.has(teamName.toLowerCase())) continue;

    const startingHole =
      rows.find((r) => r.team?.trim().toLowerCase() === teamName.toLowerCase())?.starting_hole ?? 1;

    const { data: newTeam, error: teamErr } = await adminClient
      .from('teams')
      .insert({
        tournament_id: tournamentId,
        team_number: nextTeamNumber,
        team_name: teamName,
        starting_hole: Math.min(Math.max(startingHole, 1), 18),
        max_players: 4,
      })
      .select('id')
      .single();

    if (teamErr) continue;
    teamMap.set(teamName.toLowerCase(), newTeam.id);
    teamsCreated.push(teamName);
    nextTeamNumber++;
  }

  // Import players
  const errors: RowError[] = [];
  const invites: Invite[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const email = row.email?.trim().toLowerCase();
    const name = row.name?.trim();

    if (!name) {
      errors.push({ row: rowNum, email: email ?? '', error: 'Missing name' });
      continue;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: rowNum, email: email ?? '', error: 'Invalid or missing email' });
      continue;
    }

    const teamId = row.team?.trim() ? (teamMap.get(row.team.trim().toLowerCase()) ?? null) : null;

    // Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    let authUserId: string;

    if (authError) {
      const { data: existing } = await adminClient.auth.admin.listUsers();
      const existingUser = existing?.users.find((u) => u.email?.toLowerCase() === email);
      if (!existingUser) {
        errors.push({ row: rowNum, email, error: authError.message });
        continue;
      }
      const { data: existingPlayer } = await adminClient
        .from('players')
        .select('id')
        .eq('auth_user_id', existingUser.id)
        .single();
      if (existingPlayer) {
        errors.push({ row: rowNum, email, error: 'Player already exists' });
        continue;
      }
      authUserId = existingUser.id;
    } else {
      authUserId = authData.user.id;
    }

    // Insert player row
    const { error: playerError } = await adminClient.from('players').insert({
      name,
      email,
      company: row.company?.trim() || null,
      title: row.title?.trim() || null,
      role: 'player',
      auth_user_id: authUserId,
      team_id: teamId,
    });

    if (playerError) {
      if (!authError) await adminClient.auth.admin.deleteUser(authUserId);
      errors.push({ row: rowNum, email, error: playerError.message });
      continue;
    }

    // Generate magic link
    const { data: linkData } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkData?.properties?.action_link) {
      invites.push({ name, email, link: linkData.properties.action_link });
    }

    imported++;
  }

  return NextResponse.json({ imported, errors, teamsCreated, invites }, { status: 200 });
}
