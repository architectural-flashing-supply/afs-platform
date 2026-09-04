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
//
// afs-hv-007 — this is now mounted once, persistently, as the page's
// full-bleed background (app/hailview/page.tsx), rather than only after a
// lookup completes. address/lat/lon/hailEvents are therefore optional: with
// none supplied it renders the default service-area view below with no
// markers; once a real lookup resolves, page.tsx passes the real values in
// and FitToMarkers (already-verified afs-hv-006 logic, unchanged) re-fits
// the same live map instance to them. The marker icons, pulse animation, and
// popups below are untouched from afs-hv-006.

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { StormEvent } from '@/lib/hailview/types';

interface HailViewMapProps {
  address?: string;
  lat?: number;
  lon?: number;
  hailEvents?: StormEvent[];
}

// Default view before any address has been looked up. HailView's real
// service area is physical roofing-bid prospecting out of the Burnet, TX
// shop — Central Texas only (Austin/Waco/Killeen/northern San Antonio),
// not the nationwide flashing-shipping footprint described in
// lib/chatbot/knowledge/afs-company.ts's company-service-area entry. This
// is deliberately NOT DeliveryTrackingMap's SERVICE_AREA_CENTER — that
// component's [31.5, -97.0]/zoom 5 is a rounded, whole-US framing
// calibrated for nationwide delivery tracking, a different purpose than
// this tool's much narrower dispatch radius (afs-hv-008). The coordinate
// below is the real shop location, matching afs-company.ts's shop
// coordinates exactly.
const DEFAULT_CENTER: [number, number] = [30.737075730063307, -98.23321342395246];
const DEFAULT_ZOOM = 8;

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
      // afs-hv-008 — loosened from 13 to leave visible room around the pin
      // for future nearby-area hail-triangulation markers (not built yet).
      map.setView(points[0], 11);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48] });
  }, [map, points]);

  return null;
}

export default function HailViewMap({ address, lat, lon, hailEvents }: HailViewMapProps) {
  const hasAddress = lat !== undefined && lon !== undefined;
  const events = hailEvents ?? [];

  const points = useMemo<[number, number][]>(() => {
    if (lat === undefined || lon === undefined) return [];
    const eventPoints = events.map((e): [number, number] => [e.lat, e.lon]);
    return [[lat, lon], ...eventPoints];
  }, [lat, lon, events]);

  return (
    <div className="w-full h-full" data-testid="hailview-map">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToMarkers points={points} />

        {hasAddress && (
          <Marker position={[lat as number, lon as number]} icon={ADDRESS_MARKER_ICON}>
            <Popup>{address}</Popup>
          </Marker>
        )}

        {events.map((event) => (
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
