import { renderHook, waitFor, act } from '@testing-library/react';
import { useGps } from '@/hooks/use-gps';
import { getCurrentPosition } from '@/lib/gps';

jest.mock('@/lib/gps', () => ({
  getCurrentPosition: jest.fn(),
}));

const mockGetCurrentPosition = getCurrentPosition as jest.Mock;

describe('useGps', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sets position from getCurrentPosition on mount', async () => {
    mockGetCurrentPosition.mockResolvedValue({ lat: 1, lng: 2, accuracy: 5 });

    const { result } = renderHook(() => useGps());

    await waitFor(() => expect(result.current.position).toEqual({ lat: 1, lng: 2, accuracy: 5 }));
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('sets error when getCurrentPosition rejects', async () => {
    mockGetCurrentPosition.mockRejectedValue(new Error('denied'));

    const { result } = renderHook(() => useGps());

    await waitFor(() => expect(result.current.error).toBe('denied'));
    expect(result.current.position).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('does not set state after unmount if the mount-time lookup resolves late', async () => {
    let resolveLookup: (pos: { lat: number; lng: number; accuracy: number }) => void;
    mockGetCurrentPosition.mockReturnValue(
      new Promise((resolve) => {
        resolveLookup = resolve;
      })
    );

    const { result, unmount } = renderHook(() => useGps());

    // Let the mount-time microtask-deferred refresh() actually start.
    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    await act(async () => {
      resolveLookup({ lat: 9, lng: 9, accuracy: 1 });
      await Promise.resolve();
    });

    // Hook state after unmount is inert — no React "set state after unmount" warning,
    // and the last rendered snapshot never picked up the post-unmount resolution.
    expect(result.current.position).toBeNull();
  });

  it('refresh() can be called manually and updates position again', async () => {
    mockGetCurrentPosition
      .mockResolvedValueOnce({ lat: 1, lng: 1, accuracy: 5 })
      .mockResolvedValueOnce({ lat: 2, lng: 2, accuracy: 5 });

    const { result } = renderHook(() => useGps());
    await waitFor(() => expect(result.current.position).toEqual({ lat: 1, lng: 1, accuracy: 5 }));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.position).toEqual({ lat: 2, lng: 2, accuracy: 5 });
  });
});
