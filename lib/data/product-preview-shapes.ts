/**
 * TRACED cross-sections, one per Drexel rendering.
 *
 * Every shape below was read off the END FACE of the product's own rendering
 * (public/images/products/<id>): each bend vertex was located in image pixels,
 * mapped through the rendering's axonometric projection
 * (P_img = origin + x*u + y*v) back to flat section coordinates, and then
 * verified by projecting the polyline forward onto the rendering and checking
 * it sits on the sheet edge. No ProfileType template is involved.
 *
 * WHAT THESE ARE NOT: measurements. No Drexel rendering prints a dimension, so
 * only the PROPORTIONS are real. Coordinates are normalised so the longest side
 * of each shape is 6.0 nominal inches; that scale is arbitrary, is never
 * displayed, and must never be quoted. The viewer is mounted with dimensions
 * hidden. Because the shape is not a fabrication drawing, products listed here
 * offer Request a Quote only and are never handed to FlashDraft (see
 * lib/data/products-page.ts).
 *
 * Coordinates: inches (nominal), y-down, first point at the origin - the same
 * frame as `profilePointsFor`, so bends flow through `bendsFromPoints` and
 * `signedInteriorAngleDeg` (CLAUDE.md rule #12).
 *
 * `confidence` is the tracer's own reading: high / medium / low. `note` states
 * what was traced and what was not (clips, adjoining panels and other separate
 * parts are not part of the traced sheet).
 *
 * Untraceable (no shape, deliberately): see UNTRACED_PRODUCTS.
 *
 * GENERATED from afs-overnight/trace/result/*.json by trace/gen_ts.py.
 */
import type { ProfilePoint } from '@/lib/data/product-geometry';

export type TraceConfidence = 'high' | 'medium' | 'low';

export interface ProductPreviewShape {
  /** Always true: traced from a picture, never measured. */
  schematic: true;
  confidence: TraceConfidence;
  /** Cross-section polyline, nominal inches, y-down. */
  points: ProfilePoint[];
  /** Segment indices (0 = first leg) that are perforated in the rendering. */
  perforatedSegments?: number[];
  /** What the rendering showed and what was left out. */
  note: string;
}

