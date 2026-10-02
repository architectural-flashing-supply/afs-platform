/**
 * V7'S PROFILE DRAWING ENGINE, TRANSLITERATED.
 *
 * Every Command Center screen in prototype v7 draws profiles: thumbnails on
 * cards, 90px thumbs in list rows, 460x290 plates on the Job screen, a 1000x600
 * plate on the operator screen, 200x150 cards on New quote. They are not
 * decoration — they are most of the ink on the page. A port that leaves them
 * out cannot match v7 at any threshold, which is why this module exists before
 * any screen is rebuilt.
 *
 * It is a line-by-line transliteration of the prototype's own `drawInner()`,
 * `draw()`, `stats()`, `segsOf()`, `ptsOf()`, `fmtIn()`, `dimTxt()` and
 * `bendTxt()` (AFS_Command_Center_Prototype_v7.html, lines 853-980). The output
 * is an SVG markup STRING, injected with `dangerouslySetInnerHTML`, for one
 * reason: a string is the only form that can be byte-identical to what the
 * prototype emits, and the whole-screen pixel gate compares against the
 * prototype's render. Rebuilding it as JSX would be a reinterpretation, and
 * every rounding difference would land in the diff.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THIS IS NOT A SECOND BEND-ANGLE AUTHORITY. CLAUDE.md RULE #12 STILL HOLDS.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Rule #12 says `lib/flashdraft/geometry.ts` is the only place that decides
 * what a FlashDraft bend angle means. Nothing here touches that, and the
 * distinction is a representational one rather than a promise:
 *
 *   - FlashDraft stores SIGNED INTERIOR ANGLES per bend, in (-180, 180].
 *   - v7's sample geometry stores an ABSOLUTE TURTLE HEADING per segment.
 *
 * They are different coordinates for different data. This module reads v7's
 * sample `segs` arrays and nothing else: it never receives a FlashDraft
 * profile, never imports from `lib/flashdraft/`, and is never used to render a
 * real customer drawing. A real drawing reaches a screen through the existing
 * lazy loader (`components/admin/LazyProfileThumb.tsx`, rule #26) and through
 * `shop_profile_library.geometry_svg`, both untouched.
 *
 * So: in FIXTURE mode these drawings render v7's sample profiles, so the pixel
 * gate measures layout and type rather than photographing a database. In LIVE
 * mode the same slots hold the real drawing from the real source. Do not point
 * this module at a FlashDraft profile to "unify" them — that would make it the
 * second renderer rule #12 exists to prevent.
 *
 * Also deliberate: `-0` can fall out of the `.toFixed(2)` coordinate maths on a
 * perfectly axis-aligned segment. The prototype's `+(...).toFixed(2)` coerces
 * back to a number, which prints `0`, and `X()`/`Y()` keep that unary `+` for
 * exactly that reason. Dropping it emits `-0.00` and every such coordinate
 * differs from the prototype as a string while rendering identically.
 */

/** One segment: label, length in inches, absolute heading in degrees, hem flag. */
export type V7Seg = [string, number, number, 1?] | [string, number, number];

export interface V7ProfileDef {
  name: string;
  segs: V7Seg[];
}

/** v7's nine profile definitions (prototype `DEF`, line 854). */
export const V7_DEF: Record<string, V7ProfileDef> = {
  drip: { name: 'Drip edge', segs: [['Top', 3, 0], ['Face', 2, -75], ['Hem', 0.5, 105, 1]] },
  coping: {
    name: 'Coping',
    segs: [['Drip', 1, 55], ['Face', 4, 90], ['Top', 8, 0], ['Face', 4, -90], ['Drip', 1, -55]],
  },
  snap: {
    name: 'Snap coping',
    segs: [['Hem', 0.5, -90, 1], ['Face', 2, 90], ['Top', 6, 0], ['Face', 2, -90], ['Hem', 0.5, 90, 1]],
  },
  jch: { name: 'J-channel', segs: [['Face', 2.5, -90], ['Base', 2, 0], ['Lip', 0.75, 90]] },
  gravel: {
    name: 'Gravel stop',
    segs: [['Flange', 3, 0], ['Face', 4, 90], ['Top', 4, 0], ['Drip', 1, -65]],
  },
  fascia: { name: 'Fascia', segs: [['Top', 5, 0], ['Face', 6, -90], ['Drip', 1, -135]] },
  valley: { name: 'Valley flashing', segs: [['Leg', 5, -48], ['Center', 1.5, 0], ['Leg', 5, 48]] },
  z: { name: 'Z-closure', segs: [['Top', 2, 0], ['Web', 4, -90], ['Bottom', 3, 0]] },
  counter: {
    name: 'Counterflashing',
    segs: [['Lip', 2, 0], ['Step', 2.5, -90], ['Run', 3.5, 0], ['Face', 3, -90]],
  },
};

