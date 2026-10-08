import { NextRequest, NextResponse } from 'next/server';
import { geocodeAddressForHailView } from '@/lib/hailview/geocode';
import { fetchStormHistory } from '@/lib/hailview/storm-history';
import { fetchWindContextForDate } from '@/lib/hailview/wind';
import { collectHailEvidence } from '@/lib/hailview/v2/evidence';
import { evaluateWithGuard } from '@/lib/hailview/v2/guard';
import { generateHailViewExplanation, type AuditFlag } from '@/lib/hailview/explanation';
import { signHailViewReport } from '@/lib/hailview/report-signature';
import type { MaterialCategory, MembraneMilThickness, MetalGauge, ReplacementTier, ShingleType, StormEvent } from '@/lib/hailview/types';
import type { EngineResult } from '@/lib/hailview/v2/engine';
import type { WindContext } from '@/lib/hailview/wind';

// ─────────────────────────────────────────────────────────────────────────
// HailView V2 (hv2-01). The deterministic scoring engine is now
// lib/hailview/v2/** — see SPEC_HAILVIEW_V2.md. SPEC_HAILVIEW.md §5's
// per-material point tables are SUPERSEDED; §1 and §6's determinism
// contract and §2's exclusions are unchanged and still binding.
//
// The number comes from evaluateWithGuard() — the deterministic engine plus
// a deterministic invariant re-check — strictly BEFORE the agentic layer is
// called. The agent adds narrative and advisory audit flags and can never
// change the number.
// ─────────────────────────────────────────────────────────────────────────

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

/**
 * V2's evidence radius, miles. MUCH WIDER THAN V1'S 1 MILE, and it has to
 * be: V1 asked "did a report land inside a 1-mile box", which needs no
 * neighbours, whereas V2 triangulates the size AT the address, which needs
 * reports on more than one side of it. The swath kernel's bandwidth is 3
 * miles, so 12 miles covers four bandwidths — beyond that a report carries
 * essentially no kernel weight and only lengthens the payload.
 *
 * Measured against the live feed at Burnet, TX on 2026-10-08: 12 reports
 * within 1 mile over 5 years, 102 within 15 miles. The narrow V1 radius was
 * discarding almost all of the evidence that makes triangulation possible.
 */
const V2_EVIDENCE_RADIUS_MI = 12;
const V2_LOOKBACK_YEARS = 5;

interface HailViewLookupRequestBody {
  address: string;
  material: MaterialCategory;
  roofAgeYears?: number;
  shingleType?: ShingleType;
  metalGauge?: MetalGauge;
  membraneMilThickness?: MembraneMilThickness;
  /** Whether the policy excludes cosmetic damage. Defaults per material in the engine. */
  cosmeticExclusion?: boolean;
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

  /** Legacy fields, unchanged in meaning and range so nothing downstream breaks. */
  score: number;
  tier: ReplacementTier;

  /** V2: the probability the score is derived from, with its range. */
  probability: number;
  low: number;
  high: number;
  evidenceGrade: EngineResult['evidenceGrade'];
  evidenceGradeReason: string;
  perEvent: EngineResult['perEvent'];
  bestDateOfLoss: EngineResult['bestDateOfLoss'];
  sensitivity: EngineResult['sensitivity'];
  modelVersion: string;
  constantsProvenanceSummary: EngineResult['constantsProvenanceSummary'];
  cosmeticExclusion: boolean;
  claimWindowMonths: number;
  guardFlags: string[];
  coverageNotes: string[];

  /** The raw reports the estimates were triangulated from. */
  hailEvents: StormEvent[];
  nonHailEventCount: number;
  wind: WindContext | null;
  windUnavailableReason: string | null;
  narrative: string;
  /** Advisory only — never affects the number. */
  auditFlags: AuditFlag[];

  /**
   * HMAC over every field the emailed report renders. The email endpoint
   * REFUSES to send a report it cannot verify, which is what stops that
   * public endpoint being an open relay for attacker-authored content —
   * see lib/hailview/report-signature.ts.
   *
   * `null` when no signing secret is available (neither
   * HAILVIEW_REPORT_SECRET nor SUPABASE_SERVICE_ROLE_KEY). The lookup still
   * works and still renders; only the "email me this" button cannot be
   * honoured, which the UI reports honestly rather than failing the lookup.
   */
  reportSignature: string | null;
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
  if (v.cosmeticExclusion !== undefined && typeof v.cosmeticExclusion !== 'boolean') return false;
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

    // ONE "now" for the whole request. The engine never reads the clock
    // itself, so pinning it here is what makes a single lookup internally
    // consistent and reproducible from the recorded evidence.
    const nowUtc = new Date().toISOString();

    const evidence = await collectHailEvidence({
      lat: geocoded.lat,
      lon: geocoded.lon,
      radiusMi: V2_EVIDENCE_RADIUS_MI,
      lookbackYears: V2_LOOKBACK_YEARS,
      nowUtc,
    });

