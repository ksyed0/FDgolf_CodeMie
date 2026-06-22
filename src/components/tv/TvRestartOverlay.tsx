'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const COUNTDOWN_MS = 600_000; // 10 minutes

interface TvRestartOverlayProps {
  tournamentId: string;
  visible: boolean;
  remainingLabel?: string;
}

export function TvRestartOverlay({ tournamentId, visible, remainingLabel }: TvRestartOverlayProps) {
  const [remainingMs, setRemainingMs] = useState(COUNTDOWN_MS);
  const [restarting, setRestarting] = useState(false);
  const restartingRef = useRef(false);

  // Reset countdown whenever the overlay becomes visible
  useEffect(() => {
    if (!visible) return;
    setRemainingMs(COUNTDOWN_MS);
    const tick = setInterval(() => {
      setRemainingMs((ms) => Math.max(0, ms - 1_000));
    }, 1_000);
    return () => clearInterval(tick);
  }, [visible]);

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

  if (!visible) return null;

  const totalSecs = Math.ceil(remainingMs / 1_000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const countdownLabel = remainingLabel ?? `${mins}:${String(secs).padStart(2, '0')}`;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'rgba(15, 30, 20, 0.88)' }}
    >
      <div
        className="flex flex-col items-center gap-8 rounded-3xl px-16 py-12"
        style={{ background: '#1a472a', boxShadow: '0 8px 40px rgba(0,0,0,0.5)', maxWidth: 520 }}
      >
        <span
          className="font-barlow font-extrabold text-white text-center leading-tight"
          style={{ fontSize: 36 }}
        >
          Demo Idle
        </span>

        <span className="text-[#9fd6ad] text-center text-lg leading-snug">
          The kiosk demo will auto-restart in
        </span>

        <span
          className="font-barlow font-extrabold text-white tabular-nums"
          style={{ fontSize: 72, lineHeight: 1 }}
        >
          {countdownLabel}
        </span>

        <button
          onClick={() => void triggerRestart()}
          disabled={restarting}
          className="mt-2 rounded-2xl px-10 py-4 font-barlow font-bold text-white transition-opacity disabled:opacity-50"
          style={{ background: '#c0392b', fontSize: 20, letterSpacing: '0.04em' }}
        >
          {restarting ? 'Restarting…' : 'Restart Demo'}
        </button>
      </div>
    </div>
  );
}
