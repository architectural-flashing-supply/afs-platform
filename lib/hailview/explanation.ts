import { anthropic } from '@/lib/anthropic/client';
import type { MaterialCategory, MembraneMilThickness, MetalGauge, ShingleType, StormEvent } from './types';
import type { WindContext } from './wind';
import type { EngineResult } from './v2/engine';

// ─────────────────────────────────────────────────────────────────────────
// THE AGENT IS ADVISORY ONLY — SPEC_HAILVIEW.md §1 and §6, and the V2
// determinism contract in lib/hailview/v2/engine.ts.
//
// The probability, the range, the tier, the evidence grade and every
// per-event number are computed by the deterministic engine BEFORE this
// module is called, and are handed in as fixed facts. This module returns
// PROSE and ADVISORY FLAGS. It has no ability to change the number, and the
// return type deliberately contains no numeric field that could be wired
// back into one.
//
// FAIL-OPEN: every failure path here returns empty narrative and no flags.
// A model outage degrades the report to its deterministic parts; it never
// fails the lookup, and it never blocks the number.
// ─────────────────────────────────────────────────────────────────────────

const MATERIAL_LABELS: Record<MaterialCategory, string> = {
  asphalt_shingle: 'asphalt shingle roofing',
  metal_r_panel: 'R-panel metal roofing',
  metal_standing_seam: 'standing seam metal roofing',
  tpo_pvc_membrane: 'TPO/PVC commercial membrane roofing',
  wood_shake: 'wood shake roofing',
};

/** The only flag kinds the model may raise. Anything else is discarded. */
export const AUDIT_FLAG_KINDS = [
  'source_conflict',
  'data_gap',
  'thin_coverage',
  'outlier',
] as const;
export type AuditFlagKind = (typeof AUDIT_FLAG_KINDS)[number];

export const AUDIT_FLAG_SEVERITIES = ['info', 'caution'] as const;
export type AuditFlagSeverity = (typeof AUDIT_FLAG_SEVERITIES)[number];

export interface AuditFlag {
  kind: AuditFlagKind;
  severity: AuditFlagSeverity;
  /** One plain-English sentence. Advisory: it never changes the number. */
  message: string;
}

export interface HailViewExplanationResult {
  /** Empty string when the model call failed — the caller renders its own fallback. */
  narrative: string;
  /** Advisory only. Empty on any failure or on an unparseable response. */
  auditFlags: AuditFlag[];
}

export interface ExplanationInputV2 {
  address: string;
  material: MaterialCategory;
  roofAgeYears?: number;
  shingleType?: ShingleType;
  metalGauge?: MetalGauge;
  membraneMilThickness?: MembraneMilThickness;
  /** The already-final deterministic result. Facts, not suggestions. */
  result: EngineResult;
  /** Raw reports behind the estimate, for the model to cite. */
  hailEvents: StormEvent[];
  nonHailEventCount: number;
  wind: WindContext | null;
}

