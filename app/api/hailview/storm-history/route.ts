import { NextRequest, NextResponse } from 'next/server';
import { geocodeAddressForHailView } from '@/lib/hailview/geocode';
import { fetchStormHistory } from '@/lib/hailview/storm-history';
import { fetchWindContextForDate } from '@/lib/hailview/wind';
import { computeReplacementScore } from '@/lib/hailview/replacement-score';
import { generateHailViewExplanation } from '@/lib/hailview/explanation';
import type { MaterialCategory, MembraneMilThickness, MetalGauge, ReplacementTier, ShingleType, StormEvent } from '@/lib/hailview/types';
import type { MaterialScoreFactors } from '@/lib/hailview/replacement-score';
import type { WindContext } from '@/lib/hailview/wind';

const MATERIAL_CATEGORIES: MaterialCategory[] = [
  'asphalt_shingle',
  'metal_r_panel',
  'metal_standing_seam',
  'tpo_pvc_membrane',
  'wood_shake',
];

const R_PANEL_GAUGES: MetalGauge[] = ['29ga', '26ga', '24ga'];
const STANDING_SEAM_GAUGES: MetalGauge[] = ['26ga', '24ga', '22ga'];
const MEMBRANE_THICKNESSES: MembraneMilThickness[] = [45, 60, 80];
const SHINGLE_TYPES: ShingleType[] = ['3-tab', 'architectural'];

interface HailViewLookupRequestBody {
  address: string;
  material: MaterialCategory;
  roofAgeYears?: number;
  shingleType?: ShingleType;
  metalGauge?: MetalGauge;
  membraneMilThickness?: MembraneMilThickness;
}

export interface HailViewLookupResponse {
  address: string;
  lat: number;
  lon: number;
  material: MaterialCategory;
  shingleType?: ShingleType;
  metalGauge?: MetalGauge;
  membraneMilThickness?: MembraneMilThickness;
  roofAgeYears?: number;
  score: number;
  tier: ReplacementTier;
  factors: MaterialScoreFactors;
  hailEvents: StormEvent[];
  nonHailEventCount: number;
  wind: WindContext | null;
  windUnavailableReason: string | null;
  narrative: string;
}

function isValidBody(body: unknown): body is HailViewLookupRequestBody {
  if (!body || typeof body !== 'object') return false;
  const v = body as Record<string, unknown>;
  if (typeof v.address !== 'string' || v.address.trim().length === 0) return false;
  if (typeof v.material !== 'string' || !MATERIAL_CATEGORIES.includes(v.material as MaterialCategory)) return false;
  if (v.roofAgeYears !== undefined && typeof v.roofAgeYears !== 'number') return false;
  if (v.shingleType !== undefined && typeof v.shingleType !== 'string') return false;
  if (v.metalGauge !== undefined && typeof v.metalGauge !== 'string') return false;
  if (v.membraneMilThickness !== undefined && typeof v.membraneMilThickness !== 'number') return false;
  return true;
}

