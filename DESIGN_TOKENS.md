# DESIGN_TOKENS.md
## AFS — Design System
**Derived from AFS chrome/red/black shield logo. Single fixed light silver theme.**
**No toggles. No modes. Rebranded from the original dark gunmetal theme (see §10 for history).**

---

## 1. DESIGN CHARACTER

The AFS logo is a dimensional chrome-beveled shield with deep crimson letterforms.
The site now runs a light silver gray palette — daylight-lit fabrication shop
surfaces rather than the original graphite-background treatment — with the
crimson identity accent and chrome type hierarchy unchanged.

**Character:** A fabrication shop lit by daylight through skylights. Concrete
floors, steel surfaces, polished tooling. Bright, disciplined, industrial —
not a dark nightclub, not a stark white tech-startup page.

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
   globals.css — paste inside @layer base
   ───────────────────────────────────── */

:root {
  /* BACKGROUNDS — Light silver scale (rebranded from dark gunmetal) */
  --afs-bg-dim:       #D0D0D0;  /* Depressed: code blocks, admin rows */
  --afs-bg-base:      #D4D4D4;  /* Page background */
  --afs-bg-raised:    #DADADA;  /* Cards, nav, dropdowns, modals */
  --afs-bg-surface:   #E0E0E0;  /* Table row alt, sidebars, sections */
  --afs-bg-overlay:   #E6E6E6;  /* Hover states, input field backgrounds */
  --afs-bg-modal:     rgba(212, 212, 212, 0.92);

  /* CHROME TYPE HIERARCHY — from bevel gradient (still used for light-on-color
     contexts, e.g. text-white on the crimson CTA); on the light backgrounds
     above, use the INK tokens below instead for on-page text */
  --afs-chrome-high:  #D8E0EC;
  --afs-chrome-mid:   #A0AABC;
  --afs-chrome-base:  #6B7A94;
  --afs-chrome-dim:   #48526A;  /* Borders, dividers, placeholders */
  --afs-chrome-ghost: rgba(107, 122, 148, 0.15);

  /* INK — on-page text for the light theme */
  --afs-ink-900:      #111111;  /* Page titles, section headings, body text */
  --afs-ink-700:       #374151;  /* Subheadings, supporting/muted text */

  /* TEXT ALIASES */
  --afs-text-primary:  var(--afs-ink-900);
  --afs-text-body:     var(--afs-ink-700);
  --afs-text-muted:    var(--afs-ink-700);
  --afs-text-disabled: var(--afs-chrome-dim);
  --afs-text-inverse:  #FFFFFF;   /* On crimson/copper backgrounds */

  /* CRIMSON — Fixed identity constant. Never changes. */
  --afs-crimson:       #C0001A;
  --afs-crimson-hover: #E8001F;
  --afs-crimson-dim:   #7A0010;
  --afs-crimson-ghost: rgba(192, 0, 26, 0.12);
  --afs-crimson-glow:  0 0 20px rgba(192, 0, 26, 0.30);

  /* COPPER — Architect portal only */
  --afs-copper:        #B87333;
  --afs-copper-hover:  #D4956A;
  --afs-copper-ghost:  rgba(184, 115, 51, 0.12);

  /* BORDERS */
  --afs-border:        rgba(72, 82, 106, 0.40);
  --afs-border-strong: rgba(107, 122, 148, 0.55);
  --afs-border-crimson:rgba(192, 0, 26, 0.45);
  --afs-border-copper: rgba(184, 115, 51, 0.45);

  /* SEMANTIC */
  --afs-success:       #1E8A52;
  --afs-success-ghost: rgba(30, 138, 82, 0.12);
  --afs-warning:       #C48A00;
  --afs-warning-ghost: rgba(196, 138, 0, 0.12);
  --afs-error:         #C0001A;
  --afs-info:          #3478B0;

  /* METAL EDGE GRADIENTS */
  --afs-edge-chrome: linear-gradient(
    90deg,
    transparent 0%,
    rgba(107,122,148,0) 5%,
    rgba(160,170,188,0.7) 25%,
    rgba(216,224,236,0.9) 50%,
    rgba(160,170,188,0.7) 75%,
    rgba(107,122,148,0) 95%,
    transparent 100%
  );
  --afs-edge-crimson: linear-gradient(
    90deg,
    transparent 0%,
    rgba(192,0,26,0) 5%,
    rgba(192,0,26,0.8) 25%,
    rgba(232,0,31,1) 50%,
    rgba(192,0,26,0.8) 75%,
    rgba(192,0,26,0) 95%,
    transparent 100%
  );
  --afs-edge-subtle: linear-gradient(
    90deg,
    transparent 0%,
    rgba(72,82,106,0.5) 30%,
    rgba(72,82,106,0.5) 70%,
    transparent 100%
  );
}
```

---

## 3. TAILWIND CONFIGURATION

```typescript
// tailwind.config.ts — complete configuration

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        afs: {
          // Backgrounds (semantic — reference CSS vars)
          'bg-dim':     'var(--afs-bg-dim)',
          'bg-base':    'var(--afs-bg-base)',
          'bg-raised':  'var(--afs-bg-raised)',
          'bg-surface': 'var(--afs-bg-surface)',
          'bg-overlay': 'var(--afs-bg-overlay)',

          // Chrome type hierarchy (semantic — use for text on solid crimson/
          // copper accent surfaces, not on-page text)
          'chrome-high':  'var(--afs-chrome-high)',
          'chrome-mid':   'var(--afs-chrome-mid)',
          'chrome-base':  'var(--afs-chrome-base)',
          'chrome-dim':   'var(--afs-chrome-dim)',

          // Ink — on-page text for the light theme
          'ink-900': 'var(--afs-ink-900)',
          'ink-700': 'var(--afs-ink-700)',

          // Text (semantic aliases)
          'text-primary':  'var(--afs-text-primary)',
          'text-body':     'var(--afs-text-body)',
          'text-muted':    'var(--afs-text-muted)',
          'text-disabled': 'var(--afs-text-disabled)',
          'text-inverse':  'var(--afs-text-inverse)',

          // Crimson (fixed — not CSS vars — same in all contexts)
          'crimson':       '#C0001A',
          'crimson-hover': '#E8001F',
          'crimson-dim':   '#7A0010',

          // Copper (fixed)
          'copper':      '#B87333',
          'copper-hover':'#D4956A',

          // Semantic
          'success': 'var(--afs-success)',
          'warning': 'var(--afs-warning)',
          'error':   '#C0001A',
          'info':    'var(--afs-info)',
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
        none:    '0px',
      },
      boxShadow: {
        card:    '0 1px 3px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.25)',
        raised:  '0 4px 24px rgba(0,0,0,0.40)',
        crimson: 'var(--afs-crimson-glow)',
        chrome:  '0 0 12px rgba(160,170,188,0.18)',
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## 4. GLOBAL CSS (globals.css)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* All CSS custom properties defined above go here */

/* Base */
html {
  background-color: #D4D4D4;
  color: #374151;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background-color: var(--afs-bg-base);
  color: var(--afs-text-body);
  font-family: var(--font-inter), 'Inter', sans-serif;
}

/* Chrome metallic CTA — Request a Quote button and similar secondary CTAs */
.afs-btn-chrome {
  background: linear-gradient(135deg, #C8CDD6 0%, #E8EAED 50%, #B8BFC9 100%);
  color: #1a1a1a;
  border: 1px solid #9CA3AF;
  font-weight: 700;
  transition: filter 0.15s ease;
}
.afs-btn-chrome:hover {
  filter: brightness(0.96);
}

/* ── THE METAL EDGE ──────────────────────────────────────
   Signature element. Applied to hero sections, cards, CTAs.
   References the bevel cut geometry of the AFS shield logo.
   ──────────────────────────────────────────────────────── */

.metal-edge {
  position: relative;
}
.metal-edge::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: var(--afs-edge-chrome);
  transform: skewX(-12deg);
  transform-origin: left center;
  pointer-events: none;
  z-index: 1;
}
.metal-edge::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 1px;
  background: var(--afs-edge-subtle);
  pointer-events: none;
}

