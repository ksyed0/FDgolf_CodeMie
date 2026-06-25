/**
 * @jest-environment node
 */
import { POST } from '@/app/api/auth/request-link/route';

const mockSignInWithOtp = jest.fn();
const mockFrom = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
    auth: { signInWithOtp: mockSignInWithOtp },
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
  return chain;
}

describe('POST /api/auth/request-link', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  it('returns 400 when email is missing', async () => {
    const req = new Request('http://localhost/api/auth/request-link', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it('returns 200 without calling signInWithOtp when email is not in players table', async () => {
    const chain = makeChain({ data: null, error: { message: 'No rows' } });
    mockFrom.mockReturnValue(chain);

    const req = new Request('http://localhost/api/auth/request-link', {
      method: 'POST',
      body: JSON.stringify({ email: 'unknown@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it('returns 200 and calls signInWithOtp when email matches an enrolled player', async () => {
    const chain = makeChain({ data: { id: 'player-1' }, error: null });
    mockFrom.mockReturnValue(chain);

    const req = new Request('http://localhost/api/auth/request-link', {
      method: 'POST',
      body: JSON.stringify({ email: 'player@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'player@example.com',
      options: { shouldCreateUser: false },
    });
  });
});
