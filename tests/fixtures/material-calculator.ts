/**
 * AUTO MATERIAL CALCULATOR — versioned test fixtures.
 *
 * Explicit, hand-written rows. Nothing here is random and nothing here is
 * generated, so a failure names a value a human can read off the page and
 * recompute by hand.
 *
 * THESE ARE NOT SEED DATA AND MUST NEVER BECOME SEED DATA. `products`,
 * `accessories` and `product_accessories` are empty in the real database and are
 * blocked on CLAUDE.md's data-blocker checklist #17 — the real accessory names,
 * units, SKUs and calc_rates have to come from Steve. The names below are
 * deliberately generic ("Butyl Tape", "Hex Screws") and the rates are round test
 * numbers chosen to exercise rounding boundaries, not to claim what AFS actually
 * supplies at what rate.
 *
 * FIXTURE VERSION 1 — 2026-10-03. Bump the version and say what changed if a row
 * is edited, because several tests assert exact computed quantities derived from
 * these rates.
 */

import type {
  CalculatorProductCandidate,
  ProductAccessory,
} from '@/lib/material-calculator';

export const MATERIAL_CALCULATOR_FIXTURE_VERSION = 1;

/** Deterministic, sortable ids. Not UUIDs — these never reach a database. */
const ID = {
  butylTape: 'acc-0001-butyl-tape',
  hexScrews: 'acc-0002-hex-screws',
  terminationBar: 'acc-0003-termination-bar',
  touchUpPaint: 'acc-0004-touch-up-paint',
  slipSheet: 'acc-0005-slip-sheet',
  cleatClips: 'acc-0006-cleat-clips',
} as const;

/** per_lf, required: one roll per 20 LF. 110 LF -> ceil(5.5) = 6. */
export const FIXTURE_ACCESSORY_PER_LF_REQUIRED: ProductAccessory = {
  accessoryId: ID.butylTape,
  accessoryName: 'Butyl Tape',
  sku: 'AFS-BT-20',
  unit: 'rolls',
  calcMethod: 'per_lf',
  calcRate: 20,
  isRequired: true,
};

/** per_piece, required: 2.5 per piece. 3 pieces -> ceil(7.5) = 8 (config A-03). */
export const FIXTURE_ACCESSORY_PER_PIECE_REQUIRED: ProductAccessory = {
  accessoryId: ID.hexScrews,
  accessoryName: 'Hex Screws',
  sku: 'AFS-HS-14',
  unit: 'boxes',
  calcMethod: 'per_piece',
  calcRate: 2.5,
  isRequired: true,
};

/** fixed, optional: exactly 2, never scaled and never rounded. */
export const FIXTURE_ACCESSORY_FIXED_OPTIONAL: ProductAccessory = {
  accessoryId: ID.terminationBar,
  accessoryName: 'Termination Bar',
  sku: null,
  unit: 'EA',
  calcMethod: 'fixed',
  calcRate: 2,
  isRequired: false,
};

/** per_sqft, optional: always uncalculable (config A-04). */
export const FIXTURE_ACCESSORY_PER_SQFT_OPTIONAL: ProductAccessory = {
  accessoryId: ID.touchUpPaint,
  accessoryName: 'Touch-Up Paint',
  sku: 'AFS-TUP-1',
  unit: 'cans',
  calcMethod: 'per_sqft',
  calcRate: 250,
  isRequired: false,
};

/** per_lf with a stored 0 rate — division by zero, so uncalculable. */
export const FIXTURE_ACCESSORY_ZERO_RATE_PER_LF: ProductAccessory = {
  accessoryId: ID.slipSheet,
  accessoryName: 'Slip Sheet',
  sku: null,
  unit: 'rolls',
  calcMethod: 'per_lf',
  calcRate: 0,
  isRequired: true,
};

/** per_piece with a stored 0 rate — a real answer of "none needed". */
export const FIXTURE_ACCESSORY_ZERO_RATE_PER_PIECE: ProductAccessory = {
  accessoryId: ID.cleatClips,
  accessoryName: 'Cleat Clips',
  sku: 'AFS-CC-1',
  unit: 'EA',
  calcMethod: 'per_piece',
  calcRate: 0,
  isRequired: false,
};

/** One of each supported method plus the two refusals. */
export const FIXTURE_ACCESSORY_SET: readonly ProductAccessory[] = [
  FIXTURE_ACCESSORY_PER_LF_REQUIRED,
  FIXTURE_ACCESSORY_PER_PIECE_REQUIRED,
  FIXTURE_ACCESSORY_FIXED_OPTIONAL,
  FIXTURE_ACCESSORY_PER_SQFT_OPTIONAL,
];

/**
 * Product candidates for resolve-product. Two Drip Edge / Galvalume rows
 * differing only by gauge, so ambiguity and gauge narrowing are both reachable.
 */
export const FIXTURE_PRODUCT_DRIP_EDGE_24GA: CalculatorProductCandidate = {
  productId: 'prd-0001',
  profileName: 'Drip Edge',
  profileSlug: 'drip-edge',
  materialName: 'Galvalume',
  gaugeLabel: '24 ga',
};

export const FIXTURE_PRODUCT_DRIP_EDGE_26GA: CalculatorProductCandidate = {
  productId: 'prd-0002',
  profileName: 'Drip Edge',
  profileSlug: 'drip-edge',
  materialName: 'Galvalume',
  gaugeLabel: '26 ga',
};

/** Same profile and material, no gauge at all — the gauge-agnostic case. */
export const FIXTURE_PRODUCT_DRIP_EDGE_NO_GAUGE: CalculatorProductCandidate = {
  productId: 'prd-0003',
  profileName: 'Drip Edge',
  profileSlug: 'drip-edge',
  materialName: 'Galvalume',
  gaugeLabel: null,
};

/** A different profile, so a profile mismatch is reachable. */
export const FIXTURE_PRODUCT_COPING_CAP_COPPER: CalculatorProductCandidate = {
  productId: 'prd-0004',
  profileName: 'Coping Cap',
  profileSlug: 'coping-cap',
  materialName: 'Copper',
  gaugeLabel: '16 oz',
};

/**
 * Material spelled the LEGACY way. migration 026 renamed Galvanized Galvalume to
 * Galvalume and lib/data/catalog.ts's LEGACY_MATERIAL_ALIASES still resolves it,
 * so a stored row carrying the old spelling must still match.
 */
export const FIXTURE_PRODUCT_LEGACY_MATERIAL_SPELLING: CalculatorProductCandidate = {
  productId: 'prd-0005',
  profileName: 'Gravel Stop',
  profileSlug: 'gravel-stop',
  materialName: 'Galvanized Galvalume',
  gaugeLabel: null,
};
