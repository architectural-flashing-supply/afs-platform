# DESIGN_TOKENS.md
## AFS — Design System
**Derived from AFS chrome/red/black shield logo. Single fixed gunmetal theme.**
**No toggles. No modes. The interior of the shield is the site.**

**Locked and confirmed by a real reversal.** A site-wide light silver
rebrand was built and shipped (`b3512f1`), then fully reverted
(`git revert b3512f1` → `6903d00`) one session later, per explicit
instruction that it had been "applied in error." Dark gunmetal is
canonical — the tokens below are `app/globals.css` and
`tailwind.config.js`'s actual current values, verified against the source
files, not carried forward from memory. Two narrow, deliberately-scoped
exceptions sit on top of this reverted dark theme and are not a
design-system change: (1) `app/(public)/products/page.tsx`,
`app/configure/page.tsx`, `app/quote/page.tsx` each have one inline
`#B8BEC8` background on their main content div plus crimson/black bold
titles, per an explicit instruction naming exactly those files; (2)
`afs-ink-900`/`afs-ink-700` were re-added as real tokens (not the rest of
the light theme) because FlashDraft's 2D canvas needs dark dimension-label
text on its light drawing surface — they're listed below since they're
real, current tokens.

---

## 1. DESIGN CHARACTER

The AFS logo is a dimensional chrome-beveled shield with deep crimson letterforms
set against a near-absolute graphite background. The site earns that energy by
being its precise, disciplined counterpart.

**Character:** A fabrication shop lit by daylight through skylights. Concrete
floors, steel surfaces, polished tooling. Not a dark nightclub. Not a bright
tech startup. An industrial workspace with precision and authority.

**The rule:** One loud element per viewport. The crimson CTA is the loudest
thing on the page. Everything else is the disciplined arena around it.

**The signature element — The Metal Edge:** A 1px diagonal-cut rule at 12°
skew applied to hero sections, feature cards, and primary CTA containers.
This references the bevel geometry cut on the AFS shield logo. It appears on
no competitor's site.

---

## 2. COLOR TOKENS

Derived from the four tonal zones visible in the logo:
1. Shield interior background → page backgrounds
2. Chrome bevel gradient → type hierarchy
3. Crimson letterforms → the only warm accent
4. Copper (not in logo) → architect portal distinction only

```css
/* ─────────────────────────────────────
   app/globals.css — actual current :root block, verified against source
   ───────────────────────────────────── */

:root {
  /* BACKGROUNDS — Gunmetal scale */
  --afs-bg-dim:       #1C1F26;
  --afs-bg-base:      #2A2D35;
  --afs-bg-raised:    #363C4A;
  --afs-bg-surface:   #404858;
  --afs-bg-overlay:   #4E5568;
  --afs-bg-modal:     rgba(42, 45, 53, 0.92);

  /* CHROME TYPE HIERARCHY */
  --afs-chrome-high:   #FFFFFF;
  --afs-chrome-mid:    #B8BFD0;
  --afs-chrome-base:   #9AA0B8;
  --afs-chrome-dim:    #7A8299;
  --afs-chrome-silver: #C8D0E0;
  --afs-chrome-ghost:  rgba(154, 160, 184, 0.15);

  /* INK — dark text for use on light surfaces only (FlashDraft's 2D canvas
     drawing area, which is intentionally light per the CANVAS_COLORS
     exception below — see §10). Re-added after the afs-027 light-theme
     revert specifically for this one need; not used site-wide. */
  --afs-ink-900:       #111111;
  --afs-ink-700:       #374151;

  /* CRIMSON — Fixed identity constant. Never changes. */
  --afs-crimson:       #C0001A;
  --afs-crimson-hover: #E8001F;
  --afs-crimson-dim:   #7A0010;
  --afs-crimson-ghost: rgba(192, 0, 26, 0.12);
  --afs-crimson-glow:  0 0 20px rgba(192, 0, 26, 0.30);

  /* SECONDARY BUTTON FILL */
  --afs-btn-secondary: #4E5568;

  /* COPPER — Architect portal only */
  --afs-copper:        #B87333;
  --afs-copper-hover:  #D4956A;
  --afs-copper-ghost:  rgba(184, 115, 51, 0.12);

  /* AMBER — rush/warning-adjacent accent, distinct from --afs-warning */
  --afs-amber:         #F59E0B;
  --afs-amber-dim:     #92650A;
  --afs-amber-ghost:   rgba(245, 158, 11, 0.12);

  /* BORDERS — referenced by components via the arbitrary-value syntax
     border-[var(--afs-border)], not exposed as a Tailwind color key */
  --afs-border:        rgba(78, 85, 104, 0.8);
  --afs-border-strong: rgba(180, 190, 210, 0.35);

  /* SEMANTIC */
  --afs-success:       #1E8A52;
  --afs-success-ghost: rgba(30, 138, 82, 0.12);
  --afs-warning:       #C48A00;
  --afs-info:          #3478B0;
}
```

