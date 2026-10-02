/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx}',
    // lib/ TOO, and this is not housekeeping — it was a live bug.
    //
    // Some class strings are DATA, not markup: lib/data/admin-working-area.ts
    // exports LIGHT_WORKING_AREA_CLASS so that "which screens are light" is a
    // unit test rather than a memory (CLAUDE.md rule #18). Without this glob
    // Tailwind never sees those strings and never emits the rules, so the
    // class lands in the HTML and does nothing.
    //
    // It went unnoticed because the old value — `bg-afs-bg-band
    // text-afs-ink-900` — happened to use classes that ALSO appear under
    // components/ (the marketing site's light sections), so they were emitted
    // for other reasons. The moment that string named a token used only here,
    // the light working area silently stopped painting and its text fell back
    // to the body's light-on-dark colour. The v7 style gate caught it as
    // `color #b8bfd0 != v7 #0f1318` on every element that inherits its colour.
    //
    // Worse, it was invisible to scripts/audit/contrast-check.mjs, which reads
    // the class string statically and so measured a surface that was never
    // rendered. Scanning lib/ is what keeps those two in step.
    './lib/**/*.{ts,tsx}',
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
          // Light-section palette (2026-09-19 revision pass, item 9) --
          // most full-width homepage sections convert from dark gunmetal
          // to near-white, EXCEPT hero/hail-view/footer, which stay dark.
          // Text in converted sections reuses the existing ink-900/ink-700
          // (already real tokens, built for FlashDraft's light canvas) --
          // #111111 and #374151 both clear WCAG AA by a wide margin against
          // #F7F7F5. bg-light-raised is the light-mode equivalent of
          // bg-raised/bg-surface for cards within a light section.
          'bg-light':        '#F7F7F5',
          'bg-light-raised': '#EFEFEC',
          // Distinct from bg-light -- explicitly requested as its own hex
          // (2026-09-19 revision pass #2, items 4-5) for the field-app
          // credibility strip and the "Four Ways to Start" pathways section.
          'bg-band':         '#F1F2F4',
          'border-light':    '#D8D8D4',
          // COMMAND CENTER v7 GROUND. The exact values prototype v7 resolves
          // for `--bg` and `--ink` in its light theme (docs/design/
          // command-center-v7/v7.css, <style> block 3). CLAUDE.md rule #33:
          // v7 wins every conflict about colour, and the style gate compares
          // the live working area against the prototype, so the surface a
          // converted screen paints has to BE v7's surface.
          //
          // These sit a shade away from bg-band (#F1F2F4) and ink-900
          // (#111111), which rule #18 would normally say to reuse. They are
          // added anyway, and only because reuse is not available: bg-band and
          // ink-900 are also the PUBLIC marketing site's light-section palette
          // (the credibility strip, "Four Ways to Start"), which this build is
          // required to leave visually unchanged. Retheming them to v7's values
          // would silently restyle the homepage.
          //
          // They exist as Tailwind tokens rather than as v7's `.cc-v7-ground`
          // class so that scripts/audit/contrast-check.mjs can still resolve
          // the working area's background statically. A CSS-only ground would
          // leave the gate measuring converted screens against the shell's
          // gunmetal and reporting failures that cannot happen — rule #28's
          // "the gate must not go blind", in the other direction.
          //   v7-ink  #0F1318 on v7-bg #F4F5F7 = 17.09:1
          'v7-bg':           '#F4F5F7',
          'v7-ink':          '#0F1318',
          // COMMAND CENTER V2 LIGHT WORKING AREA (prompt v2-02). The header
          // stays gunmetal; the Workbench and Job screen below it are light,
          // per docs/design/command-center-v2-prototype.html. These six are
          // the prototype's own literal values for the surfaces and states
          // the existing light palette had no equivalent for. Everything the
          // existing tokens already covered is reused instead of duplicated:
          // the working-area background is afs-bg-band, sunk blocks inside a
          // card are afs-bg-light-raised, card borders are afs-border-light,
          // and body text is afs-ink-900 / afs-ink-700.
          //
          // Measured against the surfaces they are actually used on (WCAG 2.1
          // 1.4.3 / 1.4.11), not assumed:
          //   ink-900   on bg-card   18.1:1   ink-700 on bg-card   9.8:1
          //   line-strong on bg-card  3.1:1   (control borders, 3:1 rule)
          //   green-ink on bg-card    6.8:1   green-ink on green-soft 5.9:1
          //   chrome-high on green-deep 5.0:1 (white text on the green button)
          //   amber-ink on amber-bg   7.1:1   (the "AI is unsure" highlight)
          // green-deep is the BUTTON FILL, green-ink is the TEXT green. The
          // prototype used one #1E7F45 for both; as text on green-soft that
          // measures 4.3:1 and misses the 4.5:1 body-text rule, so the text
          // green is darkened. That is the one deliberate colour deviation.
          'bg-lane':         '#E1E5E9',
          'bg-card':         '#FFFFFF',
          'line-strong':     '#8C939B',
          'green-deep':      '#1E7F45',
          'green-ink':       '#17683A',
          'green-soft':      '#E3F2E9',
          'amber-bg':        '#FFF1B8',
          'amber-ink':       '#7A4200',
          // STATUS TEXT ON GUNMETAL (v2-06, added when scripts/audit/
          // contrast-check.mjs started failing the build on every Command Center
          // screen that printed a status in colour).
          //
          // afs-crimson, afs-success, afs-warning, afs-info and afs-amber are
          // FILL colours. As TEXT on gunmetal they are not close to AA —
          // measured, not estimated: crimson 1.42:1 on bg-surface, success
          // 2.11:1, info 2.34:1, warning 3.67:1, amber 4.28:1. There is no way
          // to fix that by darkening, which is the move the light working area
          // needed (afs-green-ink); on a dark surface the text has to get
          // LIGHTER, and a colour light enough to clear 4.5:1 against #4E5568
          // needs a relative luminance of about 0.56. Red contributes only
          // 0.2126 of luminance, so a danger text at that level is necessarily a
          // salmon rather than a pillarbox red. That is physics, not taste.
          //
          // Each of these holds its dominant channel at full and lifts the
          // others only as far as the target luminance requires, which keeps as
          // much hue as the criterion allows. Blending to white instead would
          // have given #F0C1C7 — paler, and no more readable.
          //
          // Measured against all five gunmetal surfaces (WCAG 2.1 1.4.3):
          //                 bg-dim  bg-base  bg-raised  bg-surface  bg-overlay
          //   danger        10.12    8.45      6.78        5.64        4.57
          //   success       10.19    8.51      6.82        5.68        4.59
          //   warning       10.13    8.46      6.78        5.64        4.57
          //   info          10.16    8.48      6.80        5.66        4.58
          // Safe on every gunmetal surface, which is the same property that
          // makes afs-chrome-silver the one placeholder colour (rule #18).
          // They are for TEXT ON DARK only — on the light working area they are
          // 1.3-1.6:1 and rule #23 applies, exactly as it does to chrome-silver.
          'danger-on-dark':  '#FFB9B9',
          'success-on-dark': '#73E19B',
          'warning-on-dark': '#FFC120',
          'info-on-dark':    '#9AD1FF',
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
          'accent-blue':   '#0177C8',
          'accent-orange': '#994C00',
          // Real per-client brand colors for ClientCarousel.tsx (2026-09-19
          // revision pass, item 6) -- exact hex given, not approximated,
          // since these are specific real institutional brand colors
          // (school colors, hospital-system branding) rather than a
          // stand-in like NASA/Tesla's afs-crimson. Two values repeat
          // across different clients (Baylor's "& White" gold and Midland
          // Memorial's full name both #B8860B; Bug Master's "Master" and
          // Seton's "Seton" both #00827F) -- named once, shared, not
          // duplicated as separate tokens with the same value.
          'client-baylor-blue':   '#003B71',
          'client-gold-deep':     '#B8860B',
          'client-bugmaster-red': '#D2232A',
          'client-teal':          '#00827F',
          'client-orange-burnt':  '#BF5700',
          'client-seton-purple':  '#5B2C83',
          'client-seton-blue':    '#1F4E9C',
          'client-dpr-blue':      '#0B3D91',
          'client-hays-red':      '#C8102E',
          'client-hays-blue':     '#002868',
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