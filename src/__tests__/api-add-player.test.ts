/**
 * @jest-environment node
 *
 * Unit tests for POST /api/admin/add-player
 * (src/app/api/admin/add-player/route.ts)
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/add-player/route';

// ---------------------------------------------------------------------------
// Supabase server client mock (@/lib/supabase/server)
// ---------------------------------------------------------------------------

let mockGetUser: jest.Mock;
let mockSingleRole: jest.Mock;
let mockEqRole: jest.Mock;
let mockSelectRole: jest.Mock;
let mockServerFrom: jest.Mock;

function buildServerClientMock(userId: string | null = 'user-1', role: string | null = 'admin') {
  mockGetUser = jest.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: userId ? null : { message: 'no session' },
  });
  mockSingleRole = jest.fn().mockResolvedValue({ data: role ? { role } : null, error: null });
  mockEqRole = jest.fn().mockReturnValue({ single: mockSingleRole });
  mockSelectRole = jest.fn().mockReturnValue({ eq: mockEqRole });
  mockServerFrom = jest.fn().mockReturnValue({ select: mockSelectRole });
  return { auth: { getUser: mockGetUser }, from: mockServerFrom };
}

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
import { createClient as createServerClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Supabase admin client mock (@supabase/supabase-js)
// ---------------------------------------------------------------------------

let mockCreateUser: jest.Mock;
let mockListUsers: jest.Mock;
let mockDeleteUser: jest.Mock;
let mockAdminFrom: jest.Mock;

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        listUsers: mockListUsers,
        deleteUser: mockDeleteUser,
      },
    },
    from: mockAdminFrom,
  })),
}));

// ---------------------------------------------------------------------------
// next/headers mock (required by SSR client)
// ---------------------------------------------------------------------------

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ getAll: () => [], set: jest.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/add-player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { name: 'Alice Johnson', email: 'alice@example.com' };
const NEW_AUTH_USER = { id: 'auth-new-1' };
const PLAYER_ROW = { id: 'player-1', name: 'Alice Johnson', email: 'alice@example.com' };

/** Build an admin `from` chain for a successful insert */
function buildInsertChain(result: { data: unknown; error: unknown }) {
  const single = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select });
  return jest.fn().mockReturnValue({ insert });
}

/** Build an admin `from` chain for a successful select→eq→single */
function buildSelectChain(result: { data: unknown; error: unknown }) {
  const single = jest.fn().mockResolvedValue(result);
  const eq = jest.fn().mockReturnValue({ single });
  const select = jest.fn().mockReturnValue({ eq });
  return jest.fn().mockReturnValue({ select });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/add-player', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    (createServerClient as jest.Mock).mockResolvedValue(buildServerClientMock());

    mockCreateUser = jest.fn().mockResolvedValue({ data: { user: NEW_AUTH_USER }, error: null });
    mockListUsers = jest.fn().mockResolvedValue({ data: { users: [] } });
    mockDeleteUser = jest.fn().mockResolvedValue({});
    mockAdminFrom = buildInsertChain({ data: PLAYER_ROW, error: null });
  });

  it('returns 400 for malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/admin/add-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON');
  });

  it('returns 400 when name is missing', async () => {
    const res = await POST(buildRequest({ email: 'a@b.com' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/name/i);
  });

  it('returns 400 when email is missing', async () => {
    const res = await POST(buildRequest({ name: 'Bob' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is not an object', async () => {
    const res = await POST(buildRequest(null));
    expect(res.status).toBe(400);
  });

  it('returns 401 when no authenticated session', async () => {
    (createServerClient as jest.Mock).mockResolvedValue(buildServerClientMock(null));
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not admin', async () => {
    (createServerClient as jest.Mock).mockResolvedValue(buildServerClientMock('user-1', 'player'));
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it('returns 403 when caller has no player row', async () => {
    (createServerClient as jest.Mock).mockResolvedValue(buildServerClientMock('user-1', null));
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it('returns 201 with player when created successfully', async () => {
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect((await res.json()).player).toEqual(PLAYER_ROW);
    expect(mockCreateUser).toHaveBeenCalledWith({
      email: 'alice@example.com',
      email_confirm: true,
    });
  });

  it('trims and lowercases email before creating user', async () => {
    await POST(buildRequest({ name: 'Alice', email: '  ALICE@Example.Com  ' }));
    expect(mockCreateUser).toHaveBeenCalledWith({
      email: 'alice@example.com',
      email_confirm: true,
    });
  });

  it('returns 409 when auth user already exists and has a player row', async () => {
    mockCreateUser.mockResolvedValue({
      data: null,
      error: { message: 'User already registered' },
    });
    mockListUsers.mockResolvedValue({
      data: { users: [{ id: 'existing-auth', email: 'alice@example.com' }] },
    });
    // Admin from: select→eq→single returns existing player
    mockAdminFrom = buildSelectChain({ data: { id: 'existing-player' }, error: null });

    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(409);
  });

  it('returns 201 when auth user exists but has no player row yet', async () => {
    mockCreateUser.mockResolvedValue({
      data: null,
      error: { message: 'User already registered' },
    });
    mockListUsers.mockResolvedValue({
      data: { users: [{ id: 'existing-auth', email: 'alice@example.com' }] },
    });

    // from() called twice: 1st = select existing player (null), 2nd = insert
    let callCount = 0;
    mockAdminFrom = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return buildSelectChain({ data: null, error: null })();
      }
      return buildInsertChain({ data: PLAYER_ROW, error: null })();
    });

    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect((await res.json()).player).toEqual(PLAYER_ROW);
  });

  it('returns 500 when auth creation fails and no matching user found', async () => {
    mockCreateUser.mockResolvedValue({
      data: null,
      error: { message: 'Unexpected auth error' },
    });
    mockListUsers.mockResolvedValue({ data: { users: [] } });

    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(500);
  });

  it('returns 500 and rolls back auth user when player insert fails', async () => {
    mockAdminFrom = buildInsertChain({ data: null, error: { message: 'db constraint' } });

    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(500);
    expect(mockDeleteUser).toHaveBeenCalledWith(NEW_AUTH_USER.id);
  });
});
