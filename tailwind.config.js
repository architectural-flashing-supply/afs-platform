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
          'bg-dim':     '#14151A',
          'bg-base':    '#1A1A1E',
          'bg-raised':  '#22242A',
          'bg-surface': '#2A2D35',
          'bg-overlay': '#32363F',
          'chrome-high':  '#D8E0EC',
          'chrome-mid':   '#A0AABC',
          'chrome-base':  '#6B7A94',
          'chrome-dim':   '#48526A',
          'crimson':       '#C0001A',
          'crimson-hover': '#E8001F',
          'crimson-dim':   '#7A0010',
          'copper':        '#B87333',
          'copper-hover':  '#D4956A',
          'success':       '#1E8A52',
          'warning':       '#C48A00',
          'info':          '#3478B0',
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
        chrome:  '0 0 12px rgba(160,170,188,0.18)',
      },
    },
  },
  plugins: [],
};