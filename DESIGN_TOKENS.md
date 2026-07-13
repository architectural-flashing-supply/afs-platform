# DESIGN_TOKENS.md
## AFS — Design System
**Derived from AFS chrome/red/black shield logo. Single fixed gunmetal theme.**
**No toggles. No modes. The interior of the shield is the site.**

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
   globals.css — paste inside @layer base
   ───────────────────────────────────── */

:root {
  /* BACKGROUNDS — Gunmetal scale from shield interior */
  --afs-bg-dim:       #14151A;  /* Depressed: code blocks, admin rows */
  --afs-bg-base:      #1A1A1E;  /* Page background — shield interior */
  --afs-bg-raised:    #22242A;  /* Cards, nav, dropdowns, modals */
  --afs-bg-surface:   #2A2D35;  /* Table row alt, sidebars, sections */
  --afs-bg-overlay:   #32363F;  /* Hover states, input field backgrounds */
  --afs-bg-modal:     rgba(26, 26, 30, 0.92);

  /* CHROME TYPE HIERARCHY — from bevel gradient */
  --afs-chrome-high:  #D8E0EC;  /* Bevel highlight — H1 headlines */
  --afs-chrome-mid:   #A0AABC;  /* Bevel mid — subheadings, nav labels */
  --afs-chrome-base:  #6B7A94;  /* Bevel shadow — body text */
  --afs-chrome-dim:   #48526A;  /* Borders, dividers, placeholders */
  --afs-chrome-ghost: rgba(107, 122, 148, 0.15);

  /* TEXT ALIASES */
  --afs-text-primary:  var(--afs-chrome-high);
  --afs-text-body:     var(--afs-chrome-mid);
  --afs-text-muted:    var(--afs-chrome-base);
  --afs-text-disabled: var(--afs-chrome-dim);
  --afs-text-inverse:  #1A1A1E;   /* On crimson backgrounds */

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

  /* ACCENT — non-semantic, feature-specific accents (e.g. FlashDraft radius handles) */
  --afs-accent-green:  #00C853;
  --afs-accent-purple: #4A0072;

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

          // Chrome type hierarchy (semantic)
          'chrome-high':  'var(--afs-chrome-high)',
          'chrome-mid':   'var(--afs-chrome-mid)',
          'chrome-base':  'var(--afs-chrome-base)',
          'chrome-dim':   'var(--afs-chrome-dim)',

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

          // Accent — non-semantic, feature-specific
          'accent-green':  'var(--afs-accent-green)',
          'accent-purple': 'var(--afs-accent-purple)',
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
  background-color: #1A1A1E;
  color: #A0AABC;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background-color: var(--afs-bg-base);
  color: var(--afs-text-body);
  font-family: var(--font-inter), 'Inter', sans-serif;
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
  #14151A → #1A1A1E → #22242A → #2A2D35 → #32363F
  bg-dim    bg-base   bg-raised bg-surface bg-overlay

CHROME TYPE (darkest to lightest)
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

*DESIGN_TOKENS.md | AFS | Reid Whitesides | June 2026*
