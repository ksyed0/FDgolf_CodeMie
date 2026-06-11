export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

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
    !('name' in body) ||
    !('email' in body) ||
    typeof (body as Record<string, unknown>).name !== 'string' ||
    typeof (body as Record<string, unknown>).email !== 'string'
  ) {
    return NextResponse.json({ error: 'Missing required fields: name, email' }, { status: 400 });
  }

  const { name, email, company, title } = body as {
    name: string;
    email: string;
    company?: string;
    title?: string;
  };

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

  // Create Supabase auth user (email_confirm: true skips the confirmation email)
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    email_confirm: true,
  });

  if (authError) {
    // User may already exist — try to fetch them instead
    const { data: existing } = await adminClient.auth.admin.listUsers();
    const existingUser = existing?.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase().trim()
    );
    if (!existingUser) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
    // Check if player row already exists for this auth user
    const { data: existingPlayer } = await adminClient
      .from('players')
      .select('id')
      .eq('auth_user_id', existingUser.id)
      .single();
    if (existingPlayer) {
      return NextResponse.json(
        { error: 'A player with this email already exists' },
        { status: 409 }
      );
    }
    // Insert player row linked to existing auth user
    const { data: player, error: playerError } = await adminClient
      .from('players')
      .insert({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        company: company?.trim() || null,
        title: title?.trim() || null,
        role: 'player',
        auth_user_id: existingUser.id,
      })
      .select()
      .single();
    if (playerError) return NextResponse.json({ error: playerError.message }, { status: 500 });
    return NextResponse.json({ player }, { status: 201 });
  }

  const { data: player, error: playerError } = await adminClient
    .from('players')
    .insert({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      company: company?.trim() || null,
      title: title?.trim() || null,
      role: 'player',
      auth_user_id: authData.user.id,
    })
    .select()
    .single();

  if (playerError) {
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: playerError.message }, { status: 500 });
  }

  return NextResponse.json({ player }, { status: 201 });
}