/** v7's `NAMES` — profile kind to display name. */
export const V7_NAMES: Record<string, string> = Object.fromEntries(
  Object.keys(V7_DEF).map((k) => [k, V7_DEF[k].name]),
);

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** v7 `fmtIn()` — inches to the nearest 1/16, as a mixed fraction. */
export function fmtIn(v: number): string {
  const t = Math.round(v * 16);
  const w = Math.floor(t / 16);
  const r = t % 16;
  if (!r) return `${w}"`;
  const g = gcd(r, 16);
  const f = `${r / g}/${16 / g}`;
  return `${w ? `${w} ` : ''}${f}"`;
}

/** v7 `esc()`. Needed here because labels are interpolated into markup. */
export function esc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type Resolved = [string, number, number, 1 | undefined];

/** v7 `segsOf()` — the definition's segments with per-segment lengths overridden. */
export function segsOf(kind: string, d?: number[] | null): Resolved[] {
  return V7_DEF[kind].segs.map((s, i) => [
    s[0],
    d && d[i] != null ? d[i] : s[1],
    s[2],
    s[3],
  ] as Resolved);
}

/** v7 `ptsOf()` — walk the turtle, returning polyline points. */
function ptsOf(sg: Resolved[]): [number, number][] {
  let x = 0;
  let y = 0;
  const p: [number, number][] = [[0, 0]];
  sg.forEach((s) => {
    const r = (s[2] * Math.PI) / 180;
    x += s[1] * Math.cos(r);
    y += s[1] * Math.sin(r);
    p.push([x, y]);
  });
  return p;
}

function normT(a: number): number {
  let v = a;
  while (v > 180) v -= 360;
  while (v <= -180) v += 360;
  return v;
}

export interface V7Stats {
  sg: Resolved[];
  /** Developed width: every segment length added up. */
  dev: number;
  hems: number;
  bends: number;
  /** Per-vertex included angle, or null where v7 declines to label one. */
  ang: (number | null)[];
}

/** v7 `stats()`. */
export function stats(kind: string, d?: number[] | null): V7Stats {
  const sg = segsOf(kind, d);
  let dev = 0;
  let hems = 0;
  for (let i = 0; i < sg.length; i++) {
    dev += sg[i][1];
    if (sg[i][3]) hems++;
  }
  const ang: (number | null)[] = [];
  for (let i = 1; i < sg.length; i++) {
    ang.push(
      sg[i][3] || sg[i - 1][3] || sg[i][1] < 1.5 || sg[i - 1][1] < 1.5
        ? null
        : Math.round(180 - Math.abs(normT(sg[i][2] - sg[i - 1][2]))),
    );
  }
  return { sg, dev, hems, bends: sg.length - 1 - hems, ang };
}

/** v7 `bendTxt()` — "3 bends, 1 hem". */
export function bendTxt(st: V7Stats): string {
  return (
    `${st.bends} bend${st.bends === 1 ? '' : 's'}` +
    (st.hems ? `, ${st.hems} hem${st.hems === 1 ? '' : 's'}` : '')
  );
}

/** v7 `dimTxt()` — `3" × 2" × 1/2"`. */
export function dimTxt(kind: string, d?: number[] | null): string {
  return segsOf(kind, d)
    .map((s) => fmtIn(s[1]))
    .join(' × ');
}

export interface DrawOptions {
  w?: number;
  h?: number;
  /** Font size for dimension labels. */
  fs?: number;
  pad?: number;
  /** Stroke width. */
  sw?: number;
  maxScale?: number;
  /** Draw dimension labels. */
  dims?: boolean;
  /** Draw angle arcs and degree labels. */
  ang?: boolean;
  /** 'Up' | 'Down' — draws the painted-side stripe. */
  paint?: string;
  /** Segment indices to highlight as changed. */
  hi?: number[];
}

/**
 * v7 `drawInner()` — the inside of an `<svg viewBox="0 0 W H">`.
 *
 * Transliterated with the arithmetic and the `toFixed` precisions left exactly
 * as the prototype has them. The precisions are not stylistic: the pixel gate
 * compares the rendered result, and a coordinate rounded to a different number
 * of places moves a line by a sub-pixel and shows up as an antialiasing halo
 * along every stroke.
 */
