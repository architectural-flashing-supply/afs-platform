'use client';

import { useEffect, useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  Circle,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { createClient } from '@/lib/supabase/client';

const AFS_SHOP_POSITION = { lat: 30.737075730063307, lng: -98.23321342395246 };
const AFS_SHOP_LABEL = 'AFS Architectural Flashing Supply — Burnet, TX';

// Fallback view (no active delivery to track) is centered on the broader
// Southwest US service area rather than tight on the shop — Houston,
// Dallas, San Antonio, Albuquerque, and Oklahoma City should all read
// inside the circle alongside Burnet.
const SERVICE_AREA_CENTER = { lat: 31.5, lng: -97.0 };
const SERVICE_AREA_ZOOM = 5;
const SERVICE_AREA_RADIUS_METERS = 1200000; // ~750 miles — TX/LA/OK/AR/NM + parts of CO/KS

// Advanced Markers require a Map ID to render at all. No custom-styled Map
// ID has been created for this project in Google Cloud Console yet, so this
// is Google's own public demo Map ID (documented by Google specifically for
// testing Advanced Markers without one) — swap for a real Map ID once one
// exists, no other code here needs to change.
const MAP_ID = 'DEMO_MAP_ID';

export interface DeliveryAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface DriverLocation {
  lat: number;
  lng: number;
  recordedAt: string | null;
}

interface DeliveryTrackingMapProps {
  orderId?: string;
  deliveryAddress?: DeliveryAddress | null;
  initialDriverLocation?: DriverLocation | null;
  isOutForDelivery: boolean;
}

function formatAddress(address: DeliveryAddress | null): string {
  if (!address) return '';
  const cityState = [address.city, address.state].filter(Boolean).join(', ');
  return [address.line1, address.line2, cityState, address.zip].filter(Boolean).join(', ');
}

function useLiveDriverLocation(orderId: string, initial: DriverLocation | null): DriverLocation | null {
  const [location, setLocation] = useState<DriverLocation | null>(initial);

  useEffect(() => {
    setLocation(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`driver-location-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'driver_locations', filter: `order_id=eq.${orderId}` },
        (payload) => {
          const row = payload.new as { lat: string | number; lng: string | number; recorded_at: string };
          setLocation({ lat: Number(row.lat), lng: Number(row.lng), recordedAt: row.recorded_at });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return location;
}

function useGeocodedPosition(address: string): google.maps.LatLngLiteral | null {
  const geocodingLibrary = useMapsLibrary('geocoding');
  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(null);

  useEffect(() => {
    if (!geocodingLibrary || !address) return;

    let cancelled = false;
    const geocoder = new geocodingLibrary.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (cancelled) return;
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        setPosition({ lat: loc.lat(), lng: loc.lng() });
      } else {
        console.warn('[DeliveryTrackingMap] Could not geocode jobsite address', address, status);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [geocodingLibrary, address]);

  return position;
}

function FitBoundsToMarkers({ points }: { points: google.maps.LatLngLiteral[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(13);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 80);
  }, [map, points]);

  return null;
}

function PulsingDot({ className }: { className: string }) {
  return <div className={`w-4 h-4 rounded-full border-2 border-white shadow-lg ${className}`} />;
}

// Static AFS shop dot — always visible regardless of delivery status, in
// both the fallback service-area view and the live tracking view.
function ShopMarker() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker position={AFS_SHOP_POSITION} title={AFS_SHOP_LABEL} onClick={() => setOpen((v) => !v)}>
        <PulsingDot className="track-dot-red" />
      </AdvancedMarker>
      {open && (
        <InfoWindow position={AFS_SHOP_POSITION} onCloseClick={() => setOpen(false)}>
          <span className="font-body text-xs text-afs-ink-900">{AFS_SHOP_LABEL}</span>
        </InfoWindow>
      )}
    </>
  );
}

// Overlaid at the bottom of the fallback service-area map — hidden entirely
// once a live, out-for-delivery driver location exists to show instead.
// Kept to a strict max-height so it reads as a thin bar, not a curtain over
// the map — full-opacity light background so the crimson contact links
// stay legible (the prior dark/translucent version washed them out).
function ServiceAreaInfoPanel() {
  return (
    <div className="absolute bottom-0 inset-x-0 w-full max-h-[60px] bg-white py-2 px-4 overflow-hidden flex items-center flex-wrap gap-x-3 gap-y-0.5">
      <span className="font-heading text-sm font-semibold text-gray-900 shrink-0">AFS Delivery Tracking</span>
      <span className="font-body text-xs text-gray-700">
        Headquartered in Burnet, TX — Delivering Across North America — Check back when your delivery is scheduled to see real-time tracking.
      </span>
      <span className="ml-auto flex items-center gap-2 shrink-0">
        <a href="tel:+15123724900" className="font-body text-xs text-afs-crimson hover:underline">
          (512) 372-4900
        </a>
        <span className="text-gray-400 text-xs">|</span>
        <a
          href="mailto:trica@architecturalflashingsupply.com"
          className="font-body text-xs text-afs-crimson hover:underline"
        >
          trica@architecturalflashingsupply.com
        </a>
      </span>
    </div>
  );
}

// Fallback state: no token, invalid token, or the order hasn't been
// dispatched yet. Fixed on the Central/South Texas service area rather than
// fit-bounding to an actual delivery, since there isn't one to show.
function FallbackServiceAreaMap() {
  return (
    <div className="relative w-full h-full">
      <Map
        mapId={MAP_ID}
        defaultCenter={SERVICE_AREA_CENTER}
        defaultZoom={SERVICE_AREA_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: '100%', height: '100%' }}
      >
        <ShopMarker />
        <Circle
          center={AFS_SHOP_POSITION}
          radius={SERVICE_AREA_RADIUS_METERS}
          fillColor="#C0001A"
          fillOpacity={0.06}
          strokeColor="#C0001A"
          strokeOpacity={0.25}
        />
      </Map>
      <div className="absolute bottom-16 right-8 pointer-events-none">
        <span
          className="font-heading text-2xl font-bold text-gray-900 opacity-20 tracking-widest text-right block"
          style={{ textShadow: '0 1px 3px rgba(255,255,255,0.8)' }}
        >
          Texas Made. Nationally Delivered.
        </span>
      </div>
      <ServiceAreaInfoPanel />
    </div>
  );
}

function LiveMapContents({
  destinationAddress,
  driverLocation,
}: {
  destinationAddress: string;
  driverLocation: DriverLocation | null;
}) {
  const [openInfo, setOpenInfo] = useState<'destination' | 'driver' | null>(null);
  const destinationPosition = useGeocodedPosition(destinationAddress);

  const boundsPoints: google.maps.LatLngLiteral[] = [AFS_SHOP_POSITION];
  if (destinationPosition) boundsPoints.push(destinationPosition);
  if (driverLocation) boundsPoints.push({ lat: driverLocation.lat, lng: driverLocation.lng });

  return (
    <>
      <style>{`@keyframes truckPulse { 0% { transform: scale(1); opacity: 0.35; } 70% { transform: scale(2.8); opacity: 0; } 100% { transform: scale(1); opacity: 0; } }`}</style>

      <FitBoundsToMarkers points={boundsPoints} />

      <ShopMarker />

      {/* Destination — standard pin, only once the jobsite address geocodes */}
      {destinationPosition && (
        <>
          <AdvancedMarker
            position={destinationPosition}
            title="Your Jobsite"
            onClick={() => setOpenInfo(openInfo === 'destination' ? null : 'destination')}
          >
            <Pin background="#C0001A" borderColor="#7A0010" glyphColor="#FFFFFF" />
          </AdvancedMarker>
          {openInfo === 'destination' && (
            <InfoWindow position={destinationPosition} onCloseClick={() => setOpenInfo(null)}>
              <span className="font-body text-xs text-afs-ink-900">Your Jobsite</span>
            </InfoWindow>
          )}
        </>
      )}

      {/* Live driver dot — only rendered once a location has arrived */}
      {driverLocation && (
        <>
          <AdvancedMarker
            position={{ lat: driverLocation.lat, lng: driverLocation.lng }}
            title="Your Delivery"
            onClick={() => setOpenInfo(openInfo === 'driver' ? null : 'driver')}
          >
            <div style={{ position: 'relative', width: '44px', height: '44px', cursor: 'pointer' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  backgroundColor: '#C0001A',
                  opacity: 0.35,
                  animation: 'truckPulse 1.5s ease-out infinite',
                }}
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="44"
                height="44"
                viewBox="0 0 24 24"
                style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
              >
                {/* Truck body — black */}
                <path
                  d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"
                  fill="#1C1F26"
                />
                {/* Cab accent stripe — AFS crimson */}
                <path d="M17 8h2.5l1.96 2.5H17V8z" fill="#C0001A" />
                {/* Wheels */}
                <circle cx="6" cy="17" r="1.5" fill="#C0001A" />
                <circle cx="18" cy="17" r="1.5" fill="#C0001A" />
              </svg>
            </div>
          </AdvancedMarker>
          {openInfo === 'driver' && (
            <InfoWindow
              position={{ lat: driverLocation.lat, lng: driverLocation.lng }}
              onCloseClick={() => setOpenInfo(null)}
            >
              <div style={{ minWidth: '180px', padding: '4px' }}>
                <div style={{ fontFamily: 'sans-serif' }}>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#C0001A' }}>AFS</span>
                  <div style={{ fontSize: '9px', letterSpacing: '2px', color: '#6B7280', marginTop: '-2px' }}>
                    ARCHITECTURAL FLASHING SUPPLY
                  </div>
                  <hr style={{ margin: '6px 0', borderColor: '#E5E7EB' }} />
                  <div style={{ fontSize: '13px', color: '#111827' }}>🚚 Your delivery is on the way</div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                    Tap the truck to track progress
                  </div>
                </div>
              </div>
            </InfoWindow>
          )}
        </>
      )}
    </>
  );
}

// Live state: a valid token with an active (out_for_delivery) order. No info
// panel — the live blue driver dot and destination marker take its place.
function LiveTrackingMap({
  orderId,
  deliveryAddress,
  initialDriverLocation,
}: {
  orderId: string;
  deliveryAddress: DeliveryAddress | null;
  initialDriverLocation: DriverLocation | null;
}) {
  const driverLocation = useLiveDriverLocation(orderId, initialDriverLocation);

  return (
    <Map
      mapId={MAP_ID}
      defaultCenter={AFS_SHOP_POSITION}
      defaultZoom={12}
      gestureHandling="greedy"
      disableDefaultUI={false}
      style={{ width: '100%', height: '100%' }}
    >
      <LiveMapContents destinationAddress={formatAddress(deliveryAddress)} driverLocation={driverLocation} />
    </Map>
  );
}

export default function DeliveryTrackingMap({
  orderId,
  deliveryAddress,
  initialDriverLocation,
  isOutForDelivery,
}: DeliveryTrackingMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  // TODO: Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local

  if (!apiKey) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-afs-bg-base">
        <p className="font-body text-afs-chrome-mid text-sm">
          Map unavailable — Google Maps is not configured.
        </p>
      </div>
    );
  }

  const showLiveView = isOutForDelivery && Boolean(orderId);

  return (
    <div className="absolute inset-0">
      <APIProvider apiKey={apiKey}>
        {showLiveView ? (
          <LiveTrackingMap
            orderId={orderId as string}
            deliveryAddress={deliveryAddress ?? null}
            initialDriverLocation={initialDriverLocation ?? null}
          />
        ) : (
          <FallbackServiceAreaMap />
        )}
      </APIProvider>
    </div>
  );
}

