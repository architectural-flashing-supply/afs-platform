/**
 * Faint line-art wallpaper of flashing cross-sections for the Products page.
 *
 * Static, decorative, behind all content (the parent is an isolated stacking
 * context and this sits at -z-10). One tiled SVG pattern of standard profile
 * outlines, drawn as single centre-lines at very low opacity, so it reads as
 * texture and never competes with the catalog. These are generic standard
 * outlines, not product drawings, so they carry no dimensions and make no
 * claim about any specific AFS product.
 */
const SHAPES: ReadonlyArray<{ d: string; x: number; y: number; r: number; s: number }> = [
  // zee
  { d: 'M0 0 H40 V70 H80', x: 40, y: 40, r: 0, s: 1 },
  // cap with hems
  { d: 'M0 14 V60 H90 V14 M0 14 L-12 22 M90 14 L102 22', x: 330, y: 30, r: 0, s: 0.9 },
  // drip edge
  { d: 'M0 0 H70 V28 L52 42', x: 170, y: 190, r: 0, s: 1.1 },
  // gravel stop
  { d: 'M0 70 V25 H55 V0 H72 V10', x: 440, y: 210, r: 0, s: 1 },
  // hat / ridge
  { d: 'M0 60 H24 L38 14 H78 L92 60 H116', x: 40, y: 330, r: 0, s: 0.95 },
  // base flashing
  { d: 'M0 70 H60 V28 L96 14', x: 300, y: 380, r: 0, s: 1 },
  // J-channel
  { d: 'M0 0 H34 V56 H60 V44', x: 520, y: 380, r: 0, s: 0.9 },
  // wall-and-floor piece with a jog (from the photographed sample)
  { d: 'M-8 -6 C-14 -6 -14 6 -8 6 L0 70 H44 L52 76 H92 L94 62', x: 210, y: 70, r: 0, s: 0.85 },
];

export default function ProductsWallpaper() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-afs-ink-900 opacity-[0.07]"
    >
      <defs>
        <pattern id="afs-profile-wallpaper" width="640" height="520" patternUnits="userSpaceOnUse">
          {SHAPES.map((sh, i) => (
            <path
              key={i}
              d={sh.d}
              transform={`translate(${sh.x} ${sh.y}) rotate(${sh.r}) scale(${sh.s})`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#afs-profile-wallpaper)" />
    </svg>
  );
}
