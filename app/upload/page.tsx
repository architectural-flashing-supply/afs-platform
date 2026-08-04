'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { gaugeToThicknessMm } from '@/lib/utils/gauge-thickness';
import ProfileViewer3D, { type ProfileBend } from '@/components/studio/ProfileViewer3D';
import { ALL_MATERIALS, GAUGES_BY_MATERIAL, STANDARD_PROFILE_DEFAULTS, STANDARD_PANEL_WIDTHS } from '@/lib/data/catalog';
import { UPLOAD_ACCEPTED_EXTENSIONS, UPLOAD_MAX_SIZE_BYTES } from '@/lib/utils/upload-limits';
import type { ScopeOption, ScopeDirective } from '@/app/api/takeoff/route';
import type { SignUploadResponse } from '@/app/api/upload/route';

const MM_PER_INCH = 25.4;
const DEFAULT_DIMENSIONS_IN = { width: 12, legA: 2, legB: 2 };

// The takeoff AI's PROFILE TYPES TO IDENTIFY list (see /api/takeoff's
// TAKEOFF_SYSTEM_PROMPT) sorted into the 3 cross-section shapes the generic
// fallback preview below can distinguish with the leg/angle "bend"
// primitives ProfileViewer3D consumes. Only used for profile types with no
// canonical_profiles match (see PROFILE_TYPE_TO_CANONICAL_SLUG and
// resolveCanonicalSlug below) — Coping Cap and Expansion Joint Cover (both
// a flat span framed by two legs) fall through to the default 'hat' branch,
// matching prior behavior exactly for those two types.
const L_BEND_PROFILE_KEYWORDS = ['base flashing', 'counter flashing', 'step flashing', 'drip edge', 'gravel stop'];
const FLAT_PROFILE_KEYWORDS = ['valley', 'through-wall', 'through wall', 'reglet'];

type ProfileShape = 'hat' | 'l-bend' | 'flat';

// Real-world/hand-sketch drawings routinely produce profileType labels
// outside both the takeoff AI's closed list above and its two keyword
// buckets — e.g. "Outside Corner Trim", "J-Closure Trim", "Z-spacer trim".
// Rather than defaulting every one of them to the same fixed 3-leg 'hat'
// shape regardless of actual geometry, infer topology from which dimension
// fields this item's own extraction actually populated: a profile with a
// leg dimension but no overall width/height is a 2-leg corner/bend (matches
// an outside-corner trim or a Z-shaped spacer whose two flanges meet with no
// flat span between them); one with only a width/height and no leg is a
// flat span; only when a leg AND an overall width/height are both present
// does the 3-leg channel shape ('hat') fit (e.g. a J-channel/closure trim's
// own top-flange/channel/bottom-lip legs).
function classifyProfileShape(item: TakeoffItem): ProfileShape {
  const t = item.profileType.toLowerCase();
  if (FLAT_PROFILE_KEYWORDS.some((k) => t.includes(k))) return 'flat';
  if (L_BEND_PROFILE_KEYWORDS.some((k) => t.includes(k))) return 'l-bend';

  const hasLeg = item.legA != null || item.legB != null;
  const hasSpan = item.width != null || item.height != null;
  if (hasLeg && !hasSpan) return 'l-bend';
  if (!hasLeg && hasSpan) return 'flat';
  return 'hat';
}

// The AI takeoff extracts width/height/legA/legB per line item, not a
// linked machine_profile record — there is no "matched profile" to look
// up. This builds an illustrative cross-section from the item's own
// dimensions (falling back to generic defaults when a dimension wasn't
// captured, the same 90°-corner assumption lib/utils/profile-svg.ts
// already makes for these fields), shaped according to the row's own
// profileType via classifyProfileShape. Used only as a fallback for
// profile types with no canonical_profiles match — see buildBendsFromItem.
function buildGenericBendsFromItem(item: TakeoffItem): { bends: ProfileBend[]; blankWidthMm: number } {
  const legAIn = item.legA ?? DEFAULT_DIMENSIONS_IN.legA;
  const legBIn = item.legB ?? DEFAULT_DIMENSIONS_IN.legB;
  const widthIn = item.width ?? item.height ?? DEFAULT_DIMENSIONS_IN.width;

  const legAMm = legAIn * MM_PER_INCH;
  const legBMm = legBIn * MM_PER_INCH;
  const widthMm = widthIn * MM_PER_INCH;

  const shape = classifyProfileShape(item);

  if (shape === 'l-bend') {
    return {
      bends: [{ leftLeg: legAMm, rightLeg: legBMm, angle: 90, radius: 0 }],
      blankWidthMm: legAMm + legBMm,
    };
  }

  if (shape === 'flat') {
    return {
      bends: [{ leftLeg: widthMm / 2, rightLeg: widthMm / 2, angle: 160, radius: 0 }],
      blankWidthMm: widthMm,
    };
  }

  return {
    bends: [
      { leftLeg: legAMm, rightLeg: 0, angle: 90, radius: 0 },
      { leftLeg: widthMm, rightLeg: legBMm, angle: 90, radius: 0 },
    ],
    blankWidthMm: legAMm + widthMm + legBMm,
  };
}

interface CanonicalBend {
  leftLegIn: number;
  rightLegIn: number;
  angleDegrees: number;
  direction: 'up' | 'down';
}

interface CanonicalProfile {
  slug: string;
  blankWidthIn: number;
  bends: CanonicalBend[];
}

// Maps the takeoff AI's profileType strings to the matching row in
// canonical_profiles (the same 25-profile reference library FlashDraft's
// "Load into FlashDraft" browser and the Custom Configurator draw from —
// see scripts/seed-canonical-profiles.ts and
// components/studio/CanonicalProfileBrowser.tsx) so the 3D preview below
// renders that profile's real fabricated shape instead of a generic
// approximation. Only profile types with an unambiguous "standard" match
// are listed — Step Flashing and Reglet have no equivalent canonical
// profile, so they (and any custom/unmatched profileType) fall back to
// buildGenericBendsFromItem's 3-shape heuristic. Exact-string keys only —
// see resolveCanonicalSlug below for informal/hand-sketch label variants.
const PROFILE_TYPE_TO_CANONICAL_SLUG: Record<string, string> = {
  'Coping Cap': 'standard-coping-cap',
  'Base Flashing': 'l-shape-base-flashing',
  'Counter Flashing': 'counter-flashing',
  'Drip Edge': 'standard-drip-edge',
  'Gravel Stop': 'gravel-stop',
  'Valley Flashing': 'open-valley-flashing',
  'Expansion Joint Cover': 'expansion-joint-cover',
  'Through-wall Flashing': 'scupper-opening',
};

