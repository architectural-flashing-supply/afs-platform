#!/usr/bin/env node
/**
 * scope-v7-css.mjs — derive the app's Command Center stylesheet from the
 * verbatim v7 extract, by prefixing every selector with one scope class.
 *
 * WHY THIS IS A TRANSFORM AND NOT A HAND-PORT
 *
 * The Command Center must look like prototype v7 exactly, and the acceptance
 * test (tests/visual/v7-style-gate.spec.ts) compares computed styles against
 * the prototype itself. A hand-retyped stylesheet drifts the moment anyone
 * "improves" a value, and the drift is invisible until the gate catches it.
 * Deriving the CSS mechanically means the live styles ARE v7's styles: the only
 * differences possible are the scope prefix and the documented colour
 * deviations.
 *
 * WHY IT MUST BE SCOPED
 *
 * v7 is a standalone page: it styles `body`, `*`, `:root`, `h1`-`h3`, `table`,
 * `th`, `td`, `input`, `button`, `a`. Loaded globally that would restyle the
 * public marketing site (/, /products, /contact). Everything is therefore
 * prefixed with `.cc-v7`, which only the admin shell sets, and element
 * selectors become descendants of it.
 *
 * WHAT IT DOES
 *
 *   :root{...}            -> .cc-v7{...}          (custom properties land on
 *                                                  the wrapper, so var() still
 *                                                  resolves for descendants)
 *   html,body{...}        -> .cc-v7{...}
 *   body{...}             -> .cc-v7{...}
 *   *{...}                -> .cc-v7,.cc-v7 *{...} (the wrapper needs the
 *                                                  box-sizing reset too)
 *   .card{...}            -> .cc-v7 .card{...}
 *   ::selection{...}      -> .cc-v7 ::selection{...}
 *   #gpeek{...}           -> #gpeek{...}          (see FIXED-POSITION IDS)
 *   @media(...){ rules }  -> @media(...){ scoped rules }
 *   @keyframes name{...}  -> left alone (0%/70%/100% are not selectors)
 *
 * FIXED-POSITION IDS
 *
 * `#gpeek` (the drawing peek) and `#toast` are `position:fixed` overlays that
 * v7 renders as siblings of its app root. Their selectors are left UNSCOPED,
 * which is the permissive choice: a bare `#gpeek` matches whether the node sits
 * inside the wrapper or is portalled to `<body>`, whereas `.cc-v7 #gpeek` would
 * silently stop matching if it were ever portalled.
 *
 * They must nonetheless be RENDERED INSIDE the wrapper, because v7 styles them
 * with `var(--bg)` / `var(--ink)` and the custom properties live on `.cc-v7`.
 * Outside it those var() references have no value and the overlay loses its
 * background. `position:fixed` escapes layout from any ancestor, so being
 * inside costs nothing — provided no ancestor gains `transform`, `filter` or
 * `contain`, which would establish a new containing block.
 *
 * An id is unique enough not to collide with the marketing site.
 * `lib/design/v7-css.test.ts` asserts this list stays exactly these two.
 *
 * Run: pnpm css:v7   (also runs as part of `prebuild`, before the contrast gate)
 * Output is generated and committed, so a build never depends on this script
 * having been run — but `lib/design/v7-css.test.ts` regenerates and compares,
 * so a stale output fails the test suite rather than shipping quietly.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SRC_DIR = path.join(ROOT, 'docs', 'design', 'command-center-v7');
const VERBATIM = path.join(SRC_DIR, 'v7.css');
const DEVIATIONS = path.join(SRC_DIR, 'v7-deviations.css');
const FONTS = path.join(SRC_DIR, 'v7-fonts.css');
const PREFLIGHT = path.join(SRC_DIR, 'v7-preflight-reset.css');
const REAL_DATA = path.join(SRC_DIR, 'v7-real-data.css');
const OUT = path.join(ROOT, 'app', 'styles', 'command-center-v7.generated.css');

/** The one class the admin shell sets. Everything v7 styles hangs off it. */
export const SCOPE = '.cc-v7';

