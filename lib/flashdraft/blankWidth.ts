import { gaugeToThicknessMm } from '@/lib/utils/gauge-thickness';
import type { ProfileGeometry } from './types';

// K-factor (neutral-axis position within the bend) by material category —
// a visual/quoting estimate, not a fabrication-precise bend-deduction
// calculation (mirrors the existing hemAllowanceIn estimate elsewhere in
// FlashDraft).
const K_FACTOR_BY_CATEGORY: Record<string, number> = {
  galvanized: 0.415,
  copper: 0.35,
  aluminum: 0.4,
  stainless: 0.3,
  zinc: 0.38,
  default: 0.33,
};

// Material category classification mirrors the regex pattern ProfileViewer3D
// already uses to pick metal appearance by material name (MATERIAL_APPEARANCE)
// — same catalog string set, same classification approach. Painted/vintage
// steel substrates fold into the steel (galvanized) K-factor.
const MATERIAL_CATEGORY_PATTERNS: { test: RegExp; category: string }[] = [
  { test: /galvani[sz]ed|galvalume/i, category: 'galvanized' },
  { test: /kynar|painted|vintage/i, category: 'galvanized' },
  { test: /copper/i, category: 'copper' },
  { test: /aluminu?m/i, category: 'aluminum' },
  { test: /stainless/i, category: 'stainless' },
  { test: /zinc/i, category: 'zinc' },
];

export function materialCategoryFromCatalog(materialId: string | null): string {
  if (!materialId) return 'default';
  const match = MATERIAL_CATEGORY_PATTERNS.find((m) => m.test.test(materialId));
  return match?.category ?? 'default';
}

// Literal gauge -> thickness table per spec. The catalog (lib/data/catalog.ts
// GAUGES_BY_MATERIAL) also has entries this table doesn't cover (0.063"
// aluminum, zinc mm gauges) — those fall back to the shared
// gaugeToThicknessMm parser rather than silently defaulting to 24ga steel.
const GAUGE_THICKNESS_IN: Record<string, number> = {
  '26ga': 0.0179,
  '24ga': 0.0239,
  '22ga': 0.0299,
  '20ga': 0.0359,
  '18ga': 0.0478,
  '16ga': 0.0598,
  '20oz': 0.0278,
  '16oz': 0.0216,
  '0.032al': 0.032,
  '0.040al': 0.04,
  '0.050al': 0.05,
};
const DEFAULT_GAUGE_THICKNESS_IN = 0.0239;

function normalizeGaugeKey(gaugeId: string | null): string | null {
  if (!gaugeId) return null;
  const trimmed = gaugeId.trim().toLowerCase().replace(/\s+/g, '');
  const gaMatch = trimmed.match(/^(\d+)ga$/);
  if (gaMatch) return `${gaMatch[1]}ga`;
  const ozMatch = trimmed.match(/^(\d+)oz$/);
  if (ozMatch) return `${ozMatch[1]}oz`;
  const alMatch = trimmed.match(/^(0\.\d+)"?$/);
  if (alMatch) return `${alMatch[1]}al`;
  return null;
}

export function gaugeThicknessInFromCatalog(gaugeId: string | null): number {
  const key = normalizeGaugeKey(gaugeId);
  if (key && GAUGE_THICKNESS_IN[key] !== undefined) return GAUGE_THICKNESS_IN[key];
  if (gaugeId) return gaugeToThicknessMm(gaugeId) / 25.4;
  return DEFAULT_GAUGE_THICKNESS_IN;
}

function bendAllowanceIn(angleDegrees: number, radiusIn: number, kFactor: number, thicknessIn: number): number {
  return (Math.PI / 180) * Math.abs(angleDegrees) * (radiusIn + kFactor * thicknessIn);
}

export function computeBlankWidth(geometry: ProfileGeometry, materialId: string | null, gaugeId: string | null): number {
  const kFactor = K_FACTOR_BY_CATEGORY[materialCategoryFromCatalog(materialId)] ?? K_FACTOR_BY_CATEGORY.default;
  const thicknessIn = gaugeThicknessInFromCatalog(gaugeId);

  let width = 0;
  for (const leg of geometry.legs) width += leg.lengthIn;
  for (const hem of geometry.hems) width += hem.lengthIn;
  for (const bend of geometry.bendPoints) width += bendAllowanceIn(bend.angleDegrees, bend.radiusIn, kFactor, thicknessIn);
  return width;
}
