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

const AFS_SHOP_POSITION = { lat: 30.7584, lng: -98.2328 };
const AFS_SHOP_LABEL = 'AFS Architectural Flashing Supply — Burnet, TX';

// Fallback view (no active delivery to track) is centered on the broader
// Central/South Texas service area rather than tight on the shop, so Austin,
// San Antonio, and the Hill Country read alongside Burnet.
const SERVICE_AREA_CENTER = { lat: 30.2, lng: -98.5 };
const SERVICE_AREA_ZOOM = 7;
const SERVICE_AREA_RADIUS_METERS = 241402; // 150 miles

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
function ServiceAreaInfoPanel() {
  return (
    <div className="absolute bottom-0 inset-x-0 w-full bg-afs-bg-raised/90 backdrop-blur-sm rounded-t-2xl p-6">
      <h2 className="font-heading text-xl text-afs-chrome-high">AFS Delivery Tracking</h2>
      <p className="font-body text-sm text-afs-chrome-mid mt-1">Serving Central &amp; South Texas from Burnet, TX</p>
      <div className="border-t border-afs-border my-4" />
      <p className="font-body text-sm text-afs-chrome-high">
        Check back here when your delivery is scheduled — you&rsquo;ll see your driver&rsquo;s real-time location on
        this map.
      </p>
      <div className="mt-3 flex flex-col gap-1">
        <a href="tel:+15123724900" className="font-body text-sm text-afs-crimson hover:underline">
          (512) 372-4900
        </a>
        <a
          href="mailto:trica@architecturalflashingsupply.com"
          className="font-body text-sm text-afs-crimson hover:underline"
        >
          trica@architecturalflashingsupply.com
        </a>
      </div>
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
            <PulsingDot className="track-dot-blue" />
          </AdvancedMarker>
          {openInfo === 'driver' && (
            <InfoWindow
              position={{ lat: driverLocation.lat, lng: driverLocation.lng }}
              onCloseClick={() => setOpenInfo(null)}
            >
              <span className="font-body text-xs text-afs-ink-900">Your Delivery</span>
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