The Metal Edge gradients (`.metal-edge`/`.metal-edge-red`/`.metal-edge-copper`)
are defined as literal `linear-gradient(...)` values directly inside those
CSS classes in `globals.css`, not as separate `--afs-edge-*` custom
properties — there is no standalone edge-gradient token to reference from
JSX; use the `.metal-edge`/`.metal-edge-red`/`.metal-edge-copper` classes
themselves.

**`afs-accent-green` (`#00C853`) and `afs-accent-purple` (`#4A0072`)** are
real Tailwind color keys (`tailwind.config.js`) but are **not** defined as
`--afs-*` CSS custom properties in `globals.css` — they're only reachable
via the `afs-accent-green`/`afs-accent-purple` Tailwind utility classes
(`text-afs-accent-green`, `border-afs-accent-green`, etc.), not via
`var(--afs-accent-green)`. They are non-semantic, feature-specific accents
(currently used only by FlashDraft's bend-radius UI) — deliberately kept
separate from `afs-success` (`#1E8A52`), which remains the platform's real
semantic success color across ~22 files.

---

## 3. TAILWIND CONFIGURATION

```javascript
// tailwind.config.js — actual current file (plain JS, not .ts — the
// project uses .js despite BLUEPRINT.md's directory listing showing
// tailwind.config.ts; Next.js accepts either, this repo picked .js).
// Colors are literal hex duplicated from globals.css's :root block, NOT
// var(--afs-*) references — the two files must be kept in sync by hand.

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        afs: {
          'bg-dim':     '#1C1F26',
          'bg-base':    '#2A2D35',
          'bg-raised':  '#363C4A',
          'bg-surface': '#404858',
          'bg-overlay': '#4E5568',
          'chrome-high':   '#FFFFFF',
          'chrome-mid':    '#B8BFD0',
          'chrome-base':   '#9AA0B8',
          'chrome-dim':    '#7A8299',
          'chrome-silver': '#C8D0E0',
          'ink-900':       '#111111',
          'ink-700':       '#374151',
          'crimson':       '#C0001A',
          'crimson-hover': '#E8001F',
          'crimson-dim':   '#7A0010',
          'btn-secondary': '#4E5568',
          'border':        'rgba(78,85,104,0.8)',
          'copper':        '#B87333',
          'copper-hover':  '#D4956A',
          'amber':         '#F59E0B',
          'amber-dim':     '#92650A',
          'success':       '#1E8A52',
          'warning':       '#C48A00',
          'info':          '#3478B0',
          'accent-green':  '#00C853',
          'accent-purple': '#4A0072',
        }
      },
      fontFamily: {
        display: ['var(--font-bebas)', 'sans-serif'],
        heading: ['var(--font-barlow-condensed)', 'sans-serif'],
        label:   ['var(--font-barlow)', 'sans-serif'],
        body:    ['var(--font-inter)', 'sans-serif'],
        data:    ['var(--font-jetbrains)', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm:      '2px',
        lg:      '6px',
      },
      boxShadow: {
        card:    '0 1px 3px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.25)',
        raised:  '0 4px 24px rgba(0,0,0,0.40)',
        crimson: '0 0 20px rgba(192,0,26,0.30)',
        chrome:  '0 0 12px rgba(200,208,224,0.22)',
      },
    },
  },
  plugins: [],
};
```

Note there is no `text-primary`/`text-body`/`text-muted`/`text-disabled`/
`text-inverse` alias group and no `error` key in the real file — components
use `text-afs-chrome-mid`, `text-afs-chrome-high`, etc. directly, and
`afs-crimson` doubles as the error color where needed. `border` is a
single fixed rgba string (not `border-strong`, which is CSS-var-only —
see §2).

---

## 4. GLOBAL CSS (globals.css)

The real file (verified current as of this writing):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* ...the full --afs-* custom property block from §2 above... */
}

html {
  background-color: #2A2D35;
  color: #B8BFD0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background-color: var(--afs-bg-base);
  color: var(--afs-chrome-mid);
}