function validateMaterialOptions(body: HailViewLookupRequestBody): string | null {
  if (body.material === 'asphalt_shingle' && body.shingleType && !SHINGLE_TYPES.includes(body.shingleType)) {
    return `Invalid shingle type. Expected one of: ${SHINGLE_TYPES.join(', ')}.`;
  }
  if (body.material === 'metal_r_panel' && body.metalGauge && !R_PANEL_GAUGES.includes(body.metalGauge)) {
    return `Invalid R-panel gauge. Expected one of: ${R_PANEL_GAUGES.join(', ')}.`;
  }
  if (
    body.material === 'metal_standing_seam' &&
    body.metalGauge &&
    !STANDING_SEAM_GAUGES.includes(body.metalGauge)
  ) {
    return `Invalid standing seam gauge. Expected one of: ${STANDING_SEAM_GAUGES.join(', ')}.`;
  }
  if (
    body.material === 'tpo_pvc_membrane' &&
    body.membraneMilThickness &&
    !MEMBRANE_THICKNESSES.includes(body.membraneMilThickness)
  ) {
    return `Invalid membrane thickness. Expected one of: ${MEMBRANE_THICKNESSES.join(', ')}.`;
  }
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => null)) as HailViewLookupRequestBody | null;
    if (!isValidBody(body)) {
      return NextResponse.json({ error: 'A valid address and material are required.' }, { status: 400 });
    }

    const optionsError = validateMaterialOptions(body);
    if (optionsError) {
      return NextResponse.json({ error: optionsError }, { status: 400 });
    }

    const geocoded = await geocodeAddressForHailView(body.address);
    if (!geocoded) {
      return NextResponse.json({ error: 'Could not locate that address. Try a more specific address.' }, { status: 400 });
    }

    let stormEvents: StormEvent[];
    try {
      stormEvents = await fetchStormHistory(geocoded.lat, geocoded.lon);
    } catch (error) {
      console.error('[HailView Storm History Error]', error);
      return NextResponse.json({ error: 'Could not retrieve storm history right now. Try again shortly.' }, { status: 502 });
    }

    const hailEvents = stormEvents.filter((e) => e.isHail);
    const nonHailEventCount = stormEvents.length - hailEvents.length;

    const { score, tier, factors } = computeReplacementScore(
      body.material,
      hailEvents
        .filter((e) => e.sizeIn !== null)
        .map((e) => ({ id: e.id, sizeIn: e.sizeIn as number, validAt: e.validAt })),
      {
        // roofAgeYears feeds every material's formula now (asphalt: age
        // subscore + severity multiplier; metal: additive age subscore;
        // tpo_pvc_membrane: onset threshold shift; wood_shake: severity
        // multiplier) — see lib/hailview/replacement-score.ts Section 5.
        roofAgeYears: body.roofAgeYears,
        shingleType: body.material === 'asphalt_shingle' ? body.shingleType : undefined,
        membraneMilThickness: body.material === 'tpo_pvc_membrane' ? body.membraneMilThickness : undefined,
      }
    );

    let wind: WindContext | null = null;
    let windUnavailableReason: string | null = null;
    const largestHailEvent = [...hailEvents].sort((a, b) => (b.sizeIn ?? 0) - (a.sizeIn ?? 0))[0];
    if (largestHailEvent) {
      const windResult = await fetchWindContextForDate(geocoded.lat, geocoded.lon, largestHailEvent.validAt);
      wind = windResult.context;
      windUnavailableReason = windResult.unavailableReason;
    }

    let narrative: string;
    try {
      narrative = await generateHailViewExplanation({
        address: geocoded.displayName,
        material: body.material,
        roofAgeYears: body.roofAgeYears,
        shingleType: body.material === 'asphalt_shingle' ? body.shingleType : undefined,
        metalGauge: body.material === 'metal_r_panel' || body.material === 'metal_standing_seam' ? body.metalGauge : undefined,
        membraneMilThickness: body.material === 'tpo_pvc_membrane' ? body.membraneMilThickness : undefined,
        score,
        tier,
        factors,
        hailEvents,
        nonHailEventCount,
        wind,
      });
    } catch (error) {
      console.error('[HailView Explanation Error]', error);
      narrative = '';
    }

    const response: HailViewLookupResponse = {
      address: geocoded.displayName,
      lat: geocoded.lat,
      lon: geocoded.lon,
      material: body.material,
      shingleType: body.shingleType,
      metalGauge: body.metalGauge,
      membraneMilThickness: body.membraneMilThickness,
      roofAgeYears: body.roofAgeYears,
      score,
      tier,
      factors,
      hailEvents,
      nonHailEventCount,
      wind,
      windUnavailableReason,
      narrative,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[HailView Lookup Error]', error);
    return NextResponse.json({ error: 'Could not complete the lookup. Please try again.' }, { status: 500 });
  }
}
