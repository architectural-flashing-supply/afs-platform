import Link from 'next/link';
import V7Drawing from '@/components/admin/v7/V7Drawing';
import type { V7Button, V7DrawingRef, V7Pill, V7SpecChip } from '@/lib/data/v7-view/types';

/**
 * THE SMALL V7 ELEMENTS, once each.
 *
 * v7 builds these with string helpers (`btn()`, `chip()`, `specC()`, `thumbJ()`,
 * `thumbP()`, `pPill()`), and every screen calls them. Here they are components,
 * so a screen is a transliteration of v7's PAGE function and nothing else — the
 * same split v7 itself has.
 *
 * CLASS NAMES ARE V7'S, AND NOTHING HERE MAY CARRY A TAILWIND UTILITY. The
 * appearance comes entirely from app/styles/command-center-v7.generated.css,
 * which is derived from the prototype (CLAUDE.md rule #33). A utility added to
 * one of these overrides v7 on every screen at once.
 */

/** v7 `btn()` (line 1194) and the `.linkbtn` variant. */
export function V7Btn({
  button,
  onAction,
  extraClass,
}: {
  button: V7Button;
  /** Supplied by a client component when the button is not a link. */
  onAction?: (action: string, id?: string) => void;
  extraClass?: string;
}) {
  const cls = ['btn', button.tone, button.size, extraClass].filter(Boolean).join(' ');
  if (button.href) {
    return (
      <Link href={button.href} className={cls} data-testid={button.testId}>
        {button.label}
      </Link>
    );
  }
  // v7 renders every non-navigating action as a <button type="button">.
  //
  // IT IS NEVER DISABLED FOR WANT OF A HANDLER, and the first version of this
  // file got that wrong: it greyed out any button with no `onAction`, which in
  // fixture mode meant eleven of the Workbench's buttons rendered pale instead
  // of coloured and the screen missed the gate by itself. The honest rule is
  // the other way round — a button the live app cannot action is NOT EMITTED by
  // lib/data/v7-view/from-live.ts in the first place, so anything that reaches
  // here is either real or part of a fixture render under a development-only
  // flag. Both of those should look like v7.
  return (
    <button
      type="button"
      className={cls}
      data-testid={button.testId}
      onClick={onAction ? () => onAction(button.action ?? '', button.actionId) : undefined}
    >
      {button.label}
    </button>
  );
}

/** v7 `chip()` + `specC()` (line 1186) — the colour swatch and the spec text. */
export function V7Spec({ spec, big }: { spec: V7SpecChip | null; big?: boolean }) {
  if (!spec) return null;
  return (
    <>
      <i className={big ? 'mchip lg' : 'mchip'} style={{ background: spec.hex }} title={spec.colorName} />
      {spec.spec}
    </>
  );
}

/** v7 `colorLine()` (line 1188). */
export function V7ColorLine({ spec, note }: { spec: V7SpecChip; note: string }) {
  return (
    <>
      <i className="mchip lg" style={{ background: spec.hex }} title={spec.colorName} />
      <b>{spec.colorName}</b>{' '}
      <span className="cap" style={{ margin: 0 }}>
        {note}
      </span>
    </>
  );
}

/**
 * A WHOLE-className MAP, NOT A TEMPLATE, AND CLAUDE.md RULE #28 IS WHY.
 *
 * The contrast gate (`scripts/audit/contrast-check.mjs`, which runs as
 * `prebuild`) expands a class map to its values and can therefore measure the
 * colours. A runtime template like `` `pill ${tone}` `` it reports as
 * UNRESOLVED — and rule #28 says a rising unresolved count means the gate got
 * blinder, not that the code got safer. These were templates on the first pass
 * and took the count from 0 to 65 in one build.
 */
const PILL_CLASS: Record<string, string> = {
  '': 'pill',
  g: 'pill g',
  a: 'pill a',
  b: 'pill b',
  r: 'pill r',
  v: 'pill v',
};

export function V7PillEl({ pill }: { pill: V7Pill }) {
  return <span className={PILL_CLASS[pill.tone] ?? 'pill'}>{pill.text}</span>;
}

/**
 * v7 `thumbJ()` / `thumbP()` (line 1190) — the clickable profile thumbnail.
 *
 * WHEN THERE IS NO DRAWING. The live app has jobs with no geometry behind them
 * at all. v7 has no such case, so it has no markup for it. Rather than invent a
 * shape — which would be a drawing of something nobody designed, on a screen
 * that sends work to a bending machine — the `.pl` span is rendered empty, in
 * v7's own `.np` ("no profile") state. It occupies the same box, so the layout
 * is v7's; it just has nothing in it, which is the truth.
 */
export function V7Thumb({
  drawing,
  size = 100,
  state = '',
  className,
  href,
  label,
}: {
  drawing: V7DrawingRef | null;
  size?: number;
  state?: '' | 'photo' | 'np';
  className?: string;
  href?: string;
  label: string;
}) {
  const plClass = state ? `pl ${state}` : 'pl';
  const inner = (
    <span className={plClass}>
      {drawing && (
        <V7Drawing
          kind={drawing.kind}
          d={drawing.d}
          options={{ w: size, h: size, pad: 11, sw: state === 'np' || state === 'photo' ? 3.2 : 4.6, hi: drawing.hi }}
        />
      )}
    </span>
  );
  const cls = ['thumb', className].filter(Boolean).join(' ');
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={label}>
        {inner}
      </Link>
    );
  }
  return (
    <span className={cls} aria-label={label} role="img">
      {inner}
    </span>
  );
}

/** v7's `.plate` — the big dimensioned drawing on a Job, Shop or op screen. */
export function V7Plate({
  drawing,
  w = 460,
  h = 290,
  fs,
  sw,
  ang,
  pad,
}: {
  drawing: V7DrawingRef | null;
  w?: number;
  h?: number;
  fs?: number;
  sw?: number;
  ang?: boolean;
  pad?: number;
}) {
  if (!drawing) {
    // Same reasoning as V7Thumb: the box is v7's, the content is honest.
    return <div className="plate" />;
  }
  return (
    <div className="plate">
      <V7Drawing
        kind={drawing.kind}
        d={drawing.d}
        options={{ w, h, dims: true, ang, paint: drawing.paint, hi: drawing.hi, fs, sw, pad }}
      />
    </div>
  );
}

/** v7's `.leg` legend, under every plate. */
export function V7Legend() {
  return (
    <div className="leg">
      <span>
        <i style={{ background: '#111' }} />
        Profile
      </span>
      <span>
        <i style={{ background: '#C0001A' }} />
        Hem
      </span>
      <span>
        <i style={{ background: '#E39B00' }} />
        Painted side
      </span>
      <span>
        <i style={{ background: '#2563EB' }} />
        Changed
      </span>
    </div>
  );
}
