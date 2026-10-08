// Open-Meteo's free Historical Weather API is explicitly non-commercial-use
// only (open-meteo.com/en/terms: "You may only use the free API services for
// non-commercial purposes" — commercial use is defined to include
// "Integrating our service into commercial products"). AFS is a commercial
// entity and HailView is a customer-facing feature of a commercial product,
// so the free `archive-api.open-meteo.com` endpoint is not a legitimate
// option here. This calls the commercial `customer-archive-api` endpoint,
// which requires a paid-plan `apikey`. Until OPEN_METEO_API_KEY is
// configured (i.e. until a commercial Open-Meteo plan is actually
// purchased), wind context is gracefully omitted rather than silently
// falling back to the free non-commercial endpoint. See STATE_OF_THE_BUILD.md
// for the open action item to purchase a plan.
const OPEN_METEO_COMMERCIAL_ARCHIVE_URL = 'https://customer-archive-api.open-meteo.com/v1/archive';

const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const;

function degreesToCompass(deg: number): string {
  const idx = Math.round(deg / 22.5) % 16;
  return COMPASS_POINTS[idx];
}

export interface WindContext {
  maxGustMph: number;
  directionAtMaxGust: string;
  sampledDate: string; // the date this wind context was sampled for (YYYY-MM-DD)
}

export interface WindContextResult {
  context: WindContext | null;
  /** Set only when wind context could not be fetched — shown to the user, never thrown. */
  unavailableReason: string | null;
}

interface OpenMeteoArchiveResponse {
  hourly?: {
    time: string[];
    wind_gusts_10m: (number | null)[];
    wind_direction_10m: (number | null)[];
  };
}

/**
 * Fetches wind gust speed + direction for a single date (the date of the
 * largest hail event found, i.e. the storm day most relevant to the
 * material-damage narrative) from Open-Meteo's commercial Historical
 * Weather API. This is context for the agent-generated explanation only —
 * it never feeds the deterministic score in lib/hailview/v2/engine.ts.
 */
export async function fetchWindContextForDate(
  lat: number,
  lon: number,
  isoDate: string
): Promise<WindContextResult> {
  const apiKey = process.env.OPEN_METEO_API_KEY;
  if (!apiKey) {
    return {
      context: null,
      unavailableReason:
        'Wind speed/direction requires a commercial Open-Meteo subscription — OPEN_METEO_API_KEY is not configured.',
    };
  }

  const date = isoDate.slice(0, 10);
  const params = new URLSearchParams({
    latitude: lat.toFixed(6),
    longitude: lon.toFixed(6),
    start_date: date,
    end_date: date,
    hourly: 'wind_gusts_10m,wind_direction_10m',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    apikey: apiKey,
  });

  try {
    const res = await fetch(`${OPEN_METEO_COMMERCIAL_ARCHIVE_URL}?${params.toString()}`);
    if (!res.ok) {
      return { context: null, unavailableReason: `Open-Meteo responded with HTTP ${res.status}.` };
    }

    const data = (await res.json()) as OpenMeteoArchiveResponse;
    const hourly = data.hourly;
    if (!hourly || hourly.time.length === 0) {
      return { context: null, unavailableReason: 'No wind data returned for this date.' };
    }

    let maxGust = -1;
    let maxIdx = -1;
    hourly.wind_gusts_10m.forEach((gust, i) => {
      if (gust !== null && gust > maxGust) {
        maxGust = gust;
        maxIdx = i;
      }
    });

    if (maxIdx === -1) {
      return { context: null, unavailableReason: 'No wind gust data returned for this date.' };
    }

    const direction = hourly.wind_direction_10m[maxIdx];

    return {
      context: {
        maxGustMph: Math.round(maxGust),
        directionAtMaxGust: direction !== null ? degreesToCompass(direction) : 'unknown',
        sampledDate: date,
      },
      unavailableReason: null,
    };
  } catch (error) {
    console.error('[HailView Wind Error]', error);
    return { context: null, unavailableReason: 'Could not reach Open-Meteo.' };
  }
}