/**
 * Overlays v7 renders outside its app root. They stay unscoped — see the
 * FIXED-POSITION IDS note above.
 */
export const UNSCOPED_IDS = ['#gpeek', '#toast'];

/** Selectors that mean "the page itself" and therefore become the wrapper. */
const PAGE_SELECTORS = new Set(['html', 'body', ':root', 'html,body']);

/**
 * The class that paints v7's PAGE GROUND, kept separate from the scope class.
 *
 * v7 is a standalone page, so it paints its light ground and near-black text on
 * `body`. Mapping that straight onto `.cc-v7` would paint the ground for every
 * admin screen at once — and CLAUDE.md rule #18 is explicit that it must not:
 * the Command Center converts to the light working area ONE SCREEN AT A TIME,
 * and the PAGE opts in rather than the shell deciding. Twenty admin screens
 * still set their text in the light-on-dark `afs-chrome-*` tokens, and a light
 * ground under them is white-on-white.
 *
 * That is not a hypothetical: making `.cc-v7` paint the ground turned the
 * contrast gate red with 46 real failures — `afs-chrome-high` (#FFFFFF) and the
 * four `*-on-dark` tokens at 1.09:1 to 1.69:1 on v7's #F4F5F7 — across every
 * screen that had not been converted.
 *
 * So the transform SPLITS v7's `body` rule:
 *   - typography (font-family, font-size, line-height) -> `.cc-v7`, which is
 *     safe everywhere and is what makes the header and converted screens
 *     correct;
 *   - paint (background, color) -> `.cc-v7-ground`, which a screen opts into
 *     when it is converted.
 *
 * `lib/design/v7-css.test.ts` asserts the split, so nobody can quietly put the
 * paint back on the scope class.
 */
export const GROUND = '.cc-v7-ground';

/**
 * RULES THAT MUST NOT BE SCOPED AT ALL, because scoping them makes them WIN
 * fights they do not win in the prototype.
 *
 * v7 has no Tailwind, so it writes its own form-control reset:
 *
 *     button,input,select,textarea{font:inherit;color:inherit}
 *
 * Scoped, that becomes `.cc-v7 button{...}` — specificity (0,1,1), an element
 * selector plus a class. Every Tailwind utility is (0,1,0). So the scoped reset
 * OUTRANKS `text-afs-chrome-high`, `font-bold`, `text-sm` and every other type
 * or colour utility on any button, input, select or textarea inside the admin
 * shell. In the prototype the same rule is (0,0,1) and loses to everything.
 *
 * That is not theoretical. It was found by tests/e2e/contrast-live.spec.ts,
 * which measures real computed styles in a browser: Settings' crimson "Log this
 * price change" button was rendering its label in the page's inherited
 * `afs-chrome-mid` instead of the `text-afs-chrome-high` its own className
 * asks for — white on crimson is 6.45:1, what actually shipped was 3.50:1.
 * Every unconverted admin control with a Tailwind type or colour class had the
 * same silent override.
 *
 * Dropping the rule loses nothing, because Tailwind's Preflight already
 * supplies exactly these defaults — `font-family`, `font-size`, `font-weight`,
 * `line-height`, `letter-spacing` and `color: inherit` on
 * `button,input,optgroup,select,textarea` — at (0,0,1), which does not compete
 * with utilities. v7's own controls are unaffected: `.btn`, `.f`, `.mbtn`,
 * `.dtab`, `.xbtn` and the rest all set their colour explicitly.
 */
const DROPPED_SELECTORS = new Set(['button,input,select,textarea']);

/** Declarations from v7's `body` rule that paint, rather than set type. */
const GROUND_PROPERTIES = new Set(['background', 'background-color', 'color']);

/**
 * Split a `body` declaration block into [typography, paint].
 */
