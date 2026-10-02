/**
 * @jest-environment node
 */
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

import { cookies } from 'next/headers';
import { setActiveTournamentAction } from '@/lib/actions/set-active-tournament';
import { ACTIVE_TOURNAMENT_COOKIE } from '@/lib/active-tournament';

const mockCookies = cookies as jest.Mock;

describe('setActiveTournamentAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes the active tournament id to the cookie store', async () => {
    const set = jest.fn();
    mockCookies.mockResolvedValue({ set });

    await setActiveTournamentAction('tournament-123');

    expect(set).toHaveBeenCalledWith(ACTIVE_TOURNAMENT_COOKIE, 'tournament-123', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  });
});
