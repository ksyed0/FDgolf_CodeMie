/**
 * @jest-environment node
 */
import { POST } from '@/app/api/demo/stop/route';

const mockFrom = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

function makeChain(resolvedValue: unknown) {
  const chain: Record<string, jest.Mock> & { then?: jest.Mock } = {};
  chain.then = jest.fn((onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(resolvedValue).then(onFulfilled)
  );
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.single = jest.fn(() => Promise.resolve(resolvedValue));
  chain.update = jest.fn(() => chain);
  return chain;
}

describe('POST /api/demo/stop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  });

  it('returns 400 when tournamentId is missing', async () => {
    const req = new Request('http://localhost/api/demo/stop', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/tournamentId/);
  });

  it('returns 404 when tournament is not found', async () => {
    const chain = makeChain({ data: null, error: { message: 'No rows' } });
    mockFrom.mockReturnValue(chain);

    const req = new Request('http://localhost/api/demo/stop', {
      method: 'POST',
      body: JSON.stringify({ tournamentId: 'nonexistent' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 403 when tournament is not a demo', async () => {
    const chain = makeChain({ data: { id: 'tid', is_demo: false }, error: null });
    mockFrom.mockReturnValue(chain);

    const req = new Request('http://localhost/api/demo/stop', {
      method: 'POST',
      body: JSON.stringify({ tournamentId: 'tid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a demo/i);
  });

  it('returns 200 and sets status to paused for a demo tournament', async () => {
    const fetchChain = makeChain({ data: { id: 'tid', is_demo: true }, error: null });
    const updateChain = makeChain({ error: null });
    updateChain.eq = jest.fn(() => Promise.resolve({ error: null }));

    mockFrom.mockImplementation(() => {
      const chain = makeChain({ data: { id: 'tid', is_demo: true }, error: null });
      chain.update = jest.fn(() => updateChain);
      return chain;
    });

    const req = new Request('http://localhost/api/demo/stop', {
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
