'use client';

import { useEffect, useRef } from 'react';
import type { ShotOutcome } from '@/lib/types';

interface ShotMarker {
  lat: number;
  lng: number;
  outcome: ShotOutcome;
}

interface HoleMapProps {
  pinLat: number;
  pinLng: number;
  shots?: ShotMarker[];
}

const OUTCOME_COLORS: Record<ShotOutcome, string> = {
  in_play: '#2563eb', // blue-600
  out_of_bounds: '#dc2626', // red-600
  mulligan: '#f97316', // orange-500
  sunk: '#ca8a04', // yellow-600
};

export function HoleMap({ pinLat, pinLng, shots = [] }: HoleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      // Dynamically import to prevent SSR evaluation of window-dependent module
      const { setOptions, importLibrary } = await import('@googlemaps/js-api-loader');

      setOptions({
        key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
        v: 'weekly',
      });

      const { Map } = await importLibrary('maps');
      // Marker and SymbolPath live in the 'marker' library in newer Maps JS API
      // but legacy Marker + SymbolPath are accessed via google.maps global after maps is loaded
      const mapsLib = await importLibrary('marker');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Marker = (mapsLib as any).Marker ?? google.maps.Marker;
      const SymbolPath = google.maps.SymbolPath;

      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = new Map(containerRef.current, {
          center: { lat: pinLat, lng: pinLng },
          zoom: 17,
          mapTypeId: 'satellite',
          disableDefaultUI: true,
          zoomControl: true,
        });

        // Pin marker (green)
        new Marker({
          position: { lat: pinLat, lng: pinLng },
          map: mapRef.current,
          title: 'Pin',
          icon: {
            path: SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#16a34a',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
        });
      } else {
        mapRef.current.setCenter({ lat: pinLat, lng: pinLng });
      }

      // Clear previous shot markers
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      // Add shot markers
      for (const shot of shots) {
        const marker = new Marker({
          position: { lat: shot.lat, lng: shot.lng },
          map: mapRef.current!,
          icon: {
            path: SymbolPath.CIRCLE,
            scale: 7,
            fillColor: OUTCOME_COLORS[shot.outcome],
            fillOpacity: 0.9,
            strokeColor: '#fff',
            strokeWeight: 1.5,
          },
        });
        markersRef.current.push(marker);
      }
    }

    initMap().catch(console.error);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinLat, pinLng, shots]);

  return (
    <div
      ref={containerRef}
      className="h-48 w-full overflow-hidden rounded-lg border border-gray-200"
    />
  );
}
