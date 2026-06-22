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

/**
 * Build a mock Supabase chain where every method returns the chain itself,
 * making it both fluent and thenable (awaitable). The resolved value defaults
 * to `resolvedValue`, and individual methods (single, etc.) can be overridden.
 */
function makeChain(resolvedValue: unknown) {
  const chain: Record<string, jest.Mock> & { then?: jest.Mock } = {};
  // Make the chain thenable so `await from('x').select().eq()` resolves.
  chain.then = jest.fn((onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(resolvedValue).then(onFulfilled)
  );
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.in = jest.fn(() => chain);
  chain.single = jest.fn(() => Promise.resolve(resolvedValue));
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

  it('returns 404 when tournament is not found', async () => {
    const chain = makeChain({ data: null, error: { message: 'No rows' } });
    mockFrom.mockReturnValue(chain);

    const req = new Request('http://localhost/api/demo/restart', {
      method: 'POST',
      body: JSON.stringify({ tournamentId: 'nonexistent' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
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
    const mockChains: Record<string, ReturnType<typeof makeChain>> = {};

    mockFrom.mockImplementation((table: string) => {
      if (!mockChains[table]) {
        if (table === 'tournaments') {
          // tournaments chain: first single() returns demo tournament, subsequent are fine
          mockChains[table] = makeChain({ data: null, error: null });
          mockChains[table].single = jest
            .fn()
            .mockResolvedValueOnce({ data: { id: 'tid', is_demo: true }, error: null })
            .mockResolvedValue({ data: null, error: null });
        } else if (table === 'tournament_players') {
          // Returns players so shots delete is triggered
          mockChains[table] = makeChain({
            data: [{ player_id: 'p1' }],
            error: null,
          });
        } else if (table === 'teams') {
          // Returns teams so round_states delete is triggered
          mockChains[table] = makeChain({ data: [{ id: 'team1' }], error: null });
        } else {
          // shots, scores, round_states — write operations return no error
          mockChains[table] = makeChain({ data: null, error: null });
        }
      }
      return mockChains[table];
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

    // Verify wipe operations were invoked
    expect(mockFrom).toHaveBeenCalledWith('shots');
    expect(mockFrom).toHaveBeenCalledWith('scores');
    expect(mockFrom).toHaveBeenCalledWith('round_states');
    expect(mockChains['shots'].delete).toHaveBeenCalled();
    expect(mockChains['scores'].delete).toHaveBeenCalled();
    expect(mockChains['round_states'].delete).toHaveBeenCalled();
  });
});
