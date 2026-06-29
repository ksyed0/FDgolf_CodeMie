/**
 * @jest-environment node
 */
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getActiveTournamentId } from '@/lib/active-tournament';

const mockCookies = cookies as jest.Mock;
const mockCreateClient = createClient as jest.Mock;

function cookieStore(value: string | undefined) {
  return { get: jest.fn().mockReturnValue(value === undefined ? undefined : { value }) };
}

/**
 * Build a thenable Supabase query stub that returns `result` from its single
 * row methods (`single`/`maybeSingle`) regardless of which intermediate filter
 * chain the production code uses.
 */
function queryStub(result: { data: unknown; error?: unknown }) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => promise,
    maybeSingle: () => promise,
  };
  return chain;
}

describe('getActiveTournamentId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the cookie value when set', async () => {
    mockCookies.mockResolvedValue(cookieStore('abc-tournament-id'));
    expect(await getActiveTournamentId()).toBe('abc-tournament-id');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('returns null when cookie is missing and there is no user', async () => {
    mockCookies.mockResolvedValue(cookieStore(undefined));
    mockCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
      from: jest.fn(),
    });
    expect(await getActiveTournamentId()).toBeNull();
  });

  it('falls back to the most recent tournament for a system_admin', async () => {
    mockCookies.mockResolvedValue(cookieStore(undefined));

    const from = jest.fn((table: string) => {
      if (table === 'players') {
        return queryStub({ data: { id: 'sysadmin-id', role: 'system_admin' } });
      }
      if (table === 'tournaments') {
        return queryStub({ data: { id: 'most-recent-tid' } });
      }
      throw new Error(`unexpected table: ${table}`);
    });

    mockCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'auth-id' } } }) },
      from,
    });

    expect(await getActiveTournamentId()).toBe('most-recent-tid');
  });

  it('falls back to the single assignment for a tournament_admin', async () => {
    mockCookies.mockResolvedValue(cookieStore(undefined));

    const from = jest.fn((table: string) => {
      if (table === 'players') {
        return queryStub({ data: { id: 'tadmin-id', role: 'tournament_admin' } });
      }
      if (table === 'tournament_admin_assignments') {
        return queryStub({ data: { tournament_id: 'assigned-tid' } });
      }
      throw new Error(`unexpected table: ${table}`);
    });

    mockCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'auth-id' } } }) },
      from,
    });

    expect(await getActiveTournamentId()).toBe('assigned-tid');
  });

  it('returns null for a non-admin player when cookie is missing', async () => {
    mockCookies.mockResolvedValue(cookieStore(undefined));

    const from = jest.fn(() => queryStub({ data: { id: 'player-id', role: 'player' } }));

    mockCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'auth-id' } } }) },
      from,
    });

    expect(await getActiveTournamentId()).toBeNull();
  });
});
