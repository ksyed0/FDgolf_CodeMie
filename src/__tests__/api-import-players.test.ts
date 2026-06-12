/**
 * @jest-environment node
 */

import { POST } from '@/app/api/admin/import-players/route';
import { NextRequest } from 'next/server';

const mockGetUser = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

const mockAdminCreateUser = jest.fn();
const mockAdminListUsers = jest.fn();
const mockAdminGenerateLink = jest.fn();
const mockAdminDeleteUser = jest.fn();
const mockAdminFrom = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      admin: {
        createUser: (...args: unknown[]) => mockAdminCreateUser(...args),
        listUsers: () => mockAdminListUsers(),
        generateLink: (...args: unknown[]) => mockAdminGenerateLink(...args),
        deleteUser: (...args: unknown[]) => mockAdminDeleteUser(...args),
      },
    },
    from: (...args: unknown[]) => mockAdminFrom(...args),
  }),
}));

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/import-players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setupAdmin() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-uid' } }, error: null });
  mockFrom.mockReturnValue({
    select: () => ({ eq: () => ({ single: () => ({ data: { role: 'admin' } }) }) }),
  });
}

describe('POST /api/admin/import-players', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/admin/import-players', {
      method: 'POST',
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing fields', async () => {
    const res = await POST(makeRequest({ foo: 'bar' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('tournamentId');
  });

  it('returns 400 for empty rows', async () => {
    setupAdmin();
    mockAdminFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { id: 'trn-1' } }) }) }),
    });
    const res = await POST(makeRequest({ tournamentId: 'trn-1', rows: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for too many rows', async () => {
    setupAdmin();
    const rows = Array.from({ length: 201 }, (_, i) => ({ name: `P${i}`, email: `p${i}@x.com` }));
    const res = await POST(makeRequest({ tournamentId: 'trn-1', rows }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('200');
  });

  it('returns 401 for unauthenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } });
    const res = await POST(
      makeRequest({ tournamentId: 'x', rows: [{ name: 'A', email: 'a@b.c' }] })
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid' } }, error: null });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { role: 'player' } }) }) }),
    });
    const res = await POST(
      makeRequest({ tournamentId: 'x', rows: [{ name: 'A', email: 'a@b.c' }] })
    );
    expect(res.status).toBe(403);
  });

  it('returns 404 for missing tournament', async () => {
    setupAdmin();
    mockAdminFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: null }) }) }),
    });
    const res = await POST(
      makeRequest({ tournamentId: 'bad', rows: [{ name: 'A', email: 'a@b.c' }] })
    );
    expect(res.status).toBe(404);
  });

  it('imports valid rows and returns invites', async () => {
    setupAdmin();

    // Tournament lookup
    const tournamentQuery = {
      select: () => ({ eq: () => ({ single: () => ({ data: { id: 'trn-1' } }) }) }),
    };
    // Teams lookup
    const teamsQuery = { select: () => ({ eq: () => ({ data: [] }) }) };
    // Player insert
    const playerInsert = { insert: () => ({ select: jest.fn(), error: null }) };

    let callCount = 0;
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'tournaments') return tournamentQuery;
      if (table === 'teams') {
        callCount++;
        if (callCount === 1) return teamsQuery;
        return {
          insert: () => ({
            select: () => ({ single: () => ({ data: { id: 'team-new' }, error: null }) }),
          }),
        };
      }
      if (table === 'players') {
        return {
          insert: () => ({ error: null }),
          select: () => ({ eq: () => ({ single: () => ({ data: null }) }) }),
        };
      }
      return {};
    });

    mockAdminCreateUser.mockResolvedValue({ data: { user: { id: 'new-uid-1' } }, error: null });
    mockAdminGenerateLink.mockResolvedValue({
      data: { properties: { action_link: 'https://example.com/link' } },
    });

    const res = await POST(
      makeRequest({
        tournamentId: 'trn-1',
        rows: [{ name: 'Alice', email: 'alice@test.com', team: 'Alpha' }],
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.imported).toBe(1);
    expect(json.invites).toHaveLength(1);
    expect(json.invites[0].link).toBe('https://example.com/link');
  });

  it('handles existing auth user with no player row', async () => {
    setupAdmin();
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'tournaments')
        return { select: () => ({ eq: () => ({ single: () => ({ data: { id: 'trn-1' } }) }) }) };
      if (table === 'teams') return { select: () => ({ eq: () => ({ data: [] }) }) };
      if (table === 'players')
        return {
          insert: () => ({ error: null }),
          select: () => ({ eq: () => ({ single: () => ({ data: null }) }) }),
        };
      return {};
    });

    mockAdminCreateUser.mockResolvedValue({
      data: null,
      error: { message: 'User already registered' },
    });
    mockAdminListUsers.mockResolvedValue({
      data: { users: [{ id: 'existing-uid', email: 'existing@test.com' }] },
    });
    mockAdminGenerateLink.mockResolvedValue({
      data: { properties: { action_link: 'https://example.com/link2' } },
    });

    const res = await POST(
      makeRequest({
        tournamentId: 'trn-1',
        rows: [{ name: 'Existing User', email: 'existing@test.com' }],
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.imported).toBe(1);
    expect(mockAdminListUsers).toHaveBeenCalled();
  });

  it('reports error when player already exists for auth user', async () => {
    setupAdmin();
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'tournaments')
        return { select: () => ({ eq: () => ({ single: () => ({ data: { id: 'trn-1' } }) }) }) };
      if (table === 'teams') return { select: () => ({ eq: () => ({ data: [] }) }) };
      if (table === 'players')
        return {
          select: () => ({ eq: () => ({ single: () => ({ data: { id: 'player-exists' } }) }) }),
        };
      return {};
    });

    mockAdminCreateUser.mockResolvedValue({ data: null, error: { message: 'exists' } });
    mockAdminListUsers.mockResolvedValue({
      data: { users: [{ id: 'uid-dup', email: 'dup@test.com' }] },
    });

    const res = await POST(
      makeRequest({
        tournamentId: 'trn-1',
        rows: [{ name: 'Dup', email: 'dup@test.com' }],
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.imported).toBe(0);
    expect(json.errors[0].error).toBe('Player already exists');
  });

  it('cleans up auth user if player insert fails', async () => {
    setupAdmin();
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'tournaments')
        return { select: () => ({ eq: () => ({ single: () => ({ data: { id: 'trn-1' } }) }) }) };
      if (table === 'teams') return { select: () => ({ eq: () => ({ data: [] }) }) };
      if (table === 'players') return { insert: () => ({ error: { message: 'constraint' } }) };
      return {};
    });

    mockAdminCreateUser.mockResolvedValue({ data: { user: { id: 'cleanup-uid' } }, error: null });
    mockAdminDeleteUser.mockResolvedValue({});

    const res = await POST(
      makeRequest({
        tournamentId: 'trn-1',
        rows: [{ name: 'Fail', email: 'fail@test.com' }],
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.imported).toBe(0);
    expect(json.errors[0].error).toBe('constraint');
    expect(mockAdminDeleteUser).toHaveBeenCalledWith('cleanup-uid');
  });

  it('reports row errors for invalid emails', async () => {
    setupAdmin();
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'tournaments')
        return { select: () => ({ eq: () => ({ single: () => ({ data: { id: 'trn-1' } }) }) }) };
      if (table === 'teams') return { select: () => ({ eq: () => ({ data: [] }) }) };
      return {};
    });

    const res = await POST(
      makeRequest({
        tournamentId: 'trn-1',
        rows: [
          { name: 'Bob', email: 'not-an-email' },
          { name: '', email: 'valid@test.com' },
        ],
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.imported).toBe(0);
    expect(json.errors).toHaveLength(2);
    expect(json.errors[0].error).toContain('email');
    expect(json.errors[1].error).toContain('name');
  });
});