export function drawInner(kind: string, d: number[] | null | undefined, o: DrawOptions = {}): string {
  const W = o.w || 400;
  const H = o.h || 260;
  const sg = segsOf(kind, d);
  const p = ptsOf(sg);
  const n = sg.length;
  let i: number;

  const fs0 = o.fs || Math.max(11, Math.min(W, H) / 18);
  const pad = o.pad != null ? o.pad : o.dims ? Math.max(50, fs0 * 2.7) : 12;
  const xs = p.map((a) => a[0]);
  const ys = p.map((a) => a[1]);
  const x0 = Math.min.apply(null, xs);
  const x1 = Math.max.apply(null, xs);
  const y0 = Math.min.apply(null, ys);
  const y1 = Math.max.apply(null, ys);
  const bw = Math.max(x1 - x0, 0.2);
  const bh = Math.max(y1 - y0, 0.2);
  let s = Math.min((W - 2 * pad) / bw, (H - 2 * pad) / bh);
  if (o.maxScale) s = Math.min(s, o.maxScale);
  const ox = (W - bw * s) / 2 - x0 * s;
  const oy = (H + bh * s) / 2 + y0 * s;
  // The unary + is load-bearing: it turns "-0.00" back into 0. See the header.
  const X = (x: number) => +(ox + x * s).toFixed(2);
  const Y = (y: number) => +(oy - y * s).toFixed(2);
  const sw = o.sw || Math.max(2, Math.min(W, H) / 70);
  const fs = o.fs || Math.max(11, Math.min(W, H) / 18);
  const hi = o.hi || [];
  let out = '';
  let cx = 0;
  let cy = 0;
  for (i = 0; i < p.length; i++) {
    cx += p[i][0];
    cy += p[i][1];
  }
  cx /= p.length;
  cy /= p.length;

  if (o.paint) {
    const side = o.paint === 'Down' ? -1 : 1;
    const off = sw * 1.15 + 1.5;
    for (i = 0; i < n; i++) {
      if (sg[i][3]) continue;
      const th = (sg[i][2] * Math.PI) / 180;
      const nx = -Math.sin(th) * side;
      const ny = Math.cos(th) * side;
      out +=
        `<line class="stripe" stroke-width="${(sw * 0.55).toFixed(2)}" x1="${(X(p[i][0]) + nx * off).toFixed(2)}"` +
        ` y1="${(Y(p[i][1]) - ny * off).toFixed(2)}" x2="${(X(p[i + 1][0]) + nx * off).toFixed(2)}"` +
        ` y2="${(Y(p[i + 1][1]) - ny * off).toFixed(2)}"/>`;
    }
  }

  const hemInfo: Record<number, { mx: number; my: number; nx: number; ny: number }> = {};
  for (i = 0; i < n; i++) {
    if (sg[i][3]) {
      const lead = i === 0;
      const Fp = lead ? p[1] : p[i];
      const ua = (sg[i][2] * Math.PI) / 180;
      const ux = Math.cos(ua) * (lead ? -1 : 1);
      const uy = Math.sin(ua) * (lead ? -1 : 1);
      const ta = (sg[lead ? 1 : i - 1][2] * Math.PI) / 180;
      const nrx = Math.sin(ta);
      const nry = -Math.cos(ta);
      const fx = X(Fp[0]);
      const fy = Y(Fp[1]);
      const usx = ux;
      const usy = -uy;
      const nsx = nrx;
      const nsy = -nry;
      const rr = Math.max(sw * 1.15, 2.4);
      const L = sg[i][1] * s;
      const gx = fx + nsx * 2 * rr;
      const gy = fy + nsy * 2 * rr;
      const dxx = gx - fx;
      const dyy = gy - fy;
      const bmx = -usx * rr;
      const bmy = -usy * rr;
      const swp = dxx * bmy - dyy * bmx < 0 ? 1 : 0;
      const ex = gx + usx * L + nsx * L * 0.07;
      const ey = gy + usy * L + nsy * L * 0.07;
      out +=
        `<path class="ln hem" stroke-width="${sw.toFixed(2)}" d="M${fx.toFixed(1)} ${fy.toFixed(1)}` +
        ` A${rr.toFixed(1)} ${rr.toFixed(1)} 0 0 ${swp} ${gx.toFixed(1)} ${gy.toFixed(1)}` +
        ` L${ex.toFixed(1)} ${ey.toFixed(1)}"/>`;
      hemInfo[i] = { mx: (gx + ex) / 2, my: (gy + ey) / 2, nx: nsx, ny: nsy };
      continue;
    }
    const cls = `ln${hi.indexOf(i) >= 0 ? ' hi' : sg[i][3] ? ' hem' : ''}`;
    out +=
      `<line class="${cls}" stroke-width="${(hi.indexOf(i) >= 0 ? sw * 1.35 : sw).toFixed(2)}"` +
      ` x1="${X(p[i][0])}" y1="${Y(p[i][1])}" x2="${X(p[i + 1][0])}" y2="${Y(p[i + 1][1])}"/>`;
  }

  if (o.ang) {
    for (i = 1; i < n; i++) {
      if (sg[i][3] || sg[i - 1][3] || sg[i][1] < 1.5 || sg[i - 1][1] < 1.5) continue;
      const V = p[i];
      const a = p[i - 1];
      const b = p[i + 1];
      let u1 = [a[0] - V[0], a[1] - V[1]];
      let u2 = [b[0] - V[0], b[1] - V[1]];
      const l1 = Math.hypot(u1[0], u1[1]);
      const l2 = Math.hypot(u2[0], u2[1]);
      u1 = [u1[0] / l1, u1[1] / l1];
      u2 = [u2[0] / l2, u2[1] / l2];
      const ia = Math.round(180 - Math.abs(normT(sg[i][2] - sg[i - 1][2])));
      const r = fs * 1.15;
      const vx = X(V[0]);
      const vy = Y(V[1]);
      const a1 = [vx + u1[0] * r, vy - u1[1] * r];
      const a2 = [vx + u2[0] * r, vy - u2[1] * r];
      const cr = u1[0] * -u2[1] - -u1[1] * u2[0];
      out +=
        `<path class="arc" stroke-width="${Math.max(1.2, sw * 0.4).toFixed(2)}" d="M${a1[0].toFixed(1)} ${a1[1].toFixed(1)}` +
        ` A${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${cr > 0 ? 1 : 0} ${a2[0].toFixed(1)} ${a2[1].toFixed(1)}"/>`;
      let bx = u1[0] + u2[0];
      let by = u1[1] + u2[1];
      const bl = Math.hypot(bx, by) || 1;
      bx /= bl;
      by /= bl;
      const tx = vx + bx * (r + fs * 0.95);
      const ty = vy - by * (r + fs * 0.95);
      out +=
        `<text class="dl a" text-anchor="middle" dominant-baseline="central" font-size="${(fs * 0.78).toFixed(1)}"` +
        ` stroke-width="${(fs * 0.2).toFixed(1)}" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}">${ia}°</text>`;
    }
  }

  if (o.dims) {
    for (i = 0; i < n; i++) {
      if (hemInfo[i]) {
        const hh = hemInfo[i];
        const dd2 = fs * 0.8 + sw * 1.5;
        out +=
          `<text class="dl h" text-anchor="middle" dominant-baseline="central" font-size="${fs.toFixed(1)}"` +
          ` stroke-width="${(fs * 0.24).toFixed(1)}" x="${(hh.mx + hh.nx * dd2).toFixed(1)}"` +
          ` y="${(hh.my + hh.ny * dd2).toFixed(1)}">${fmtIn(sg[i][1])}</text>`;
        continue;
      }
      const th2 = (sg[i][2] * Math.PI) / 180;
      let nl = [-Math.sin(th2), Math.cos(th2)];
      const mid = [(p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2];
      if (nl[0] * (mid[0] - cx) + nl[1] * (mid[1] - cy) < 0) nl = [-nl[0], -nl[1]];
      let dist = fs * 0.95 + sw * 1.4 + (o.paint ? sw * 1.6 : 0);
      if (sg[i][1] * s < fs * 2.6) dist += fs * 0.55;
      const lx = X(mid[0]) + nl[0] * dist;
      const ly = Y(mid[1]) - nl[1] * dist;
      const c2 = hi.indexOf(i) >= 0 ? ' c' : sg[i][3] ? ' h' : '';
      out +=
        `<text class="dl${c2}" text-anchor="middle" dominant-baseline="central" font-size="${fs.toFixed(1)}"` +
        ` stroke-width="${(fs * 0.24).toFixed(1)}" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}">${fmtIn(sg[i][1])}</text>`;
    }
  }
  return out;
}

/** v7 `draw()` — a complete `<svg>` element as markup. */
export function draw(kind: string, d: number[] | null | undefined, o: DrawOptions = {}): string {
  return (
    `<svg viewBox="0 0 ${o.w || 400} ${o.h || 260}" role="img" aria-label="${esc(V7_NAMES[kind])} profile drawing">` +
    drawInner(kind, d, o) +
    '</svg>'
  );
}
