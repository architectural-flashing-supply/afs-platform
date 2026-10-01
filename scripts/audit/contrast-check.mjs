#!/usr/bin/env node
/**
 * AUTOMATED WCAG AA CONTRAST GATE FOR EVERY COMMAND CENTER SCREEN.
 *
 *   node scripts/audit/contrast-check.mjs            report + exit code
 *   node scripts/audit/contrast-check.mjs --json      machine-readable
 *   node scripts/audit/contrast-check.mjs --failures  only the failing pairs
 *
 * Exit 0 when every measured pair clears its threshold, exit 1 when any does
 * not. This is the script that fails the build.
 *
 * ================= WHY THIS IS NOT A LIST SOMEBODY MAINTAINS =================
 *
 * lib/design/placeholder-contrast.test.ts already guards a hand-picked set of
 * placeholder pairs and has caught real bugs. Its limit is that it can only
 * check pairs a human remembered to enumerate: a new screen is invisible to it
 * until somebody adds a line. That is the failure mode this gate removes.
 *
 * NOTHING HERE IS ENUMERATED BY HAND. Every run derives:
 *
 *   1. THE SCREENS — from lib/data/admin-nav.ts (the real one-level navigation)
 *      plus every page.tsx on or beneath each of those routes, found on disk.
 *   2. THE RENDER TREE — by walking each page's JSX and RECURSING INTO the
 *      components it renders, following imports across files, so a colour pair
 *      is measured against the background the component is really mounted on
 *      rather than against a guess. `{children}` is resolved too: a component
 *      that paints a surface and renders children inside it (LightWorkingArea
 *      is the one that matters here) hands that surface down to its callers'
 *      JSX, exactly as the browser does.
 *   3. THE COLOURS — out of tailwind.config.js, so a retheme moves these numbers
 *      rather than invalidating them. Opacity modifiers (`bg-afs-bg-raised/90`)
 *      and the one rgba token are composited against the surface underneath.
 *   4. THE PAIRS — from the resolved tree.
 *
 * Adding a screen, a component or a colour puts it under the gate
 * automatically. Deleting one removes it. There is no list to forget.
 *
 * ========================= WHAT IS MEASURED, AND WHY =========================
 *
 * TEXT — SC 1.4.3. Every `text-*` colour and every placeholder colour against
 * its resolved background. 4.5:1, or 3:1 where the text is large by WCAG's own
 * definition (>= 24px, or >= 18.66px bold), read off the real size and weight
 * classes on the element. Hover and focus colours are measured too: 1.4.3 has no
 * exemption for a state the user can see. Placeholders get no large-text
 * exemption at all — CLAUDE.md rule #18 is explicit about that.
 *
 * FORM FIELDS — SC 1.4.11. 3:1, for `input` / `select` / `textarea` only, and a
 * field passes if EITHER its fill or its border reaches 3:1 against the surface
 * behind it, or its border reaches 3:1 against its own fill. That is what the
 * criterion asks: the boundary of the control must be perceivable.
 *
 * DELIBERATELY NOT MEASURED, each with the reason:
 *   - A LABELLED BUTTON OR LINK'S FILL. 1.4.11 covers "visual information
 *     required to identify user interface components". A button carrying white
 *     text at 6.45:1 is identified by its label, which 1.4.3 already measures
 *     above. Requiring its crimson fill to clear 3:1 against gunmetal as well is
 *     a common misreading that would fail this design system's signature button
 *     everywhere while making nothing more usable. Form fields are the case the
 *     criterion is actually about — an empty input is identified by its boundary
 *     and by nothing else.
 *   - BORDERS AND DIVIDERS ON NON-INTERACTIVE CONTAINERS. 1.4.11 exempts pure
 *     decoration; a card outline on a card that already differs from the lane
 *     behind it is decoration.
 *   - `disabled:` and `aria-disabled:` variants. 1.4.3 and 1.4.11 both exempt
 *     inactive components explicitly.
 *   - Gradients, and arbitrary values that are not a plain colour. These are
 *     COUNTED and PRINTED as unresolved rather than silently passed, so the gate
 *     cannot become quietly vacuous.
 *
 * ======================= WHY STATIC AND NOT A BROWSER =======================
 *
 * A getComputedStyle sweep of a live page is the most faithful measurement there
 * is, and tests/e2e/contrast-live.spec.ts does exactly that against alpha to
 * confirm these numbers are the ones a browser really paints. It is not what the
 * BUILD gate can be: that would need a running server, an admin session and a
 * deployment, none of which exist when the build runs. This script needs only
 * the repository — and the live spec is what keeps it honest.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const BODY_TEXT_MIN = 4.5;
const LARGE_TEXT_MIN = 3.0;
const FORM_FIELD_MIN = 3.0;
const MAX_COMPONENT_DEPTH = 12;

/* ------------------------------------------------------------------ colour */

