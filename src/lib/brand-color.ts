// Derives the app's full brand shade ramp (light + dark theme) from a single
// user-picked hex color. Keeps the "CSS variables as RGB triplets" contract
// from globals.css, so `bg-brand-600` etc. all follow the picked color.

export const DEFAULT_BRAND_HEX = '#7c3aed'

type Rgb = [number, number, number]

export function isValidHex(hex: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(hex.trim())
}

export function normalizeHex(hex: string): string {
  const h = hex.trim().replace(/^#/, '').toLowerCase()
  return `#${h}`
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace(/^#/, '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// Blend `color` toward `target` by `amount` (0..1).
function mix(color: Rgb, target: Rgb, amount: number): Rgb {
  return [
    Math.round(color[0] + (target[0] - color[0]) * amount),
    Math.round(color[1] + (target[1] - color[1]) * amount),
    Math.round(color[2] + (target[2] - color[2]) * amount),
  ]
}

const WHITE: Rgb = [255, 255, 255]
const BLACK: Rgb = [0, 0, 0]

function triplet(c: Rgb): string {
  return `${c[0]} ${c[1]} ${c[2]}`
}

// Perceived luminance (0..255) — decides whether text on this color should
// be white or near-black.
function luminance([r, g, b]: Rgb): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export interface BrandVars {
  light: Record<string, string>
  dark: Record<string, string>
}

export function buildBrandVars(hex: string): BrandVars {
  const base = hexToRgb(normalizeHex(hex))

  // Light theme: base is the 500/600 anchor; tints toward white above it,
  // shades toward black below.
  const light: Record<string, string> = {
    '--brand-50': triplet(mix(base, WHITE, 0.94)),
    '--brand-100': triplet(mix(base, WHITE, 0.86)),
    '--brand-300': triplet(mix(base, WHITE, 0.45)),
    '--brand-400': triplet(mix(base, WHITE, 0.2)),
    '--brand-500': triplet(base),
    '--brand-600': triplet(mix(base, BLACK, 0.12)),
    '--brand-700': triplet(mix(base, BLACK, 0.26)),
    '--brand-contrast': luminance(base) > 165 ? '17 24 39' : '255 255 255',
  }

  // Dark theme: a lightened pastel of the base (the reference dashboard's
  // lavender treatment), with deep tinted fills for 50/100.
  const pastel = mix(base, WHITE, 0.3)
  const dark: Record<string, string> = {
    '--brand-50': triplet(mix(base, BLACK, 0.72)),
    '--brand-100': triplet(mix(base, BLACK, 0.6)),
    '--brand-300': triplet(mix(base, BLACK, 0.25)),
    '--brand-400': triplet(mix(base, WHITE, 0.15)),
    '--brand-500': triplet(pastel),
    '--brand-600': triplet(pastel),
    '--brand-700': triplet(mix(base, WHITE, 0.5)),
    '--brand-contrast': luminance(pastel) > 165 ? '18 18 24' : '255 255 255',
  }

  return { light, dark }
}

// CSS text overriding the brand variables app-wide. Injected after
// globals.css so it wins the cascade.
export function buildBrandCss(hex: string): string {
  const { light, dark } = buildBrandVars(hex)
  const toBlock = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([k, v]) => `${k}:${v};`)
      .join('')
  return `:root{${toBlock(light)}}[data-theme='dark']{${toBlock(dark)}}`
}