export const PRODUCT_PREVIEW_SHAPES: Readonly<Record<string, ProductPreviewShape>> = {
  'econo-coping-lt': {
    schematic: true,
    confidence: 'medium',
    note: "Units = image px. Blue coping cap end face only (galvanized continuous cleat is a separate part, not traced). Segments: 0-1 top/cover (left end is the render's cutaway edge at x=308, NOT a real free end - the other half of the coping, i.e. opposite leg, is not shown; profile is presumably symmetric but not visible), 1-2 vertical face leg, 2-3 outward kick/drip, 3-4 small hem turned back under (closed hem ~10px). Top assumed level (end-face top edge slope matches substrate front edge).",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 5.703, y: 0.0 },
      { x: 5.728, y: 3.198 },
      { x: 6.0, y: 3.607 },
      { x: 5.918, y: 3.665 },
    ],
  },
  'econo-coping': {
    schematic: true,
    confidence: 'medium',
    note: "Units = image px. Traced the rear (fully visible) blue coping section; the rendering shows two identical coping sections at a lap/splice joint (front section stepped forward, plus a grey splice plate between). Galvanized continuous cleat is a separate part, not traced. Segments: 0-1 top cover (left end x=302 is the render's cutaway edge, not a real free end; the opposite leg is not shown), 1-2 vertical face leg, 2-3 outward kick/drip, 3-4 small closed hem turned back under. Top treated as level.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 5.656, y: 0.0 },
      { x: 5.664, y: 3.108 },
      { x: 6.0, y: 3.615 },
      { x: 5.928, y: 3.655 },
    ],
  },
  'econo-gravel-stop': {
    schematic: true,
    confidence: 'high',
    note: "Units = image px along the end face. u taken from the flange front edge, which matches the slope of the substrate (wood) front-face top edge (~0.11-0.13); v vertical (front-face vertical edges are vertical). Segments: 0-1 horizontal roof flange (fastened, free end at 0), 1-2 inclined rise (~45 deg) up to the raised gravel-stop ridge, 2-3 vertical exterior face, 3-4 outward kick/drip, 4-5 small closed hem turned back under. Galvanized cleat is a separate part, not traced.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 1.673, y: 0.0 },
      { x: 2.373, y: -0.696 },
      { x: 2.398, y: 4.809 },
      { x: 2.619, y: 5.257 },
      { x: 2.543, y: 5.304 },
    ],
  },
  'fascia-extender-w-offset': {
    schematic: true,
    confidence: 'high',
    note: "Units = image px. u from substrate (wood) front-face top-edge slope (~0.115), v vertical. Segments: 0-1 upper nailing/attachment leg (fastened to fascia, free top end at 0), 1-2 small outward joggle offset (~6.5 px out, ~1/3 the hem size), 2-3 main vertical face, 3-4 outward kick/drip, 4-5 small closed hem turned back under. Galvanized cleat (continuous cleat engaging the hem) is a separate part, not traced.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.0, y: 1.054 },
      { x: 0.075, y: 1.161 },
      { x: 0.075, y: 5.287 },
      { x: 0.51, y: 5.952 },
      { x: 0.406, y: 6.0 },
    ],
  },
  'fascia-extender': {
    schematic: true,
    confidence: 'high',
    note: "Units = image px. u from substrate (wood) front-face top-edge slope (~0.115), v vertical. Segments: 0-1 flat vertical face (top end is the free nailing edge, face-fastened; no offset, no top hem), 1-2 outward kick/drip, 2-3 small closed hem turned back under (engages the galvanized continuous cleat, which is a separate part, not traced).",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.0, y: 5.286 },
      { x: 0.441, y: 5.952 },
      { x: 0.337, y: 6.0 },
    ],
  },
  'gravel-stop': {
    schematic: true,
    confidence: 'medium',
    note: "Units = image px. MULTI-PIECE ASSEMBLY: the rendering shows (front to back cuts) a galvanized gravel-stop base (roof flange fastened to deck -> ~45 deg incline up -> vertical leg down the fascia -> outward kick, no hem), a black membrane strip-in over its vertical leg, and TWO lapped sections of the blue fascia cover (front one cut at x~748, rear one at x~827). Traced = the rear blue fascia cover section (fully visible incl. hem). u assumed from the cover's own top-return edge (treated as level; substrate edges give 0.05-0.11, so the top return may be slightly pitched - uncertain). Segments: 0-1 short inward/downward lip at the inner end of the top return (~15 px, ~45 deg; its tip merges with the membrane/front piece so exact end is uncertain), 1-2 horizontal top return over the gravel stop, 2-3 vertical face, 3-4 outward kick/drip, 4-5 small closed hem turned back under. The galvanized base piece is NOT traced here; if 'gravel-stop' means the base, it needs a separate trace.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.081, y: -0.096 },
      { x: 0.691, y: -0.096 },
      { x: 0.699, y: 5.241 },
      { x: 1.137, y: 5.856 },
      { x: 1.048, y: 5.904 },
    ],
  },
  'secure-lok-fascia': {
    schematic: true,
    confidence: 'medium',
    note: "Axonometric with mild perspective: section-vertical = image vertical; section-horizontal slopes ~0.125 down-right (wood front-face top edge and the cover's short level top both slope this way); depth axis slope ~-0.55. Foreshortening of u solved from the two axis angles (|u|/|v|~0.94). Units = source px along vertical. Traced sheet = the blue fascia COVER only: rear free end kicked down/back -> rear bend -> rear apex -> long sloped top rising to the face -> short level top -> front corner -> tall vertical face (~670) -> outward/down kick at bottom -> small open return hem (bottom hem receives the cleat's sloped lower flange). Not traced (separate pieces in the section): (1) interior Secure-Lok clip: free end -> 180-degree hem at top -> sloped leg under cover top -> bend -> rising leg -> short down leg (~110) hugging inside of face; (2) galvanized continuous cleat: fastened horizontal flange, sloped leg, vertical leg, sloped bottom flange hooked into cover hem. Uncertain: bottom return length/angle (+/-3px), centreline +/-2px on a ~4px band, foreshortening approximate due to perspective.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.203, y: -0.197 },
      { x: -0.035, y: -0.442 },
      { x: 0.82, y: -1.4 },
      { x: 1.182, y: -1.401 },
      { x: 1.191, y: 4.127 },
      { x: 1.385, y: 4.599 },
      { x: 1.305, y: 4.55 },
    ],
  },
  'snap-coping-max': {
    schematic: true,
    confidence: 'low',
    note: "Axonometric with mild perspective: section-vertical = image vertical; section-horizontal slopes 0.126 (wood face top edge and the coping top edge agree, so the top is FLAT in section, not pitched); |u|/|v|~0.94 from axis angles. Units = source px. Traced = blue coping cover: back (roof-side) leg -> back top corner -> flat top (~770) -> front top corner -> front vertical face (~552) -> outward/down kick -> short return hem that engages the galvanized cleat's sloped lower flange. PROBLEM: the back leg is only visible for ~100 units below the top; below that it is occluded by the protruding galvanized hat-cleat flange, so the back leg's true length and any back-side hem/kick are NOT readable - point 0 is the last visible point, not a confirmed free end. Not traced: galvanized snap cleat (fastened flanges either side of a raised trapezoidal hat in the middle, plus a vertical leg down the outside face ending in a sloped kick flange). Bottom return length +/-3px.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.004, y: -0.752 },
      { x: 5.837, y: -0.751 },
      { x: 5.845, y: 3.438 },
      { x: 6.0, y: 3.867 },
      { x: 5.919, y: 3.831 },
    ],
  },
  'dmc-gutter-lt-1': {
    schematic: true,
    confidence: 'medium',
    note: "Box gutter end face at the near (lower-left) end. Axonometric with noticeable perspective: section-horizontal slopes 0.24 (top) to 0.28 (bottom) in image, verticals converge slightly (back wall leans +14px, front edge -7px over ~500px); single affine frame uses slope 0.265 and |u|/|v|~0.94 from axis angles, so the flat bottom plots with ~1 deg residual tilt and heights are good to ~2%. Units = source px. Shape from roof end: horizontal roof/back flange (~150) lapping onto deck (fastened, under membrane) -> back top corner -> tall back wall (~516) -> flat bottom (~484) -> front wall (~470, lower than back by ~50) -> front top corner -> inward horizontal top return (~70) -> angled stiffening leg down and back toward the face, open free edge (~30). Front lip is an open folded stiffener, not a closed hem. Not traced: stainless hanger straps and fasteners. Wood/brick face lies in a different plane and was not used for the frame.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 1.365, y: -0.027 },
      { x: 1.515, y: 4.674 },
      { x: 5.92, y: 4.744 },
      { x: 6.0, y: 0.443 },
      { x: 5.368, y: 0.449 },
      { x: 5.538, y: 0.663 },
    ],
  },
  'rib-mechanically-seamed-flat-panel': {
    schematic: true,
    confidence: 'medium',
    note: "Units = image px along section. 0: free end of left (female) leg's outward return lip, hanging down; 0-1 downturned lip (~26); 1-2 outward top return (~34); 2-3 left vertical leg (~110); 3-4 flat pan; 4-5 right vertical leg (~95); 5-6 short inward top return (~14). Right leg reads shorter than left (95 vs 110 px) - may be partly perspective foreshortening (right end is farther); real proportions not certain. Pan flat, no striations.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.007, y: -0.19 },
      { x: 0.255, y: -0.19 },
      { x: 0.255, y: 0.613 },
      { x: 5.993, y: 0.613 },
      { x: 6.0, y: -0.08 },
      { x: 5.898, y: -0.073 },
    ],
  },
  'rib-mechanically-seamed-striations': {
    schematic: true,
    confidence: 'medium',
    note: "Units = image px along section. 0-1 downturned lip at free end of left (female) leg; 1-2 outward top return (~34); 2-3 left vertical leg (~107); 3-12 pan with two shallow trapezoidal recessed striations (each ~9 deep, flat bottom ~65 wide, sloped sides ~60 wide), measured by automated edge scan of the front end-face bottom edge; 12-13 right vertical leg (~92); 13-14 short inward top return (~15). Right leg reads shorter than left; possibly partly perspective. Striation depth small relative to thickness rendering, hence medium.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.007, y: -0.189 },
      { x: 0.255, y: -0.175 },
      { x: 0.255, y: 0.604 },
      { x: 1.558, y: 0.604 },
      { x: 1.981, y: 0.67 },
      { x: 2.468, y: 0.67 },
      { x: 2.927, y: 0.604 },
      { x: 3.51, y: 0.604 },
      { x: 3.932, y: 0.67 },
      { x: 4.405, y: 0.67 },
      { x: 4.82, y: 0.604 },
      { x: 5.993, y: 0.604 },
      { x: 6.0, y: -0.066 },
      { x: 5.891, y: -0.066 },
    ],
  },
  'rib-snap-lock-striations': {
    schematic: true,
    confidence: 'medium',
    note: "Units = image px along section. Left = female snap-lock leg: 0-1-2 small hook/catch at bottom of outer leg (free end hooks inward/up), 2-3 outer leg down (~90), 3-4 top of rib (~29 wide), 4-5 inner vertical leg (~130) down to pan. Pan 5-14 with two shallow trapezoidal recessed striations (~9 deep), measured by automated edge scan. Right = male leg: 14-15 vertical leg (~112), 15-16 180-degree hem folded back down on the inside, 16-17 hemmed return running down the leg, 17-18 kicked-out foot angling inward to free end. Hook at 0-2 is tiny (~15 px) so its exact curl shape is approximate.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.015, y: -0.117 },
      { x: -0.073, y: -0.125 },
      { x: -0.073, y: -0.785 },
      { x: 0.139, y: -0.756 },
      { x: 0.139, y: 0.198 },
      { x: 1.445, y: 0.198 },
      { x: 1.87, y: 0.264 },
      { x: 2.369, y: 0.264 },
      { x: 2.809, y: 0.198 },
      { x: 3.433, y: 0.198 },
      { x: 3.858, y: 0.264 },
      { x: 4.32, y: 0.264 },
      { x: 4.702, y: 0.198 },
      { x: 5.919, y: 0.198 },
      { x: 5.927, y: -0.623 },
      { x: 5.89, y: -0.616 },
      { x: 5.883, y: -0.315 },
      { x: 5.802, y: -0.154 },
    ],
  },
  'rib-snap-lock-flat': {
    schematic: true,
    confidence: 'medium',
    note: "Units = image px along section. Left = female snap-lock leg: 0-1-2 small hook/catch at bottom of outer leg, 2-3 outer leg (~89), 3-4 rib top (~30), 4-5 inner vertical leg (~131) to pan. 5-6 flat pan (edge scan confirms no striations). Right = male leg: 6-7 vertical leg (~115), 7-8 180-degree hem folded back down inside, 8-9 hem return down the leg, 9-10 kicked-out foot angling inward to free end. Tiny hook 0-2 approximate. Same section as rib-snap-lock-striations minus the striations.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.022, y: -0.117 },
      { x: -0.073, y: -0.139 },
      { x: -0.073, y: -0.791 },
      { x: 0.147, y: -0.762 },
      { x: 0.147, y: 0.198 },
      { x: 5.919, y: 0.198 },
      { x: 5.927, y: -0.645 },
      { x: 5.897, y: -0.63 },
      { x: 5.875, y: -0.322 },
      { x: 5.802, y: -0.161 },
    ],
  },
  'trim-drip-edge': {
    schematic: true,
    confidence: 'medium',
    note: "Isolated part on black background; near (right) end face read. Verticals are vertical; the only in-section horizontal reference is the flange end edge itself (slope -0.318, same on far end), so the flange is ASSUMED horizontal (90-degree flange-to-face bend); |u|/|v|~0.885 solved from flange-edge and length-axis angles under that assumption. Units = source px. Shape: kick free end -> outward kick (~38 long, ~31 deg off vertical, away from the flange side) -> vertical face (~304) -> 90-degree corner -> horizontal deck flange (~234) to free edge. The paired lines at both free edges are the rendered sheet-thickness outline (same ~4px width as the face band), NOT hems - no hems present. Uncertain: flange could be at roof pitch rather than level (not determinable from an isolated part); kick angle +/-3 deg.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.357, y: -0.58 },
      { x: 0.4, y: -5.993 },
      { x: 4.556, y: -6.0 },
    ],
  },
  'j-channel': {
    schematic: true,
    confidence: 'medium',
    note: "Isolated part on black background, small in frame (~110px tall face), near (right) end read. Verticals vertical; section-horizontal slope ~-0.335 (bottom-flange end edge -0.344, top-return end edge -0.29 - mild perspective); |u|/|v|~0.91 from axis angles. Units = source px. Shape: wide flat leg/nailing flange (~190, free edge, no hem; the large grey area is the TOP SURFACE of this flange seen from above, its far free edge running along the length) -> 90-degree corner -> vertical face (~107) -> 90-degree corner -> short return (~65) -> 180-degree closed hem folded back underneath (~25). Hem layer offset (~3 units) is at thickness scale and only approximately resolved. Read as a J-channel lying on its long leg; orientation in service may differ.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: -6.0, y: 0.044 },
      { x: -6.0, y: -3.344 },
      { x: -3.939, y: -3.296 },
      { x: -4.711, y: -3.185 },
    ],
  },
  'perforated-z-closure': {
    schematic: true,
    confidence: 'medium',
    note: "Isolated part on black background, small in frame; near (lower-right) end read. Verticals vertical; section-horizontal slope -0.33 (top-flange end edge -0.335, bottom-flange end edge -0.315); |u|/|v|~0.905 from axis angles (same camera as j-channel). Units = source px. Shape: wide top flange (~180, perforated with staggered rows of elongated slots - perforations are along the length, not part of the section) -> 90-degree bend -> vertical web (~98) -> 90-degree bend -> short bottom flange (~63) pointing the opposite way = Z. Both free edges plain, no hems or returns visible. Small part: bend positions +/-2px.",
    perforatedSegments: [0],
    points: [
      { x: 0.0, y: 0.0 },
      { x: 4.449, y: -0.02 },
      { x: 4.449, y: 2.397 },
      { x: 6.0, y: 2.419 },
    ],
  },
  'ridge-cap': {
    schematic: true,
    confidence: 'medium',
    note: "Near end face (lower-right end of the length). Units = image px along profile X. u direction from eave-to-eave line on the end face; v magnitude (1.118 x |u|) derived from orthographic-projection constraint using the three observed axis directions (section X, section vertical = image vertical walls, length direction (269,137)). Segments: 0-1 left flange kicked down/outward ~22 deg below horizontal; 1-2 left vertical wall; 2-3 left roof slope up to peak; 3-4 right roof slope; 4-5 right vertical wall; 5-6 right flange kicked down/outward. No hems visible at flange tips (only sheet-thickness double line). Right wall reads ~6 px shorter than left and peak sits ~6 units right of centre: either slight real asymmetry or read error; profile is probably nominally symmetric. Absolute scale not evident.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.535, y: -0.216 },
      { x: 0.535, y: -0.924 },
      { x: 3.092, y: -1.92 },
      { x: 5.533, y: -0.916 },
      { x: 5.533, y: -0.257 },
      { x: 6.0, y: -0.032 },
    ],
  },
  'ridge-trim': {
    schematic: true,
    confidence: 'medium',
    note: "Near end face (lower-right end). Units = image px along profile X. Shape: shallow inverted-V ridge trim, ~23 deg legs (rise 63 over half-span 302), with a closed/flat hem folded UNDER at each free edge (hem length ~44 units, ~7% of span; the open slot of the hem is visible on the left end face). Segments: 0-1 left under-hem return, 1-2 left leg up to ridge, 2-3 right leg, 3-4 right under-hem return. Section vertical axis inferred from assuming the profile is symmetric about the ridge (tip-to-tip line = horizontal; ridge above its midpoint); v magnitude from orthographic constraint with length direction (268,138) taken from the ridge line. Pitch is sensitive to that axis assumption (a few degrees). Hem thickness gap drawn ~1.3 units under the main sheet (the sheet thickness). Absolute scale not evident.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: -0.432, y: 0.077 },
      { x: 2.567, y: -0.55 },
      { x: 5.568, y: 0.073 },
      { x: 5.096, y: -0.006 },
    ],
  },
  't-style-drip-edge': {
    schematic: true,
    confidence: 'medium',
    note: "Near end face (lower-right end). Units = image px along profile X. Sequence from deck-flange free edge: 0-1 horizontal roof-deck flange (~305 units); 1-2-3 open hem fold at the outer (overhang) edge, folded UNDER with a visible gap of ~6-9 units (sheet thickness + air gap); 3-4 hem return running back under the deck ~60 units; 4-5 vertical fascia/face leg dropping from the end of the hem return (forms the T: deck overhangs the face by ~64 units); 5-6 drip kick angled down and OUTWARD (toward -X, the overhang/hem side, away from the fascia line; ~28 deg off vertical), ending at the free drip edge. Assumptions: deck flange = section horizontal and face leg = section vertical (image-vertical); v magnitude from orthographic constraint with length direction (270,135). Hem gap/taper is at the limit of pixel resolution (few px). Absolute scale not evident.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: -5.927, y: -0.093 },
      { x: -6.0, y: -0.027 },
      { x: -5.927, y: 0.082 },
      { x: -4.748, y: 0.168 },
      { x: -4.748, y: 1.31 },
      { x: -5.019, y: 1.816 },
    ],
  },
  'trims-offset-cleat': {
    schematic: true,
    confidence: 'medium',
    note: "Near end face (lower-right end); far end traced independently and agrees within ~3 units (averaged). Units = image px along profile X. Shape: flat offset cleat - lower flange 0-1 (~69), angled offset ramp 1-2 (~34 across, ~13.6 up, ~22 deg), upper flange 2-3 (~68), both flanges parallel. No hems or returns visible at either free edge (sheet edge shows as single thin line). Assumption: flanges horizontal in section and section-vertical projects to image vertical (as on the other renders from this set); v magnitude from orthographic constraint with length direction (267,139.5). The ramp angle depends on that vertical assumption; if the offset were truly vertical the image would show it as an edge-on line, which it is not (the offset face is visibly wide), so a sloped ramp is supported by the rendering. Absolute scale not evident.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 2.425, y: 0.0 },
      { x: 3.628, y: -0.477 },
      { x: 6.0, y: -0.477 },
    ],
  },
  'trims-reglet': {
    schematic: true,
    confidence: 'medium',
    note: "Near end face (lower-right end); far end gives the same face height (129 vs 131.5 px) and kick. Units = image px along profile X. Shape: 0-1 horizontal top leg (~69) that inserts back into the reglet (toward +X, away from viewer); 1-2 vertical face (~118); 2-3 bottom kick angled down and OUTWARD (toward -X, ~33 deg off vertical, ~31 long). No hem, hook or return visible at the top-leg tip on the near end face (single sheet-thickness V); the far-end tip area shows a bright highlight a few px above the silhouette that could be an edge highlight or a very small upturn - not resolvable, so not traced. Assumptions: face leg = section vertical (image vertical), top leg treated as section horizontal (direction measured, it reads horizontal within 0.2 units given vertical axis); v magnitude from orthographic constraint with length direction (273,135). Absolute scale not evident.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: -2.865, y: 0.007 },
      { x: -2.865, y: 4.924 },
      { x: -3.553, y: 6.0 },
    ],
  },
  'trims-zee': {
    schematic: true,
    confidence: 'high',
    note: "Near end face (lower-right end); far end edges give the same length vector (269.5,136) from both the top-flange tip and web top. Units = image px along profile X. Shape: plain Z - 0-1 top flange (~60) pointing -X, 1-2 vertical web (~116), 2-3 bottom flange (~58) pointing +X; flanges parallel and square to the web. No hems, kicks or returns visible on any free edge. Assumptions: web = section vertical (image vertical); v magnitude from orthographic constraint with measured flange and length directions. Absolute scale not evident.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 3.053, y: 0.033 },
      { x: 3.053, y: 5.953 },
      { x: 6.0, y: 5.935 },
    ],
  },
  'eave-trim-sample-02': {
    schematic: true,
    confidence: 'high',
    note: "Units = image px along section axes (no scale given). 0-1 roof deck flange (free end at back right of end face) running out to nose; 1-2 open 180deg hem at nose (fold gap visible); 2-3 hem return under deck back toward building (~61 units); 3-4 vertical fascia leg; 4-5 kick/drip angled outward-down (toward nose side); 5-6 open 180deg hem returned up inside the kick. Kick angle and both hem gaps read directly from end face; hem return lengths approximate to +/-2px.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: -6.0, y: 0.0 },
      { x: -6.0, y: 0.159 },
      { x: -4.783, y: 0.189 },
      { x: -4.783, y: 1.561 },
      { x: -5.035, y: 2.215 },
      { x: -4.763, y: 1.905 },
    ],
  },
  'gable-sample-02': {
    schematic: true,
    confidence: 'high',
    note: "Units = image px along section axes (no scale given). 0-1 hem return (underside, ~47 units); 1-2 open 180deg hem at free edge of top flange (black gap visible); 2-3 top (roof-side) flange; 3 = 90deg corner; 3-4 tall vertical face leg (~302 units, ~1.45x the top flange); 4-5 kick angled outward (away from top flange side); 5-6 open 180deg hem returned up inside kick. All read directly from the end face.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.837, y: 0.0 },
      { x: 0.837, y: -0.097 },
      { x: -2.883, y: -0.097 },
      { x: -2.883, y: 5.245 },
      { x: -3.157, y: 5.903 },
      { x: -2.864, y: 5.409 },
    ],
  },
  'peak-sample-02': {
    schematic: true,
    confidence: 'medium',
    note: "Units = image px along section axes (no scale). 0-1 hem return under sloped flange (~57 units); 1-2 open 180deg hem at free edge; 2-3 sloped top flange falling ~24deg below horizontal away from the corner (acute ~66deg interior angle with vertical leg); 3-4 vertical leg (~298 units); 4-5 kick angled outward; 5-6 open 180deg hem returned up inside kick. Medium because the section-horizontal axis u cannot be measured on this end face (no horizontal edge); u was taken from gable-sample-02, which shares the identical camera (length-axis direction 273,135 vs 270,131). The ~24deg flange pitch depends on that assumption; all vertices themselves sit on the visible end-face edge.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.906, y: 0.459 },
      { x: 0.923, y: 0.375 },
      { x: -4.503, y: -2.07 },
      { x: -4.503, y: 3.253 },
      { x: -4.857, y: 3.93 },
      { x: -4.541, y: 3.421 },
    ],
  },
  'soffit-j-sample-02': {
    schematic: true,
    confidence: 'high',
    note: "Units = image px along section axes (no scale). Channel open to +x. 0-1 short hem return under top flange (~23 units); 1-2 open 180deg hem at top flange free edge (black gap visible); 2-3 short top flange (~58); 3 = 90deg corner; 3-4 vertical web (~110); 4 = 90deg corner; 4-5 long bottom flange (~171), plain free edge (no hem visible at its end). u measured from bottom flange edge.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.815, y: 0.0 },
      { x: 0.815, y: -0.141 },
      { x: -1.22, y: -0.141 },
      { x: -1.22, y: 3.726 },
      { x: 4.78, y: 3.726 },
    ],
  },
  'valley-sample-02': {
    schematic: true,
    confidence: 'low',
    note: "Open V valley: 0-1 left flange, 1 = single plain fold at valley centre (no crimp, no splash diverter rib, no hems), 1-2 right flange; both free edges plain. Vertex positions (end-face corners 272,605 / 957,583 / 1574,177) are read exactly, so the 3-point topology is certain. BUT the end face has no horizontal or vertical reference edge, so the section axes cannot be measured. u/v were derived by ASSUMING the valley is symmetric (equal flange lengths, fold on the vertical centreline) and an orthographic camera, solving the orthonormality constraint with the length axis (270,137). Result: each flange rises ~15.6deg from horizontal (included angle ~149deg). The render has mild perspective, so that angle is approximate; flange lengths are normalised to 100 units each (no scale). Treat the angle and equal-flange assumption as unverified.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 3.0, y: 0.837 },
      { x: 6.0, y: 0.0 },
    ],
  },
  'vented-ridge-sample-02': {
    schematic: true,
    confidence: 'medium',
    note: "Units = image px along section axes (no scale). Symmetric-ish raised ridge cap: 0-1 left hem return (under foot); 1-2 open 180deg hem at left foot outer edge; 2-3 left foot flange, pitched ~21-23deg (parallel to the roof slope, so it sits on the roof panel); 3-4 left vertical riser wall (~88); 4-5 left roof slope up to apex (~24deg); 5 = ridge apex (plain fold); 5-6 right roof slope (~24.5deg); 6-7 right vertical riser wall (~82); 7-8 right foot flange pitched ~23deg; 8-9 open 180deg hem at right foot outer edge; 9-10 right hem return under foot. u taken as the shared Drexel camera axis (same as gable/soffit-j, where it was measured); it is confirmed here because both feet then come out parallel to their roof slopes. The long bright diagonal on the right of the render is the right wall's bottom fold running along the length (inside view through the open end), NOT part of the section. ~6% left/right asymmetry in slope run and wall height is as-measured and may be mild render perspective; the true part is probably symmetric. Hem return lengths +/-3px.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: -0.391, y: 0.176 },
      { x: -0.41, y: 0.123 },
      { x: 0.136, y: -0.088 },
      { x: 0.136, y: -0.905 },
      { x: 2.712, y: -2.057 },
      { x: 5.121, y: -0.959 },
      { x: 5.132, y: -0.196 },
      { x: 5.59, y: 0.002 },
      { x: 5.58, y: 0.045 },
      { x: 5.248, y: -0.104 },
    ],
  },
};

