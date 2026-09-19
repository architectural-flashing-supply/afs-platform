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
          'border-light':    '#D8D8D4',
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