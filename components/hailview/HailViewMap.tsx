'use client';

// HailView Phase 6 (afs-hv-006) — interactive Leaflet/OpenStreetMap view of
// the geocoded address plus every real hail event already returned by
// app/api/hailview/storm-history/route.ts (result.lat/result.lon from
// lib/hailview/geocode.ts's HailViewGeocodeResult, result.hailEvents — each
// a real StormEvent from lib/hailview/storm-history.ts with its own
// lat/lon straight from the IEM LSR feed's geometry.coordinates). No new
// data is fetched here — this only plots what app/hailview/page.tsx already
// received and already renders in the Storm History Timeline list.
//
// Loaded exclusively via next/dynamic({ ssr: false }) from page.tsx — Leaflet
// touches `window`/`document` at import time and breaks under Next's SSR
// pass otherwise.

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { StormEvent } from '@/lib/hailview/types';

interface HailViewMapProps {
  address: string;
  lat: number;
  lon: number;
  hailEvents: StormEvent[];
}

// Leaflet's default pin icon resolves its image paths against the app's own
// origin, not the leaflet package, and 404s under Next.js's bundler unless
// patched globally. Both markers below use L.divIcon() (plain HTML/CSS, no
// image asset) instead, which sidesteps that issue entirely rather than
// papering over it with an icon-path workaround.

// Pulsating address marker — an expanding, fading afs-crimson ring behind a
// solid afs-crimson dot. The ring's animation (keyframes + the
// prefers-reduced-motion static fallback) lives in app/globals.css as
// .hailview-address-marker-ring, matching the existing track-dot-pulse /
// truckPulse precedent in that file and in components/track/
// DeliveryTrackingMap.tsx. This divIcon HTML is still scanned by Tailwind's
// (regex-based, not AST-based) content pipeline, so bg-afs-crimson etc.
// resolve normally — no literal hex needed, no CANVAS_COLORS-style exception
// applies here.
const ADDRESS_MARKER_ICON = L.divIcon({
  className: '',
  html: `
    <span class="hailview-address-marker relative flex items-center justify-center" style="width:28px;height:28px;" data-testid="hailview-map-address-marker">
      <span class="hailview-address-marker-ring absolute inline-block rounded-full bg-afs-crimson" style="width:28px;height:28px;"></span>
      <span class="relative inline-block rounded-full bg-afs-crimson border-2 border-white" style="width:14px;height:14px;box-shadow:0 0 6px rgba(0,0,0,0.5);"></span>
    </span>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Storm event markers are deliberately smaller, unanimated, flat circles —
// distinct from the pulsating address marker — colored/sized by the real
// hail diameter (StormEvent.sizeIn, inches) already shown in the Storm
// History Timeline list on the results page.
function stormMarkerVisual(sizeIn: number | null): { px: number; colorClass: string } {
  const size = sizeIn ?? 0;
  if (size >= 1.75) return { px: 20, colorClass: 'bg-afs-crimson-hover' };
  if (size >= 1.0) return { px: 15, colorClass: 'bg-afs-copper' };
  return { px: 10, colorClass: 'bg-afs-amber' };
}

function stormMarkerIcon(sizeIn: number | null): L.DivIcon {
  const { px, colorClass } = stormMarkerVisual(sizeIn);
  return L.divIcon({
    className: '',
    html: `<span class="block rounded-full border border-white ${colorClass}" style="width:${px}px;height:${px}px;box-shadow:0 0 4px rgba(0,0,0,0.5);"></span>`,
    iconSize: [px, px],
    iconAnchor: [px / 2, px / 2],
  });
}

// Bounds-fits the map to the address plus every plotted storm event —
// never a hardcoded zoom, since the event count and spread genuinely
// varies address to address.
function FitToMarkers({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48] });
  }, [map, points]);

  return null;
}

export default function HailViewMap({ address, lat, lon, hailEvents }: HailViewMapProps) {
  const points = useMemo<[number, number][]>(() => {
    const eventPoints = hailEvents.map((e): [number, number] => [e.lat, e.lon]);
    return [[lat, lon], ...eventPoints];
  }, [lat, lon, hailEvents]);

  return (
    <div
      className="w-full h-[420px] rounded overflow-hidden border border-afs-border"
      data-testid="hailview-map"
    >
      <MapContainer
        center={[lat, lon]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToMarkers points={points} />

        <Marker position={[lat, lon]} icon={ADDRESS_MARKER_ICON}>
          <Popup>{address}</Popup>
        </Marker>

        {hailEvents.map((event) => (
          <Marker key={event.id} position={[event.lat, event.lon]} icon={stormMarkerIcon(event.sizeIn)}>
            <Popup>
              {event.validAt.slice(0, 10)} &mdash; {event.sizeIn}&Prime; hail
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
