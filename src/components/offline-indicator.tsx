'use client';

import { useSyncEngine } from '@/hooks/use-sync-engine';

export function OfflineIndicator() {
  const { pendingCount, isOnline } = useSyncEngine();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-md">
      {!isOnline && (
        <>
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Offline
        </>
      )}
      {pendingCount > 0 && (
        <span>
          {pendingCount} shot{pendingCount > 1 ? 's' : ''} pending sync
        </span>
      )}
    </div>
  );
}