function parseHex(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/** WCAG 2.1 relative luminance, straight from the specification's formula. */
function luminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Alpha-composite `fg` at `alpha` over the opaque `bg`, as a browser would. */
function composite(fg, alpha, bg) {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
}

function toHex(rgb) {
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join('')}`;
}

const keyOf = (rgb) => rgb.join(',');

/* -------------------------------------------------------- tailwind tokens */

/**
 * Flattens tailwind.config.js's colour tree into the suffixes Tailwind really
 * generates: `afs.bg-card` becomes `afs-bg-card`, which is what `bg-afs-bg-card`
 * in a className resolves against.
 */
function loadTokens() {
  const config = require(path.join(ROOT, 'tailwind.config.js'));
  const out = new Map();
  const walk = (node, prefix) => {
    for (const [key, value] of Object.entries(node)) {
      const name = prefix ? `${prefix}-${key}` : key;
      if (typeof value === 'string') out.set(name, value);
      else if (value && typeof value === 'object') walk(value, name);
    }
  };
  walk(config.theme.extend.colors, '');
  out.set('white', '#FFFFFF');
  out.set('black', '#000000');
  return out;
}

const TOKENS = loadTokens();

/** A token name -> opaque RGB over `backgroundRgb`, or null if unresolvable. */
function resolveColor(name, backgroundRgb) {
  const raw = TOKENS.get(name);
  if (!raw) return null;
  if (raw.startsWith('#')) return parseHex(raw);
  const rgba = raw.match(/^rgba?\(([^)]+)\)$/);
  if (!rgba) return null;
  const parts = rgba[1].split(',').map((s) => Number(s.trim()));
  const rgb = parts.slice(0, 3);
  if (rgb.some((n) => !Number.isFinite(n))) return null;
  const alpha = parts.length > 3 ? parts[3] : 1;
  return alpha >= 1 ? rgb : composite(rgb, alpha, backgroundRgb ?? [255, 255, 255]);
}

/* --------------------------------------------------------- class parsing */

const EXEMPT_VARIANTS = /^(disabled|aria-disabled|group-disabled|peer-disabled)$/;
/**
 * Variants that style a PSEUDO-ELEMENT, not the element itself.
 *
 * `<input type="file" className="file:bg-afs-btn-secondary file:text-afs-chrome-high">`
 * paints the little browser-drawn button INSIDE the field. Reading
 * `file:bg-*` as the field's own fill made SupplierPriceChangeForm's attachment
 * input look like a 1.48:1 invisible control, when the field has no fill of its
 * own at all and the button it describes is white-on-#4E5568 at 7.44:1. These
 * are measured as what they are — a nested surface sitting on the element's own
 * background.
 */
const PSEUDO_VARIANTS = /^(file|before|after|selection|marker|first-letter|first-line)$/;
const LAYOUT_VARIANTS =
  /^(sm|md|lg|xl|2xl|dark|motion-safe|motion-reduce|print|first|last|odd|even|rtl|ltr|empty)$/;
/** Looks like a colour rather than a length/number in an arbitrary value. */
const ARBITRARY_COLOR = /^\[(#[0-9A-Fa-f]{3,8}|rgba?\(.*\)|hsla?\(.*\))\]$/;

/**
 * Splits `hover:md:text-afs-chrome-high/80` into variants, utility, token and
 * opacity. Returns null for anything that is not a colour utility this gate
 * measures — including `text-[10px]`, which is a size, not a colour.
 */
function parseColorClass(cls) {
  const segments = cls.split(':');
  const utility = segments.pop();
  const variants = segments;
  if (variants.some((v) => EXEMPT_VARIANTS.test(v))) return null;

  const placeholderVariant = variants.includes('placeholder');
  const pseudo = variants.find((v) => PSEUDO_VARIANTS.test(v)) ?? null;
  const stateful = variants.some(
    (v) => !LAYOUT_VARIANTS.test(v) && v !== 'placeholder' && !PSEUDO_VARIANTS.test(v)
  );

  const m = utility.match(/^(bg|text|border|placeholder|ring|outline)-(.+)$/);
  if (!m) return null;
  let kind = m[1];
  let rest = m[2];
  if (placeholderVariant && kind === 'text') kind = 'placeholder';

  let opacity = 1;
  const slash = rest.lastIndexOf('/');
  if (slash > 0) {
    const pct = Number(rest.slice(slash + 1));
    if (Number.isFinite(pct)) {
      opacity = pct / 100;
      rest = rest.slice(0, slash);
    }
  }

  if (rest.startsWith('[')) {
    if (!ARBITRARY_COLOR.test(rest)) return null; // a length, not a colour
    const hex = rest.match(/^\[(#[0-9A-Fa-f]{3,8})\]$/);
    if (!hex) return { kind, token: null, arbitrary: rest, rgb: null, opacity, stateful, pseudo };
    return { kind, token: rest, arbitrary: null, rgb: parseHex(hex[1]), opacity, stateful, pseudo };
  }
  if (!TOKENS.has(rest)) return null;
  return { kind, token: rest, arbitrary: null, rgb: null, opacity, stateful, pseudo };
}

/** WCAG "large text": >= 24px, or >= 18.66px and bold. Read off the real classes. */
const TEXT_PX = {
  'text-xs': 12, 'text-sm': 14, 'text-base': 16, 'text-lg': 18, 'text-xl': 20,
  'text-2xl': 24, 'text-3xl': 30, 'text-4xl': 36, 'text-5xl': 48, 'text-6xl': 60,
  'text-7xl': 72, 'text-8xl': 96, 'text-9xl': 128,
};

function sizeOf(classes, inherited) {
  let px = inherited?.px ?? 16;
  let bold = inherited?.bold ?? false;
  for (const cls of classes) {
    const u = cls.split(':').pop();
    if (TEXT_PX[u] !== undefined) px = TEXT_PX[u];
    const arb = u.match(/^text-\[(\d+(?:\.\d+)?)px\]$/);
    if (arb) px = Number(arb[1]);
    if (/^font-(bold|extrabold|black|semibold)$/.test(u)) bold = true;
    if (/^font-(normal|light|medium|thin)$/.test(u)) bold = false;
  }
  return { px, bold, large: px >= 24 || (bold && px >= 18.66) };
}

/* --------------------------------------------------------- JSX tree build */

const VOID_TAGS = new Set([
  'img', 'input', 'br', 'hr', 'source', 'path', 'circle', 'line', 'rect', 'use',
  'meta', 'link', 'ellipse', 'polygon', 'polyline', 'stop', 'col', 'area',
]);
const FORM_FIELDS = new Set(['input', 'select', 'textarea']);

/**
 * Looks like a value computed at runtime (`TONES[tone]`, `styles.card`,
 * `SOME_MAP`), rather than a class name. Reported as unresolved so the gate
 * cannot silently skip a surface it could not read.
 */
const RUNTIME_LOOKUP = /^[A-Za-z_$][\w$]*(?:\.[\w$]+|\[[^\]]*\])+$/;

/**
 * A className expression -> THE MUTUALLY EXCLUSIVE CLASS SETS IT CAN PRODUCE.
 *
 * This is the difference between a useful gate and a noisy one. The Workbench's
 * summary chip is written as
 *
 *     chip.tone === 'go'
 *       ? '… bg-afs-green-deep text-afs-chrome-high'
 *       : '… bg-afs-bg-card      text-afs-ink-900'
 *
 * Collecting every token on the element and pairing them all up invents two
 * combinations that can never render — white on white at 1.00:1, and ink on
 * green at 3.76:1 — and reports them as defects. Both arms have to be measured,
 * but each arm has to be measured AS AN ARM.
 *
 * So the expression is split into alternatives: a ternary contributes its two
 * branches, a `cond && '…'` contributes "present" and "absent", and a template
 * literal crosses its fixed text with each interpolation's alternatives. Nothing
 * here evaluates a condition — it enumerates what the condition can produce.
 */
function splitTopLevel(expr) {
  // Returns { question, colon } indices of the outermost `? :`, or null.
  let depth = 0;
  let quote = null;
  let question = -1;
  let ternaries = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (quote) {
      if (ch === quote && expr[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; continue; }
    if (depth !== 0) continue;
    if (ch === '?') {
      if (expr[i + 1] === '.' || expr[i + 1] === '?') { i++; continue; } // ?. and ??
      if (question === -1) question = i;
      else ternaries++;
      continue;
    }
    if (ch === ':' && question !== -1) {
      if (ternaries > 0) { ternaries--; continue; }
      return { question, colon: i };
    }
  }
  return null;
}

function splitTemplate(body) {
  // `fixed ${expr} more` -> { fixed: 'fixed  more', parts: ['expr'] }
  const parts = [];
  let fixed = '';
  let i = 0;
  while (i < body.length) {
    if (body[i] === '$' && body[i + 1] === '{') {
      let depth = 0;
      let j = i + 1;
      for (; j < body.length; j++) {
        if (body[j] === '{') depth++;
        else if (body[j] === '}') { depth--; if (depth === 0) break; }
      }
      parts.push(body.slice(i + 2, j));
      fixed += ' ';
      i = j + 1;
      continue;
    }
    fixed += body[i];
    i++;
  }
  return { fixed, parts };
}

function classAlternatives(expr, constants, unresolved, file, line, depth = 0) {
  const text = expr.trim();
  if (!text || depth > 8) return [[]];

  const ternary = splitTopLevel(text);
  if (ternary) {
    const thenPart = text.slice(ternary.question + 1, ternary.colon);
    const elsePart = text.slice(ternary.colon + 1);
    return [
      ...classAlternatives(thenPart, constants, unresolved, file, line, depth + 1),
      ...classAlternatives(elsePart, constants, unresolved, file, line, depth + 1),
    ];
  }

  // `MAP[key] ?? 'fallback'` — both sides are real, so both are alternatives.
  const nullishIdx = topLevelIndexOf(text, '??');
  if (nullishIdx !== -1) {
    return [
      ...classAlternatives(text.slice(0, nullishIdx), constants, unresolved, file, line, depth + 1),
      ...classAlternatives(text.slice(nullishIdx + 2), constants, unresolved, file, line, depth + 1),
    ];
  }

  // `cond && '…'` — the classes are either applied or not.
  const andIdx = topLevelIndexOf(text, '&&');
  if (andIdx !== -1) {
    return [[], ...classAlternatives(text.slice(andIdx + 2), constants, unresolved, file, line, depth + 1)];
  }

  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
    return [tokenize(text.slice(1, -1), constants, unresolved, file, line)];
  }

  if (text.startsWith('`') && text.endsWith('`')) {
    const { fixed, parts } = splitTemplate(text.slice(1, -1));
    let alts = [tokenize(fixed, constants, unresolved, file, line)];
    for (const part of parts) {
      const sub = classAlternatives(part, constants, unresolved, file, line, depth + 1);
      const crossed = [];
      for (const a of alts) for (const b of sub) crossed.push([...a, ...b]);
      alts = crossed.length ? crossed : alts;
    }
    return alts;
  }

  if (text.startsWith('(') && text.endsWith(')')) {
    return classAlternatives(text.slice(1, -1), constants, unresolved, file, line, depth + 1);
  }

  // `TONES[tone]` / `TONES.light` — every value in the map is a real state.
  const lookup = text.match(/^([A-Za-z_$][\w$]*)\s*(?:\[[^\]]*\]|\.[\w$]+)$/);
  if (lookup) {
    const values = constants.objects?.get(lookup[1]);
    if (values) return values.map((v) => tokenize(v, constants, unresolved, file, line));
  }

  // A bare identifier: a resolvable class constant, or something computed.
  return [tokenize(text, constants, unresolved, file, line)];
}

function topLevelIndexOf(expr, needle) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < expr.length - needle.length + 1; i++) {
    const ch = expr[i];
    if (quote) {
      if (ch === quote && expr[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; continue; }
    if (depth === 0 && expr.startsWith(needle, i)) return i;
  }
  return -1;
}

function tokenize(text, constants, unresolved, file, line) {
  const out = [];
  for (const token of text.split(/\s+/).filter(Boolean)) {
    if (constants.has(token)) {
      out.push(...constants.get(token).split(/\s+/).filter(Boolean));
      continue;
    }
    if (RUNTIME_LOOKUP.test(token) || /^[A-Z][A-Z0-9_]{2,}$/.test(token)) {
      unresolved.push({
        file,
        line,
        cls: token,
        why: 'className is computed at runtime, so its colours cannot be read statically',
      });
      continue;
    }
    out.push(token);
  }
  return out;
}

/** The className expression on a tag, as its mutually exclusive class sets. */
function classesInTag(attrs, constants, unresolved, file, line) {
  const idx = attrs.indexOf('className');
  if (idx === -1) return [[]];
  const after = attrs.slice(idx + 'className'.length).replace(/^\s*=\s*/, '');
  if (after.startsWith('"') || after.startsWith("'")) {
    const quote = after[0];
    const end = after.indexOf(quote, 1);
    return [tokenize(end === -1 ? '' : after.slice(1, end), constants, unresolved, file, line)];
  }
  if (!after.startsWith('{')) return [[]];
  let depth = 0;
  let body = '';
  for (let i = 0; i < after.length; i++) {
    if (after[i] === '{') depth++;
    else if (after[i] === '}') {
      depth--;
      if (depth === 0) { body = after.slice(1, i); break; }
    }
  }
  const alts = classAlternatives(body, constants, unresolved, file, line);
  return alts.length ? alts : [[]];
}

/**
 * A deliberately small JSX parser. It finds opening/closing/self-closing tags
 * and nests them, which is all that is needed to answer "what is the nearest
 * ancestor that paints a background". It understands no expressions, and it
 * tolerates what it cannot parse by leaving the stack alone.
 */
function parseTree(source, constants, unresolved, file) {
  const root = { name: '#root', attrs: '', classes: [[]], children: [], line: 1, start: 0, end: source.length };
  const stack = [root];
  const tagRe =
    /<\/?([A-Za-z][A-Za-z0-9._]*)((?:[^<>'"{}]|'[^']*'|"[^"]*"|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*?)(\/?)>/g;
  let m;
  while ((m = tagRe.exec(source)) !== null) {
    const name = m[1];
    const attrs = m[2] ?? '';
    const selfClosing = m[3] === '/';
    if (m[0].startsWith('</')) {
      const i = stack.map((e) => e.name).lastIndexOf(name);
      if (i > 0) {
        stack[i].end = m.index;
        stack.length = i;
      }
      continue;
    }
    const node = {
      name,
      attrs,
      classes: classesInTag(attrs, constants, unresolved, file, source.slice(0, m.index).split(String.fromCharCode(10)).length),
      children: [],
      line: source.slice(0, m.index).split('\n').length,
      start: m.index,
      end: m.index + m[0].length,
    };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing && !VOID_TAGS.has(name.toLowerCase())) stack.push(node);
  }
  return root;
}

/** Innermost node whose span contains `index`. */
function nodeAt(root, index) {
  let best = null;
  const visit = (node) => {
    if (node !== root && !(node.start <= index && index <= node.end)) return;
    if (node !== root) best = node;
    for (const c of node.children) visit(c);
  };
  visit(root);
  return best;
}

/* --------------------------------------------------- files and the screens */

const SOURCE_CACHE = new Map();
function readSource(rel) {
  if (!SOURCE_CACHE.has(rel)) {
    const abs = path.join(ROOT, rel);
    SOURCE_CACHE.set(rel, fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null);
  }
  return SOURCE_CACHE.get(rel);
}

function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(path.join(ROOT, fromFile)), spec);
  else return null;
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    if (fs.existsSync(base + ext)) return path.relative(ROOT, base + ext).split(path.sep).join('/');
  }
  return null;
}

/**
 * MODULE-LEVEL CLASS CONSTANTS, RESOLVED ACROSS FILES.
 *
 * Not every className is a literal. The one that matters most here is
 * `LIGHT_WORKING_AREA_CLASS` — a plain exported string in
 * lib/data/admin-working-area.ts, deliberately kept there so "which screens are
 * light" is testable data rather than a copy-pasted class string. A gate that
 * read only literals would never see its `bg-afs-bg-band`, and would then
 * measure every light Command Center screen against the gunmetal shell behind
 * it: ink-900 reported at 1.37:1, and wrong about all of it.
 *
 * So simple `const NAME = '…'` declarations are resolved, locally and through
 * imports, and substituted wherever they appear in a className — bare, or
 * interpolated into a template literal.
 */
const CONST_CACHE = new Map();
function stringConstants(file, depth = 0) {
  if (CONST_CACHE.has(file)) return CONST_CACHE.get(file);
  const out = new Map();
  CONST_CACHE.set(file, out); // set first, so an import cycle terminates
  const src = readSource(file);
  if (src === null || depth > 4) return out;

  const declRe = new RegExp(
    String.raw`(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]*)?=\s*(['"` + '`' + String.raw`])((?:[^'"` + '`' + String.raw`\\]|\\.)*)\2\s*;`,
    'g'
  );
  for (const m of src.matchAll(declRe)) {
    if (m[3].includes('${')) continue; // interpolated: not a fixed class string
    out.set(m[1], m[3]);
  }
  for (const m of src.matchAll(/import\s+([^;]+?)\s+from\s+'([^']+)'/g)) {
    const target = resolveImport(m[2], file);
    if (!target) continue;
    const named = m[1].match(/\{([^}]*)\}/);
    if (!named) continue;
    const from = stringConstants(target, depth + 1);
    for (const part of named[1].split(',')) {
      const nm = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (nm && from.has(nm)) out.set(nm, from.get(nm));
    }
  }
  return out;
}

/**
 * CLASS MAPS — `const TONES = { light: '…', dark: '…' }`, then
 * `className={TONES[tone]}`.
 *
 * This codebase uses that shape wherever a component has two palettes: Badge's
 * `TEXT_CLASS[variant]`, PanelErrorBoundary's `TONES[tone]`. The key is only
 * known at runtime, but the SET OF POSSIBLE VALUES is right there in the file,
 * and every one of them is a surface a user can really see. So each value
 * becomes an alternative — the same treatment a ternary's two arms get.
 *
 * Without this they were reported as unresolved, which is honest but useless:
 * Badge renders on nearly every Command Center screen.
 */
const OBJECT_CACHE = new Map();
function objectConstants(file) {
  if (OBJECT_CACHE.has(file)) return OBJECT_CACHE.get(file);
  const out = new Map();
  OBJECT_CACHE.set(file, out);
  const src = readSource(file);
  if (src === null) return out;

  const declRe = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]*)?=\s*\{/g;
  let m;
  while ((m = declRe.exec(src)) !== null) {
    let depth = 0;
    let end = -1;
    for (let i = m.index + m[0].length - 1; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end === -1) continue;
    const bodyText = src.slice(m.index + m[0].length, end);
    const values = [];
    for (const v of bodyText.matchAll(/:\s*'([^']*)'|:\s*"([^"]*)"/g)) values.push(v[1] ?? v[2] ?? '');
    // Only a map whose values look like class strings is of any use here.
    const classy = values.filter((v) => /(^|\s)(bg|text|border|placeholder|ring)-/.test(v));
    if (classy.length) out.set(m[1], classy);
  }
  return out;
}

/** Imported JSX component name -> the .tsx file that defines it. */
const IMPORT_CACHE = new Map();
function componentImports(file) {
  if (IMPORT_CACHE.has(file)) return IMPORT_CACHE.get(file);
  const src = readSource(file) ?? '';
  const map = new Map();
  for (const m of src.matchAll(/import\s+([^;]+?)\s+from\s+'([^']+)'/g)) {
    const target = resolveImport(m[2], file);
    if (!target || !target.endsWith('.tsx')) continue;
    const clause = m[1];
    const def = clause.match(/^(?:type\s+)?([A-Za-z_$][\w$]*)/);
    if (def && !clause.trimStart().startsWith('{')) map.set(def[1], target);
    const named = clause.match(/\{([^}]*)\}/);
    if (named) {
      for (const part of named[1].split(',')) {
        const nm = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (nm && /^[A-Z]/.test(nm)) map.set(nm, target);
      }
    }
  }
  IMPORT_CACHE.set(file, map);
  return map;
}

function navRoutes() {
  const nav = readSource('lib/data/admin-nav.ts');
  if (!nav) throw new Error('lib/data/admin-nav.ts not found — the screen list cannot be derived.');
  const routes = new Map();
  for (const m of nav.matchAll(/\{\s*label:\s*'([^']+)',\s*href:\s*'([^']+)'/g)) routes.set(m[2], m[1]);
  const search = nav.match(/ADMIN_SEARCH_HREF\s*=\s*'([^']+)'/);
  if (search) routes.set(search[1], 'Search');
  if (routes.size === 0) throw new Error('No routes parsed out of lib/data/admin-nav.ts — refusing to report a vacuous pass.');
  return routes;
}

function pagesUnder(route) {
  const dir = path.join(ROOT, 'app', route.replace(/^\//, ''));
  if (!fs.existsSync(dir)) return [];
  const found = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'page.tsx') found.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  };
  walk(dir);
  return found.sort();
}

/* ------------------------------------------------------------- the walker */

/**
 * Walks one file's JSX with a known incoming background, recursing into the
 * components it renders, and collects every colour pair it can resolve.
 *
 * `childrenBg` is the background in force at the point the file writes
 * `{children}` — that is what a wrapper component hands down to its caller's
 * JSX, and it is the whole reason LightWorkingArea's light surface reaches the
 * Workbench's own markup instead of stopping at the wrapper.
 */
const CHILD_BG_CACHE = new Map();

function analyze(file, incomingBgs, out, depth, visiting) {
  const src = readSource(file);
  if (src === null || depth > MAX_COMPONENT_DEPTH) return incomingBgs;
  const stamp = `${file}@${incomingBgs.map(keyOf).join('|')}`;
  if (visiting.has(stamp)) return CHILD_BG_CACHE.get(stamp) ?? incomingBgs;
  visiting.add(stamp);

  const imports = componentImports(file);
  // WHERE `{children}` IS ACTUALLY RENDERED — not the first text that looks
  // like it. `export default function LightWorkingArea({ children }: …)` puts a
  // literal `{ children }` in the DESTRUCTURED PARAMETER LIST, several lines
  // before the JSX, and matching that one put the wrapper's `{children}` outside
  // every element — so the light working area's background never reached the
  // pages inside it and every light screen was measured against the gunmetal
  // shell. The right occurrence is the first one that falls INSIDE a parsed JSX
  // element.
  const constants = stringConstants(file);
  constants.objects = objectConstants(file);
  const tree = parseTree(src, constants, out.unresolved, file);
  let childrenIdx = -1;
  for (const m of src.matchAll(/\{\s*(?:props\.)?children\s*\}/g)) {
    if (nodeAt(tree, m.index)) {
      childrenIdx = m.index;
      break;
    }
  }
  let childrenBgs = null;

  const visit = (node, parentBgs, inheritedSize) => {
    const allBgs = [];
    let size = sizeOf([], inheritedSize);

    // EVERY ALTERNATIVE IS MEASURED AS AN ALTERNATIVE. A ternary's two arms are
    // two states this element can really be in; what they are not is one state
    // whose colours can be mixed with each other.
    for (const classes of node.classes) {
      const all = classes.map(parseColorClass).filter(Boolean);
      // A pseudo-element is its own little surface sitting on this element's
      // background — `file:bg-*` is the browser's Choose-file button, not the
      // field's fill. Separated here so neither can be mistaken for the other.
      const parsed = all.filter((p) => !p.pseudo);
      const pseudoGroups = new Map();
      for (const p of all) {
        if (!p.pseudo) continue;
        if (!pseudoGroups.has(p.pseudo)) pseudoGroups.set(p.pseudo, []);
        pseudoGroups.get(p.pseudo).push(p);
      }
      const altSize = sizeOf(classes, inheritedSize);
      if (altSize.px > size.px || (altSize.bold && !size.bold)) size = altSize;

      // --- this alternative's background, composited over the parent's
      const ownBgs = [];
      for (const p of parsed) {
        if (p.kind !== 'bg') continue;
        if (p.arbitrary) {
          out.unresolved.push({ file, line: node.line, cls: `bg-${p.arbitrary}`, why: 'arbitrary colour is not a plain hex' });
          continue;
        }
        for (const pb of parentBgs) {
          const c = p.rgb ?? resolveColor(p.token, pb);
          if (!c) continue;
          ownBgs.push(p.opacity < 1 ? composite(c, p.opacity, pb) : c);
        }
      }
      if (classes.some((c) => /(^|:)bg-gradient-to-/.test(c))) {
        out.unresolved.push({ file, line: node.line, cls: 'bg-gradient-*', why: 'a gradient has no single background colour' });
      }
      const altBgs = ownBgs.length ? dedupe(ownBgs) : parentBgs;
      allBgs.push(...altBgs);

      // --- text and placeholder (SC 1.4.3), against THIS alternative's surface
      for (const p of parsed) {
        if (p.kind !== 'text' && p.kind !== 'placeholder') continue;
        if (p.arbitrary) {
          out.unresolved.push({ file, line: node.line, cls: `${p.kind}-${p.arbitrary}`, why: 'arbitrary colour is not a plain hex' });
          continue;
        }
        const min = p.kind === 'placeholder' ? BODY_TEXT_MIN : altSize.large ? LARGE_TEXT_MIN : BODY_TEXT_MIN;
        for (const bg of altBgs) {
          const base = p.rgb ?? resolveColor(p.token, bg);
          if (!base) continue;
          const fg = p.opacity < 1 ? composite(base, p.opacity, bg) : base;
          record(out, {
            rule: p.kind === 'placeholder' ? 'placeholder' : altSize.large ? 'large text' : 'body text',
            token: p.token,
            fgHex: toHex(fg),
            bgHex: toHex(bg),
            ratio: contrast(fg, bg),
            min,
            file,
            line: node.line,
            stateful: p.stateful,
            px: altSize.px,
          });
        }
      }

      // --- pseudo-element surfaces, measured on their own terms
      for (const [name, group] of pseudoGroups) {
        const pseudoBgs = [];
        for (const p of group) {
          if (p.kind !== 'bg' || p.arbitrary) continue;
          for (const pb of altBgs) {
            const c = p.rgb ?? resolveColor(p.token, pb);
            if (c) pseudoBgs.push(p.opacity < 1 ? composite(c, p.opacity, pb) : c);
          }
        }
        const surfaces = pseudoBgs.length ? dedupe(pseudoBgs) : altBgs;
        for (const p of group) {
          if (p.kind !== 'text' && p.kind !== 'placeholder') continue;
          if (p.arbitrary) continue;
          for (const bg of surfaces) {
            const base = p.rgb ?? resolveColor(p.token, bg);
            if (!base) continue;
            const fg = p.opacity < 1 ? composite(base, p.opacity, bg) : base;
            record(out, {
              rule: p.kind === 'placeholder' ? 'placeholder' : 'body text',
              token: `${name}:${p.token}`,
              fgHex: toHex(fg),
              bgHex: toHex(bg),
              ratio: contrast(fg, bg),
              min: BODY_TEXT_MIN,
              file,
              line: node.line,
              stateful: false,
              px: altSize.px,
            });
          }
        }
      }

      // --- form fields (SC 1.4.11) — see the header for why only these
      if (FORM_FIELDS.has(node.name.toLowerCase())) {
        const borders = [];
        for (const p of parsed) {
          if (p.kind !== 'border' && p.kind !== 'ring' && p.kind !== 'outline') continue;
          if (p.arbitrary) continue;
          for (const pb of parentBgs) {
            const c = p.rgb ?? resolveColor(p.token, pb);
            if (c) borders.push(p.opacity < 1 ? composite(c, p.opacity, pb) : c);
          }
        }
        if (ownBgs.length || borders.length) {
          for (const pb of parentBgs) {
            const options = [
              ...ownBgs.map((f) => contrast(f, pb)),
              ...borders.map((b) => contrast(b, pb)),
              ...borders.flatMap((b) => ownBgs.map((f) => contrast(b, f))),
            ];
            record(out, {
              rule: 'form field',
              token: `<${node.name}> fill ${ownBgs.length ? toHex(ownBgs[0]) : 'none'} / border ${borders.length ? toHex(borders[0]) : 'none'}`,
              fgHex: ownBgs.length ? toHex(ownBgs[0]) : toHex(borders[0]),
              bgHex: toHex(pb),
              ratio: Math.max(...options),
              min: FORM_FIELD_MIN,
              file,
              line: node.line,
              stateful: false,
              px: altSize.px,
            });
          }
        }
      }
    }

    // Children can sit on any surface this element can take, which is the union.
    const myBgs = dedupe(allBgs.length ? allBgs : parentBgs);

    // --- recurse into a rendered component, and let it supply its children's bg
    let childBgsForThisNode = myBgs;
    const target = imports.get(node.name) ?? imports.get(node.name.split('.')[0]);
    if (target && target !== file) {
      const produced = analyze(target, myBgs, out, depth + 1, visiting);
      if (produced && produced.length) childBgsForThisNode = produced;
    }

    for (const child of node.children) visit(child, childBgsForThisNode, size);

    if (childrenIdx >= 0 && childrenBgs === null && node.start <= childrenIdx && childrenIdx <= node.end) {
      childrenBgs = myBgs;
    }
  };

  for (const child of tree.children) visit(child, incomingBgs, null);

  // A more precise answer for `{children}`: the innermost element enclosing it.
  if (childrenIdx >= 0) {
    const holder = nodeAt(tree, childrenIdx);
    if (holder) {
      const resolved = resolveNodeBg(tree, holder, incomingBgs);
      if (resolved) childrenBgs = resolved;
    }
  }

  const result = childrenBgs ?? incomingBgs;
  CHILD_BG_CACHE.set(stamp, result);
  visiting.delete(stamp);
  return result;
}

/** Re-resolve one node's background by walking the chain from the tree root. */
function resolveNodeBg(root, target, incomingBgs) {
  const chain = [];
  const find = (node, trail) => {
    if (node === target) { chain.push(...trail, node); return true; }
    for (const c of node.children) if (find(c, [...trail, node])) return true;
    return false;
  };
  find(root, []);
  let bgs = incomingBgs;
  for (const node of chain) {
    if (node === root) continue;
    const own = [];
    for (const classes of node.classes) {
      for (const p of classes.map(parseColorClass).filter(Boolean)) {
        if (p.kind !== 'bg' || p.arbitrary) continue;
        for (const pb of bgs) {
          const c = p.rgb ?? resolveColor(p.token, pb);
          if (c) own.push(p.opacity < 1 ? composite(c, p.opacity, pb) : c);
        }
      }
    }
    if (own.length) bgs = dedupe(own);
  }
  return bgs;
}

function dedupe(list) {
  const seen = new Map();
  for (const rgb of list) seen.set(keyOf(rgb), rgb);
  return [...seen.values()];
}

function record(out, finding) {
  const key = `${finding.rule}|${finding.fgHex}|${finding.bgHex}|${finding.min}`;
  const existing = out.byKey.get(key);
  if (existing) {
    // Keep the first site, but never let a passing duplicate hide a failing one.
    if (!finding.stateful && existing.stateful) existing.stateful = false;
    return;
  }
  finding.pass = finding.ratio >= finding.min;
  out.byKey.set(key, finding);
  out.findings.push(finding);
}

/* ----------------------------------------------------------------- screens */

function adminRootBackground() {
  // The gunmetal shell every Command Center screen renders inside, read off the
  // real component rather than restated as a constant here.
  const src = readSource('components/layout/AdminShell.tsx') ?? '';
  const m = src.match(/bg-(afs-[a-z0-9-]+)/);
  if (!m) throw new Error('Could not read AdminShell.tsx\'s root background — refusing to guess it.');
  const rgb = resolveColor(m[1], [255, 255, 255]);
  if (!rgb) throw new Error(`AdminShell's root background token ${m[1]} is not in tailwind.config.js.`);
  return { token: m[1], rgb };
}