function splitBodyBlock(body) {
  const type = [];
  const paint = [];
  for (const decl of body.split(';')) {
    const d = decl.trim();
    if (!d) continue;
    const prop = d.slice(0, d.indexOf(':')).trim().toLowerCase();
    (GROUND_PROPERTIES.has(prop) ? paint : type).push(d);
  }
  return [type.join(';'), paint.join(';')];
}

/**
 * Scope one selector from a comma-separated list.
 */
function scopeOne(sel, scope = SCOPE) {
  const s = sel.trim();
  if (!s) return null;

  // `:root`, `body`, `html` -> the wrapper itself.
  if (PAGE_SELECTORS.has(s)) return scope;

  // The universal reset has to cover the wrapper as well as its descendants.
  if (s === '*') return `${scope},${scope} *`;

  // Fixed-position overlays keep their bare id.
  for (const id of UNSCOPED_IDS) {
    if (s === id || s.startsWith(`${id} `) || s.startsWith(`${id}:`) || s.startsWith(`${id}.`)) {
      return s;
    }
  }

  // `body.foo` / `body .foo` -> fold `body` into the wrapper rather than
  // emitting `.cc-v7 body`, which could never match.
  if (s === 'body' || s.startsWith('body.') || s.startsWith('body:')) {
    return scope + s.slice('body'.length);
  }
  if (s.startsWith('body ')) return `${scope} ${s.slice('body '.length)}`;

  return `${scope} ${s}`;
}

/** Scope a whole comma-separated selector list. */
function scopeSelectorList(list, scope = SCOPE) {
  const out = [];
  for (const part of splitTopLevel(list, ',')) {
    const scoped = scopeOne(part, scope);
    if (scoped) out.push(scoped);
  }
  // De-duplicate: `html,body` both collapse to the wrapper.
  return [...new Set(out)].join(',');
}

/**
 * Split on a separator, ignoring separators inside (), [] or quotes — so
 * `:is(a,b)` and `url(a,b)` survive.
 */
function splitTopLevel(text, sep) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let cur = '';
  for (const ch of text) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === sep && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

/**
 * Walk a stylesheet body, scoping rule selectors. Recurses into conditional
 * at-rules (@media, @supports, @container) and leaves @keyframes' percentage
 * "selectors" and all declaration blocks untouched.
 */
/**
 * SCOPE EVERY SELECTOR IN ONE STYLESHEET UNDER ONE CLASS.
 *
 * `scope` and `ground` default to v7's, so every existing caller and the
 * generated v7 output are byte-identical. They are parameters because V8's
 * contract (`docs/design/command-center-v8/`) needs exactly the same transform
 * under `.cc-v8` — and a second copy of a 150-line CSS parser is a second place
 * for the look to drift, which is the failure rule #33 exists to prevent.
 * One transform, two scopes.
 */
