'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const COUNTDOWN_MS = 600_000; // 10 minutes

interface TvRestartOverlayProps {
  tournamentId: string;
}

export function TvRestartOverlay({ tournamentId }: TvRestartOverlayProps) {
  const [remainingMs, setRemainingMs] = useState(COUNTDOWN_MS);
  const [restarting, setRestarting] = useState(false);
  const restartingRef = useRef(false);

  const triggerRestart = useCallback(async () => {
    if (restartingRef.current) return;
    restartingRef.current = true;
    setRestarting(true);
    try {
      await fetch('/api/demo/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId }),
      });
    } catch {
      restartingRef.current = false;
      setRestarting(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          triggerRestart();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [triggerRestart]);

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-10 py-6 z-50"
      style={{ background: 'rgba(26,71,42,0.96)', borderTop: '2px solid #2f8f4e' }}
    >
      <div className="flex items-center gap-3">
        <span style={{ fontSize: 28 }}>🏆</span>
        <div>
          <p className="font-barlow font-extrabold text-white" style={{ fontSize: 22 }}>
            Tournament Complete
          </p>
          <p style={{ fontSize: 13, color: '#9fd6ad' }}>
            Restarting automatically in {minutes}:{seconds}
          </p>
        </div>
      </div>
      <button
        onClick={triggerRestart}
        disabled={restarting}
        className="rounded-xl font-semibold disabled:opacity-60 transition-colors"
        style={{
          background: restarting ? '#2f8f4e' : '#fff',
          color: restarting ? '#fff' : '#1a472a',
          fontSize: 15,
          padding: '10px 28px',
        }}
      >
        {restarting ? 'Restarting…' : 'Restart Demo'}
      </button>
    </div>
  );
}
