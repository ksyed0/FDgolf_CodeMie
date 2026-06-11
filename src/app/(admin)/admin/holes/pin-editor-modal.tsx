'use client';

import { useState, useCallback } from 'react';
import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import type { Hole } from '@/lib/types';

interface PinEditorModalProps {
  hole: Hole;
  onClose: () => void;
  onSave: (lat: number, lng: number) => void;
}

export function PinEditorModal({ hole, onClose, onSave }: PinEditorModalProps) {
  const [lat, setLat] = useState(hole.pin_lat);
  const [lng, setLng] = useState(hole.pin_lng);

  const handleMapClick = useCallback((e: { lngLat: { lat: number; lng: number } }) => {
    setLat(e.lngLat.lat);
    setLng(e.lngLat.lng);
  }, []);

  const handleDragEnd = useCallback((e: { lngLat: { lat: number; lng: number } }) => {
    setLat(e.lngLat.lat);
    setLng(e.lngLat.lng);
  }, []);

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="flex w-full max-w-lg flex-col gap-4 rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Hole {hole.hole_number} — Set Pin Location
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Map */}
        <div className="h-72 w-full overflow-hidden rounded-lg border border-gray-200">
          <Map
            initialViewState={{ longitude: lng, latitude: lat, zoom: 17 }}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/satellite-v9"
            mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
            cursor="crosshair"
            onClick={handleMapClick}
          >
            <Marker
              latitude={lat}
              longitude={lng}
              anchor="center"
              draggable
              onDragEnd={handleDragEnd}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
                {/* Drop shadow */}
                <circle cx="14" cy="15" r="9" fill="black" fillOpacity="0.25" />
                {/* Pin */}
                <circle cx="14" cy="14" r="9" fill="#16a34a" stroke="#fff" strokeWidth="2.5" />
                <text x="14" y="18" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#fff">
                  {hole.hole_number}
                </text>
              </svg>
            </Marker>
          </Map>
        </div>

        <p className="text-xs text-gray-500">
          Click on the map or drag the marker to position the pin.
        </p>

        {/* Coordinate readout */}
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 px-4 py-3 font-mono text-sm">
          <div>
            <span className="text-xs uppercase tracking-wide text-gray-400">Lat</span>
            <div className="text-gray-800">{lat.toFixed(6)}</div>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-gray-400">Lng</span>
            <div className="text-gray-800">{lng.toFixed(6)}</div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(lat, lng)} className="bg-[#1a472a] hover:bg-[#143820]">
            Save Pin
          </Button>
        </div>
      </div>
    </div>
  );
}