// Real-world/hand-sketch drawings routinely produce profileType labels
// outside the takeoff AI's closed "PROFILE TYPES TO IDENTIFY" list (see
// app/api/takeoff/route.ts) and outside PROFILE_TYPE_TO_CANONICAL_SLUG's
// exact keys above. "Sill Flashing" and "Head Flashing" are two observed in
// the wild that DO have an unambiguous canonical_profiles match once read as
// a keyword rather than an exact string — the same window/door sill-pan and
// head-flashing shapes as canonical_profiles' own 'Window Sill Pan' and
// 'Head Flashing' entries (scripts/seed-canonical-profiles.ts) and
// catalog.ts's 'Sill Pan Flashing' / 'Head Flashing' products, just under a
// different label than either list uses. Checked only when no exact key
// above matches, so it can't change behavior for any of the 8 listed types.
//
// Deliberately NOT mapped here: "Outside Corner Trim", "J-Closure Trim", and
// "Z-spacer trim" (also observed in the wild) are wall-panel trim/accessory
// shapes with no equivalent row in the 25-profile canonical library or in
// catalog.ts — forcing them onto the nearest canonical shape would
// misrepresent their real fabricated geometry, so they're left to fall
// through to classifyProfileShape's leg-count-aware fallback instead.
const INFORMAL_PROFILE_LABEL_TO_CANONICAL_SLUG: Array<{ keywords: string[]; slug: string }> = [
  { keywords: ['sill flashing', 'sill pan'], slug: 'window-sill-pan' },
  { keywords: ['head flashing'], slug: 'head-flashing' },
];

function resolveCanonicalSlug(profileType: string): string | undefined {
  if (PROFILE_TYPE_TO_CANONICAL_SLUG[profileType]) {
    return PROFILE_TYPE_TO_CANONICAL_SLUG[profileType];
  }
  const t = profileType.toLowerCase();
  return INFORMAL_PROFILE_LABEL_TO_CANONICAL_SLUG.find(({ keywords }) => keywords.some((k) => t.includes(k)))?.slug;
}

// Reasonable scale bounds so a wildly wrong or missing extracted dimension
// can't blow up the preview into an unreadable sliver or a giant slab —
// the canonical shape itself (not this clamp) is what carries the real
// fabrication-accurate topology.
const CANONICAL_SCALE_MIN = 0.2;
const CANONICAL_SCALE_MAX = 5;

// canonical_profiles stores each bend as a turn magnitude + up/down
// direction (see seed-canonical-profiles.ts's turtleBends), not the signed
// "interior angle" ProfileViewer3D's reconstruction (lib/flashdraft/
// geometry.ts computeProfilePoints) expects. Converting the direction into
// the interior-angle convention (up: 180 - turn, down: 180 + turn) is what
// lets a profile with alternating bend directions — nearly all of them —
// reconstruct correctly; see CanonicalProfileBrowser's comment on why
// FlashDraft's own "Load into Library" flow avoids this same reconstruction
// entirely by handing off pre-computed points instead. A takeoff line item
// has no pre-computed points to hand off (only a matched slug), so this
// route recomputes them via the angle conversion instead.
function canonicalBendsToProfileBends(bends: CanonicalBend[], scale: number): ProfileBend[] {
  return bends.map((b) => ({
    leftLeg: b.leftLegIn * scale * MM_PER_INCH,
    rightLeg: b.rightLegIn * scale * MM_PER_INCH,
    angle: b.direction === 'up' ? 180 - b.angleDegrees : 180 + b.angleDegrees,
    radius: 0,
  }));
}

function buildBendsFromItem(
  item: TakeoffItem,
  canonicalProfiles: Record<string, CanonicalProfile>
): { bends: ProfileBend[]; blankWidthMm: number } {
  const slug = resolveCanonicalSlug(item.profileType);
  const canonical = slug ? canonicalProfiles[slug] : undefined;

  if (canonical && canonical.bends.length > 0) {
    // Scale the canonical shape to roughly match this item's own extracted
    // (or AFS-standard-default) size, using whichever overall dimension it
    // has — real shape, sized to this line item rather than a fixed stock
    // dimension every time.
    const targetIn =
      item.width ?? item.height ?? (item.legA != null && item.legB != null ? item.legA + item.legB : null);
    const rawScale = targetIn && targetIn > 0 ? targetIn / canonical.blankWidthIn : 1;
    const scale = Math.min(CANONICAL_SCALE_MAX, Math.max(CANONICAL_SCALE_MIN, rawScale));

    return {
      bends: canonicalBendsToProfileBends(canonical.bends, scale),
      blankWidthMm: canonical.blankWidthIn * scale * MM_PER_INCH,
    };
  }

  return buildGenericBendsFromItem(item);
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'results' | 'submitting' | 'submitted' | 'failed';
type Confidence = 'high' | 'medium' | 'low';

interface TakeoffItem {
  profileType: string;
  material: string | null;
  gauge: string | null;
  finish: string | null;
  width: number | null;
  height: number | null;
  legA: number | null;
  legB: number | null;
  lengthFt: number;
  // Null for a roof panel item whose width wasn't found on the drawing —
  // AFS has no standard panel width to assume, so quantity stays
  // uncalculated until the estimator picks one (see ROOF_PANEL_PROFILE_TYPES
  // and the panel-width selector in the results table below).
  quantity: number | null;
  unit: string;
  confidence: Confidence;
  aiNote: string | null;
  // Roof panel items only — the true sloped roof area (sq ft) the takeoff AI
  // calculated from plan geometry and pitch (see app/api/takeoff/route.ts's
  // ROOF PANEL IDENTIFICATION AND QUANTITY rules). null for every other
  // profile type. Used to derive quantity client-side once a width is known.
  calculatedAreaSqFt: number | null;
}

interface TakeoffResult {
  items: TakeoffItem[];
  processingNotes: string | null;
  overallConfidence: Confidence;
  status: 'success' | 'partial' | 'failed';
  scopeDirective: ScopeDirective | null;
}

type PrefillableField = 'width' | 'height' | 'legA' | 'legB' | 'material' | 'gauge';
const PREFILLABLE_DIMENSION_FIELDS: readonly ('width' | 'height' | 'legA' | 'legB')[] = ['width', 'height', 'legA', 'legB'];

// Applies STANDARD_PROFILE_DEFAULTS (lib/data/catalog.ts) to any field the
// AI left null because the drawing itself didn't specify it — never
// overwrites a field the AI actually read off the drawing. Returns, in
// parallel with the (possibly updated) items, one Set per item recording
// exactly which fields were filled this way, so the table can badge them as
// "AFS standard default" rather than presenting them as if extracted.
function applyStandardDefaults(rawItems: TakeoffItem[]): { items: TakeoffItem[]; prefilled: Set<PrefillableField>[] } {
  const prefilled: Set<PrefillableField>[] = [];
  const items = rawItems.map((item) => {
    const defaults = STANDARD_PROFILE_DEFAULTS[item.profileType];
    const filled = new Set<PrefillableField>();
    if (!defaults) {
      prefilled.push(filled);
      return item;
    }

    const next = { ...item };
    for (const key of PREFILLABLE_DIMENSION_FIELDS) {
      if (next[key] == null && defaults[key] != null) {
        next[key] = defaults[key];
        filled.add(key);
      }
    }
    if (next.material == null && defaults.material) {
      next.material = defaults.material;
      filled.add('material');
    }
    if (next.gauge == null && defaults.gauge) {
      next.gauge = defaults.gauge;
      filled.add('gauge');
    }
    prefilled.push(filled);
    return next;
  });
  return { items, prefilled };
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// Local work-persistence draft for the results table below — see the
// restore-on-mount, write-on-edit, and debounced-database-save effects in
// UploadPage. Stored in localStorage (survives tab/browser close, unlike
// sessionStorage) rather than React state alone so edits aren't lost to a
// refresh, back-navigation, or browser/power loss before the debounced
// database save (takeoff_uploads.confirmed_items) lands. Keyed by uploadId
// via DRAFT_KEY_PREFIX, with a small pointer key recording which upload is
// "active" so a fresh page load knows which draft to look for.
interface TakeoffDraft {
  uploadId: string;
  filename: string | null;
  result: TakeoffResult;
  items: TakeoffItem[];
  prefilledFields: PrefillableField[][];
  // Parallel to items — true for a roof panel row whose quantity was
  // computed from the estimator's own panel-width selection (see
  // handlePanelWidthSelect), so the UserSelectedBadge survives a reload.
  // Absent in drafts written before this field existed; restored as all-
  // false in that case (see the mount-time restore effect below).
  panelWidthUserSelected?: boolean[];
  savedAt: number;
}

const DRAFT_KEY_PREFIX = 'afs:takeoff-draft:';
const ACTIVE_DRAFT_POINTER_KEY = 'afs:takeoff-active-upload-id';

function readDraft(uploadId: string): TakeoffDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY_PREFIX + uploadId);
    return raw ? (JSON.parse(raw) as TakeoffDraft) : null;
  } catch {
    return null;
  }
}

