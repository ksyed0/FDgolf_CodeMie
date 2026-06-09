/**
 * SyncEngine unit tests.
 *
 * Dependencies mocked:
 *   - localStorage  (in-memory store replacing the global)
 *   - @/lib/supabase/client  (Supabase browser client)
 *   - navigator.onLine / navigator.online event
 */

import { SyncEngine } from '@/lib/sync-engine';

// ---------------------------------------------------------------------------
// In-memory localStorage mock
// ---------------------------------------------------------------------------

const localStorageStore: Record<string, string> = {};

const localStorageMock: Storage = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => {
    localStorageStore[key] = value;
  },
  removeItem: (key: string) => {
    delete localStorageStore[key];
  },
  clear: () => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
  },
  get length() {
    return Object.keys(localStorageStore).length;
  },
  key: (index: number) => Object.keys(localStorageStore)[index] ?? null,
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ---------------------------------------------------------------------------
// Supabase client mock
// ---------------------------------------------------------------------------

type InsertFn = jest.Mock<{ error: { message: string } | null }>;

let mockInsert: InsertFn;

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      insert: mockInsert,
    }),
  }),
}));

// ---------------------------------------------------------------------------
// navigator.onLine mock
// ---------------------------------------------------------------------------

Object.defineProperty(global.navigator, 'onLine', {
  get: () => true,
  configurable: true,
});

// ---------------------------------------------------------------------------
// crypto.randomUUID mock (not available in all Node test environments)
// ---------------------------------------------------------------------------

