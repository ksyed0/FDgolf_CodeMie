'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { syncEngine } from '@/lib/sync-engine';

export function useSyncEngine() {
  useEffect(() => {
    const cleanup = syncEngine.startAutoSync();
    return cleanup;
  }, []);

  const pendingCount = useSyncExternalStore(
    (cb) => syncEngine.subscribe(cb),
    () => syncEngine.pendingCount,
    () => 0
  );

  const isOnline = useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
      };
    },
    () => navigator.onLine,
    () => true
  );

  return { pendingCount, isOnline, flush: () => syncEngine.flush() };
}