/* Crimson variant — primary CTA containers */
.metal-edge-red::before {
  background: var(--afs-edge-crimson);
}

/* Copper variant — architect portal sections */
.metal-edge-copper::before {
  background: linear-gradient(
    90deg,
    transparent 0%, rgba(184,115,51,0) 5%,
    rgba(184,115,51,0.8) 25%, rgba(212,149,106,1) 50%,
    rgba(184,115,51,0.8) 75%, rgba(184,115,51,0) 95%,
    transparent 100%
  );
}

/* ── REDUCED MOTION ────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

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
                  text-afs-ink-700 text-xs font-label

Primary CTA:      bg-afs-crimson hover:bg-afs-crimson-hover text-white
                  font-label font-semibold metal-edge-red shadow-crimson
                  (unchanged by the light rebrand — crimson CTAs keep white text)
Chrome CTA:       afs-btn-chrome (metallic gradient, #1a1a1a text, used for
                  secondary CTAs like "Request a Quote")
Secondary CTA:    border border-[var(--afs-border)] text-afs-ink-700
                  hover:bg-afs-bg-surface font-label
Ghost CTA:        text-afs-ink-700 hover:text-afs-ink-900 font-label

Admin rows:       bg-afs-bg-dim (slightly recessed)
Rush badge:       bg-afs-crimson text-white font-label text-xs font-bold
Architect accent: Replace crimson with copper in architect portal sections

ON-PAGE TEXT MAPPING (light theme):
  Page titles, section headings, body text  → text-afs-ink-900
  Accent text, eyebrows, labels              → text-afs-crimson
  Subheadings, supporting/muted text         → text-afs-ink-700
  Text ON a solid crimson/copper CTA or badge fill → keep text-white
    (chrome-high/mid/base/dim tokens remain defined for this on-color-fill
    case; they are no longer used for on-page text against the light
    backgrounds above)
```

---

## 8. TONAL SCALE QUICK REFERENCE

```
LIGHT SILVER BACKGROUNDS (darkest to lightest)
  #D0D0D0 → #D4D4D4 → #DADADA → #E0E0E0 → #E6E6E6
  bg-dim    bg-base   bg-raised bg-surface bg-overlay

INK TEXT (for the light backgrounds above)
  #111111 → #374151
  ink-900   ink-700

CHROME TYPE (retained for text on solid crimson/copper fills only)
  #48526A → #6B7A94 → #A0AABC → #D8E0EC
  dim       base      mid       high

CRIMSON (fixed warm accent)
  #7A0010 → #C0001A → #E8001F
  dim       base      hover
```

---

## 9. LOGO ASSET NOTE

```
File:         afs-logo.png
Dimensions:   2404×1080px, RGB PNG
Background:   Pure black (#000000)
Location:     afs-web/public/assets/afs-logo.png

Usage on bg-base (#1A1A1E):
  Logo background (#000000) differs from page background (#1A1A1E).
  Wrap in bg-afs-bg-dim (#14151A) container to blend:

  <div className="bg-afs-bg-dim inline-block px-4 py-2 rounded-sm">
    <Image src="/assets/afs-logo.png" alt="AFS Architectural Flashing Supply"
           width={200} height={90} priority />
  </div>

  Request SVG or transparent PNG from client to resolve permanently.
```

---

## 10. REBRAND HISTORY

```
June 2026:    Original dark gunmetal theme, derived from the shield logo's
              graphite interior. bg-* tokens ran #14151A → #32363F (darkest
              to lightest); on-page text used the chrome-high/mid/base scale
              (light colors, readable on dark backgrounds).

2026-07-12:   Site-wide light silver rebrand. bg-* tokens now run
              #D0D0D0 → #E6E6E6. On-page text moved to the new ink-900/
              ink-700 tokens (dark colors, readable on light backgrounds).
              The chrome-high/mid/base/dim scale was kept, unchanged, for
              its original purpose — text on solid crimson/copper accent
              fills — but is no longer used for on-page text. Crimson/copper
              accent colors, the Metal Edge signature element, and all
              existing crimson CTAs were left unchanged.
```

---

*DESIGN_TOKENS.md | AFS | Reid Whitesides | June 2026*