.metal-edge {
  position: relative;
}
.metal-edge::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(200,208,224,0.7) 25%,
    rgba(255,255,255,0.9) 50%,
    rgba(200,208,224,0.7) 75%,
    transparent 100%
  );
  transform: skewX(-12deg);
  pointer-events: none;
}
.metal-edge-red::before {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(192,0,26,0.8) 25%,
    rgba(232,0,31,1) 50%,
    rgba(192,0,26,0.8) 75%,
    transparent 100%
  );
}
.metal-edge-copper::before {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(184,115,51,0.8) 25%,
    rgba(212,149,106,1) 50%,
    rgba(184,115,51,0.8) 75%,
    transparent 100%
  );
}

.hero-glow-red {
  color: #C0001A;
  text-shadow: 0 0 30px rgba(192,0,26,0.6), 0 0 60px rgba(192,0,26,0.3), 0 2px 4px rgba(0,0,0,0.8);
}

.hero-glow-chrome {
  color: #D0D6E8;
  text-shadow: 0 0 20px rgba(200,210,230,0.4), 0 1px 3px rgba(0,0,0,0.8);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Differences from the originally-designed version: no `.metal-edge::after`
subtle-bottom-rule (dropped), no font-family declaration on `body` (fonts
are applied via the `<html>` class list in `layout.tsx` per §5, not
redeclared here), and `.hero-glow-red`/`.hero-glow-chrome` (homepage hero
text-shadow treatments) were added and are not otherwise documented
elsewhere in this file.

---

## 5. GOOGLE FONTS SETUP (layout.tsx)

```typescript
import {
  Bebas_Neue,
  Barlow_Condensed,
  Barlow,
  Inter,
  JetBrains_Mono,
} from 'next/font/google';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
});
const barlowCondensed = Barlow_Condensed({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});
const barlow = Barlow({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-barlow',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

// Apply to <html> element:
// className={`${bebasNeue.variable} ${barlowCondensed.variable} 
//             ${barlow.variable} ${inter.variable} ${jetbrainsMono.variable}`}
```

---

## 6. TYPOGRAPHY SCALE

```
Display (Bebas Neue):
  Hero H1:      font-display text-[7rem] leading-none     — homepage hero
  Section H1:   font-display text-6xl                     — section headers
  Stat numbers: font-display text-8xl                     — stat blocks

Heading (Barlow Condensed 600–700):
  Page title:   font-heading text-4xl font-bold
  Card title:   font-heading text-2xl font-semibold
  Table header: font-heading text-sm font-semibold tracking-wider uppercase

Label (Barlow 500–600):
  Nav links:    font-label text-sm font-medium
  Buttons:      font-label text-sm font-semibold
  Eyebrow:      font-label text-xs tracking-widest uppercase

Body (Inter 400–500):
  Running text: font-body text-base leading-relaxed
  Small text:   font-body text-sm
  Caption:      font-body text-xs

Data (JetBrains Mono 400):
  Part numbers: font-data text-sm
  Dimensions:   font-data text-base
  Prices:       font-data text-sm (on admin/invoice views only)
```

---

## 7. COMPONENT PALETTE RULES

```
NavBar:           bg-afs-bg-raised + border-b border-[var(--afs-border)]
Page background:  bg-afs-bg-base
Cards:            bg-afs-bg-raised border border-[var(--afs-border)] metal-edge
Section alt:      bg-afs-bg-surface
Input fields:     bg-afs-bg-overlay border border-[var(--afs-border)]
                  focus:border-afs-crimson outline-none
Table row alt:    bg-afs-bg-surface
Badges:           bg-afs-bg-surface border border-[var(--afs-border)]
                  text-afs-chrome-mid text-xs font-label

Primary CTA:      bg-afs-crimson hover:bg-afs-crimson-hover text-white
                  font-label font-semibold metal-edge-red shadow-crimson
Secondary CTA:    border border-[var(--afs-border)] text-afs-chrome-mid
                  hover:bg-afs-bg-surface font-label
Ghost CTA:        text-afs-chrome-base hover:text-afs-chrome-mid font-label

Admin rows:       bg-afs-bg-dim (slightly recessed)
Rush badge:       bg-afs-crimson text-white font-label text-xs font-bold
Architect accent: Replace crimson with copper in architect portal sections
```

---

## 8. TONAL SCALE QUICK REFERENCE

```
DARKEST                                                    MID-TONE
  #1C1F26 → #2A2D35 → #363C4A → #404858 → #4E5568
  bg-dim    bg-base   bg-raised bg-surface bg-overlay

CHROME TYPE (darkest to lightest)
  #7A8299 → #9AA0B8 → #B8BFD0 → #FFFFFF
  dim       base      mid       high     (+ #C8D0E0 chrome-silver)

CRIMSON (fixed warm accent)
  #7A0010 → #C0001A → #E8001F
  dim       base      hover

ACCENT (non-semantic, feature-specific — FlashDraft radius UI only)
  #00C853 accent-green   #4A0072 accent-purple
```

---

## 9. LOGO ASSET NOTE

**Corrected afs-logo-003, 2026-07-28** — the block below was stale on
every factual point, not just the dimensions. Verified this session by
reading the PNG's own IHDR chunk directly (`buf.readUInt32BE(16/20)` for
width/height, byte 25 for color type — no image-editing tool was
available, so this was done with Node's built-in `zlib` against the raw
file bytes) rather than trusting the old note. Real values:

```
File:         afs-logo.png
Dimensions:   1536×1024px, RGBA PNG (color type 6 — has an alpha channel)
Background:   Pale gray radial gradient (NOT pure black — sampled
              corner pixels are brightness ~218-255, not ~0)
Location:     public/afs-logo.png (repo root's public/, not
              afs-web/public/assets/ — that path doesn't exist in this repo)

Mark geometry: an italicized crimson "AFS" wordmark inside a beveled
  chrome parallelogram frame (pointed tip at the left, ~1.5%/49% of the
  mark's own box), with "ARCHITECTURAL FLASHING SUPPLY" in a separate
  chrome/crimson line below the frame, not enclosed by it. See
  components/ui/AFSAnimatedLogo.tsx's TOP_BAND/BOTTOM_BAND polygons for
  the frame band's traced boundary, if reusing this geometry elsewhere.

Usage: <Image src="/afs-logo.png" alt="AFS Architectural Flashing Supply"
       className="w-full h-auto object-contain" /> — object-contain
       already handles the real 1536x1024 (1.5) aspect ratio; no
       bg-afs-bg-dim wrapper needed since the background isn't black.

  Still true: no SVG source exists for this logo (CLAUDE.md's DATA
  BLOCKERS table). Request one from the client to resolve permanently.
```

---

## 10. THE CANVAS_COLORS EXCEPTION

A `<canvas>` 2D drawing context (`fillStyle`/`strokeStyle`) cannot consume
Tailwind classes or CSS custom properties — it needs literal color values
at the JS call site. The same is true of third-party embedded iframes
(Stripe's `CardElement`). The established, sanctioned pattern for this is
a single documented constant object that mirrors the real afs-* token
values as literal hex, with a comment citing this exception:

```typescript
// app/studio/draft/page.tsx — Canvas 2D fillStyle/strokeStyle can't
// consume Tailwind classes or CSS custom properties — mirrors the
// afs-crimson / afs-ink-900 tokens for the canvas-drawn profile and its
// dimension labels (same documented exception pattern already used for
// the Stripe CardElement in app/checkout/page.tsx).
const CANVAS_COLORS = {
  background: '#F5F5F0',
  grid: 'rgba(17, 17, 17, 0.08)',
  profile: '#C0001A',            // mirrors afs-crimson
  profileSelected: '#2563EB',
  point: '#C0001A',
  ink: '#111111',                // mirrors afs-ink-900
  dragLabelBg: 'rgba(17, 17, 17, 0.92)',
  dragLabelText: '#FFFFFF',
  radiusHandle: '#00C853',       // mirrors afs-accent-green
  radiusHandleWarn: '#D32F2F',
  radiusLabelBg: '#4A0072',      // mirrors afs-accent-purple
  radiusLabelText: '#FFFFFF',
};
```

The same pattern exists as `STRIPE_CARD_ELEMENT_COLORS` in
`app/checkout/page.tsx` for Stripe's `CardElement` iframe styling.

**This is the only sanctioned way to use a literal hex value in this
codebase.** A literal hex directly in a `className` or inline `style` on a
normal DOM element is still a rule #4 violation — including inside a
`CANVAS_COLORS`-adjacent component. The one place this line gets crossed
deliberately was FlashDraft's Bend Radius input border, which briefly used
an inline `style={{ borderColor: '#00C853' }}` to visually match the
canvas handle before real `afs-accent-green`/`afs-accent-purple` tokens
existed — now fixed to use `className="border-afs-accent-green"` (see
STATE_OF_THE_BUILD.md, afs-035).

---

*DESIGN_TOKENS.md | AFS | Reid Whitesides | June 2026*
