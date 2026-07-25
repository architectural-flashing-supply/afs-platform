'use client';

import { useEffect, useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { createClient } from '@/lib/supabase/client';

const AFS_SHOP_POSITION = { lat: 30.7584, lng: -98.2328 };
const AFS_SHOP_LABEL = 'AFS Architectural Flashing Supply — 209 Shurcast Drive, Burnet TX';

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
  orderId: string;
  deliveryAddress: DeliveryAddress | null;
  initialDriverLocation: DriverLocation | null;
  isOutForDelivery: boolean;
}

function formatAddress(address: DeliveryAddress | null): string {
  if (!address) return '';
  const cityState = [address.city, address.state].filter(Boolean).join(', ');
  return [address.line1, address.line2, cityState, address.zip].filter(Boolean).join(', ');
}

function useLiveDriverLocation(
  orderId: string,
  enabled: boolean,
  initial: DriverLocation | null
): DriverLocation | null {
  const [location, setLocation] = useState<DriverLocation | null>(initial);

  useEffect(() => {
    setLocation(initial);
  }, [initial]);

  useEffect(() => {
    if (!enabled) return;

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
  }, [orderId, enabled]);

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

type OpenInfo = 'shop' | 'destination' | 'driver' | null;

function PulsingDot({ className }: { className: string }) {
  return <div className={`w-4 h-4 rounded-full border-2 border-white shadow-lg ${className}`} />;
}

function MapContents({
  destinationAddress,
  driverLocation,
}: {
  destinationAddress: string;
  driverLocation: DriverLocation | null;
}) {
  const [openInfo, setOpenInfo] = useState<OpenInfo>(null);
  const destinationPosition = useGeocodedPosition(destinationAddress);

  const boundsPoints: google.maps.LatLngLiteral[] = [AFS_SHOP_POSITION];
  if (destinationPosition) boundsPoints.push(destinationPosition);
  if (driverLocation) boundsPoints.push({ lat: driverLocation.lat, lng: driverLocation.lng });

  return (
    <>
      <FitBoundsToMarkers points={boundsPoints} />

      {/* Static AFS shop dot — always visible regardless of delivery status */}
      <AdvancedMarker
        position={AFS_SHOP_POSITION}
        title={AFS_SHOP_LABEL}
        onClick={() => setOpenInfo(openInfo === 'shop' ? null : 'shop')}
      >
        <PulsingDot className="track-dot-red" />
      </AdvancedMarker>
      {openInfo === 'shop' && (
        <InfoWindow position={AFS_SHOP_POSITION} onCloseClick={() => setOpenInfo(null)}>
          <span className="font-body text-xs text-afs-ink-900">{AFS_SHOP_LABEL}</span>
        </InfoWindow>
      )}

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

      {/* Live driver dot — only rendered when out_for_delivery + a location exists */}
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

export default function DeliveryTrackingMap({
  orderId,
  deliveryAddress,
  initialDriverLocation,
  isOutForDelivery,
}: DeliveryTrackingMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  // TODO: Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local
  const driverLocation = useLiveDriverLocation(orderId, isOutForDelivery, initialDriverLocation);

  if (!apiKey) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-afs-bg-base">
        <p className="font-body text-afs-chrome-mid text-sm">
          Map unavailable — Google Maps is not configured.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        mapId={MAP_ID}
        defaultCenter={AFS_SHOP_POSITION}
        defaultZoom={12}
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: '100%', height: '100%' }}
      >
        <MapContents destinationAddress={formatAddress(deliveryAddress)} driverLocation={driverLocation} />
      </Map>
    </APIProvider>
  );
}