const SYSTEM_PROMPT = `You are HailView's report-writing assistant for Architectural Flashing Supply (AFS), a sheet metal fabricator. You are given an ALREADY-COMPUTED, deterministic result for one property and one roofing material: the probability that an insurer would pay for a FULL ROOF REPLACEMENT, a range around it, an evidence grade, and a per-storm breakdown. Your job has two parts: write a clear factual narrative, and raise any advisory audit flags about the DATA.

ABSOLUTE RULES ABOUT THE NUMBER:
- The probability, the range, the tier and the evidence grade you are given are FINAL. They were computed by a separate deterministic formula before you were called.
- NEVER state, imply, or calculate a different probability, percentage, score, or tier than the ones given to you. Do not round them to a different value. Do not describe the result as higher or lower than it is, and never suggest what it "should" be.
- NEVER invent a number of any kind. Every figure in your narrative must appear verbatim in the data given to you.
- Your audit flags are ADVISORY observations about the quality of the underlying data. They do not and cannot change the result.

WHAT THE NUMBER MEANS — be precise about this, because it is easy to misstate:
- It is the probability that an INSURER PAYS FOR A FULL ROOF REPLACEMENT. It is not the probability that the roof is damaged, and not a condition rating.
- Hail sizes at the property are ESTIMATED by triangulating nearby storm-spotter reports. NEVER call an estimated size "confirmed", "verified", "recorded at", or "measured at" the property. Say "estimated at your address". Only a report that was actually measured at a point is a measurement, and the data tells you which were.
- If a storm falls outside the typical claim window, say so plainly: the roof really was hit, but that loss is outside the window a policy will normally pay on. Do not present it as if it counted toward the result.
- If the evidence grade is C or D, say clearly that the nearest reports are too far away to be confident about this specific address.

WRITING RULES:
- 3 to 5 short paragraphs, readable by a non-engineer, no jargon without a plain-language gloss.
- Cite specific storms by date and estimated size from the data you are given.
- Mention wind context if provided — wind-driven hail strikes at an angle and damages differently from vertical hail.
- Never mention pricing, cost, or a dollar figure. If replacement looks warranted, say to request a formal AFS quote, with no figure.
- Do not mention that you are an AI or that this was model-generated.
- Plain prose only. This renders as plain text, NOT Markdown: no headers, no ** bold **, no bullet lists, no horizontal rules. Separate paragraphs with one blank line.

OUTPUT FORMAT — this exact structure, nothing before or after:
<narrative>
(your prose here)
</narrative>
<audit_flags>
(one flag per line, in the form KIND|SEVERITY|message — or the single word NONE)
</audit_flags>

KIND must be exactly one of: source_conflict, data_gap, thin_coverage, outlier.
SEVERITY must be exactly one of: info, caution.
Raise a flag only for something genuinely visible in the data: reports of the same storm that disagree sharply on size, a gap in coverage, evidence resting on very few or very distant reports, or a single report wildly out of line with its neighbours. Write NONE if there is nothing to raise. Do not invent flags to fill the section.

TWO CONVENTIONS THAT ARE CORRECT AND MUST NOT BE FLAGGED AS CONFLICTS. Both were flagged as "source_conflict" by an earlier version of this prompt that had not been told about them, which is noise rather than audit:
- A STORM IS DATED BY ITS CONVECTIVE DAY, which runs 12:00 UTC to 12:00 UTC, not midnight to midnight. So an individual report timestamped early on the 6th belongs to the 5th's storm, and a report timestamped just after midnight is grouped with the evening before it. A storm date one day earlier than a raw report's date is this convention working, NOT a reporting-lag error or a mis-assignment.
- ONE CONVECTIVE DAY IS ONE STORM EVENT at one address, because an insurance claim is filed per date of loss. Several reports hours apart and miles apart on the same convective day are deliberately ONE event, not several.
Flag a date only if it is genuinely impossible — a report outside the storm's own day entirely, or a future date.`;

function formatHailEvents(events: StormEvent[]): string {
  if (events.length === 0) return 'No hail reports were found near this address in the search window.';
  return events
    .map(
      (e) =>
        `- ${e.validAt.slice(0, 10)}: ${e.sizeIn}" reported, ${e.distanceMi.toFixed(2)} mi from the address${e.city ? `, near ${e.city}` : ''}`
    )
    .join('\n');
}

function formatSubDetails(input: ExplanationInputV2): string {
  const parts: string[] = [];
  if (input.roofAgeYears !== undefined) parts.push(`roof age ${input.roofAgeYears} years`);
  if (input.shingleType) parts.push(`shingle type ${input.shingleType}`);
  if (input.metalGauge) parts.push(`gauge ${input.metalGauge}`);
  if (input.membraneMilThickness !== undefined) parts.push(`membrane thickness ${input.membraneMilThickness} mil`);
  return parts.length > 0 ? parts.join(', ') : 'none provided';
}

function formatPerEvent(result: EngineResult): string {
  if (result.perEvent.length === 0) return 'No storm events were identified.';
  return result.perEvent
    .map((e) => {
      const window =
        e.windowStatus === 'in_window'
          ? `inside the ${result.claimWindowMonths}-month claim window`
          : `OUTSIDE the claim window (about ${e.monthsAgo} months ago) — contributes nothing to the result`;
      return (
        `- ${e.convectiveDayUtc}: estimated ${e.estimatedSizeIn.toFixed(2)}" at the address ` +
        `(range ${e.estimatedSizeLowIn.toFixed(2)}"-${e.estimatedSizeHighIn.toFixed(2)}", ` +
        `${e.interpolation}, nearest report ${Number.isFinite(e.nearestReportMi) ? e.nearestReportMi.toFixed(1) : '?'} mi, ` +
        `${e.reportCount} report(s): ${e.measuredCount} measured / ${e.estimatedCount} estimated; ` +
        `largest size reported anywhere in this storm ${e.maxReportedSizeIn}"). ` +
        `Functional damage ${(e.pFunctional * 100).toFixed(0)}%, cosmetic ${(e.pCosmetic * 100).toFixed(0)}%` +
        `${e.cosmeticSuppressed ? ' (cosmetic damage excluded by the policy setting, so it contributes nothing)' : ''}. ` +
        `This event is ${window}.`
      );
    })
    .join('\n');
}

