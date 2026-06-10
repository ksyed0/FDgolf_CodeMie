/**
 * @jest-environment node
 *
 * Unit tests for POST /api/auth/magic-link (src/app/api/auth/magic-link/route.ts).
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/magic-link/route';

// ---------------------------------------------------------------------------
// Supabase server client mock (@/lib/supabase/server)
// ---------------------------------------------------------------------------

let mockGetUser: jest.Mock;
let mockSinglePlayer: jest.Mock;
let mockEq: jest.Mock;
let mockSelect: jest.Mock;
let mockFrom: jest.Mock;

function buildServerClientMock(
  user: { id: string } | null = { id: 'user-1' },
  playerRole: string | null = 'admin'
) {
  mockGetUser = jest.fn().mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'no session' },
  });

  mockSinglePlayer = jest.fn().mockResolvedValue({
    data: playerRole ? { role: playerRole } : null,
    error: playerRole ? null : { message: 'not found' },
  });
  mockEq = jest.fn().mockReturnValue({ single: mockSinglePlayer });
  mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
  mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

  return { auth: { getUser: mockGetUser }, from: mockFrom };
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { createClient as createServerClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Supabase admin client mock (@supabase/supabase-js)
// ---------------------------------------------------------------------------

let mockGenerateLink: jest.Mock;

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      admin: {
        generateLink: mockGenerateLink,
      },
    },
  })),
}));

// ---------------------------------------------------------------------------
// next/headers mock
// ---------------------------------------------------------------------------

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ getAll: () => [], set: jest.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const MAGIC_LINK = 'https://auth.example.com/verify?token=abc123';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/auth/magic-link', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    (createServerClient as jest.Mock).mockResolvedValue(buildServerClientMock());
    mockGenerateLink = jest.fn().mockResolvedValue({
      data: { properties: { action_link: MAGIC_LINK } },
      error: null,
    });
  });

  // -------------------------------------------------------------------------
  describe('validation — returns 400 for invalid input', () => {
    it('returns 400 for non-JSON body', async () => {
      const req = new NextRequest('http://localhost/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('returns 400 when email is missing', async () => {
      const res = await POST(buildRequest({}));
      expect(res.status).toBe(400);
    });

    it('returns 400 when email is not a string', async () => {
      const res = await POST(buildRequest({ email: 42 }));
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('authentication — returns 401 when not signed in', () => {
    it('returns 401 when getUser returns no user', async () => {
      (createServerClient as jest.Mock).mockResolvedValue(buildServerClientMock(null, null));
      const res = await POST(buildRequest({ email: 'player@example.com' }));
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  describe('authorization — returns 403 when caller is not admin', () => {
    it('returns 403 for a player role', async () => {
      (createServerClient as jest.Mock).mockResolvedValue(
        buildServerClientMock({ id: 'user-1' }, 'player')
      );
      const res = await POST(buildRequest({ email: 'player@example.com' }));
      expect(res.status).toBe(403);
    });

    it('returns 403 when player record is not found', async () => {
      (createServerClient as jest.Mock).mockResolvedValue(
        buildServerClientMock({ id: 'user-1' }, null)
      );
      const res = await POST(buildRequest({ email: 'player@example.com' }));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  describe('successful response — returns 200 with magic link', () => {
    it('returns 200 with the action_link from Supabase', async () => {
      const res = await POST(buildRequest({ email: 'admin@example.com' }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.link).toBe(MAGIC_LINK);
    });

    it('calls generateLink with type magiclink and the provided email', async () => {
      await POST(buildRequest({ email: 'admin@example.com' }));
      expect(mockGenerateLink).toHaveBeenCalledWith({
        type: 'magiclink',
        email: 'admin@example.com',
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('admin link failure — returns 500', () => {
    it('returns 500 when Supabase generateLink returns an error', async () => {
      mockGenerateLink = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'rate limit exceeded' },
      });
      const res = await POST(buildRequest({ email: 'admin@example.com' }));
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toContain('rate limit exceeded');
    });
  });
});
