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
          // PUBLIC PRODUCTS CATALOG (2026-10-01). Reid's layering rule for this
          // page is that every level sits DARKER than the one beneath it, and
          // that there are never white cards on a pale background. Three of the
          // four levels already existed and are reused rather than duplicated:
          //
          //   page            afs-bg-light         #F7F7F5
          //   category band   afs-bg-light-raised  #EFEFEC
          //   product card    afs-bg-lane          #E1E5E9
          //   enlarged card   afs-bg-catalog-pop   #D9DDE2   <- new
          //
          // Only the fourth needed a value: the hover popover and the modal sit
          // ON TOP of a card, so they have to go darker again, and nothing in
          // the light palette was darker than bg-lane while still reading as a
          // light surface.
          //
          // Measured (WCAG 2.1 1.4.3 / 1.4.11), not assumed:
          //   ink-900 on catalog-pop  13.8:1     ink-700 on catalog-pop  7.6:1
          //   crimson on catalog-pop   4.7:1     (AA body text — this is why
          //     the surface is #D9DDE2 and not darker; at #CDD3DA the red
          //     accent measures 4.28:1 and misses)
          //   white on crimson         6.5:1     (the primary button)
          //
          // border-catalog replaces afs-border-light for CONTROL boundaries on
          // this page. border-light (#D8D8D4) is a hairline between two pale
          // panels and measures under 1.5:1 on every one of these four
          // surfaces; afs-line-strong (#8C939B) is the Command Center's control
          // border and still only reaches 2.45:1 on bg-lane and 2.28:1 on
          // catalog-pop, both short of the 3:1 rule for a form-field or button
          // boundary. #6F7781 clears it on all four:
          //   on bg-light 4.23:1   bg-light-raised 3.94:1
          //   on bg-lane  3.58:1   catalog-pop     3.32:1
          'bg-catalog-pop':  '#D9DDE2',
          'border-catalog':  '#6F7781',
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