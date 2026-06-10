'use client';

import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
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
  in_play: '#2563eb',
  out_of_bounds: '#dc2626',
  mulligan: '#f97316',
  sunk: '#ca8a04',
};

export function HoleMap({ pinLat, pinLng, shots = [] }: HoleMapProps) {
  return (
    <div className="h-48 w-full overflow-hidden rounded-lg border border-gray-200">
      <Map
        // Re-key on hole change so the map re-centers when the player advances
        key={`${pinLat},${pinLng}`}
        initialViewState={{ longitude: pinLng, latitude: pinLat, zoom: 17 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/satellite-v9"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        // Disable pan/zoom to prevent accidental touches during shot entry
        interactive={false}
      >
        {/* Pin marker */}
        <Marker latitude={pinLat} longitude={pinLng} anchor="center">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="8" fill="#16a34a" stroke="#fff" strokeWidth="2" />
          </svg>
        </Marker>

        {/* Shot markers */}
        {shots.map((shot, i) => (
          <Marker key={i} latitude={shot.lat} longitude={shot.lng} anchor="center">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <circle
                cx="7"
                cy="7"
                r="5.5"
                fill={OUTCOME_COLORS[shot.outcome]}
                fillOpacity="0.9"
                stroke="#fff"
                strokeWidth="1.5"
              />
            </svg>
          </Marker>
        ))}
      </Map>
    </div>
  );
}