export function transform(css, scope = SCOPE, ground = GROUND) {
  let out = '';
  let i = 0;

  while (i < css.length) {
    // Comments pass through verbatim — they carry the block provenance notes.
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      out += css.slice(i, stop);
      i = stop;
      continue;
    }

    // Whitespace between rules.
    if (/\s/.test(css[i])) {
      out += css[i++];
      continue;
    }

    // Read the prelude up to `{` or `;` (a `;` ends an at-rule like @import).
    let j = i;
    let depth = 0;
    let quote = null;
    while (j < css.length) {
      const ch = css[j];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if ((ch === '{' || ch === ';') && depth === 0) break;
      j++;
    }

    if (j >= css.length) {
      out += css.slice(i);
      break;
    }

    const prelude = css.slice(i, j);

    if (css[j] === ';') {
      // A statement at-rule (@import, @charset). Pass through.
      out += prelude + ';';
      i = j + 1;
      continue;
    }

    // Find the matching close brace for this block.
    const bodyStart = j + 1;
    let k = bodyStart;
    let braces = 1;
    quote = null;
    while (k < css.length && braces > 0) {
      const ch = css[k];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (css.startsWith('/*', k)) {
        const end = css.indexOf('*/', k + 2);
        k = end === -1 ? css.length : end + 1;
      } else if (ch === '{') braces++;
      else if (ch === '}') braces--;
      k++;
    }
    const body = css.slice(bodyStart, k - 1);
    const trimmed = prelude.trim();

    if (/^@(media|supports|container|layer)\b/i.test(trimmed)) {
      // Conditional group: scope the rules inside it.
      out += `${prelude}{${transform(body)}}`;
    } else if (/^@keyframes\b/i.test(trimmed) || /^@(font-face|page|property|counter-style)\b/i.test(trimmed)) {
      // Percentage keyframe steps and descriptor blocks are not selectors.
      out += `${prelude}{${body}}`;
    } else if (DROPPED_SELECTORS.has(trimmed.replace(/\s+/g, ''))) {
      // Deliberately emitted as nothing — see DROPPED_SELECTORS above.
      out += '';
    } else if (trimmed === 'body' || trimmed === ':root,body' || trimmed === 'body,:root') {
      // v7 paints the page ground on `body`. Split it: typography stays on the
      // scope class, paint moves to the opt-in ground class. See GROUND above.
      const [type, paint] = splitBodyBlock(body);
      if (type) out += `${scope}{${type}}`;
      if (paint) out += `${ground}{${paint}}`;
      if (!type && !paint) out += `${scope}{${body}}`;
    } else {
      out += `${scopeSelectorList(prelude, scope)}{${body}}`;
    }
    i = k;
  }

  return out;
}

export function buildScopedCss() {
  const verbatim = fs.readFileSync(VERBATIM, 'utf8');
  const deviations = fs.readFileSync(DEVIATIONS, 'utf8');
  const fonts = fs.readFileSync(FONTS, 'utf8');
  const preflight = fs.readFileSync(PREFLIGHT, 'utf8');
  const realData = fs.readFileSync(REAL_DATA, 'utf8');

  const banner = `/*
 * command-center-v7.generated.css — GENERATED. DO NOT EDIT.
 *
 * Produced by scripts/design/scope-v7-css.mjs from, in order:
 *   docs/design/command-center-v7/v7.css             (verbatim prototype CSS)
 *   docs/design/command-center-v7/v7-deviations.css  (WCAG AA fixes only)
 *   docs/design/command-center-v7/v7-fonts.css       (self-hosted font binding)
 *   docs/design/command-center-v7/v7-preflight-reset.css (cancels Tailwind
 *                                                    Preflight rules v7 lacks)
 *   docs/design/command-center-v7/v7-real-data.css   (cases v7's sample data
 *                                                    cannot produce)
 *
 * Every selector is scoped to \`${SCOPE}\`, which only the admin shell sets, so
 * none of this can reach the public marketing site. To change a Command Center
 * style, change the prototype or the deviations file and run \`pnpm css:v7\`.
 * Editing this file directly will be overwritten and will fail
 * lib/design/v7-css.test.ts.
 */
`;

  return `${banner}
/* ============================ scoped from v7.css ============================ */
${transform(verbatim)}

/* ====================== scoped from v7-deviations.css ====================== */
${transform(deviations)}

/* ======================== scoped from v7-fonts.css ======================== */
${transform(fonts)}

/* ================== scoped from v7-preflight-reset.css =================== */
${transform(preflight)}

/* ====================== scoped from v7-real-data.css ===================== */
${transform(realData)}
`;
}

// Only write when run directly, so tests can import buildScopedCss() safely.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (invokedDirectly) {
  const css = buildScopedCss();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  fs.writeFileSync(OUT, css);
  const rel = path.relative(ROOT, OUT).replace(/\\/g, '/');
  console.log(
    `${prev === css ? 'unchanged' : 'wrote'} ${rel} — ${css.split('\n').length} lines, scope ${SCOPE}`,
  );
}

export { OUT, VERBATIM, DEVIATIONS, FONTS, PREFLIGHT, REAL_DATA };
