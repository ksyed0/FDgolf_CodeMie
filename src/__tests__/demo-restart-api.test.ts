/**
 * @jest-environment node
 */
import { POST } from '@/app/api/demo/restart/route';

const mockFrom = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

function makeChain(returnValue: unknown) {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.in = jest.fn(() => chain);
  chain.single = jest.fn(() => Promise.resolve(returnValue));
  chain.update = jest.fn(() => chain);
  chain.delete = jest.fn(() => chain);
  return chain;
}

describe('POST /api/demo/restart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  });

  it('returns 400 when tournamentId is missing', async () => {
    const req = new Request('http://localhost/api/demo/restart', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/tournamentId/);
  });

  it('returns 403 when tournament is not a demo tournament', async () => {
    const chain = makeChain({ data: { id: 'tid', is_demo: false }, error: null });
    mockFrom.mockReturnValue(chain);

    const req = new Request('http://localhost/api/demo/restart', {
      method: 'POST',
      body: JSON.stringify({ tournamentId: 'tid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a demo/i);
  });

  it('returns 200 and resets tournament when is_demo is true', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain({ data: { id: 'tid', is_demo: true }, error: null });
      }
      const chain = makeChain({ data: [], error: null });
      chain.delete = jest.fn(() => chain);
      chain.update = jest.fn(() => chain);
      return chain;
    });

    const req = new Request('http://localhost/api/demo/restart', {
      method: 'POST',
      body: JSON.stringify({ tournamentId: 'tid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
