'use client';

import { useState, useEffect, useRef } from 'react';
import { getCurrentPosition, type GpsPosition } from '@/lib/gps';

export function useGps() {
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cancelledRef = useRef(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const pos = await getCurrentPosition();
      if (!cancelledRef.current) setPosition(pos);
    } catch (e) {
      if (!cancelledRef.current) setError(e instanceof Error ? e.message : 'GPS error');
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    cancelledRef.current = false;
    // Defer to a microtask so the initial setLoading(true) inside refresh()
    // doesn't run synchronously within the effect callback itself.
    void Promise.resolve().then(refresh);
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { position, error, loading, refresh };
}
