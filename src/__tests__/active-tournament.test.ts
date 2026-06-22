/**
 * @jest-environment node
 */
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

import { cookies } from 'next/headers';
import { getActiveTournamentId } from '@/lib/active-tournament';

const mockCookies = cookies as jest.Mock;

describe('getActiveTournamentId', () => {
  it('returns null when cookie is not set', async () => {
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue(undefined) });
    expect(await getActiveTournamentId()).toBeNull();
  });

  it('returns the cookie value when set', async () => {
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: 'abc-tournament-id' }),
    });
    expect(await getActiveTournamentId()).toBe('abc-tournament-id');
  });
});
