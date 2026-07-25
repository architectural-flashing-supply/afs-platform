export interface GeocodeResult {
  lat: number;
  lng: number;
}

interface GoogleGeocodeResponse {
  status: string;
  results: Array<{
    geometry: { location: { lat: number; lng: number } };
  }>;
}

/**
 * Server-side Google Maps Geocoding API call — GOOGLE_MAPS_API_KEY only,
 * never the NEXT_PUBLIC_ client key. Returns null on any failure (missing
 * key, empty address, non-OK API status, network error) rather than
 * throwing, since callers use this as a best-effort cache-fill step that
 * must never break the request it's called from.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const trimmed = address.trim();
  if (!apiKey || !trimmed) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as GoogleGeocodeResponse;
    const location = data.status === 'OK' ? data.results?.[0]?.geometry?.location : null;
    if (!location) return null;

    return { lat: location.lat, lng: location.lng };
  } catch (error) {
    console.error('[Geocode Error]', error);
    return null;
  }
}
