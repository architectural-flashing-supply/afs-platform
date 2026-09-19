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

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, Tooltip, useMap } from 'react-leaflet';
import type { LeafletEvent } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HQ_LOCATION } from './nationwide-locations';

// Contiguous-US delivery-area outline (2026-09-19 revision pass #2, item 6)
// -- replaces the old decorative radius Circle, which drew a perfect circle
// centered on Burnet that bore no relation to the actual US coastline or the
// Canadian/Mexican borders. public/data/us-contiguous.geojson is a single
// MultiPolygon Feature generated once from the free `us-atlas` npm package
// (ISC license, US Census TIGER/Line-derived, states-10m.json) merged with
// topojson-client's merge() over every state EXCEPT Alaska, Hawaii, and the
// territories (Puerto Rico, Guam, American Samoa, N. Mariana Islands, USVI)
// -- so the outline is exactly the lower 48 + DC, stopping at the real
// international borders, coast to coast. Coordinates rounded to 3 decimals
// (~110m precision, invisible at this render size) to keep the committed
// file at ~70KB, under the 100KB budget. us-atlas/topojson-client/
// topojson-simplify were only ever dev-time tools to produce this one static
// file -- they are not runtime dependencies and are not in package.json.
// Fetched from /public/data at runtime (not bundled via a TS import) since
// it's a static asset, not app code.
interface UsContiguousGeoJSON {
  type: 'Feature';
  properties: { name: string };
  geometry: {
    type: 'MultiPolygon';
    coordinates: number[][][][];
  };
}

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

// A divIcon marker gets Leaflet's own role="button"/tabindex="0" for
// keyboard interactivity but no accessible name (unlike an L.Icon image
// marker, a div has no `alt`) -- axe/Lighthouse's aria-command-name audit
// flags this. eventHandlers.add is the reliable hook for this (unlike a
// ref + mount effect on the parent, which fires before MapContainer has
// finished creating the map instance and actually attached the marker's
// DOM element -- too early for getElement() to return anything).
function setMarkerAriaLabel(e: LeafletEvent) {
  e.target.getElement()?.setAttribute('aria-label', HQ_LOCATION.name);
}

// Fits the view to the polygon's own real bounds (computed from the actual
// geometry via Leaflet, not a hand-typed approximate bounding box) so the
// frame always matches whatever outline is actually drawn.
function FitToPolygonBounds({ geojson }: { geojson: UsContiguousGeoJSON }) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.geoJSON(geojson as unknown as GeoJSON.GeoJsonObject).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [16, 16] });
    }
  }, [geojson, map]);

  return null;
}

export default function NationwideMapLeaflet() {
  const [usPolygon, setUsPolygon] = useState<UsContiguousGeoJSON | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/us-contiguous.geojson')
      .then((res) => res.json())
      .then((data: UsContiguousGeoJSON) => {
        if (!cancelled) setUsPolygon(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

        {usPolygon && (
          <>
            <FitToPolygonBounds geojson={usPolygon} />
            {/* Leaflet's pathOptions prop takes a plain style object read by
                its own SVG renderer, not JSX/CSS -- it can't consume
                Tailwind classes or CSS custom properties, same documented
                exception as the CANVAS_COLORS/WebGL material patterns in
                DESIGN_TOKENS.md §10. Literal value mirrors afs-crimson
                (#C0001A); same fill/opacity as the old circle, thin stroke. */}
            <GeoJSON
              data={usPolygon as unknown as GeoJSON.GeoJsonObject}
              pathOptions={{ color: '#C0001A', weight: 1.5, fillColor: '#C0001A', fillOpacity: 0.05, opacity: 0.25 }}
            >
              <Tooltip direction="top" permanent>
                Nationwide delivery
              </Tooltip>
            </GeoJSON>
          </>
        )}

        <Marker
          position={[HQ_LOCATION.lat, HQ_LOCATION.lon]}
          icon={HQ_MARKER_ICON}
          eventHandlers={{ add: setMarkerAriaLabel }}
        >
          <Popup>{HQ_LOCATION.name}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
