import { render, screen, fireEvent, act } from '@testing-library/react';

let resolveSearch: (value: { data: unknown }) => void;
let searchPromise: Promise<{ data: unknown }>;

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
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

import { RosterManager } from '@/app/(admin)/admin/roster/roster-manager';

describe('RosterManager search debounce', () => {
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

    const { unmount } = render(<RosterManager tournamentId="t1" players={[]} teams={[]} />);

    fireEvent.click(screen.getByText('+ Add Existing'));

    const input = screen.getByPlaceholderText(/search by name or email/i);
    fireEvent.change(input, { target: { value: 'ale' } });

    act(() => {
      jest.advanceTimersByTime(250);
    });

    unmount();

    await act(async () => {
      resolveSearch({ data: [{ id: 'p1', name: 'Alex', email: 'alex@example.com' }] });
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining('unmounted component'));
    consoleError.mockRestore();
  });

  it('shows search results when the debounce resolves while still mounted', async () => {
    render(<RosterManager tournamentId="t1" players={[]} teams={[]} />);

    fireEvent.click(screen.getByText('+ Add Existing'));

    const input = screen.getByPlaceholderText(/search by name or email/i);
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
