/**
 * Seeds canonical_profiles (006_canonical_profiles.sql) with 25 hand-crafted
 * flashing profiles. Unlike the old imported machine profile library
 * (removed in Command Center V2 prompt v2-01 — its geometry came out of the
 * old Thalmann's job-history database and was only ever approximately
 * reconstructed into a polyline at read time, see lib/flashdraft/geometry.ts),
 * these profiles are defined here as an explicit turtle-graphics walk and their exact
 * resulting points are computed once, at seed time, and stored as-is. There
 * is no reconstruction step downstream — `points` in the database IS the
 * final geometry.
 *
 * Turtle-graphics algorithm (matches DESIGN spec exactly):
 *   - Start at (0, 0) facing RIGHT (heading 0deg).
 *   - Each move walks `length` in the current heading, then turns by `turn`
 *     degrees (turn applies to every move AFTER it, not the move itself).
 *   - Positive turn = counterclockwise = UP in SVG (y decreases).
 *   - Negative turn = clockwise = DOWN in SVG (y increases).
 *   - dx = cos(headingDeg * PI/180) * length
 *   - dy = -sin(headingDeg * PI/180) * length (negated — SVG y increases
 *     downward, the opposite of standard math convention)
 *
 * `bends` is derived from the same move list (one entry per turn, pairing
 * the leg before and after it), so `points` and `bends` can never drift out
 * of sync with each other — both are read off a single source of truth per
 * profile.
 *
 * Run: pnpm tsx scripts/seed-canonical-profiles.ts
 */

import { readFileSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';

// supabase-js always constructs a Realtime client, which requires a global
// WebSocket implementation. Node 22+ has one natively; this script targets
// whatever Node the repo's package.json/CI actually pins (20 here), so
// polyfill it via the `ws` package rather than bumping the whole project's
// Node version just for this one standalone script.
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;
}

loadEnvLocal();