let uuidCounter = 0;
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: () => `uuid-${++uuidCounter}` },
  configurable: true,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncEngine', () => {
  let engine: SyncEngine;

  beforeEach(() => {
    // Reset state between tests
    localStorageMock.clear();
    uuidCounter = 0;
    mockInsert = jest.fn().mockReturnValue({ error: null });
    engine = new SyncEngine();
  });

  // -------------------------------------------------------------------------
  describe('enqueue (addToQueue)', () => {
    it('adds a shot to the queue', () => {
      engine.enqueue('shots', { player_id: 'p1', strokes: 4 });
      const queue = engine.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].table).toBe('shots');
      expect(queue[0].payload).toEqual({ player_id: 'p1', strokes: 4 });
    });

    it('assigns a unique id to each queued entry', () => {
      engine.enqueue('shots', { player_id: 'p1' });
      engine.enqueue('shots', { player_id: 'p2' });
      const queue = engine.getQueue();
      expect(queue[0].id).not.toBe(queue[1].id);
    });

    it('starts new entries with retries = 0', () => {
      engine.enqueue('shots', { player_id: 'p1' });
      expect(engine.getQueue()[0].retries).toBe(0);
    });

    it('persists the queue to localStorage', () => {
      engine.enqueue('shots', { player_id: 'p1' });
      const raw = localStorage.getItem('fdgolf_sync_queue');
      expect(raw).not.toBeNull();
      const parsed: unknown[] = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
    });

    it('accumulates multiple entries', () => {
      engine.enqueue('shots', { player_id: 'p1' });
      engine.enqueue('shots', { player_id: 'p2' });
      engine.enqueue('scores', { player_id: 'p3', hole_number: 5 });
      expect(engine.getQueue()).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  describe('flush (processQueue)', () => {
    it('calls Supabase insert for each queued item', async () => {
      // Seed localStorage directly — do NOT call enqueue() here, because enqueue()
      // triggers flush() internally without awaiting it, leaving this.processing=true
      // and causing any subsequent manual flush() call to short-circuit immediately.
      mockInsert = jest.fn().mockReturnValue({ error: null });
      localStorage.setItem(
        'fdgolf_sync_queue',
        JSON.stringify([
          { id: 'a', table: 'shots', payload: { player_id: 'p1' }, created_at: 1, retries: 0 },
          { id: 'b', table: 'shots', payload: { player_id: 'p2' }, created_at: 2, retries: 0 },
        ])
      );

      await engine.flush();
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });

    it('removes successfully synced items from the queue', async () => {
      localStorage.setItem(
        'fdgolf_sync_queue',
        JSON.stringify([
          { id: 'a', table: 'shots', payload: { player_id: 'p1' }, created_at: 1, retries: 0 },
        ])
      );
      mockInsert = jest.fn().mockReturnValue({ error: null });

      await engine.flush();

      expect(engine.getQueue()).toHaveLength(0);
    });

    it('keeps failed items in the queue', async () => {
      localStorage.setItem(
        'fdgolf_sync_queue',
        JSON.stringify([
          { id: 'a', table: 'shots', payload: { player_id: 'p1' }, created_at: 1, retries: 0 },
        ])
      );
      mockInsert = jest.fn().mockReturnValue({ error: { message: 'network error' } });

      await engine.flush();

      expect(engine.getQueue()).toHaveLength(1);
    });

    it('increments retryCount (retries field) when an insert fails', async () => {
      localStorage.setItem(
        'fdgolf_sync_queue',
        JSON.stringify([
          { id: 'a', table: 'shots', payload: { player_id: 'p1' }, created_at: 1, retries: 0 },
        ])
      );
      mockInsert = jest.fn().mockReturnValue({ error: { message: 'timeout' } });

      await engine.flush();

      expect(engine.getQueue()[0].retries).toBe(1);
    });

    it('drops items whose retries reach 5 (max retries exceeded)', async () => {
      // retries = 4 → after failure becomes 5, but < 5 check fails → dropped
      localStorage.setItem(
        'fdgolf_sync_queue',
        JSON.stringify([
          { id: 'a', table: 'shots', payload: { player_id: 'p1' }, created_at: 1, retries: 4 },
        ])
      );
      mockInsert = jest.fn().mockReturnValue({ error: { message: 'server error' } });

      await engine.flush();

      // retries was 4, incremented to 5; 5 < 5 is false → entry dropped
      expect(engine.getQueue()).toHaveLength(0);
    });

    it('retains items that fail until they exceed the max retry limit', async () => {
      localStorage.setItem(
        'fdgolf_sync_queue',
        JSON.stringify([
          { id: 'keep', table: 'shots', payload: { player_id: 'p1' }, created_at: 1, retries: 3 },
          { id: 'drop', table: 'shots', payload: { player_id: 'p2' }, created_at: 2, retries: 4 },
        ])
      );
      mockInsert = jest.fn().mockReturnValue({ error: { message: 'server error' } });

      await engine.flush();

      const queue = engine.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('keep');
      expect(queue[0].retries).toBe(4);
    });

    it('does not process when already flushing (idempotent guard)', async () => {
      localStorage.setItem(
        'fdgolf_sync_queue',
        JSON.stringify([
          { id: 'a', table: 'shots', payload: { player_id: 'p1' }, created_at: 1, retries: 0 },
        ])
      );
      mockInsert = jest.fn().mockReturnValue({ error: null });

      // Fire two concurrent flushes; the second should be a no-op
      const p1 = engine.flush();
      const p2 = engine.flush();
      await Promise.all([p1, p2]);

      expect(mockInsert).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('pendingCount (getStatus)', () => {
    it('returns 0 when the queue is empty', () => {
      expect(engine.pendingCount).toBe(0);
    });

    it('reflects the number of pending items correctly', () => {
      localStorage.setItem(
        'fdgolf_sync_queue',
        JSON.stringify([
          { id: 'a', table: 'shots', payload: {}, created_at: 1, retries: 0 },
          { id: 'b', table: 'shots', payload: {}, created_at: 2, retries: 2 },
        ])
      );
      expect(engine.pendingCount).toBe(2);
    });

    it('decreases after a successful flush', async () => {
      localStorage.setItem(
        'fdgolf_sync_queue',
        JSON.stringify([
          { id: 'a', table: 'shots', payload: { player_id: 'p1' }, created_at: 1, retries: 0 },
        ])
      );
      mockInsert = jest.fn().mockReturnValue({ error: null });

      expect(engine.pendingCount).toBe(1);
      await engine.flush();
      expect(engine.pendingCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('getQueue', () => {
    it('returns an empty array when localStorage has no queue', () => {
      expect(engine.getQueue()).toEqual([]);
    });

    it('parses the persisted queue from localStorage', () => {
      const entry = { id: 'x', table: 'scores', payload: { hole: 1 }, created_at: 999, retries: 0 };
      localStorage.setItem('fdgolf_sync_queue', JSON.stringify([entry]));
      const queue = engine.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].table).toBe('scores');
    });
  });

  // -------------------------------------------------------------------------
  describe('subscribe', () => {
    it('calls the listener when the queue changes', () => {
      const listener = jest.fn();
      engine.subscribe(listener);
      engine.enqueue('shots', { player_id: 'p1' });
      expect(listener).toHaveBeenCalled();
    });

    it('unsubscribes when the returned function is called', () => {
      const listener = jest.fn();
      const unsubscribe = engine.subscribe(listener);
      unsubscribe();
      engine.enqueue('shots', { player_id: 'p1' });
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