/**
 * Parses the model's two-section response.
 *
 * Hand-written rather than schema-library-validated, deliberately: this
 * codebase has no `zod` dependency and CLAUDE.md rule #32 already settled
 * the precedent for exactly this situation — "do not add a schema library
 * for two documented shapes", with lib/integrations/pathfinder-response.ts
 * as the pattern. Adding a runtime dependency for one four-field union
 * would be the larger change.
 *
 * Every unrecognised line is DROPPED, never coerced: an invented flag kind
 * or severity is not advisory information, it is noise.
 */
export function parseExplanationResponse(text: string): HailViewExplanationResult {
  const narrativeMatch = /<narrative>([\s\S]*?)<\/narrative>/i.exec(text);
  const flagsMatch = /<audit_flags>([\s\S]*?)<\/audit_flags>/i.exec(text);

  // If the model ignored the format entirely, take the whole response as
  // narrative rather than losing it — the prose is still usable, and the
  // flags are advisory and can safely be empty.
  const narrative = (narrativeMatch ? narrativeMatch[1] : text)
    .replace(/<\/?audit_flags>[\s\S]*$/i, '')
    .trim();

  const auditFlags: AuditFlag[] = [];
  if (flagsMatch) {
    for (const rawLine of flagsMatch[1].split('\n')) {
      const line = rawLine.trim().replace(/^[-*]\s*/, '');
      if (!line || /^none$/i.test(line)) continue;
      const parts = line.split('|');
      if (parts.length < 3) continue;
      const kind = parts[0].trim().toLowerCase();
      const severity = parts[1].trim().toLowerCase();
      const message = parts.slice(2).join('|').trim();
      if (!AUDIT_FLAG_KINDS.includes(kind as AuditFlagKind)) continue;
      if (!AUDIT_FLAG_SEVERITIES.includes(severity as AuditFlagSeverity)) continue;
      if (!message) continue;
      auditFlags.push({
        kind: kind as AuditFlagKind,
        severity: severity as AuditFlagSeverity,
        message,
      });
    }
  }

  return { narrative, auditFlags };
}

/**
 * Writes the narrative and raises advisory audit flags for an
 * already-final deterministic result.
 *
 * FAILS OPEN. Any throw — network, auth, rate limit, malformed response —
 * comes back as `{ narrative: '', auditFlags: [] }` and is logged. The
 * caller renders its own deterministic summary in that case.
 */
export async function generateHailViewExplanation(
  input: ExplanationInputV2
): Promise<HailViewExplanationResult> {
  const { result } = input;

  const windLine = input.wind
    ? `On the date of the largest reported hail, ${input.wind.sampledDate}, the recorded max wind gust was ${input.wind.maxGustMph} mph from the ${input.wind.directionAtMaxGust}.`
    : 'Wind speed and direction data was not available for this report.';

  const userPrompt = `Property: ${input.address}
Material: ${MATERIAL_LABELS[input.material]}
Material sub-details: ${formatSubDetails(input)}
Policy cosmetic-damage exclusion: ${result.cosmeticExclusion ? 'YES — cosmetic-only damage contributes nothing' : 'NO — cosmetic-only damage can contribute'}

FINAL RESULT (do not alter, do not restate differently):
Probability an insurer pays for a full roof replacement: ${(result.probability * 100).toFixed(0)}% (range ${(result.low * 100).toFixed(0)}% to ${(result.high * 100).toFixed(0)}%)
Tier: ${result.tier}
Evidence grade: ${result.evidenceGrade} — ${result.evidenceGradeReason}
Model version: ${result.modelVersion} (UNCALIBRATED — not yet fitted to real claim outcomes)
Claim window: ${result.claimWindowMonths} months
Best date of loss: ${result.bestDateOfLoss ? result.bestDateOfLoss.convectiveDayUtc : 'none inside the claim window'}

Per-storm breakdown (sizes are ESTIMATED AT THE ADDRESS by triangulation, not measured there):
${formatPerEvent(result)}

Sensitivity: ${result.sensitivity.note}

Raw nearby hail reports (what the estimates were triangulated FROM):
${formatHailEvents(input.hailEvents)}

Other (non-hail) storm reports in the area over the same period: ${input.nonHailEventCount}

Data coverage notes: ${result.coverageNotes.join(' ') || 'none'}

Wind context: ${windLine}

Write the narrative and the audit flags now.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return { narrative: '', auditFlags: [] };
    return parseExplanationResponse(textBlock.text);
  } catch (error) {
    console.error('[HailView Explanation Error]', error);
    return { narrative: '', auditFlags: [] };
  }
}
