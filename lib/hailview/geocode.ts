export interface HailViewGeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Nominatim's usage policy (operations.osmfoundation.org/policies/nominatim)
// requires a descriptive User-Agent identifying the calling application —
// "stock User-Agents as set by http libraries will not do." This is a new
// string for AFS's own HailView tool, not reused from any other project.
const NOMINATIM_USER_AGENT =
  'AFS-HailView/1.0 (+https://architecturalflashingsupply.com; tricia@architecturalflashingsupply.com)';

/**
 * Server-side Nominatim geocode. Returns null on any failure (empty
 * address, no match, network error) rather than throwing, so the caller
 * can turn it into a friendly "could not locate that address" response.
 */
export async function geocodeAddressForHailView(address: string): Promise<HailViewGeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const url = `${NOMINATIM_URL}?format=json&limit=1&addressdetails=0&q=${encodeURIComponent(trimmed)}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    const first = data[0];
    if (!first) return null;

    const lat = parseFloat(first.lat);
    const lon = parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return { lat, lon, displayName: first.display_name };
  } catch (error) {
    console.error('[HailView Geocode Error]', error);
    return null;
  }
}
