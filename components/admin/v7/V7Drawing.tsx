import { drawInner, V7_NAMES, type DrawOptions } from '@/lib/design/v7-draw';

/**
 * A v7 profile drawing, as v7 emits it.
 *
 * WHY `dangerouslySetInnerHTML` HERE AND NOWHERE ELSE.
 *
 * The markup is produced by `lib/design/v7-draw.ts`, which is a transliteration
 * of the prototype's own `draw()`. Rebuilding that output as JSX would be a
 * reinterpretation, and the whole-screen pixel gate compares against the
 * prototype's render — so every coordinate rounded differently would land in
 * the diff as an antialiasing halo along a stroke. The string is the only form
 * that can be identical.
 *
 * IT IS NOT A SANITISATION HOLE, and the reason is structural rather than a
 * promise to be careful:
 *
 *   - `draw()` takes a profile KIND (a key into v7's own nine-entry `V7_DEF`
 *     table) and an array of NUMBERS. Nothing else. A kind that is not a key
 *     throws before any markup exists; the numbers reach the output only via
 *     `.toFixed()` and `fmtIn()`, both of which can produce nothing but digits,
 *     a space, a slash, a dot, a minus and a quote mark.
 *   - The one string that is interpolated is the profile's display name for the
 *     `aria-label`, which comes from that same constant table and is passed
 *     through `esc()` regardless.
 *   - No customer name, no job title, no note, no uploaded file and no database
 *     column is ever passed to it. Caller-supplied TEXT is rendered as ordinary
 *     JSX children by the components around this one.
 *
 * So the untrusted-input path that makes this API dangerous does not exist
 * here. Keep it that way: if a future caller wants a label inside the drawing,
 * it goes through `esc()` in `v7-draw.ts` like `V7_NAMES` does — never
 * concatenated into `html` by the caller.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IT RENDERS THE <svg> ITSELF, WITH NO WRAPPER, AND THAT IS NOT TIDINESS.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The first version returned `<span dangerouslySetInnerHTML>` around the whole
 * `<svg>` string, because that is the obvious way to inject markup from React.
 * v7's CSS sizes a drawing with `.plate svg{width:100%}` and
 * `.pl svg{width:100%;height:100%}`, and those are DESCENDANT selectors, so
 * they still matched — but 100% of an inline `<span>`, which shrinks to its
 * content, not 100% of the plate. Every plate and every thumbnail in the app
 * came out at a slightly different size, which showed up as a dimension label
 * reading `1 1/2"` where the prototype read `11/2"` on the same drawing.
 *
 * So the `<svg>` element is JSX with v7's own attributes and only its INSIDE is
 * injected. Do not wrap it again.
 */
export default function V7Drawing({
  kind,
  d,
  options,
}: {
  kind: string;
  d?: number[] | null;
  options?: DrawOptions;
}) {
  const o = options ?? {};
  return (
    <svg
      viewBox={`0 0 ${o.w || 400} ${o.h || 260}`}
      role="img"
      aria-label={`${V7_NAMES[kind]} profile drawing`}
      dangerouslySetInnerHTML={{ __html: drawInner(kind, d, o) }}
    />
  );
}
