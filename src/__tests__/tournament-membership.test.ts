import type { SupabaseClient } from '@supabase/supabase-js';
import { getActivePlayerMembership } from '@/lib/tournament-membership';

/**
 * `getActivePlayerMembership` takes `supabase` as a plain argument (not via
 * `createClient()`), and its query chain terminates on `.in(...)` rather than
 * `.single()`/`.maybeSingle()` — the data resolves at the end of the chain itself.
 */
function buildSupabaseStub(result: { data: unknown }) {
  const eq = jest.fn();
  const inFn = jest.fn(() => Promise.resolve(result));
  eq.mockReturnValue({ in: inFn });
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from, select, eq, in: inFn };
}

describe('getActivePlayerMembership', () => {
  it('returns null when no rows match', async () => {
    const { client } = buildSupabaseStub({ data: [] });
    await expect(getActivePlayerMembership(client, 'player-1')).resolves.toBeNull();
  });

  it('returns null when data is null', async () => {
    const { client } = buildSupabaseStub({ data: null });
    await expect(getActivePlayerMembership(client, 'player-1')).resolves.toBeNull();
  });

  it('maps a single row to {tournamentId, teamId}', async () => {
    const { client } = buildSupabaseStub({
      data: [
        {
          tournament_id: 'tour-1',
          team_id: 'team-1',
          tournaments: { status: 'active', created_at: '2026-06-01T00:00:00Z' },
        },
      ],
    });

    await expect(getActivePlayerMembership(client, 'player-1')).resolves.toEqual({
      tournamentId: 'tour-1',
      teamId: 'team-1',
    });
  });

  it('returns the row with the most recent tournament created_at when multiple match', async () => {
    const { client } = buildSupabaseStub({
      data: [
        {
          tournament_id: 'tour-old',
          team_id: 'team-old',
          tournaments: { status: 'paused', created_at: '2026-01-01T00:00:00Z' },
        },
        {
          tournament_id: 'tour-new',
          team_id: 'team-new',
          tournaments: { status: 'active', created_at: '2026-06-01T00:00:00Z' },
        },
      ],
    });

    await expect(getActivePlayerMembership(client, 'player-1')).resolves.toEqual({
      tournamentId: 'tour-new',
      teamId: 'team-new',
    });
  });

  it('queries by player_id and restricts to active/paused tournaments', async () => {
    const { client, eq, in: inFn } = buildSupabaseStub({ data: [] });
    await getActivePlayerMembership(client, 'player-42');

    expect(eq).toHaveBeenCalledWith('player_id', 'player-42');
    expect(inFn).toHaveBeenCalledWith('tournaments.status', ['active', 'paused']);
  });
});
