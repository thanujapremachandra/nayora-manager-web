import type { Config } from 'tailwindcss'

// Every color the app uses is routed through a CSS variable (defined in
// globals.css) with a light sheet on :root and a dark sheet on
// [data-theme="dark"]. That means the whole app — every existing
// text-gray-*/bg-*/border-* utility — flips theme automatically without
// per-component dark: variants. `<alpha-value>` keeps opacity modifiers
// (e.g. bg-surface/90) working.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Elevated surface (cards, dialogs, inputs). White in light mode,
        // near-black panel in dark mode. Plain `white` stays literal white —
        // it's used for text on colored buttons, which must not flip.
        surface: v('surface'),
        brand: {
          50: v('brand-50'),
          100: v('brand-100'),
          300: v('brand-300'),
          400: v('brand-400'),
          500: v('brand-500'),
          600: v('brand-600'),
          700: v('brand-700'),
          // Text color that sits on brand-500/600 fills: white in light
          // mode, near-black in dark mode (lavender buttons want dark text).
          contrast: v('brand-contrast'),
        },
        // Warm yellow highlight (chart peak bars, small accents).
        accent: {
          300: v('accent-300'),
          400: v('accent-400'),
          500: v('accent-500'),
        },
        gray: {
          50: v('gray-50'),
          100: v('gray-100'),
          200: v('gray-200'),
          300: v('gray-300'),
          400: v('gray-400'),
          500: v('gray-500'),
          600: v('gray-600'),
          700: v('gray-700'),
          800: v('gray-800'),
          900: v('gray-900'),
        },
        // Status palettes: only the shades the app actually uses are
        // remapped; anything else falls through to Tailwind's defaults.
        red: { 50: v('red-50'), 100: v('red-100'), 600: v('red-600'), 700: v('red-700') },
        green: { 50: v('green-50'), 100: v('green-100'), 600: v('green-600'), 700: v('green-700') },
        amber: {
          50: v('amber-50'),
          100: v('amber-100'),
          200: v('amber-200'),
          600: v('amber-600'),
          700: v('amber-700'),
          800: v('amber-800'),
        },
        blue: { 100: v('blue-100'), 700: v('blue-700') },
        cyan: { 100: v('cyan-100'), 600: v('cyan-600'), 700: v('cyan-700') },
        orange: { 100: v('orange-100'), 700: v('orange-700') },
        purple: { 100: v('purple-100'), 700: v('purple-700') },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
