import { render, screen, fireEvent, act } from '@testing-library/react';

let resolveSearch: (value: { data: unknown }) => void;
let searchPromise: Promise<{ data: unknown }>;

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'tournament_admin_assignments') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
      }
      if (table === 'players') {
        return {
          select: () => ({
            or: () => ({
              limit: () => searchPromise,
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  }),
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

import { TournamentAdmins } from '@/app/(admin)/admin/tournament/tournament-admins';

describe('TournamentAdmins search debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    searchPromise = new Promise((resolve) => {
      resolveSearch = resolve;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not update state after unmount if the search resolves after the component is gone', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = render(<TournamentAdmins tournamentId="t1" />);

    // Flush the initial load() effect.
    await act(async () => {
      await Promise.resolve();
    });

    const input = screen.getByPlaceholderText(/search player/i);
    fireEvent.change(input, { target: { value: 'ale' } });

    // Fire the 250ms debounce timer so the search request starts, then unmount
    // while the request is still pending.
    act(() => {
      jest.advanceTimersByTime(250);
    });

    unmount();

    // Resolve the in-flight search after unmount — the cancelled guard must
    // prevent setResults from firing, i.e. no "set state after unmount" warning.
    await act(async () => {
      resolveSearch({ data: [{ id: 'p1', name: 'Alex', email: 'alex@example.com' }] });
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining('unmounted component'));
    consoleError.mockRestore();
  });

  it('shows search results when the debounce resolves while still mounted', async () => {
    render(<TournamentAdmins tournamentId="t1" />);

    await act(async () => {
      await Promise.resolve();
    });

    const input = screen.getByPlaceholderText(/search player/i);
    fireEvent.change(input, { target: { value: 'ale' } });

    act(() => {
      jest.advanceTimersByTime(250);
    });

    await act(async () => {
      resolveSearch({ data: [{ id: 'p1', name: 'Alex', email: 'alex@example.com' }] });
      await Promise.resolve();
    });

    expect(screen.getByText('Alex')).toBeInTheDocument();
  });
});