/** Products whose rendering could not be traced, with the reason. They get no 3D preview. */
export const UNTRACED_PRODUCTS: Readonly<Record<string, string>> = {
  'dmc-150ss-seamed-90': "Not rendered in 3D by decision: roofing panel / seam close-up.",
  'dmc-200s-seamed-180': "Not rendered in 3D by decision: roofing panel / seam close-up.",
  'dmc-200s-seamed-90': "Not rendered in 3D by decision: roofing panel / seam close-up.",
  'dmc-200s': "Not rendered in 3D by decision: roofing panel / seam close-up.",
  'dmc-fwq100-reveal': "Not rendered in 3D by decision: roofing panel / seam close-up.",
  'fastener-flange': "Not rendered in 3D by decision: partial seam close-up, same class as the DMC panels.",
  'snap-lock-wclip': "Rendering is a close-up cutaway of an ASSEMBLED seam, not a single panel: (a) a blue female rib (tall rounded-top rib, left wall ending in an inward hook at bottom ~(920-967,680-753)px), (b) a blue male leg with a 180-degree hemmed top loop (~1075-1110,385-570px) and a lower vertical wall with an in",
};

/** The traced shape for a product id, or null if it has none. */
export function previewShapeFor(productId: string): ProductPreviewShape | null {
  return PRODUCT_PREVIEW_SHAPES[productId] ?? null;
}

/** Every product id that carries a traced preview. */
export function previewedProductIds(): string[] {
  return Object.keys(PRODUCT_PREVIEW_SHAPES);
}