function readActiveDraft(): TakeoffDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const activeUploadId = window.localStorage.getItem(ACTIVE_DRAFT_POINTER_KEY);
    return activeUploadId ? readDraft(activeUploadId) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: TakeoffDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DRAFT_KEY_PREFIX + draft.uploadId, JSON.stringify(draft));
    window.localStorage.setItem(ACTIVE_DRAFT_POINTER_KEY, draft.uploadId);
  } catch {
    // localStorage unavailable (private browsing, quota exceeded, disabled)
    // — the debounced database save (confirmed_items PATCH, below) is the
    // fallback persistence path for this case.
  }
}

function clearDraft(uploadId: string | null): void {
  if (typeof window === 'undefined' || !uploadId) return;
  try {
    window.localStorage.removeItem(DRAFT_KEY_PREFIX + uploadId);
    if (window.localStorage.getItem(ACTIVE_DRAFT_POINTER_KEY) === uploadId) {
      window.localStorage.removeItem(ACTIVE_DRAFT_POINTER_KEY);
    }
  } catch {
    // best-effort cleanup only
  }
}

const SCOPE_DIRECTIVE_OPTIONS: { value: ScopeOption; label: string }[] = [
  { value: 'full', label: 'Full Takeoff (all sheet metal)' },
  { value: 'roof', label: 'Roof Only' },
  { value: 'flashing', label: 'Flashing & Components Only' },
  { value: 'roof_flashing', label: 'Roof + Flashing Combined' },
  { value: 'custom', label: 'Custom' },
];

const CUSTOM_SCOPE_MAX_LENGTH = 300;

// Matches /api/takeoff's TAKEOFF_SYSTEM_PROMPT "PROFILE TYPES TO IDENTIFY" list —
// including the 3 roof panel types (see ROOF_PANEL_PROFILE_TYPES below), so an
// estimator can manually reassign a line item into or out of a panel type, not
// just edit whatever profileType the AI happened to assign.
const TAKEOFF_PROFILE_TYPES = [
  'Coping Cap',
  'Base Flashing',
  'Counter Flashing',
  'Step Flashing',
  'Drip Edge',
  'Gravel Stop',
  'Valley Flashing',
  'Expansion Joint Cover',
  'Reglet',
  'Through-wall Flashing',
  'Mechanically Double-Locked Panel',
  'Single-Lock Panel',
  'Snap-Lock Panel',
];

const DIMENSION_FIELDS: { key: 'width' | 'height' | 'legA' | 'legB'; label: string }[] = [
  { key: 'width', label: 'W' },
  { key: 'height', label: 'H' },
  { key: 'legA', label: 'A' },
  { key: 'legB', label: 'B' },
];

// The 3 roof panel profileType strings TAKEOFF_SYSTEM_PROMPT_RULES can
// return (app/api/takeoff/route.ts). These never get an auto-filled width
// (see STANDARD_PROFILE_DEFAULTS in lib/data/catalog.ts) — when the AI
// didn't find an explicit width on the drawing, the results table below
// shows a panel-width picker (STANDARD_PANEL_WIDTHS) instead of a plain
// dimension input, since AFS has no single standard width to assume.
const ROOF_PANEL_PROFILE_TYPES = new Set([
  'Mechanically Double-Locked Panel',
  'Single-Lock Panel',
  'Snap-Lock Panel',
]);

function isRoofPanelItem(item: TakeoffItem): boolean {
  return ROOF_PANEL_PROFILE_TYPES.has(item.profileType);
}

// Linear feet of panel run needed to cover calculatedAreaSqFt at the given
// coverage width — rounded to 1 decimal, matching this table's existing
// lengthFt display precision.
function calculatePanelQuantity(areaSqFt: number, widthIn: number): number {
  const widthFt = widthIn / 12;
  return Math.round((areaSqFt / widthFt) * 10) / 10;
}

// Small indicator shown next to a field that was pre-filled from
// STANDARD_PROFILE_DEFAULTS rather than read off the drawing — see
// applyStandardDefaults. Uses the afs-accent-green Tailwind token (CLAUDE.md
// rule 4) rather than an inline hex value.
function DefaultBadge() {
  return (
    <span
      className="text-afs-accent-green"
      title="AFS standard default — not read from the drawing"
      style={{ fontSize: '10px', lineHeight: 1, fontWeight: 700 }}
    >
      ●
    </span>
  );
}

// Marks a quantity computed from the estimator's own panel-width selection
// (see handlePanelWidthSelect) rather than a drawing-read or AFS-default
// value — distinct from DefaultBadge both in meaning (a real user choice,
// not a fabricated fallback) and in token (afs-accent-purple, per CLAUDE.md
// rule 4's sanctioned FlashDraft palette) so the two are never confused.
function UserSelectedBadge() {
  return (
    <span
      className="text-afs-accent-purple"
      title="Calculated from the panel width you selected — not read from the drawing"
      style={{ fontSize: '10px', lineHeight: 1, fontWeight: 700 }}
    >
      ●
    </span>
  );
}

