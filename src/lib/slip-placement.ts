import type { DuplexFlipAxis, SlipPlacement, SlipPlacementLayout } from '@/lib/supabase/types'

export const A4_SHORT_MM = 210
export const A4_LONG_MM = 297

export function pageDimensionsMm(orientation: SlipPlacementLayout['orientation']): { width: number; height: number } {
  return orientation === 'landscape' ? { width: A4_LONG_MM, height: A4_SHORT_MM } : { width: A4_SHORT_MM, height: A4_LONG_MM }
}

// Physical A4 paper always has one long edge (297mm) and one short edge
// (210mm) — that doesn't change with logical page orientation, only which
// *logical* axis (x or y) that physical edge maps to does. "Long-edge flip"
// (the standard default for portrait duplex) mirrors the SHORT physical
// dimension; "short-edge flip" mirrors the LONG one. Which logical axis
// that corresponds to flips between portrait and landscape — this is
// exactly why a landscape sheet needs different back-mirroring math than
// the original portrait-only design, not just a rotated copy of it.
export function mirrorAxisFor(orientation: SlipPlacementLayout['orientation'], flipAxis: DuplexFlipAxis): 'x' | 'y' {
  const shortEdgeAxis = orientation === 'landscape' ? 'y' : 'x'
  const longEdgeAxis = orientation === 'landscape' ? 'x' : 'y'
  return flipAxis === 'long-edge' ? shortEdgeAxis : longEdgeAxis
}

// Where the back content for a given front placement must sit so it lines
// up directly behind it once the physical sheet is flipped for duplex.
export function backPlacementFor(front: SlipPlacement, layout: Pick<SlipPlacementLayout, 'orientation' | 'duplexFlipAxis'>): SlipPlacement {
  const { width: pageWidth, height: pageHeight } = pageDimensionsMm(layout.orientation)
  const axis = mirrorAxisFor(layout.orientation, layout.duplexFlipAxis)

  if (axis === 'x') {
    return { ...front, x: pageWidth - front.x - front.width }
  }
  return { ...front, y: pageHeight - front.y - front.height }
}

export function createSlipPlacement(x: number, y: number, width = 130, height = 90): SlipPlacement {
  return { id: crypto.randomUUID(), x, y, width, height }
}

export function clampPlacement(p: SlipPlacement, pageWidth: number, pageHeight: number): SlipPlacement {
  return {
    ...p,
    x: Math.min(Math.max(p.x, 0), pageWidth - p.width),
    y: Math.min(Math.max(p.y, 0), pageHeight - p.height),
    width: Math.min(Math.max(p.width, 30), pageWidth),
    height: Math.min(Math.max(p.height, 30), pageHeight),
  }
}