    if (evidence.errors.length > 0 && evidence.observations.length === 0) {
      return NextResponse.json(
        { error: 'Could not retrieve storm history right now. Try again shortly.' },
        { status: 502 }
      );
    }

    // THE NUMBER. Deterministic, then deterministically re-checked. Nothing
    // after this line can change it.
    const result = evaluateWithGuard({
      material: body.material,
      roofAgeYears: body.roofAgeYears,
      shingleType: body.material === 'asphalt_shingle' ? body.shingleType : undefined,
      // Root cause #4: V1 never passed metalGauge to the scorer at all.
      metalGauge:
        body.material === 'metal_r_panel' || body.material === 'metal_standing_seam'
          ? body.metalGauge
          : undefined,
      membraneMilThickness: body.material === 'tpo_pvc_membrane' ? body.membraneMilThickness : undefined,
      cosmeticExclusion: body.cosmeticExclusion,
      lat: geocoded.lat,
      lon: geocoded.lon,
      observations: evidence.observations,
      nowUtc,
      coverageNotes: evidence.coverageNotes,
    });

    // The raw close-in report list the UI timeline shows. Still the V1
    // 1-mile view on purpose: this panel answers "what was reported near my
    // house", which is a different question from "what does the engine
    // triangulate from", and a 12-mile list would bury it.
    let stormEvents: StormEvent[] = [];
    try {
      stormEvents = await fetchStormHistory(geocoded.lat, geocoded.lon);
    } catch (error) {
      // Non-fatal: the engine already has its evidence. This is display only.
      console.error('[HailView Storm History Error]', error);
    }
    const hailEvents = stormEvents.filter((e) => e.isHail);
    const nonHailEventCount = stormEvents.length - hailEvents.length;

    let wind: WindContext | null = null;
    let windUnavailableReason: string | null = null;
    const largestHailEvent = [...hailEvents].sort((a, b) => (b.sizeIn ?? 0) - (a.sizeIn ?? 0))[0];
    if (largestHailEvent) {
      const windResult = await fetchWindContextForDate(geocoded.lat, geocoded.lon, largestHailEvent.validAt);
      wind = windResult.context;
      windUnavailableReason = windResult.unavailableReason;
    }

    // Advisory layer. Fails open — generateHailViewExplanation never throws.
    const explanation = await generateHailViewExplanation({
      address: geocoded.displayName,
      material: body.material,
      roofAgeYears: body.roofAgeYears,
      shingleType: body.material === 'asphalt_shingle' ? body.shingleType : undefined,
      metalGauge:
        body.material === 'metal_r_panel' || body.material === 'metal_standing_seam'
          ? body.metalGauge
          : undefined,
      membraneMilThickness: body.material === 'tpo_pvc_membrane' ? body.membraneMilThickness : undefined,
      result,
      hailEvents,
      nonHailEventCount,
      wind,
    });

    const response: HailViewLookupResponse = {
      address: geocoded.displayName,
      lat: geocoded.lat,
      lon: geocoded.lon,
      material: body.material,
      shingleType: body.shingleType,
      metalGauge: body.metalGauge,
      membraneMilThickness: body.membraneMilThickness,
      roofAgeYears: body.roofAgeYears,

      score: result.score,
      tier: result.tier,

      probability: result.probability,
      low: result.low,
      high: result.high,
      evidenceGrade: result.evidenceGrade,
      evidenceGradeReason: result.evidenceGradeReason,
      perEvent: result.perEvent,
      bestDateOfLoss: result.bestDateOfLoss,
      sensitivity: result.sensitivity,
      modelVersion: result.modelVersion,
      constantsProvenanceSummary: result.constantsProvenanceSummary,
      cosmeticExclusion: result.cosmeticExclusion,
      claimWindowMonths: result.claimWindowMonths,
      guardFlags: result.guardFlags,
      coverageNotes: result.coverageNotes,

      hailEvents,
      nonHailEventCount,
      wind,
      windUnavailableReason,
      narrative: explanation.narrative,
      auditFlags: explanation.auditFlags,
      reportSignature: null,
    };

    // Signed LAST, over the response that was actually built, so the MAC can
    // never cover a different value from the one the customer is shown.
    try {
      response.reportSignature = signHailViewReport({
        address: response.address,
        material: response.material,
        score: response.score,
        tier: response.tier,
        narrative: response.narrative,
        probability: response.probability,
        low: response.low,
        high: response.high,
        evidenceGrade: response.evidenceGrade,
        evidenceGradeReason: response.evidenceGradeReason,
        modelVersion: response.modelVersion,
        claimWindowMonths: response.claimWindowMonths,
        cosmeticExclusion: response.cosmeticExclusion,
        sensitivityNote: response.sensitivity.note,
        perEvent: response.perEvent,
      });
    } catch (error) {
      // No signing secret configured. The lookup is still valid and is still
      // returned — only emailing it is unavailable.
      console.error('[HailView Report Signature Error]', error);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[HailView Lookup Error]', error);
    return NextResponse.json({ error: 'Could not complete the lookup. Please try again.' }, { status: 500 });
  }
}