// Always surfaces a blank option (AI found no data) plus the current value
// even when the AI extracted something outside the canonical list, so an
// unusual value is never silently discarded by the dropdown.
function selectOptions(current: string | null, canonical: readonly string[]): string[] {
  const options = [...canonical];
  if (current && !options.includes(current)) options.unshift(current);
  if (!options.includes('')) options.unshift('');
  return options;
}

interface QuoteRequestSuccessResponse {
  requestId: string;
  requestNumber: string;
}

interface QuoteRequestErrorResponse {
  error: string;
}

interface ApiErrorResponse {
  error: string;
}

// Vercel serverless functions return a plain-text 413 (not JSON) when a
// request body exceeds their hard 4.5MB limit, and other infra-level
// failures (gateway timeouts, etc.) can do the same. res.json() throws on a
// non-JSON body, which without this guard left the UI stuck on "Uploading..."
// / "Processing..." forever instead of surfacing an error.
async function parseJsonResponse<T>(res: Response): Promise<T | ApiErrorResponse> {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    return { error: text.trim().slice(0, 200) || `Request failed with status ${res.status}` };
  }
  try {
    return (await res.json()) as T;
  } catch {
    return { error: `Request failed with status ${res.status}` };
  }
}

function isApiError(data: unknown): data is ApiErrorResponse {
  return typeof data === 'object' && data !== null && 'error' in data && typeof (data as ApiErrorResponse).error === 'string';
}

