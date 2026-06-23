import { cookies } from 'next/headers';

export const ACTIVE_TOURNAMENT_COOKIE = 'x-active-tournament';

export async function getActiveTournamentId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_TOURNAMENT_COOKIE)?.value ?? null;
}
