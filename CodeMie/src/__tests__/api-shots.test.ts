/**
 * @jest-environment node
 *
 * Unit tests for POST /api/shots (src/app/api/shots/route.ts).
 *
 * The Supabase server client and next/headers (cookies) are mocked so the
 * handler can run in a plain Node/Jest environment without a real Next.js
 * runtime.
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/shots/route';

// ---------------------------------------------------------------------------
// Supabase server client mock
// ---------------------------------------------------------------------------

type SelectChain = {
  single: jest.Mock<Promise<{ data: { id: string } | null; error: { message: string } | null }>>;
};

type InsertChain = {
  select: jest.Mock<SelectChain>;
};

type FromChain = {
  insert: jest.Mock<InsertChain>;
};

let mockFrom: jest.Mock<FromChain>;
let mockInsert: jest.Mock<InsertChain>;
let mockSelect: jest.Mock<SelectChain>;
let mockSingle: jest.Mock<
  Promise<{ data: { id: string } | null; error: { message: string } | null }>
>;

function buildSupabaseMock() {
  mockSingle = jest.fn().mockResolvedValue({ data: { id: 'shot-123' }, error: null });
  mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
  mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
  mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });

  return { from: mockFrom };
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

// We need to reset the resolved value per test, so we import the mock after
// the jest.mock declaration and configure it in beforeEach.
import { createClient as createServerClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// next/headers mock (cookies — required by server client)
// ---------------------------------------------------------------------------

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    getAll: () => [],
    set: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/shots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  player_id: 'player-1',
  tournament_id: 'tournament-1',
  hole_number: 3,
  shot_number: 1,
  club_name: '7 Iron',
  start_lat: 43.5257,
  start_lng: -79.8816,
  outcome: 'in_play' as const,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/shots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createServerClient as jest.Mock).mockResolvedValue(buildSupabaseMock());
  });

  // -------------------------------------------------------------------------
  describe('validation — returns 400 when required fields are missing', () => {
    it('returns 400 when player_id is missing', async () => {
      const { player_id: _omit, ...rest } = validBody;
      const response = await POST(buildRequest(rest));
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBeDefined();
    });

    it('returns 400 when tournament_id is missing', async () => {
      const { tournament_id: _omit, ...rest } = validBody;
      const response = await POST(buildRequest(rest));
      expect(response.status).toBe(400);
    });

    it('returns 400 when hole_number is missing', async () => {
      const { hole_number: _omit, ...rest } = validBody;
      const response = await POST(buildRequest(rest));
      expect(response.status).toBe(400);
    });

    it('returns 400 when shot_number is missing', async () => {
      const { shot_number: _omit, ...rest } = validBody;
      const response = await POST(buildRequest(rest));
      expect(response.status).toBe(400);
    });

    it('returns 400 when club_name is missing', async () => {
      const { club_name: _omit, ...rest } = validBody;
      const response = await POST(buildRequest(rest));
      expect(response.status).toBe(400);
    });

    it('returns 400 when outcome is missing', async () => {
      const { outcome: _omit, ...rest } = validBody;
      const response = await POST(buildRequest(rest));
      expect(response.status).toBe(400);
    });

    it('returns 400 when the request body is not valid JSON', async () => {
      const request = new NextRequest('http://localhost/api/shots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('successful insert — returns 201', () => {
    it('returns 201 with the new shot id on a valid insert', async () => {
      const response = await POST(buildRequest(validBody));
      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.id).toBe('shot-123');
    });

    it('calls supabase.from("shots").insert(...) with the correct payload', async () => {
      await POST(buildRequest(validBody));
      expect(mockFrom).toHaveBeenCalledWith('shots');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          player_id: validBody.player_id,
          tournament_id: validBody.tournament_id,
          hole_number: validBody.hole_number,
          shot_number: validBody.shot_number,
          club_name: validBody.club_name,
          outcome: validBody.outcome,
        })
      );
    });

    it('includes optional GPS fields when provided', async () => {
      await POST(buildRequest(validBody));
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          start_lat: validBody.start_lat,
          start_lng: validBody.start_lng,
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('Supabase insert failure — returns 500', () => {
    it('returns 500 when Supabase returns an error', async () => {
      mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'insert failed — constraint violation' },
      });
      mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });

      (createServerClient as jest.Mock).mockResolvedValue({ from: mockFrom });

      const response = await POST(buildRequest(validBody));
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toContain('insert failed');
    });

    it('does not leak internal error details beyond the error message field', async () => {
      mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'unexpected error' },
      });
      mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });

      (createServerClient as jest.Mock).mockResolvedValue({ from: mockFrom });

      const response = await POST(buildRequest(validBody));
      const json = await response.json();
      // Only the `error` key should be present — no stack traces etc.
      expect(Object.keys(json)).toEqual(['error']);
    });
  });
});
