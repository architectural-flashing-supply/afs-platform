'use client';

// hp-013 — the actual Leaflet/OpenStreetMap rendering for NationwideMap.tsx,
// split into its own module for the same reason components/hailview/
// HailViewMap.tsx is split from app/hailview/page.tsx: react-leaflet/leaflet
// touch `window`/`document` at import time and break Next's SSR pass unless
// this module is only ever reached through next/dynamic({ ssr: false }) —
// see NationwideMap.tsx, which is the only place this file is imported from.
// Tile layer, divIcon pattern (Leaflet's default marker image 404s under
// Next's bundler), and the overall MapContainer setup are copied from that
// same already-verified HailViewMap.tsx, not a new map dependency.

import { MapContainer, TileLayer, Marker, Popup, Circle, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HQ_LOCATION, NATIONWIDE_RADIUS_METERS } from './nationwide-locations';

// Continental US bounding box (approx. contiguous 48 states — mainland only,
// not AK/HI): SW corner near San Diego/the Mexico border, NE corner near
// the Maine/New Brunswick border. Used with fitBounds() rather than a fixed
// center/zoom so the full CONUS frame holds regardless of the map
// container's exact aspect ratio at 420px/320px heights.
const CONTINENTAL_US_BOUNDS: [[number, number], [number, number]] = [
  [24.5, -124.8],
  [49.4, -66.9],
];

const HQ_MARKER_ICON = L.divIcon({
  className: '',
  html: `
    <span class="relative flex items-center justify-center" style="width:22px;height:22px;" data-testid="nationwide-map-hq-marker">
      <span class="absolute inline-block rounded-full bg-afs-crimson" style="width:22px;height:22px;opacity:0.35;"></span>
      <span class="relative inline-block rounded-full bg-afs-crimson border-2 border-white" style="width:12px;height:12px;box-shadow:0 0 6px rgba(0,0,0,0.5);"></span>
    </span>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function FitToContinentalUS() {
  const map = useMap();
  map.fitBounds(CONTINENTAL_US_BOUNDS, { padding: [16, 16] });
  return null;
}

export default function NationwideMapLeaflet() {
  return (
    // react-leaflet's MapContainer doesn't spread unrecognized props (like
    // data-testid) onto its underlying DOM node, so the test hook lives on a
    // wrapping div instead -- same pattern already established by
    // components/hailview/HailViewMap.tsx's own "hailview-map" testid.
    <div className="h-full w-full" data-testid="nationwide-map">
      <MapContainer
        center={[HQ_LOCATION.lat, HQ_LOCATION.lon]}
        zoom={4}
        scrollWheelZoom={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToContinentalUS />

        <Circle
          center={[HQ_LOCATION.lat, HQ_LOCATION.lon]}
          radius={NATIONWIDE_RADIUS_METERS}
          pathOptions={{ color: '#C0001A', fillColor: '#C0001A', fillOpacity: 0.05, opacity: 0.25 }}
        >
          <Tooltip direction="top" permanent>
            Nationwide delivery
          </Tooltip>
        </Circle>

        <Marker position={[HQ_LOCATION.lat, HQ_LOCATION.lon]} icon={HQ_MARKER_ICON}>
          <Popup>{HQ_LOCATION.name}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