function loadEnvLocal(): void {
  try {
    const envPath = path.resolve(__dirname, '../.env.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local not found — assume env vars are already set (e.g. CI)
  }
}

interface Move {
  length: number;
  turn?: number; // degrees to turn AFTER this move; + = UP (CCW), - = DOWN (CW)
}

interface Point {
  x: number;
  y: number;
}

interface Bend {
  leftLegIn: number;
  rightLegIn: number;
  angleDegrees: number;
  direction: 'up' | 'down';
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function turtlePoints(moves: Move[]): Point[] {
  let heading = 0;
  let x = 0;
  let y = 0;
  const points: Point[] = [{ x: round(x), y: round(y) }];
  for (const move of moves) {
    const rad = (heading * Math.PI) / 180;
    x += Math.cos(rad) * move.length;
    y += -Math.sin(rad) * move.length;
    points.push({ x: round(x), y: round(y) });
    heading += move.turn ?? 0;
  }
  return points;
}

function turtleBends(moves: Move[]): Bend[] {
  const bends: Bend[] = [];
  for (let i = 0; i < moves.length - 1; i++) {
    const turn = moves[i].turn ?? 0;
    bends.push({
      leftLegIn: moves[i].length,
      rightLegIn: moves[i + 1].length,
      angleDegrees: Math.abs(turn),
      direction: turn >= 0 ? 'up' : 'down',
    });
  }
  return bends;
}

interface ProfileSpec {
  name: string;
  slug: string;
  category: string;
  description: string;
  blankWidthIn: number;
  tags: string[];
  moves: Move[];
}

const PROFILES: ProfileSpec[] = [
  // Coping Caps & Cleats
  {
    name: 'Standard Coping Cap',
    slug: 'standard-coping-cap',
    category: 'Coping Caps & Cleats',
    description: 'Standard flat coping cap for parapet walls',
    blankWidthIn: 12,
    tags: ['coping', 'parapet', 'standard'],
    moves: [{ length: 2, turn: 90 }, { length: 8, turn: -90 }, { length: 2 }],
  },
  {
    name: 'Tapered Coping Cap',
    slug: 'tapered-coping-cap',
    category: 'Coping Caps & Cleats',
    description: 'Tapered coping cap with sloped top surface for water drainage',
    blankWidthIn: 14,
    tags: ['coping', 'parapet', 'tapered'],
    moves: [
      { length: 3, turn: 90 },
      { length: 1, turn: 45 },
      { length: 6, turn: -45 },
      { length: 1, turn: -90 },
      { length: 3 },
    ],
  },
  {
    name: 'Coping Cap with Drip Edge',
    slug: 'coping-cap-drip-edge',
    category: 'Coping Caps & Cleats',
    description: 'Coping cap with integrated drip edges on both sides',
    blankWidthIn: 15,
    tags: ['coping', 'parapet', 'drip-edge'],
    moves: [
      { length: 1, turn: -90 },
      { length: 0.5, turn: 90 },
      { length: 2, turn: 90 },
      { length: 8, turn: -90 },
      { length: 2, turn: -90 },
      { length: 0.5, turn: 90 },
      { length: 1 },
    ],
  },
  // Drip Edge & Gravel Stop
  {
    name: 'Standard Drip Edge',
    slug: 'standard-drip-edge',
    category: 'Drip Edge & Gravel Stop',
    description: 'Standard eave drip edge',
    blankWidthIn: 6.25,
    tags: ['drip-edge', 'eave', 'roofing'],
    moves: [{ length: 4, turn: -90 }, { length: 1.5, turn: 45 }, { length: 0.75 }],
  },
  {
    name: 'Hemmed Drip Edge',
    slug: 'hemmed-drip-edge',
    category: 'Drip Edge & Gravel Stop',
    description: 'Drip edge with hemmed back edge',
    blankWidthIn: 5.875,
    tags: ['drip-edge', 'hemmed', 'roofing'],
    moves: [{ length: 4, turn: -90 }, { length: 1.5, turn: 180 }, { length: 0.375 }],
  },
  {
    name: 'Gravel Stop',
    slug: 'gravel-stop',
    category: 'Drip Edge & Gravel Stop',
    description: 'Gravel stop for built-up roofing systems',
    blankWidthIn: 8.5,
    tags: ['gravel-stop', 'roofing', 'BUR'],
    moves: [{ length: 4, turn: 90 }, { length: 4, turn: -45 }, { length: 0.5 }],
  },
  {
    name: 'Raised Gravel Stop',
    slug: 'raised-gravel-stop',
    category: 'Drip Edge & Gravel Stop',
    description: 'Tall gravel stop for deep gravel ballast',
    blankWidthIn: 10.5,
    tags: ['gravel-stop', 'roofing'],
    moves: [{ length: 4, turn: 90 }, { length: 6, turn: -45 }, { length: 0.5 }],
  },
  // Base & Counter Flashing
  {
    name: 'L-Shape Base Flashing',
    slug: 'l-shape-base-flashing',
    category: 'Base & Counter Flashing',
    description: 'Simple L-shape base flashing for wall-to-roof transitions',
    blankWidthIn: 14,
    tags: ['base-flashing', 'L-shape', 'standard'],
    moves: [{ length: 6, turn: 90 }, { length: 8 }],
  },
  {
    name: 'Z-Shape Base Flashing',
    slug: 'z-shape-base-flashing',
    category: 'Base & Counter Flashing',
    description: 'Z-shape base flashing for step-down transitions',
    blankWidthIn: 13,
    tags: ['base-flashing', 'Z-shape', 'step'],
    moves: [{ length: 4, turn: 90 }, { length: 3, turn: -90 }, { length: 6 }],
  },
  {
    name: 'Stepped Base Flashing',
    slug: 'stepped-base-flashing',
    category: 'Base & Counter Flashing',
    description: 'Stepped base flashing for staircase roof transitions',
    blankWidthIn: 13,
    tags: ['base-flashing', 'stepped', 'staircase'],
    moves: [
      { length: 3, turn: 90 },
      { length: 2, turn: -90 },
      { length: 3, turn: 90 },
      { length: 2, turn: -90 },
      { length: 3 },
    ],
  },
  {
    name: 'Counter Flashing',
    slug: 'counter-flashing',
    category: 'Base & Counter Flashing',
    description: 'Counter flashing that laps over base flashing',
    blankWidthIn: 5.5,
    tags: ['counter-flashing', 'reglet'],
    moves: [{ length: 1, turn: -90 }, { length: 4, turn: 45 }, { length: 0.5 }],
  },
  {
    name: 'Two-Piece Counter Flashing',
    slug: 'two-piece-counter-flashing',
    category: 'Base & Counter Flashing',
    description: 'Two-piece counter flashing with built-in reglet',
    blankWidthIn: 7.25,
    tags: ['counter-flashing', 'two-piece'],
    moves: [
      { length: 0.75, turn: -90 },
      { length: 0.5, turn: 90 },
      { length: 1.5, turn: -90 },
      { length: 4, turn: 45 },
      { length: 0.5 },
    ],
  },
  // Fascia & Rake
  {
    name: 'Standard Fascia',
    slug: 'standard-fascia',
    category: 'Fascia & Rake',
    description: 'Standard architectural fascia panel',
    blankWidthIn: 7.5,
    tags: ['fascia', 'eave', 'standard'],
    moves: [{ length: 6, turn: 90 }, { length: 1, turn: -180 }, { length: 0.5 }],
  },
  {
    name: 'Fascia with Drip',
    slug: 'fascia-with-drip',
    category: 'Fascia & Rake',
    description: 'Fascia with integrated top drip edge',
    blankWidthIn: 8.75,
    tags: ['fascia', 'drip', 'eave'],
    moves: [
      { length: 0.75, turn: -90 },
      { length: 0.5, turn: 90 },
      { length: 6, turn: 90 },
      { length: 1, turn: -180 },
      { length: 0.5 },
    ],
  },
  {
    name: 'Rake Fascia',
    slug: 'rake-fascia',
    category: 'Fascia & Rake',
    description: 'Rake fascia for gable end termination',
    blankWidthIn: 7,
    tags: ['fascia', 'rake', 'gable'],
    moves: [{ length: 4, turn: 90 }, { length: 1, turn: -90 }, { length: 0.5, turn: -90 }, { length: 1.5 }],
  },
  // Valley Flashing
  {
    name: 'Open Valley Flashing',
    slug: 'open-valley-flashing',
    category: 'Valley Flashing',
    description: 'Open valley flashing — one half shown, mirror for full valley',
    blankWidthIn: 9.5,
    tags: ['valley', 'roofing', 'open'],
    moves: [{ length: 8, turn: 90 }, { length: 1, turn: -180 }, { length: 0.5 }],
  },
  {
    name: 'Closed Valley Flashing',
    slug: 'closed-valley-flashing',
    category: 'Valley Flashing',
    description: 'W-shape closed valley flashing',
    blankWidthIn: 18,
    tags: ['valley', 'roofing', 'closed', 'W-valley'],
    moves: [{ length: 6, turn: 135 }, { length: 6, turn: -135 }, { length: 6 }],
  },
  // Gutters & Scuppers
  {
    name: 'Box Gutter',
    slug: 'box-gutter',
    category: 'Gutters & Scuppers',
    description: 'Built-in box gutter profile',
    blankWidthIn: 20,
    tags: ['gutter', 'box', 'built-in'],
    moves: [
      { length: 2, turn: 90 },
      { length: 4, turn: -90 },
      { length: 8, turn: -90 },
      { length: 4, turn: 90 },
      { length: 2 },
    ],
  },
  {
    name: 'Scupper Opening',
    slug: 'scupper-opening',
    category: 'Gutters & Scuppers',
    description: 'Through-wall scupper opening flashing',
    blankWidthIn: 12,
    tags: ['scupper', 'drainage', 'parapet'],
    moves: [
      { length: 1, turn: 90 },
      { length: 3, turn: -90 },
      { length: 4, turn: -90 },
      { length: 3, turn: 90 },
      { length: 1 },
    ],
  },
  {
    name: 'Conductor Head',
    slug: 'conductor-head',
    category: 'Gutters & Scuppers',
    description: 'Conductor head / leader head for downspout connection',
    blankWidthIn: 15,
    tags: ['conductor-head', 'leader-head', 'drainage'],
    moves: [
      { length: 0.5, turn: 90 },
      { length: 4, turn: -90 },
      { length: 6, turn: -90 },
      { length: 4, turn: 90 },
      { length: 0.5 },
    ],
  },
  // Window & Door Flashing
  {
    name: 'Window Sill Pan',
    slug: 'window-sill-pan',
    category: 'Window & Door Flashing',
    description: 'Window sill pan flashing',
    blankWidthIn: 10,
    tags: ['window', 'sill', 'pan'],
    moves: [
      { length: 1, turn: 90 },
      { length: 1, turn: -90 },
      { length: 6, turn: -90 },
      { length: 1, turn: 90 },
      { length: 1 },
    ],
  },
  {
    name: 'Head Flashing',
    slug: 'head-flashing',
    category: 'Window & Door Flashing',
    description: 'Window and door head flashing',
    blankWidthIn: 5.5,
    tags: ['head-flashing', 'window', 'door'],
    moves: [{ length: 4, turn: -90 }, { length: 1, turn: 45 }, { length: 0.5 }],
  },
  {
    name: 'Door Threshold Pan',
    slug: 'door-threshold-pan',
    category: 'Window & Door Flashing',
    description: 'Door threshold pan flashing',
    blankWidthIn: 9,
    tags: ['door', 'threshold', 'pan'],
    moves: [
      { length: 1.5, turn: 90 },
      { length: 1, turn: -90 },
      { length: 4, turn: -90 },
      { length: 1, turn: 90 },
      { length: 1.5 },
    ],
  },
  // Expansion Joints
  {
    name: 'Expansion Joint Cover',
    slug: 'expansion-joint-cover',
    category: 'Expansion Joints',
    description: 'Expansion joint cover — W-shape with standing legs',
    blankWidthIn: 13,
    tags: ['expansion-joint', 'cover'],
    moves: [
      { length: 2, turn: 90 },
      { length: 1, turn: -90 },
      { length: 1, turn: -90 },
      { length: 2, turn: 90 },
      { length: 1, turn: 90 },
      { length: 2, turn: -90 },
      { length: 1, turn: -90 },
      { length: 1, turn: 90 },
      { length: 2 },
    ],
  },
  // Standing Seam
  {
    // Spec-vs-geometry discrepancy resolved per explicit user decision: the
    // spec listed blank_width_in as 3.5, but the leg lengths below
    // (0.75+1.5+0.5+1.5+0.75) sum to 5.0 — every other profile in this file
    // has legs summing exactly to its stated blank_width_in, so 5.0 (matching
    // the geometry) was chosen over the literal spec value.
    name: 'Standing Seam Cap',
    slug: 'standing-seam-cap',
    category: 'Standing Seam',
    description: 'Standing seam panel cap detail',
    blankWidthIn: 5.0,
    tags: ['standing-seam', 'roofing', 'cap'],
    moves: [
      { length: 0.75, turn: 90 },
      { length: 1.5, turn: -90 },
      { length: 0.5, turn: -90 },
      { length: 1.5, turn: 90 },
      { length: 0.75 },
    ],
  },
];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set (.env.local).');
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rows = PROFILES.map((spec, index) => ({
    name: spec.name,
    slug: spec.slug,
    category: spec.category,
    description: spec.description,
    blank_width_in: spec.blankWidthIn,
    points: turtlePoints(spec.moves),
    bends: turtleBends(spec.moves),
    tags: spec.tags,
    is_active: true,
    sort_order: index + 1,
  }));

  console.log(`Seeding ${rows.length} canonical profiles...`);
  const { data, error } = await supabase
    .from('canonical_profiles')
    .upsert(rows, { onConflict: 'slug' })
    .select('id, slug');

  if (error) {
    throw new Error(`Insert failed: ${error.message}`);
  }

  console.log(`Inserted/updated ${data?.length ?? 0} canonical profiles:`);
  for (const row of data ?? []) {
    console.log(`  - ${row.slug}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
