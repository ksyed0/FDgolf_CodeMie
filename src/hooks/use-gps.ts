'use client';

import { useState, useEffect } from 'react';
import { getCurrentPosition, type GpsPosition } from '@/lib/gps';

export function useGps() {
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const pos = await getCurrentPosition();
      setPosition(pos);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GPS error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { position, error, loading, refresh };
}
