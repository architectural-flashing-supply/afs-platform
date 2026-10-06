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

export interface PreviewHem {
  type: 'open' | 'smashed' | 'teardrop';
  lengthIn: number;
  gapIn: number;
  foldSide: 'left' | 'right';
}

export interface ProductPreviewShape {
  /** Always true: traced from a picture, never measured. */
  schematic: true;
  confidence: TraceConfidence;
  /** Cross-section polyline, nominal inches, y-down. */
  points: ProfilePoint[];
  /** Segment indices (0 = first leg) that are perforated in the rendering. */
  perforatedSegments?: number[];
  /**
   * Hems at the two free ends, read from the rendering. The polyline ends where the hem
   * STARTS; the hem runs out `lengthIn` to its fold tip and returns (viewer convention).
   * `gapIn` is centreline to centreline. `foldSide`: looking along the polyline toward
   * that free end, the returned tail lies on the left or right of the leg (y-down).
   */
  hemStart?: PreviewHem;
  hemEnd?: PreviewHem;
  /** What the rendering showed and what was left out. */
  note: string;
}

export const PRODUCT_PREVIEW_SHAPES: Readonly<Record<string, ProductPreviewShape>> = {
  'econo-coping-lt': {
    schematic: true,
    confidence: 'high',
    note: "Units/projection identical to result/econo-coping-lt.json. END: kick + OPEN HEM. Old points 3-4 (kick end + short 'closed hem' stub) replaced by the fold tip; tail removed and described in hemEnd. BEND CORRECTIONS (old trace sat on the inner/lower edge of the strip, not its centre): top cover line moved up 4.0 (y 0 -> -4.0); vertical face re-centred and plumb at x=696.33 (old 692..695); kick start bend (695,388) -> (696.33,388.66); kick end (728,437.6) -> fold tip (731.37,440.64). START: render cut-away of the top cover (opposite leg not modelled) - not a real free end. CONVENTIONS: polyline = centreline of the rendered end-face strip; the final point is the hem fold tip = outermost point of the 180-degree fold measured on the kick-leg centreline (outer fold edge minus half the sheet thickness). Hem tail centreline lies parallel to the leg, offset by gap + sheetThickness on foldSide, and runs back returnLength from the tip. 'sheetThickness' (extra field) = measured end-face strip width in profile units. Kick-leg line, thickness, gap and fold edge were measured by sub-pixel luminance profiles (hz_fit.py: leg strip-centre fit residual < 0.2 px); verified on result2/<id>.check.png (9x).",
    hemEnd: { type: 'open', lengthIn: 0.42, gapIn: 0.17, foldSide: 'right' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: 5.945, y: 0.0 },
      { x: 5.945, y: 3.353 },
      { x: 6.0, y: 3.434 },
    ],
  },
  'econo-coping': {
    schematic: true,
    confidence: 'high',
    note: "Units/projection identical to result/econo-coping.json (rear coping section). END: kick + OPEN HEM. Old points 3-4 replaced by the fold tip; tail in hemEnd. BEND CORRECTIONS: top cover line moved up 4.3-5.3 (old line ran in the dark gap under the end-face strip); vertical face re-centred (x 708.5-709.5); kick leg direction corrected by ~3.8 deg (strip-centre fit); kick start bend (709,389) -> (708.5,390.06); kick end (751,452.5) -> fold tip (755.34,455.83). START: render cut-away (opposite leg not modelled) - not a real free end. The front coping section at img ~(945,955) shows the same open hem. CONVENTIONS: polyline = centreline of the rendered end-face strip; the final point is the hem fold tip = outermost point of the 180-degree fold measured on the kick-leg centreline (outer fold edge minus half the sheet thickness). Hem tail centreline lies parallel to the leg, offset by gap + sheetThickness on foldSide, and runs back returnLength from the tip. 'sheetThickness' (extra field) = measured end-face strip width in profile units. Kick-leg line, thickness, gap and fold edge were measured by sub-pixel luminance profiles (hz_fit.py: leg strip-centre fit residual < 0.2 px); verified on result2/<id>.check.png (9x).",
    hemEnd: { type: 'open', lengthIn: 0.42, gapIn: 0.17, foldSide: 'right' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: 5.874, y: 0.008 },
      { x: 5.866, y: 3.274 },
      { x: 6.0, y: 3.462 },
    ],
  },
  'econo-gravel-stop': {
    schematic: true,
    confidence: 'medium',
    note: "Units/projection identical to result/econo-gravel-stop.json. END: the angled kick leg IS real (light-blue angled band visible along the full length) and it terminates in an OPEN HEM that hooks over the galvanized cleat's free edge. Old points 4-5 (kick end + 'closed hem' stub) replaced by the fold tip; tail in hemEnd. UNRESOLVED: the returned tail runs up on the wall side of the cleat kick and is hidden behind the cleat; hemEnd.returnLength (2.7) is ONLY the visible part (a lower bound) - the true return length cannot be read from this rendering. hemEnd.gap is from the visible U (tail outer edge ~14.2 img px from leg centreline) and is consistent with the cleat thickness sitting in the slot; it could not be measured on a clear slot as on the other products. BEND CORRECTIONS: flange line moved down 1.2-2.2; rise and vertical re-centred, so the ridge virtual-sharp moves (251,-73.6) -> (253.33,-81.06) (acute ~45 deg fold; the virtual sharp of the centrelines lies above the visibly rounded apex); flange/rise bend (177,0) -> (178.17,2.19); kick start bend (253.6,508.6) -> (253.93,508.95); kick end (277,556) -> fold tip (278.72,556.92). START (roof-flange edge): plain. CONVENTIONS: polyline = centreline of the rendered end-face strip; the final point is the hem fold tip = outermost point of the 180-degree fold measured on the kick-leg centreline (outer fold edge minus half the sheet thickness). Hem tail centreline lies parallel to the leg, offset by gap + sheetThickness on foldSide, and runs back returnLength from the tip. 'sheetThickness' (extra field) = measured end-face strip width in profile units. Kick-leg line, thickness, gap and fold edge were measured by sub-pixel luminance profiles (hz_fit.py: leg strip-centre fit residual < 0.2 px); verified on result2/<id>.check.png (9x).",
    hemEnd: { type: 'open', lengthIn: 0.42, gapIn: 0.17, foldSide: 'right' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: 1.788, y: 0.01 },
      { x: 2.542, y: -0.825 },
      { x: 2.548, y: 5.092 },
      { x: 2.591, y: 5.175 },
    ],
  },
  'fascia-extender-w-offset': {
    schematic: true,
    confidence: 'high',
    note: "Units/projection identical to result/fascia-extender-w-offset.json. END: kick + OPEN HEM (clear black slot). Old points 4-5 replaced by the fold tip; tail in hemEnd. BEND CORRECTIONS: upper nailing leg re-centred x 0 -> -1.0 (joggle top (0,91) -> (-1,89.58)); kick start bend (6.5,456.3) -> (6.5,458.58); kick end (44,513.7) -> fold tip (46.9,516.59). START (top nailing edge): plain. CONVENTIONS: polyline = centreline of the rendered end-face strip; the final point is the hem fold tip = outermost point of the 180-degree fold measured on the kick-leg centreline (outer fold edge minus half the sheet thickness). Hem tail centreline lies parallel to the leg, offset by gap + sheetThickness on foldSide, and runs back returnLength from the tip. 'sheetThickness' (extra field) = measured end-face strip width in profile units. Kick-leg line, thickness, gap and fold edge were measured by sub-pixel luminance profiles (hz_fit.py: leg strip-centre fit residual < 0.2 px); verified on result2/<id>.check.png (9x).",
    hemEnd: { type: 'open', lengthIn: 0.42, gapIn: 0.17, foldSide: 'right' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.0, y: 1.103 },
      { x: 0.092, y: 1.234 },
      { x: 0.092, y: 5.651 },
      { x: 0.336, y: 6.0 },
    ],
  },
  'fascia-extender': {
    schematic: true,
    confidence: 'high',
    note: "Units/projection identical to result/fascia-extender.json. END: kick + OPEN HEM (clear black slot). Old points 2-3 replaced by the fold tip; tail in hemEnd. BEND CORRECTIONS: kick start bend (0,455) -> (0,456.53) (kick direction from strip-centre fit); kick end (38,512.4) -> fold tip (40.88,515.31). Vertical face was already centred. START (top nailing edge): plain. CONVENTIONS: polyline = centreline of the rendered end-face strip; the final point is the hem fold tip = outermost point of the 180-degree fold measured on the kick-leg centreline (outer fold edge minus half the sheet thickness). Hem tail centreline lies parallel to the leg, offset by gap + sheetThickness on foldSide, and runs back returnLength from the tip. 'sheetThickness' (extra field) = measured end-face strip width in profile units. Kick-leg line, thickness, gap and fold edge were measured by sub-pixel luminance profiles (hz_fit.py: leg strip-centre fit residual < 0.2 px); verified on result2/<id>.check.png (9x).",
    hemEnd: { type: 'open', lengthIn: 0.42, gapIn: 0.17, foldSide: 'right' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.0, y: 5.64 },
      { x: 0.251, y: 6.0 },
    ],
  },
  'gravel-stop': {
    schematic: true,
    confidence: 'medium',
    note: "Units/projection identical to result/gravel-stop.json (rear blue fascia-cover section of a multi-piece assembly; galvanized base and front blue piece not traced). END: kick + OPEN HEM with a wide clear slot. Old points 4-5 replaced by the fold tip; tail in hemEnd. START: short angled lip = kick (no hem). CORRECTIONS: start (0,0) -> (-3.7,3.6) (lip strip visibly continues ~5 px further before meeting the front cover piece; exact lip end is where it merges with that piece's silhouette, +/-1.5 px); top return moved up 1.5 (corners (10,-11.8) -> (11.28,-13.3), (85,-11.8) -> (87,-13.3)); vertical face re-centred (x 87 at top to 86 at bottom); kick start bend (86,645.1) -> (86,644.43); kick end (140,720.8) -> fold tip (144.97,724.35). CONVENTIONS: polyline = centreline of the rendered end-face strip; the final point is the hem fold tip = outermost point of the 180-degree fold measured on the kick-leg centreline (outer fold edge minus half the sheet thickness). Hem tail centreline lies parallel to the leg, offset by gap + sheetThickness on foldSide, and runs back returnLength from the tip. 'sheetThickness' (extra field) = measured end-face strip width in profile units. Kick-leg line, thickness, gap and fold edge were measured by sub-pixel luminance profiles (hz_fit.py: leg strip-centre fit residual < 0.2 px); verified on result2/<id>.check.png (9x).",
    hemEnd: { type: 'open', lengthIn: 0.42, gapIn: 0.17, foldSide: 'right' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.129, y: -0.146 },
      { x: 0.782, y: -0.146 },
      { x: 0.773, y: 5.524 },
      { x: 1.017, y: 5.854 },
    ],
  },
  'secure-lok-fascia': {
    schematic: true,
    confidence: 'medium',
    note: "Same frame as result/secure-lok-fascia.json. Previous trace already drew this hem as a tail segment (old points 6->7); per spec the tail is REMOVED and the polyline now ends at the fold tip. CORRECTIONS: (1) the old kick line ran ~2-3px left of the actual kick sheet (it sat in the shadow/gap); kick re-fitted to the sheet centre: kick bend moved from (1.1,669.9) to (1.6,677.3) (img y980 -> y987.5, where the band starts leaving the vertical), kick now ends at the fold tip (29.8,727.2) = img (967.9,1040.7), previously (24.6,727.1). Kick ~26.5 deg off vertical in image. Hem: tail returns on the wall side (right when travelling down the kick toward the free end), ~13.8 units long from the fold tip (tail end is where it merges into the cleat flange highlight, +/-3 uncertain), clear gap ~4.7 (+/-1) at pixel resolution, leg-to-tail centreline spacing ~10.4. Rear free end (start) is plain - no change to points 0-4.",
    hemEnd: { type: 'open', lengthIn: 0.42, gapIn: 0.17, foldSide: 'right' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.216, y: -0.21 },
      { x: -0.037, y: -0.471 },
      { x: 0.873, y: -1.491 },
      { x: 1.258, y: -1.492 },
      { x: 1.272, y: 4.459 },
      { x: 1.3, y: 4.508 },
    ],
  },
  'snap-coping-max': {
    schematic: true,
    confidence: 'low',
    note: "Same frame as result/snap-coping-max.json. Previous trace drew the hem tail as old points 4->5 ((790,608.6)->(779.3,603.8)); per spec the tail is REMOVED and the polyline now ends at the fold tip (799.0,604.3) = img (1021.4,1016.8), placed on the kick leg line at the fold's outermost extent along the leg. Kick bend (769.6,552) re-checked and unchanged. Kick ~26.6 deg off vertical in image (slope 0.5 px/px); the last ~8px of kick curve into the fold so the leg-line tip sits ~2px outside the sheet's rounded bottom - inherent to a straight-leg model. Hem: tail returns on the wall side (right when travelling down the kick), ~9 units (+/-3; tail end is where it merges into the cleat flange highlight), clear gap ~5.5 (+/-1.5); centerlineOffset 13.5 is measured from the straight kick leg line (which sits ~2.5 outside the curved kick bottom), true sheet-to-sheet centreline spacing ~11. START end: NOT VISIBLE (occluded by the cleat flange) - back-leg length and its end treatment cannot be read from this rendering; confidence low because of that.",
    hemEnd: { type: 'open', lengthIn: 0.4052, gapIn: 0.17, foldSide: 'right' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.004, y: -0.769 },
      { x: 5.969, y: -0.768 },
      { x: 5.977, y: 3.515 },
      { x: 6.0, y: 3.556 },
    ],
  },
  'dmc-gutter-lt-1': {
    schematic: true,
    confidence: 'medium',
    note: "Same frame and points as result/dmc-gutter-lt-1.json (no corrections needed: fold at old point 5 = img (944,584) and leg tip at old point 6 = img (961,612) re-checked at 12x and match the sheet). Both free ends confirmed NOT hemmed: start plain; end is an angled kick leg off the inward top return (~128 deg fold-back, wedge gap opening to ~29 units - too open to be an open hem). Unresolved: the last few px of the kick leg could be hidden behind the hanger strap; visible leg length ~30 units is a minimum.",
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
    confidence: 'high',
    note: "Units = image px (same origin/u/v as result json). No hems on either free end; both are plain cut edges. Corrections from column scans: left top return level is y=-112 (was -110/-110, -34 lip x -> -35); right top return is at y=-97 (was -95/-94), right leg top x 787->789 (leg leans 2px in the rendering), return flange cut end x 773->771. Right leg reads shorter than left (97 vs 112) as before - not resolved whether that is design or perspective. Coordinates use the pixel-index convention of the original trace (origin pixel = index); check images therefore show lines ~0.5px up-left of strip centres, not an error.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.0, y: -0.204 },
      { x: 0.255, y: -0.204 },
      { x: 0.255, y: 0.612 },
      { x: 5.978, y: 0.612 },
      { x: 6.0, y: -0.095 },
      { x: 5.869, y: -0.095 },
    ],
  },
  'rib-mechanically-seamed-striations': {
    schematic: true,
    confidence: 'high',
    note: "Units = image px (same origin/u/v as result json). No hems on either free end; both plain cut edges. Corrections from column/row scans: left top return level y=-110 (was -109 at the lip corner and -107 at the leg corner - the return is level, the -107 was a bend error), lip x -34 -> -35, lip end -83 -> -81; right leg base x 788 -> 787 and top 789, right top return at y=-94.6 (was -92), cut end x 774 -> 771. Striations untouched. Measurements use pixel-index coordinates like the original trace (check image shows the line ~0.5px toward the upper-left of the strip centre, which is the pixel-centre convention, not an error). Right leg shorter than left (94.6 vs 110) as in previous trace - design vs perspective unresolved.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.0, y: -0.211 },
      { x: 0.255, y: -0.211 },
      { x: 0.255, y: 0.59 },
      { x: 1.558, y: 0.59 },
      { x: 1.981, y: 0.655 },
      { x: 2.468, y: 0.655 },
      { x: 2.927, y: 0.59 },
      { x: 3.51, y: 0.59 },
      { x: 3.932, y: 0.655 },
      { x: 4.405, y: 0.655 },
      { x: 4.82, y: 0.59 },
      { x: 5.985, y: 0.59 },
      { x: 6.0, y: -0.099 },
      { x: 5.869, y: -0.099 },
    ],
  },
  'rib-snap-lock-striations': {
    schematic: true,
    confidence: 'high',
    note: "Units = image px (same origin/u/v as result json). Polyline ends at the hem apex projected onto the leg centreline (790,-115.5). Right hem: open hem, tail on the pan side (left looking up the leg toward the end); straight return ~40.5 from apex, centreline spacing 6.9 -> 9.4 (gap 3.9 -> 6.4, mean 5.1); then tail kicks ~27.6 more at ~15 deg away from the leg to its cut end at profile (772,-48.5) (snap-lock engagement flare). Left catch re-measured: free end (-19,-27)->(-22,-27.5), apex (-17,-43)->(-16,-40), corner (-29,-44)->(-30,-45), outer leg top x -29 -> -30 (outer leg centreline measured at x_img 678). Pan/striations unchanged from previous trace. Old points 16..18 (hem return + kicked foot) now represented by hemEnd. Same section as rib-snap-lock-flat. Coordinates use the pixel-index convention of the original trace (origin pixel = index); check images therefore show lines ~0.5px up-left of strip centres, not an error.",
    hemEnd: { type: 'open', lengthIn: 0.42, gapIn: 0.17, foldSide: 'left' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.044, y: -0.092 },
      { x: -0.059, y: -0.128 },
      { x: -0.059, y: -0.78 },
      { x: 0.161, y: -0.751 },
      { x: 0.161, y: 0.201 },
      { x: 1.465, y: 0.201 },
      { x: 1.89, y: 0.267 },
      { x: 2.388, y: 0.267 },
      { x: 2.828, y: 0.201 },
      { x: 3.451, y: 0.201 },
      { x: 3.875, y: 0.267 },
      { x: 4.337, y: 0.267 },
      { x: 4.718, y: 0.201 },
      { x: 5.934, y: 0.201 },
      { x: 5.941, y: -0.224 },
    ],
  },
  'rib-snap-lock-flat': {
    schematic: true,
    confidence: 'high',
    note: "Units = image px (same origin/u/v as result json). Polyline ends at the hem apex projected onto the leg centreline (790,-117). Right hem: open hem, tail returns on the pan side (left when looking up the leg toward the end), straight return ~40 from apex; the tail is not exactly parallel - centreline spacing to leg grows 6.7 -> 9.1 over the return (gap 3.7 -> 6.1, mean 4.9), then the tail kicks a further ~28.5 at ~14 deg away from the leg to its cut end at profile (772,-49.5) - this is the snap-lock engagement flare. Left end corrected slightly: free end (-20,-27)->(-21.5,-28), apex (-17,-43)->(-16.5,-41) per row scans. Old points 7..10 (hem return + kicked foot) are now represented by hemEnd. Coordinates use the pixel-index convention of the original trace (origin pixel = index); check images therefore show lines ~0.5px up-left of strip centres, not an error.",
    hemEnd: { type: 'open', lengthIn: 0.42, gapIn: 0.17, foldSide: 'left' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.033, y: -0.092 },
      { x: -0.07, y: -0.121 },
      { x: -0.07, y: -0.784 },
      { x: 0.15, y: -0.755 },
      { x: 0.15, y: 0.205 },
      { x: 5.923, y: 0.205 },
      { x: 5.93, y: -0.232 },
    ],
  },
  'trim-drip-edge': {
    schematic: true,
    confidence: 'medium',
    note: "Same frame as result/trim-drip-edge.json. CORRECTIONS vs previous trace: (1) previous trace called both free ends plain/kick and said the doubled lines were thickness outline - wrong: both ends are OPEN HEMS (black gap between two layers visible only near the free edges; single-sheet band elsewhere has no gap). (2) Kick re-fit on the outer kick-sheet highlight: bend moved up from y304.4 to y301.2 (img y588.8, where the band starts widening), and the kick now runs to the hem fold tip at img (818.6,637.5) instead of stopping at img y630 - kick leg length 48.7 (was 38.3), angle ~29.9 deg off vertical. (3) Flange end extended from x233.7 to the fold tip x239.0 (outer fold edge img x1044.5 minus half thickness). Hem readings: flange hem tail lies UNDER the flange (+y, toward face side), returns ~62 units (tail end img x~990; doubled band starts x981-990, black gap starts x993-995 -> +/-8 units). Kick hem tail lies on the inside (+x/wall side) of the kick and returns ~41 units, nearly the full kick (gap ends img y~597, ~7.7 units short of the kick bend), +/-3. gap = clear dark gap (1-3px, at pixel resolution, +/-1); centerlineOffset = highlight-to-highlight spacing used to draw the tail. Units = source px along vertical (same as previous). Flange-level assumption from previous trace retained.",
    hemStart: { type: 'open', lengthIn: 0.7154, gapIn: 0.17, foldSide: 'left' },
    hemEnd: { type: 'open', lengthIn: 1.0818, gapIn: 0.17, foldSide: 'right' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.075, y: -0.13 },
      { x: 0.12, y: -5.993 },
      { x: 3.566, y: -6.0 },
    ],
  },
  'j-channel': {
    schematic: true,
    confidence: 'medium',
    note: "Same frame as result/j-channel.json. Previous trace drew the hem tail as old point 4 (40.7,-102); per spec it is REMOVED and the polyline now ends at the fold tip (69.8,-105.4) = img (935,485.5) (old point 3 was (65.1,-105.5) = img x931, short of the fold; outer fold edge is at img x~938). Hem: tail lies UNDER the return (+y, channel side) = right when travelling toward the free end; returns ~31 units (tail highlight ends img x~908, +/-3); highlight-to-highlight spacing 3-5 rows (~4 units); clear gap ~1.5 units at pixel resolution (+/-1), tapering slightly toward the tail end - it is a slightly open hem, not smashed. Flange (start) end plain, unchanged.",
    hemEnd: { type: 'open', lengthIn: 0.9815, gapIn: 0.17, foldSide: 'right' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: -6.0, y: 0.044 },
      { x: -6.0, y: -3.344 },
      { x: -4.771, y: -3.315 },
    ],
  },
  'perforated-z-closure': {
    schematic: true,
    confidence: 'medium',
    note: "Same frame and points as result/perforated-z-closure.json; ends re-checked at 12x with pixel column scans - both free edges plain, no hems or kicks. No corrections.",
    perforatedSegments: [1],
    points: [
      { x: 0.0, y: 0.0 },
      { x: 4.449, y: -0.02 },
      { x: 4.449, y: 2.397 },
      { x: 6.0, y: 2.419 },
    ],
  },
  'ridge-cap': {
    schematic: true,
    confidence: 'high',
    note: "Same origin/u/v as result/ridge-cap.json. CORRECTIONS: both flange 'kicks' are kick legs ending in OPEN HEMS folded to the underside (roof side) of each flange. Flange polylines refit to the LEG sheet line (the previous trace's flange lines sat ~2-3 img px low, between leg and tail): left bend moved (0,76.92)->(0,73.41) (img (696.2,645.0), where the leg sheet line y = 687.1 - 0.809(x-644) meets the wall sheet line x=696.2), right bend (543,72.46)->(543,72.87) (img (1209.6,469.6), leg line y = 470.5 + 0.147(x-1216)). Free ends are now the fold tips: left img (637.5,692.3) -> (-61.75,97.85); right img (1259.1,476.8) -> (594.87,94.39) (axial position of the fold's outermost centerline point: mid-line apex img (639.0,694.0) and (1258.7,479.3)). Flange angles: left 21.6 deg, right 22.5 deg below horizontal. Hem measurements: leg-to-tail centre spacing left 4.9 units (4.6 img px perp at 0.935 px/unit), right 4.5 units (5.4 img px vertical at 1.209 px/unit); minus ~1.3 unit sheet thickness -> gap 3.6 / 3.2 (+/-0.6, resolution limit). returnLength from fold tip to tail end: left 48.5 (tail end img (682,662.4), +/-2), right 48.6 (tail end img ~(1215,475.7), +/-3: the tail end coincides with where its length-direction free edge leaves the end face). Unresolved: flange lengths differ (left 66.4 vs right 56.2 units) as in the previous trace - real asymmetry or projection (v) error, not resolved here; walls, slopes and peak not re-audited beyond confirming the wall sheet lines (img x 696.2 and 1209.6). foldSide convention: profile y-down drawn as on screen; looking along travel toward the free end, right = (-ty,tx).",
    hemStart: { type: 'open', lengthIn: 0.4432, gapIn: 0.17, foldSide: 'left' },
    hemEnd: { type: 'open', lengthIn: 0.4441, gapIn: 0.17, foldSide: 'right' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.176, y: -0.07 },
      { x: 0.176, y: -0.847 },
      { x: 3.118, y: -1.993 },
      { x: 5.926, y: -0.838 },
      { x: 5.926, y: -0.076 },
      { x: 6.0, y: -0.045 },
    ],
  },
  'ridge-trim': {
    schematic: true,
    confidence: 'high',
    note: "Same origin/u/v as result/ridge-trim.json. CORRECTIONS vs previous trace: (1) the previous polyline legs ran ~3 img px BELOW the actual leg sheet, i.e. along the hem tail/slot, not the leg; legs refit to the leg sheet edge centroids (left: y = 667.0 - 0.5908(x-690); right: y = 508.4 - 0.090(x-965)); ridge = their intersection img (957.3,509.1) -> profile (300.99,-64.14) (was (301.86,-63.16)). (2) Hem returns removed from the polyline; ends are now the fold tips (left img (662.9,682.9), right img (1238.4,483.8)), i.e. the axial position of the outermost centerline point of each 180-deg fold. (3) Hems are OPEN (visible dark slot along the whole return), not flat/closed as previously noted. Measurements: leg-to-tail centre spacing left 4.0-4.5 units (perp img 4.0-4.5 px at 0.994 px/unit), right 4.1-4.9 units (vertical img 5.0-6.0 px at 1.219 px/unit); minus ~1.3 unit sheet thickness -> gap ~3.1 left / ~2.9 right (+/-0.6, resolution limit; left value adjusted after overlay check). returnLength from fold tip to tail end: left 47.7, right 47.1 (tail ends: img (708.5,660.6) and (1194.8,491.9)). Profile is symmetric within measurement (half-spans 303.5 / 305.3). foldSide convention: profile y-down drawn as on screen; looking along travel toward the free end, right = (-ty,tx). Both tails are on the underside (roof side) of the legs: start=left, end=right.",
    hemStart: { type: 'open', lengthIn: 0.4702, gapIn: 0.17, foldSide: 'left' },
    hemEnd: { type: 'open', lengthIn: 0.4642, gapIn: 0.17, foldSide: 'right' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: 2.986, y: -0.611 },
      { x: 6.0, y: -0.002 },
    ],
  },
  't-style-drip-edge': {
    schematic: true,
    confidence: 'high',
    note: "Same origin/u/v as result/t-style-drip-edge.json. Free ends: start = deck-flange edge (plain), end = drip kick (kick leg ending in an OPEN HEM folded to the inside/fascia side; previously drawn as a plain kick). Hem measurements: leg-to-tail centre spacing 4.0-5.0 img px horizontal (mean 4.6) at 0.926 px/unit -> 4.97 units; minus ~1.3 unit sheet thickness -> gap 3.7 (+/-0.6). returnLength 26.1 from the fold tip to the tail end (tail end img ~(872.7,590), +/-2 units; kick leg length 32.0). Fold tip = axial position of the fold's outermost centerline point (mid-line apex img (858.0,619.0)), placed on the leg line at img (856.1,618.2). OTHER CORRECTIONS: (a) deck line refit to the deck sheet end-face edge centroids (y = 525.2 - 0.3378(x-820), checked at x 820..1090); the previous deck line ran 1.4-2.4 img px above it (on the top surface). Deck free end moved (305.59,1.40)->(307.19,3.58). (b) Interior T-nose OPEN hem (points 1-2-3-4, not a free end) re-measured: deck sheet over return with a dark slot (7-15 grey along the mid-line) closed at the nose apex img (811.0,533.1); points now 1=(3.72,-2.09) deck, 2=(-0.53,2.17) apex (mid-line, outermost fold centerline), 3=(3.72,6.32) return, 4=(63.56,7.73) where the return line (y = 528.0 - 0.333(x-840)) meets the fascia; nose centre spacing ~8.3 units. (c) Fascia sheet line measured at img x=871.3 (y 560 and 575) -> profile x 63.56 (was 63.78); kick bend moved (63.78,68.12)->(63.56,65.19) = intersection of fascia line and kick leg line (x = 866.2 - 0.418(y-594)); kick tip (49.96,93.91)->(47.41,92.86). foldSide convention: profile y-down drawn as on screen; looking along travel toward the free end, right = (-ty,tx); tail at (+0.86,+0.50) = LEFT of travel (-0.50,+0.86).",
    hemEnd: { type: 'open', lengthIn: 0.5089, gapIn: 0.17, foldSide: 'left' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: -5.917, y: -0.111 },
      { x: -6.0, y: -0.027 },
      { x: -5.917, y: 0.053 },
      { x: -4.75, y: 0.081 },
      { x: -4.75, y: 1.201 },
      { x: -4.809, y: 1.301 },
    ],
  },
  'trims-offset-cleat': {
    schematic: true,
    confidence: 'high',
    note: "Same origin/u/v as result/trims-offset-cleat.json. No hems or kicks at either free end (confirmed at 10x and with intensity profiles). Minor refit of all segments to the end-face sheet edge centroids (bright neutral line, every 8 px): lower flange y = 613 - 0.357(x-876), ramp y = 584 - 0.85(x-948), upper flange y = 565 - 0.359(x-972) (img). The previous upper flange ran ~2 img px below the sheet edge (in the halo); bends moved (69.1,0)->(71.13,-1.50) and (103.4,-13.6)->(100.47,-14.39); ends (0,0)->(0,-0.27) and (171.0,-13.6)->(171.5,-15.75). Both flanges measure ~1 deg off the profile X axis (parallel to each other); this is within ~1 img px of the previous horizontal assumption over each flange and may be a small error in the u axis rather than real - treat flanges as parallel; ramp rise 12.9-14.4 units over ~29 units run.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 2.489, y: -0.043 },
      { x: 3.515, y: -0.494 },
      { x: 6.0, y: -0.542 },
    ],
  },
  'trims-reglet': {
    schematic: true,
    confidence: 'high',
    note: "Same origin/u/v as result/trims-reglet.json. Changes: last point moved from (-16.48,143.49) to (-17.16,144.56) = hem fold tip (outermost point of the 180-deg fold, img ~(917.6,599)); kick direction unchanged. Kick leg (30-32 units) ends in an OPEN HEM folded to the inside of the kick (toward the wall/+X side, i.e. under the face); tail returns ~25.5 units back up the kick, ending ~6 units short of the face/kick bend (slot visible img y 572-597). Gap: leg-to-tail centre spacing measured 3.75-5.0 img px perpendicular (= 4.4-5.9 units at 0.853 img px/unit in that direction); minus ~1.3 unit sheet thickness -> gap ~3.6 units (+/-0.7, rendering resolution limit). foldSide convention: profile plane drawn y-down as on screen; looking along the travel direction toward the free end, right = (-ty, tx); tail lies on (+0.84,+0.54) = LEFT of travel (-0.54,+0.84). Top leg tip: plain (no hem visible on the near end face; far-end face not visible). Verified with result2/_h6/chk.py overlay: polyline on the leg edge, tail and fold arc on the visible returned strip and U.",
    hemEnd: { type: 'open', lengthIn: 1.0572, gapIn: 0.257, foldSide: 'left' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: -3.339, y: 0.008 },
      { x: -3.339, y: 5.739 },
      { x: -3.506, y: 6.0 },
    ],
  },
  'trims-zee': {
    schematic: true,
    confidence: 'high',
    note: "Same origin/u/v as result/trims-zee.json. No hems, kicks or returns at either free end (10x crops + intensity profiles). Points unchanged from result/trims-zee.json: the flange lines were checked against the edge centroids (top flange: 472.0 @x905 vs 472.2 traced, 468.5 @x915 vs 468.2; bottom flange: 572.0 @x995 vs 572.6, 569.3 @x1003 vs 570.1) - within 1 px.",
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
    note: "Ends: start plain, end = kick with OPEN 180-degree hem at its tip. The previous trace drew the kick tip ~4px too low (img y 623 vs fold at 619) and the hem tail only ~12px long (ended img y 603); the tail actually returns to img y ~591.5, i.e. almost back to the fascia/kick bend. Kick-leg/fascia vertex (pt 4) recomputed as the intersection of the measured kick-leg centreline with the fascia line (img y 582.7, was 586.0 which was on the rounded bend). The nose fold at pts 1-2-3 is an INTERNAL closed-loop open hem (deck folds under and the return turns down into the fascia at img (871,516)); it is not a free end and was left as polyline vertices. Units = old trace units (image px along u,v). Gap = clear dark width (FWHM) converted to profile units; centerlineOffset = leg-to-tail centreline distance; sheetThickness = difference (render sheet ~2px, anti-aliasing +/-0.5).",
    hemEnd: { type: 'open', lengthIn: 0.5111, gapIn: 0.17, foldSide: 'left' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: -6.0, y: 0.0 },
      { x: -6.0, y: 0.159 },
      { x: -4.783, y: 0.189 },
      { x: -4.783, y: 1.492 },
      { x: -4.86, y: 1.645 },
    ],
  },
  'gable-sample-02': {
    schematic: true,
    confidence: 'high',
    note: "BOTH free ends are hemmed: start = open hem under the top flange edge (tail on the underside), end = kick with an open hem at its tip. Hem tails removed from the polyline and expressed as hemStart/hemEnd. Top fold tip moved out to img x 1041 (fold centre; was 1039). Kick-leg vertex (pt 2) recomputed as intersection of measured kick-leg centreline with the face line. Kick tip moved to the measured fold (img (819,631)). The previous trace drew the kick hem tail only ~9px long (to img y 597 from a tip that was too low/left); the tail actually spans img y 596-631.",
    hemStart: { type: 'open', lengthIn: 0.782, gapIn: 0.17, foldSide: 'right' },
    hemEnd: { type: 'open', lengthIn: 0.5998, gapIn: 0.17, foldSide: 'left' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: -3.242, y: 0.0 },
      { x: -3.242, y: 5.878 },
      { x: -3.305, y: 6.0 },
    ],
  },
  'peak-sample-02': {
    schematic: true,
    confidence: 'medium',
    note: "BOTH free ends hemmed (open). Correction: the previous peak trace sat ~1.5px right/below the actual sheet-edge strips (vertical face edge measured at img x 819.5@y440 vs old 821.0; corner at ~(819.5,294.5) vs old (822,296); flange edge 1.5px above old line). All points shifted by image (-1.4,-1.5) = profile (-1.47,-1.95) so corner is now (-1.5,-2.0), not (0,0) - same origin/u/v kept. Kick-leg vertex recomputed as intersection of measured kick centreline with face line. Confidence medium only because u for this end face is borrowed from gable (no horizontal edge, see old notes); hem readings themselves are clear.",
    hemStart: { type: 'open', lengthIn: 0.8508, gapIn: 0.17, foldSide: 'right' },
    hemEnd: { type: 'open', lengthIn: 0.6088, gapIn: 0.17, foldSide: 'left' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: -5.171, y: -2.33 },
      { x: -5.172, y: 3.515 },
      { x: -5.253, y: 3.67 },
    ],
  },
  'soffit-j-sample-02': {
    schematic: true,
    confidence: 'high',
    note: "Start (top flange) = open hem with tail on the underside; end (bottom flange) = plain. The hem gap tapers (open ~2.9px at fold, ~1.4px near tail end) so returned tail is ~5-8 deg off parallel; reported gap/centerlineOffset are averages over the tail length. It is not a teardrop (no enlarged rounded bulb at the fold: fold outer height ~6px = two sheets + gap). Top fold tip moved to img x 932 (was 930).",
    hemStart: { type: 'smashed', lengthIn: 0.7663, gapIn: 0.045, foldSide: 'right' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: -1.314, y: 0.0 },
      { x: -1.314, y: 3.867 },
      { x: 4.686, y: 3.867 },
    ],
  },
  'valley-sample-02': {
    schematic: true,
    confidence: 'high',
    note: "Both free ends plain; points unchanged from previous trace (vertices sit on the visible end-face corners). Overall flange angle still carries the previous low-confidence axis assumption (see result/valley-sample-02.json notes); the free-end treatment itself is certain.",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 3.0, y: 0.837 },
      { x: 6.0, y: 0.0 },
    ],
  },
  'vented-ridge-sample-02': {
    schematic: true,
    confidence: 'high',
    note: "Both feet carry open hems (tails underneath, toward the roof). Corrections: both riser walls were ~1-2.4px off the measured end-face strips (left wall measured at img x 693.6 vs old 696.0; right wall ~1209.5-1210 vs old ~1208) - pts for both walls (old 3,4,6,7) re-derived from measured wall lines (wall/foot vertices = intersection with measured foot centrelines; wall/slope corners at img (693.7,560) and (1210,388)). Apex (0,0) unchanged. Right foot tail end read at img x ~1219; the bright edge from there up-left to the wall bottom is the tail longitudinal edge receding along the length axis (verified by slope), so it is excluded.",
    hemStart: { type: 'open', lengthIn: 0.4305, gapIn: 0.17, foldSide: 'left' },
    hemEnd: { type: 'open', lengthIn: 0.42, gapIn: 0.17, foldSide: 'right' },
    points: [
      { x: 0.0, y: 0.0 },
      { x: 0.171, y: -0.078 },
      { x: 0.171, y: -0.992 },
      { x: 3.123, y: -2.294 },
      { x: 5.894, y: -1.037 },
      { x: 5.894, y: -0.179 },
      { x: 6.0, y: -0.132 },
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