export default function UploadPage() {
  const [state, setState] = useState<UploadState>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [result, setResult] = useState<TakeoffResult | null>(null);
  const [items, setItems] = useState<TakeoffItem[]>([]);
  const [stage, setStage] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [scopeOption, setScopeOption] = useState<ScopeOption>('full');
  const [customScopeText, setCustomScopeText] = useState('');
  const [prefilledFields, setPrefilledFields] = useState<Set<PrefillableField>[]>([]);
  const [panelWidthUserSelected, setPanelWidthUserSelected] = useState<boolean[]>([]);
  const [canonicalProfiles, setCanonicalProfiles] = useState<Record<string, CanonicalProfile>>({});
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showGuestNudge, setShowGuestNudge] = useState(false);
  const lastDraftLoadedAtRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNavigationRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsAuthenticated(!!data.user));
  }, []);

  // Restore-on-mount: if a local draft exists (this device left off mid-edit
  // — refresh, back-navigation, browser/power loss), load it straight into
  // the results view instead of showing the empty dropzone. Compared against
  // lastDraftLoadedAtRef rather than unconditionally so this same pattern
  // extends cleanly to a future server-fetched initial load (e.g. resuming
  // a takeoff by URL) — "restore only if newer than or equal to what's
  // already loaded" — without this page needing to change; today nothing is
  // loaded yet at mount, so any draft found here always qualifies.
  useEffect(() => {
    const draft = readActiveDraft();
    if (!draft || draft.savedAt < lastDraftLoadedAtRef.current) return;
    lastDraftLoadedAtRef.current = draft.savedAt;
    setUploadId(draft.uploadId);
    setFilename(draft.filename);
    setResult(draft.result);
    setItems(draft.items);
    setPrefilledFields(draft.prefilledFields.map((fields) => new Set(fields)));
    setPanelWidthUserSelected(draft.panelWidthUserSelected ?? draft.items.map(() => false));
    setState('results');
  }, []);

  // Local persistence: write the full current item state to localStorage on
  // every edit (any change to `items`, plus the metadata needed to redraw
  // the results view after a reload).
  useEffect(() => {
    if (!uploadId || !result || (state !== 'results' && state !== 'submitting')) return;
    const savedAt = Date.now();
    lastDraftLoadedAtRef.current = savedAt;
    writeDraft({
      uploadId,
      filename,
      result,
      items,
      prefilledFields: prefilledFields.map((fields) => Array.from(fields)),
      panelWidthUserSelected,
      savedAt,
    });
  }, [uploadId, filename, result, items, prefilledFields, panelWidthUserSelected, state]);

  // Debounced database save: persists edited items to
  // takeoff_uploads.confirmed_items ~1.5-2s after the last edit, so work
  // survives even if localStorage is unavailable or gets cleared.
  useEffect(() => {
    if (!uploadId || (state !== 'results' && state !== 'submitting')) return;
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/takeoff/${uploadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });
        setSaveStatus(res.ok ? 'saved' : 'error');
      } catch {
        setSaveStatus('error');
      }
    }, 1800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [uploadId, items, state]);

  // beforeunload warning: native "leave site?" dialog while edits haven't
  // been confirmed saved to the database yet (the local draft above is
  // written synchronously on every edit, so the remaining risk window is
  // the debounced database save still pending or having failed).
  useEffect(() => {
    if (saveStatus !== 'saving' && saveStatus !== 'error') return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  // Guest account nudge: work that exists only as a local draft / unconfirmed
  // takeoff_uploads row tied to no account is gone the moment this browser
  // loses it. Rather than block navigation outright, intercept the in-page
  // actions that would take a guest away from it and offer the choice.
  const hasGuestOnlyWork = isAuthenticated === false && uploadId !== null && items.length > 0 && (state === 'results' || state === 'submitting');

  const navigateAwayFromDraft = (action: () => void) => {
    if (hasGuestOnlyWork) {
      pendingNavigationRef.current = action;
      setShowGuestNudge(true);
    } else {
      action();
    }
  };

  useEffect(() => {
    fetch('/api/studio/canonical-profiles')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { profiles?: CanonicalProfile[] } | null) => {
        if (!data?.profiles) return;
        const bySlug: Record<string, CanonicalProfile> = {};
        for (const p of data.profiles) bySlug[p.slug] = p;
        setCanonicalProfiles(bySlug);
      })
      .catch(() => {
        // 3D preview falls back to buildGenericBendsFromItem's heuristic
        // shapes if the canonical library can't be loaded.
      });
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setFilename(file.name);

    if (scopeOption === 'custom' && customScopeText.trim().length === 0) {
      setError('Enter a custom scope description before uploading.');
      setState('failed');
      return;
    }

    setState('uploading');
    setStage(0);

    if (file.size > UPLOAD_MAX_SIZE_BYTES) {
      setError(`File exceeds ${UPLOAD_MAX_SIZE_BYTES / 1024 / 1024}MB.`);
      setState('failed');
      return;
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!UPLOAD_ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`${ext.toUpperCase()} is not supported.`);
      setState('failed');
      return;
    }

    try {
      // 1. Ask for a signed Storage upload URL — metadata only, no file
      // bytes in this request, so it never touches Vercel's 4.5MB
      // serverless body limit.
      const signRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, fileSize: file.size }),
      });
      const signData = await parseJsonResponse<SignUploadResponse>(signRes);
      if (!signRes.ok || isApiError(signData)) {
        setError(isApiError(signData) ? signData.error : 'Could not prepare upload.');
        setState('failed');
        return;
      }

      // 2. Upload the file bytes directly from the browser to Supabase
      // Storage using that signed URL — this is the request that actually
      // carries the file, and it never passes through this app's servers.
      const supabase = createClient();
      const { error: storageError } = await supabase.storage
        .from('blueprints')
        .uploadToSignedUrl(signData.storageKey, signData.token, file);
      if (storageError) {
        setError(`Upload to storage failed: ${storageError.message}`);
        setState('failed');
        return;
      }

      setUploadId(signData.uploadId);
      setSaveStatus('idle');
      setState('processing');
      setStage(1);

      const scopeDirective: ScopeDirective = scopeOption === 'custom'
        ? { option: 'custom', customText: customScopeText.trim() }
        : { option: scopeOption };

      setStage(2);
      const takeoffRes = await fetch('/api/takeoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: signData.uploadId,
          storageKey: signData.storageKey,
          fileType: ext,
          scopeDirective,
        }),
      });
      setStage(3);
      const takeoffData = await parseJsonResponse<TakeoffResult>(takeoffRes);
      if (!takeoffRes.ok || isApiError(takeoffData)) {
        setError(isApiError(takeoffData) ? takeoffData.error : 'AI processing failed.');
        setState('failed');
        return;
      }
      setResult(takeoffData);
      const { items: itemsWithDefaults, prefilled } = applyStandardDefaults(takeoffData.items ?? []);
      setItems(itemsWithDefaults);
      setPrefilledFields(prefilled);
      setPanelWidthUserSelected(itemsWithDefaults.map(() => false));
      setState(takeoffData.items?.length === 0 ? 'failed' : 'results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      setState('failed');
    }
  }, [scopeOption, customScopeText]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const updateItem = <K extends keyof TakeoffItem>(index: number, field: K, value: TakeoffItem[K]) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    // A manual edit means this field (or, if the profile type itself
    // changed, every default computed for the old profile type) is no
    // longer "AFS standard default" — the estimator's number now, not ours.
    setPrefilledFields(prev => prev.map((fields, i) => {
      if (i !== index) return fields;
      if (field === 'profileType') return new Set();
      const next = new Set(fields);
      next.delete(field as unknown as PrefillableField);
      return next;
    }));
    // Changing profile type away from a roof panel (or to a different one)
    // invalidates any prior panel-width selection for this row.
    if (field === 'profileType') {
      setPanelWidthUserSelected(prev => prev.map((selected, i) => (i === index ? false : selected)));
    }
  };

  // Sets a roof panel row's width from the estimator's own selection
  // (STANDARD_PANEL_WIDTHS) and derives quantity from the AI's
  // calculatedAreaSqFt — the only place a roof panel item's quantity gets
  // filled in when the drawing itself didn't specify a width.
  const handlePanelWidthSelect = (index: number, widthIn: number) => {
    const item = items[index];
    updateItem(index, 'width', widthIn);
    updateItem(index, 'quantity', item.calculatedAreaSqFt != null ? calculatePanelQuantity(item.calculatedAreaSqFt, widthIn) : null);
    setPanelWidthUserSelected(prev => prev.map((selected, i) => (i === index ? true : selected)));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
    setPrefilledFields(prev => prev.filter((_, i) => i !== index));
    setPanelWidthUserSelected(prev => prev.filter((_, i) => i !== index));
  };

  const submitQuoteRequest = useCallback(async (email?: string) => {
    setSubmitError(null);
    setState('submitting');
    try {
      const res = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, isRush: false, guestEmail: email }),
      });
      const data = (await res.json()) as QuoteRequestSuccessResponse | QuoteRequestErrorResponse;
      if (!res.ok) {
        setSubmitError('error' in data ? data.error : 'Submission failed. Please try again.');
        setState('results');
        return;
      }
      const success = data as QuoteRequestSuccessResponse;
      setRequestNumber(success.requestNumber);
      setShowEmailCapture(false);
      setState('submitted');
      // Submitted work now lives in quote_requests under the guest email (or
      // account) regardless of this browser — the local draft's job is done.
      clearDraft(uploadId);
    } catch {
      setSubmitError('Submission failed. Please try again.');
      setState('results');
    }
  }, [items, uploadId]);

  const handleSubmitClick = () => {
    if (items.length === 0) {
      setSubmitError('Add at least one item before submitting your request.');
      return;
    }
    const missingQuantityCount = items.filter(item => item.quantity == null).length;
    if (missingQuantityCount > 0) {
      setSubmitError(
        missingQuantityCount === 1
          ? 'Select a panel width for the item missing a quantity before submitting.'
          : `Select a panel width for all ${missingQuantityCount} items missing a quantity before submitting.`
      );
      return;
    }
    if (isAuthenticated) {
      submitQuoteRequest();
    } else {
      setSubmitError(null);
      setShowEmailCapture(true);
    }
  };

  const handleGuestSubmit = () => {
    const trimmed = guestEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setSubmitError('Enter a valid email address.');
      return;
    }
    submitQuoteRequest(trimmed);
  };

  const resetToIdle = () => {
    clearDraft(uploadId);
    setState('idle');
    setResult(null);
    setItems([]);
    setPrefilledFields([]);
    setPanelWidthUserSelected([]);
    setSubmitError(null);
    setShowEmailCapture(false);
    setGuestEmail('');
    setRequestNumber(null);
    setUploadId(null);
    setSaveStatus('idle');
  };

  const stages = [
    'Reading your drawing...',
    'Identifying flashing profiles...',
    'Calculating quantities...',
    'Building your specification...',
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--afs-bg-base)', padding: '64px 32px 32px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p style={{ fontFamily: 'var(--font-barlow)', fontSize: '11px', letterSpacing: '4px', textTransform: 'uppercase', color: 'var(--afs-crimson)', marginBottom: '12px' }}>
            BLUEPRINT TAKEOFF AI
          </p>
          <h1 style={{ fontFamily: 'var(--font-bebas)', fontSize: '72px', lineHeight: 1, color: 'var(--afs-chrome-high)', marginBottom: '16px' }}>
            UPLOAD YOUR DRAWING
          </h1>
          <p style={{ fontFamily: 'var(--font-inter)', fontSize: '16px', color: 'var(--afs-chrome-mid)', maxWidth: '520px', margin: '0 auto' }}>
            Upload a construction drawing and our AI extracts every flashing profile, dimension, and quantity automatically.
          </p>
        </div>

        {/* SCOPE DIRECTIVE */}
        {state === 'idle' && (
          <div style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '8px', padding: '24px', marginBottom: '24px' }}>
            <label htmlFor="scope-directive-select" style={{ fontFamily: 'var(--font-barlow)', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--afs-chrome-mid)', display: 'block', marginBottom: '10px' }}>
              Takeoff Scope
            </label>
            <select
              id="scope-directive-select"
              data-testid="scope-directive-select"
              value={scopeOption}
              onChange={(e) => setScopeOption(e.target.value as ScopeOption)}
              required
              style={{
                width: '100%',
                maxWidth: '420px',
                backgroundColor: 'var(--afs-bg-base)',
                border: '1px solid var(--afs-chrome-dim)',
                borderRadius: '6px',
                padding: '10px 12px',
                color: 'var(--afs-chrome-high)',
                fontFamily: 'var(--font-inter)',
                fontSize: '14px',
                outline: 'none',
              }}
            >
              {SCOPE_DIRECTIVE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {scopeOption === 'custom' && (
              <div style={{ marginTop: '12px' }}>
                <textarea
                  data-testid="scope-directive-custom-text"
                  value={customScopeText}
                  onChange={(e) => setCustomScopeText(e.target.value.slice(0, CUSTOM_SCOPE_MAX_LENGTH))}
                  maxLength={CUSTOM_SCOPE_MAX_LENGTH}
                  required
                  placeholder="e.g. Only the north and east parapet details on sheet A3.1"
                  rows={3}
                  style={{
                    width: '100%',
                    maxWidth: '520px',
                    backgroundColor: 'var(--afs-bg-base)',
                    border: '1px solid var(--afs-chrome-dim)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    color: 'var(--afs-chrome-high)',
                    fontFamily: 'var(--font-inter)',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: 'var(--afs-chrome-dim)', marginTop: '4px' }}>
                  {customScopeText.length}/{CUSTOM_SCOPE_MAX_LENGTH}
                </p>
              </div>
            )}
          </div>
        )}

        {/* IDLE */}
        {state === 'idle' && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => document.getElementById('file-input')?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--afs-crimson)' : 'var(--afs-chrome-dim)'}`,
              borderRadius: '8px',
              padding: '80px 40px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: dragOver ? 'var(--afs-crimson-ghost)' : 'var(--afs-bg-raised)',
              transition: 'all 0.2s',
            }}
          >
            <input
              id="file-input"
              type="file"
              style={{ display: 'none' }}
              accept=".dwg,.dxf,.pdf,.png,.jpg,.jpeg,.tiff,.tif,.webp"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <svg style={{ width: '56px', height: '56px', margin: '0 auto 24px', color: 'var(--afs-chrome-base)', display: 'block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '24px', color: 'var(--afs-chrome-high)', marginBottom: '8px' }}>
              Drop your drawing here
            </p>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'var(--afs-chrome-base)', marginBottom: '32px' }}>
              or click to browse
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
              {['DWG', 'DXF', 'PDF', 'PNG', 'JPG', 'TIFF'].map(f => (
                <span key={f} style={{
                  fontFamily: 'var(--font-jetbrains)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--afs-chrome-high)',
                  backgroundColor: 'var(--afs-bg-overlay)',
                  border: '1px solid var(--afs-chrome-dim)',
                  borderRadius: '4px',
                  padding: '6px 12px',
                }}>
                  {f}
                </span>
              ))}
            </div>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'var(--afs-chrome-dim)' }}>
              Maximum 50MB
            </p>
          </div>
        )}

        {/* UPLOADING */}
        {state === 'uploading' && (
          <div style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '8px', padding: '48px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-barlow)', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--afs-chrome-mid)', marginBottom: '24px' }}>
              Uploading {filename}...
            </p>
            <div style={{ backgroundColor: 'var(--afs-bg-base)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: 'var(--afs-crimson)', height: '100%', width: '66%', borderRadius: '4px', animation: 'pulse 2s infinite' }} />
            </div>
          </div>
        )}

        {/* PROCESSING */}
        {state === 'processing' && (
          <div style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '8px', padding: '48px', maxWidth: '520px', margin: '0 auto' }}>
            <p style={{ fontFamily: 'var(--font-barlow)', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--afs-chrome-mid)', marginBottom: '32px', textAlign: 'center' }}>
              AI Processing — {filename}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {stages.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: i <= stage ? 'var(--afs-crimson)' : 'transparent',
                    border: i <= stage ? 'none' : '1px solid var(--afs-bg-overlay)',
                  }} />
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: i <= stage ? 'var(--afs-chrome-high)' : 'var(--afs-chrome-dim)' }}>
                    {s}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'var(--afs-chrome-dim)', textAlign: 'center', marginTop: '32px' }}>
              Usually takes 30–90 seconds. Do not close this tab.
            </p>
          </div>
        )}

        {/* RESULTS */}
        {(state === 'results' || state === 'submitting') && result && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '32px', color: 'var(--afs-chrome-high)', marginBottom: '4px' }}>
                  Extraction Results
                </h2>
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'var(--afs-chrome-base)' }}>
                  {items.length} items identified from {filename}
                </p>
                {saveStatus !== 'idle' && (
                  <p style={{
                    fontFamily: 'var(--font-inter)',
                    fontSize: '11px',
                    marginTop: '4px',
                    color: saveStatus === 'saved' ? 'var(--afs-success)' : saveStatus === 'error' ? 'var(--afs-crimson)' : 'var(--afs-chrome-dim)',
                  }}>
                    {saveStatus === 'saving' && 'Saving...'}
                    {saveStatus === 'saved' && 'Saved'}
                    {saveStatus === 'error' && 'Save failed — your edits are still kept in this browser.'}
                  </p>
                )}
              </div>
              <span style={{
                fontFamily: 'var(--font-barlow)',
                fontSize: '11px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: '4px',
                border: `1px solid ${result.overallConfidence === 'high' ? 'var(--afs-success)' : result.overallConfidence === 'medium' ? 'var(--afs-warning)' : 'var(--afs-crimson)'}`,
                color: result.overallConfidence === 'high' ? 'var(--afs-success)' : result.overallConfidence === 'medium' ? 'var(--afs-warning)' : 'var(--afs-crimson)',
              }}>
                {result.overallConfidence.toUpperCase()} CONFIDENCE
              </span>
            </div>

            {result.processingNotes && (
              <div style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '6px', padding: '16px', marginBottom: '24px' }}>
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'var(--afs-chrome-mid)' }}>{result.processingNotes}</p>
              </div>
            )}

            {prefilledFields.some(f => f.size > 0) && (
              <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'var(--afs-chrome-dim)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <DefaultBadge /> AFS standard default — this drawing didn&apos;t specify that field, so it was pre-filled with AFS&apos;s standard value for this profile. Edit any value before submitting.
              </p>
            )}

            <div style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--afs-bg-surface)' }}>
                    {['#', 'Profile', 'Material', 'Gauge', 'Dimensions', 'Length (ft)', 'Qty', 'Confidence', ''].map(h => (
                      <th key={h} style={{ fontFamily: 'var(--font-barlow)', fontSize: '11px', color: 'var(--afs-chrome-base)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--afs-bg-overlay)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const gaugeChoices = item.material ? GAUGES_BY_MATERIAL[item.material] ?? [] : [];
                    return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--afs-bg-surface)', borderLeft: item.confidence === 'low' ? '3px solid var(--afs-warning)' : '3px solid transparent' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--afs-chrome-dim)', fontFamily: 'var(--font-jetbrains)' }}>{i + 1}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <select value={item.profileType} disabled={state === 'submitting'} onChange={(e) => updateItem(i, 'profileType', e.target.value)}
                            style={{ background: 'transparent', border: '1px solid var(--afs-bg-overlay)', borderRadius: '4px', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-inter)', fontSize: '13px', width: '100%', outline: 'none', padding: '4px' }}>
                            {selectOptions(item.profileType, TAKEOFF_PROFILE_TYPES).map(opt => (
                              <option key={opt} value={opt}>{opt === '' ? '— Select —' : opt}</option>
                            ))}
                          </select>
                          <button onClick={() => setViewingIndex(i)} type="button"
                            style={{ background: 'none', border: '1px solid var(--afs-chrome-dim)', borderRadius: '4px', color: 'var(--afs-chrome-mid)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-barlow)', padding: '3px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            View 3D
                          </button>
                        </div>
                        {item.aiNote && <p style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: 'var(--afs-chrome-dim)', marginTop: '2px' }}>{item.aiNote}</p>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <select value={item.material ?? ''} disabled={state === 'submitting'} onChange={(e) => updateItem(i, 'material', e.target.value === '' ? null : e.target.value)}
                            style={{ background: 'transparent', border: '1px solid var(--afs-bg-overlay)', borderRadius: '4px', color: 'var(--afs-chrome-mid)', fontFamily: 'var(--font-inter)', fontSize: '13px', width: '100%', outline: 'none', padding: '4px' }}>
                            {selectOptions(item.material, ALL_MATERIALS).map(opt => (
                              <option key={opt} value={opt}>{opt === '' ? '— None —' : opt}</option>
                            ))}
                          </select>
                          {prefilledFields[i]?.has('material') && <DefaultBadge />}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <select value={item.gauge ?? ''} disabled={state === 'submitting' || !item.material} onChange={(e) => updateItem(i, 'gauge', e.target.value === '' ? null : e.target.value)}
                            style={{ background: 'transparent', border: '1px solid var(--afs-bg-overlay)', borderRadius: '4px', color: 'var(--afs-chrome-mid)', fontFamily: 'var(--font-jetbrains)', fontSize: '12px', width: '90px', outline: 'none', padding: '4px' }}>
                            {selectOptions(item.gauge, gaugeChoices).map(opt => (
                              <option key={opt} value={opt}>{opt === '' ? '— None —' : opt}</option>
                            ))}
                          </select>
                          {prefilledFields[i]?.has('gauge') && <DefaultBadge />}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {isRoofPanelItem(item) && item.width == null ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '170px' }}>
                            <span style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: 'var(--afs-chrome-dim)' }}>
                              Area: {item.calculatedAreaSqFt != null ? `${item.calculatedAreaSqFt.toLocaleString()} sq ft` : 'not calculated'}
                            </span>
                            <select
                              value=""
                              disabled={state === 'submitting' || item.calculatedAreaSqFt == null}
                              onChange={(e) => { if (e.target.value) handlePanelWidthSelect(i, parseFloat(e.target.value)); }}
                              style={{ background: 'transparent', border: '1px solid var(--afs-bg-overlay)', borderRadius: '4px', color: 'var(--afs-chrome-mid)', fontFamily: 'var(--font-inter)', fontSize: '12px', outline: 'none', padding: '4px' }}
                            >
                              <option value="">Select panel width…</option>
                              <optgroup label="Common">
                                {STANDARD_PANEL_WIDTHS.filter(w => w.commonality === 'common').map(w => (
                                  <option key={w.widthIn} value={w.widthIn}>{w.widthIn}&quot;</option>
                                ))}
                              </optgroup>
                              <optgroup label="Less Common">
                                {STANDARD_PANEL_WIDTHS.filter(w => w.commonality === 'less-common').map(w => (
                                  <option key={w.widthIn} value={w.widthIn}>{w.widthIn}&quot;</option>
                                ))}
                              </optgroup>
                            </select>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {DIMENSION_FIELDS.map(dim => (
                              <label key={dim.key} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ fontFamily: 'var(--font-barlow)', fontSize: '10px', color: 'var(--afs-chrome-dim)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  {dim.label}
                                  {prefilledFields[i]?.has(dim.key) && <DefaultBadge />}
                                </span>
                                <input type="number" step="0.125" value={item[dim.key] ?? ''} disabled={state === 'submitting'}
                                  onChange={(e) => updateItem(i, dim.key, e.target.value === '' ? null : parseFloat(e.target.value))}
                                  style={{ background: 'transparent', border: '1px solid var(--afs-bg-overlay)', borderRadius: '3px', color: 'var(--afs-chrome-mid)', fontFamily: 'var(--font-jetbrains)', fontSize: '12px', width: '46px', outline: 'none', padding: '2px 4px' }} />
                              </label>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <input type="number" value={item.lengthFt} disabled={state === 'submitting'} onChange={(e) => updateItem(i, 'lengthFt', parseFloat(e.target.value))}
                          style={{ background: 'transparent', border: 'none', color: 'var(--afs-chrome-mid)', fontFamily: 'var(--font-jetbrains)', fontSize: '13px', width: '60px', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <input type="number" value={item.quantity ?? ''} disabled={state === 'submitting'}
                            onChange={(e) => updateItem(i, 'quantity', e.target.value === '' ? null : parseInt(e.target.value))}
                            style={{ background: 'transparent', border: 'none', color: 'var(--afs-chrome-mid)', fontFamily: 'var(--font-jetbrains)', fontSize: '13px', width: '50px', outline: 'none' }} />
                          {panelWidthUserSelected[i] && <UserSelectedBadge />}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontFamily: 'var(--font-barlow)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
                          padding: '2px 8px', borderRadius: '3px',
                          border: `1px solid ${item.confidence === 'high' ? 'var(--afs-success)' : item.confidence === 'medium' ? 'var(--afs-warning)' : 'var(--afs-crimson)'}`,
                          color: item.confidence === 'high' ? 'var(--afs-success)' : item.confidence === 'medium' ? 'var(--afs-warning)' : 'var(--afs-crimson)',
                        }}>
                          {item.confidence}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => removeItem(i)} disabled={state === 'submitting'}
                          style={{ background: 'none', border: 'none', color: 'var(--afs-chrome-dim)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-inter)' }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {submitError && (
              <div style={{ backgroundColor: 'var(--afs-crimson-ghost)', border: '1px solid var(--afs-crimson)', borderRadius: '6px', padding: '14px 16px', marginBottom: '16px' }}>
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'var(--afs-crimson-hover)' }}>{submitError}</p>
              </div>
            )}

            {showEmailCapture && (
              <div style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '8px', padding: '20px', marginBottom: '16px', maxWidth: '480px' }}>
                <p style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '18px', color: 'var(--afs-chrome-high)', marginBottom: '6px' }}>
                  Enter your email to submit
                </p>
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'var(--afs-chrome-base)', marginBottom: '14px' }}>
                  We&apos;ll send your quote request confirmation to this address.
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="you@company.com"
                    style={{ flex: 1, minWidth: '200px', backgroundColor: 'var(--afs-bg-base)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '6px', padding: '10px 12px', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-inter)', fontSize: '14px', outline: 'none' }}
                  />
                  <button onClick={handleGuestSubmit} disabled={state === 'submitting'}
                    style={{ backgroundColor: 'var(--afs-crimson)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                    Submit
                  </button>
                  <button onClick={() => setShowEmailCapture(false)} disabled={state === 'submitting'}
                    style={{ backgroundColor: 'transparent', color: 'var(--afs-chrome-base)', fontFamily: 'var(--font-barlow)', fontSize: '14px', padding: '10px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <button onClick={handleSubmitClick} disabled={state === 'submitting'}
                style={{ backgroundColor: state === 'submitting' ? 'var(--afs-crimson-dim)' : 'var(--afs-crimson)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '14px 32px', borderRadius: '6px', border: 'none', cursor: state === 'submitting' ? 'default' : 'pointer', letterSpacing: '1px' }}>
                {state === 'submitting' ? 'Submitting...' : 'Submit Quote Request'}
              </button>
              <button onClick={() => navigateAwayFromDraft(resetToIdle)} disabled={state === 'submitting'}
                style={{ backgroundColor: 'var(--afs-bg-overlay)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '14px 24px', borderRadius: '6px', border: '1px solid var(--afs-chrome-dim)', cursor: 'pointer' }}>
                Start Over
              </button>
              <a href="/quote"
                onClick={(e) => {
                  if (!hasGuestOnlyWork) return;
                  e.preventDefault();
                  navigateAwayFromDraft(() => { window.location.href = '/quote'; });
                }}
                style={{ backgroundColor: 'var(--afs-bg-overlay)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '14px 24px', borderRadius: '6px', border: '1px solid var(--afs-chrome-dim)', textDecoration: 'none', display: 'inline-block' }}>
                Build Quote Manually
              </a>
            </div>
          </div>
        )}

        {/* SUBMITTED */}
        {state === 'submitted' && requestNumber && (
          <div style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '8px', padding: '48px', maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--afs-crimson-ghost)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <svg style={{ width: '28px', height: '28px', color: 'var(--afs-crimson)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '28px', color: 'var(--afs-chrome-high)', marginBottom: '12px' }}>
              Quote Request Submitted
            </h2>
            <p style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '20px', color: 'var(--afs-crimson)', marginBottom: '16px' }}>
              {requestNumber}
            </p>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'var(--afs-chrome-mid)', marginBottom: '32px' }}>
              AFS will review your specifications and deliver a formal quote to your account. You&apos;ll receive an email when it&apos;s ready.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/account/quotes"
                style={{ backgroundColor: 'var(--afs-crimson)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '14px 28px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block' }}>
                View Your Requests
              </a>
              <button onClick={resetToIdle}
                style={{ backgroundColor: 'var(--afs-bg-overlay)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '14px 24px', borderRadius: '6px', border: '1px solid var(--afs-chrome-dim)', cursor: 'pointer' }}>
                Start Over
              </button>
            </div>
          </div>
        )}

        {/* FAILED */}
        {state === 'failed' && (
          <div style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-crimson)', borderRadius: '8px', padding: '40px', maxWidth: '520px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '24px', color: 'var(--afs-chrome-high)', marginBottom: '8px' }}>Upload Failed</h2>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'var(--afs-chrome-mid)', marginBottom: '24px' }}>{error ?? 'Something went wrong.'}</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setState('idle'); setError(null); }}
                style={{ backgroundColor: 'var(--afs-crimson)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '12px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                Try Again
              </button>
              <a href="/quote"
                style={{ backgroundColor: 'var(--afs-bg-overlay)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '12px 24px', borderRadius: '6px', border: '1px solid var(--afs-chrome-dim)', textDecoration: 'none', display: 'inline-block' }}>
                Build Quote Manually
              </a>
            </div>
          </div>
        )}

      </div>

      {viewingIndex !== null && items[viewingIndex] && (
        <div
          onClick={() => setViewingIndex(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '8px', width: '800px', maxWidth: '100%', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--afs-bg-overlay)' }}>
              <h3 style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '20px', color: 'var(--afs-chrome-high)' }}>
                {items[viewingIndex].profileType || 'Custom Profile'}
              </h3>
              <button onClick={() => setViewingIndex(null)} type="button"
                style={{ background: 'none', border: 'none', color: 'var(--afs-chrome-dim)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '4px' }}>
                ×
              </button>
            </div>
            {(() => {
              const item = items[viewingIndex];
              const { bends, blankWidthMm } = buildBendsFromItem(item, canonicalProfiles);
              return (
                <ProfileViewer3D
                  bends={bends}
                  blankWidth={blankWidthMm}
                  material={item.material || 'Galvanized Steel'}
                  gauge={item.gauge || '24 ga'}
                  thicknessMm={gaugeToThicknessMm(item.gauge)}
                  profileName={item.profileType || 'Custom Profile'}
                  className="w-full h-[600px]"
                />
              );
            })()}
          </div>
        </div>
      )}

      {showGuestNudge && (
        <div
          onClick={() => setShowGuestNudge(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '8px', padding: '28px', maxWidth: '440px', width: '100%' }}
          >
            <h3 style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '22px', color: 'var(--afs-chrome-high)', marginBottom: '10px' }}>
              Keep this takeoff?
            </h3>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'var(--afs-chrome-mid)', marginBottom: '20px' }}>
              You&apos;re not signed in, so this in-progress takeoff only lives in this browser. Create a free account to keep access to it from anywhere.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a href="/register"
                style={{ backgroundColor: 'var(--afs-crimson)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '13px', padding: '10px 18px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block' }}>
                Create Account
              </a>
              <button
                onClick={() => {
                  setShowGuestNudge(false);
                  const action = pendingNavigationRef.current;
                  pendingNavigationRef.current = null;
                  action?.();
                }}
                style={{ backgroundColor: 'var(--afs-bg-overlay)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '13px', padding: '10px 16px', borderRadius: '6px', border: '1px solid var(--afs-chrome-dim)', cursor: 'pointer' }}>
                Continue Without Account
              </button>
              <button onClick={() => setShowGuestNudge(false)}
                style={{ backgroundColor: 'transparent', color: 'var(--afs-chrome-base)', fontFamily: 'var(--font-barlow)', fontSize: '13px', padding: '10px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
