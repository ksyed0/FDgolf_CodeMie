'use server';

import { cookies } from 'next/headers';
import { ACTIVE_TOURNAMENT_COOKIE } from '@/lib/active-tournament';

export async function setActiveTournamentAction(tournamentId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_TOURNAMENT_COOKIE, tournamentId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}
