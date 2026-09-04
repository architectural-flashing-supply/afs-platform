// afs-fl-034 — "drawing to steel" hero accent. A thin red/chrome line-drawing
// of a flashing bend profile, in the same visual language as FlashDraft's own
// canvas (app/studio/draft/page.tsx CANVAS_COLORS: crimson profile lines,
// crimson joints, a bend-angle arc + label). Positioned over the top-right
// corner of the existing hero photo/rooftop-triangle, masked to fade out
// toward the bottom so the sketch reads as dissolving into the real,
// unchanged photo beneath it rather than sitting on top of it as a separate
// layer. Pure CSS keyframe animation (.hero-sketch-line in globals.css) —
// no client JS needed, no 'use client', consistent with this being a static
// server-rendered page. Static fallback for prefers-reduced-motion lives
// alongside the animation in globals.css, matching the
// hailview-address-marker-ring precedent (draws fully in, then holds).
export default function HeroDrawingOverlay() {
  return (
    <svg
      viewBox="0 0 320 260"
      aria-hidden="true"
      className="hero-sketch-overlay absolute pointer-events-none"
      style={{
        top: '4%',
        right: '3%',
        width: 'clamp(200px, 24vw, 320px)',
        height: 'auto',
        zIndex: 3,
        maskImage: 'linear-gradient(to bottom, black 35%, transparent 90%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 35%, transparent 90%)',
      }}
    >
      {/* Stepped roofline / flashing bend profile — same shape vocabulary as a
          FlashDraft coping-cap profile drawing */}
      <path
        className="hero-sketch-line"
        d="M20,180 L20,60 L140,60 L140,20 L220,20 L220,90 L280,90"
        fill="none"
        stroke="var(--afs-crimson)"
        strokeWidth="1.5"
      />
      {/* One highlighted (chrome) segment, echoing CANVAS_COLORS.profileSelected */}
      <path
        className="hero-sketch-line hero-sketch-line-delay1"
        d="M140,20 L220,20"
        fill="none"
        stroke="var(--afs-chrome-silver)"
        strokeWidth="1.5"
      />
      {/* Bend-angle arc + label, matching FlashDraft's angleArc annotation */}
      <path
        className="hero-sketch-fade hero-sketch-line-delay2"
        d="M124,44 A22,22 0 0 1 140,36"
        fill="none"
        stroke="var(--afs-chrome-mid)"
        strokeWidth="1"
      />
      <text
        className="hero-sketch-fade hero-sketch-line-delay2"
        x="128"
        y="30"
        fontSize="11"
        fill="var(--afs-chrome-mid)"
        fontFamily="var(--font-jetbrains), monospace"
      >
        90&deg;
      </text>

      {/* Vertex joints, matching CANVAS_COLORS.point */}
      {[
        [20, 180],
        [20, 60],
        [140, 60],
        [140, 20],
        [220, 20],
        [220, 90],
        [280, 90],
      ].map(([cx, cy], i) => (
        <circle
          key={`${cx}-${cy}`}
          className="hero-sketch-fade"
          style={{ animationDelay: `${1.6 + i * 0.08}s` }}
          cx={cx}
          cy={cy}
          r={3}
          fill="var(--afs-crimson)"
        />
      ))}
    </svg>
  );
}