function buildScreens() {
  const routes = navRoutes();
  const root = adminRootBackground();
  const screens = [];
  const seen = new Set();

  for (const [route, label] of routes) {
    for (const page of pagesUnder(route)) {
      if (seen.has(page)) continue;
      seen.add(page);
      const asRoute = `/${page.replace(/^app\//, '').replace(/\/page\.tsx$/, '')}`;
      screens.push({
        label: asRoute === route ? label : `${label}: /${asRoute.slice(route.length + 1)}`,
        route: asRoute,
        page,
        root,
      });
    }
  }

  // THE SIGN-IN PAGE IS A COMMAND CENTER SCREEN.
  //
  // It is not under /admin and it is not in the nav, so the derivation above
  // misses it — and it is the only way into every screen the derivation does
  // find. tests/e2e/contrast-live.spec.ts measured it by accident (it landed
  // there before it was signed in) and found six real failures, including a
  // crimson "Create one" link at 1.71:1. Added here by finding the route group
  // on disk rather than by naming a file, for the same reason as everything
  // else in this script: so it keeps working if the page moves.
  const authPages = pagesUnder('(auth)');
  for (const page of authPages) {
    if (seen.has(page)) continue;
    seen.add(page);
    const asRoute = `/${page.replace(/^app\/\(auth\)\//, '').replace(/\/page\.tsx$/, '')}`;
    screens.push({ label: `Sign-in flow: ${asRoute}`, route: asRoute, page, root });
  }

  return screens.sort((a, b) => a.route.localeCompare(b.route));
}

