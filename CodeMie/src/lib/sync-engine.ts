import { createClient } from '@/lib/supabase/client';

const QUEUE_KEY = 'fdgolf_sync_queue';

interface QueueEntry {
  id: string;
  table: string;
  payload: Record<string, unknown>;
  created_at: number;
  retries: number;
}

export class SyncEngine {
  private processing = false;
  private listeners: Set<() => void> = new Set();

  getQueue(): QueueEntry[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  private saveQueue(queue: QueueEntry[]) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    this.notify();
  }

  enqueue(table: string, payload: Record<string, unknown>): string {
    const entry: QueueEntry = {
      id: crypto.randomUUID(),
      table,
      payload,
      created_at: Date.now(),
      retries: 0,
    };
    const queue = this.getQueue();
    queue.push(entry);
    this.saveQueue(queue);
    this.flush();
    return entry.id;
  }

  async flush(): Promise<void> {
    if (this.processing) return;
    if (!navigator.onLine) return;

    this.processing = true;
    const supabase = createClient();
    const queue = this.getQueue();
    const failed: QueueEntry[] = [];

    for (const entry of queue) {
      const { error } = await supabase.from(entry.table).insert(entry.payload);
      if (error) {
        entry.retries++;
        if (entry.retries < 5) {
          failed.push(entry);
        }
      }
    }

    this.saveQueue(failed);
    this.processing = false;
  }

  get pendingCount(): number {
    return this.getQueue().length;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  /* istanbul ignore next -- wraps window/setInterval browser APIs; covered at E2E level */
  startAutoSync() {
    window.addEventListener('online', () => this.flush());
    const interval = setInterval(() => this.flush(), 10000);
    return () => {
      window.removeEventListener('online', () => this.flush());
      clearInterval(interval);
    };
  }
}

export const syncEngine = new SyncEngine();