function measure(screen) {
  const out = { findings: [], unresolved: [], byKey: new Map(), files: new Set() };
  // The shell above the page is part of the screen, so it is measured with it.
  // The sign-in flow has its own shell; everything else has the gunmetal header.
  const shell = screen.page.startsWith('app/(auth)/')
    ? 'components/layout/AuthShell.tsx'
    : 'components/layout/AdminShell.tsx';
  analyze(shell, [screen.root.rgb], out, 0, new Set());
  const incoming = CHILD_BG_CACHE.get(`${shell}@${keyOf(screen.root.rgb)}`) ?? [screen.root.rgb];
  analyze(screen.page, incoming, out, 0, new Set());
  return { ...screen, findings: out.findings, unresolved: out.unresolved };
}

/* ----------------------------------------------------------------- report */

const fmt = (n) => `${n.toFixed(2)}:1`;

function main() {
  const asJson = process.argv.includes('--json');
  const onlyFailures = process.argv.includes('--failures');
  const screens = buildScreens().map(measure);

  if (screens.length === 0) {
    console.error('No Command Center screens were found. That is a broken gate, not a pass.');
    process.exit(1);
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        screens.map((s) => ({ route: s.route, label: s.label, findings: s.findings, unresolved: s.unresolved })),
        null,
        2
      )
    );
  }

  let failed = 0;
  let measured = 0;
  let unresolvedTotal = 0;

  if (!asJson) {
    console.log('WCAG AA CONTRAST GATE — every Command Center screen');
    console.log(
      `Thresholds: body text ${BODY_TEXT_MIN}:1 · large text ${LARGE_TEXT_MIN}:1 · form fields ${FORM_FIELD_MIN}:1 · placeholders are body text`
    );
    console.log('Screens from lib/data/admin-nav.ts + app/; colours from tailwind.config.js; backgrounds resolved through the real render tree.');
    console.log(`Shell background: ${screen0(screens).root.token} ${toHex(screen0(screens).root.rgb)}`);
    console.log('');
  }

  for (const screen of screens) {
    const fails = screen.findings.filter((f) => !f.pass);
    failed += fails.length;
    measured += screen.findings.length;
    unresolvedTotal += screen.unresolved.length;
    if (asJson) continue;

    const worst = screen.findings.length ? Math.min(...screen.findings.map((f) => f.ratio)) : Infinity;
    console.log(
      `${fails.length ? 'FAIL' : 'PASS'}  ${screen.route}  (${screen.label})  ` +
        `${screen.findings.length} pairs · ${fails.length} below · worst ${Number.isFinite(worst) ? fmt(worst) : 'n/a'}`
    );
    const rows = [...screen.findings].sort((a, b) => a.ratio - b.ratio).filter((f) => !onlyFailures || !f.pass);
    for (const f of rows) {
      console.log(
        `      ${f.pass ? ' ok ' : 'FAIL'} ${fmt(f.ratio).padStart(8)} (needs ${f.min}:1) ${f.rule.padEnd(11)} ` +
          `${f.fgHex} on ${f.bgHex}  ${f.token}${f.stateful ? ' [state]' : ''}  ${f.file}:${f.line}`
      );
    }
    for (const u of dedupeUnresolved(screen.unresolved)) {
      console.log(`      ???? unresolved  ${u.cls}  (${u.why})  ${u.file}:${u.line}`);
    }
    console.log('');
  }

  if (!asJson) {
    console.log('—'.repeat(96));
    console.log(
      `${screens.length} screens · ${measured} colour pairs measured · ${unresolvedTotal} unresolved · ${failed} below threshold`
    );
    console.log(failed === 0 ? 'PASS — every measured pair clears WCAG AA.' : `FAIL — ${failed} pair(s) below threshold.`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

function screen0(screens) {
  return screens[0];
}

function dedupeUnresolved(list) {
  const seen = new Set();
  return list.filter((u) => {
    const k = `${u.file}:${u.line}:${u.cls}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

main();
