import type { Product, Variant, AttributeValue, ProductAttribute } from '@/lib/supabase/types'
import { computeAvailable } from '@/lib/supabase/types'

export type VariantStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'backordered'

export type AttributeWithValues = ProductAttribute & { attribute_values: AttributeValue[] }

export type VariantWithValues = Variant & {
  variant_attribute_values: { attribute_value_id: string }[]
}

export type ProductWithDetails = Product & {
  product_attributes: AttributeWithValues[]
  variants: VariantWithValues[]
}

export function variantStatus(
  variant: Variant,
  threshold: number
): VariantStatus {
  const available = computeAvailable(variant)
  if (available < 0) return 'backordered'
  if (available === 0) return 'out_of_stock'
  if (available <= threshold) return 'low_stock'
  return 'in_stock'
}

export function effectiveThreshold(product: Product, defaultThreshold: number): number {
  return product.low_stock_threshold ?? defaultThreshold
}

export function effectivePrice(product: Product, variant: Variant): number | null {
  if (product.price_mode === 'global') return product.global_price
  return variant.price ?? product.global_price
}

export function effectiveCost(product: Product, variant: Variant): number | null {
  if (product.price_mode === 'global') return product.global_cost
  return variant.cost ?? product.global_cost
}

export function variantLabel(
  variant: VariantWithValues,
  attributes: AttributeWithValues[]
): string {
  if (variant.name) return variant.name

  const valueIds = new Set(variant.variant_attribute_values.map((v) => v.attribute_value_id))
  const parts: string[] = []
  for (const attr of attributes) {
    const match = attr.attribute_values.find((v) => valueIds.has(v.id))
    if (match) parts.push(match.value)
  }
  return parts.length > 0 ? parts.join(' / ') : 'Standard'
}

// Cartesian product of attribute value ID groups, one group per attribute.
// e.g. [[blue,purple],[s,m,l]] -> [[blue,s],[blue,m],[blue,l],[purple,s],...]
export function cartesianProduct(groups: string[][]): string[][] {
  if (groups.length === 0) return []
  return groups.reduce<string[][]>(
    (acc, group) => acc.flatMap((combo) => group.map((value) => [...combo, value])),
    [[]]
  )
}

export function comboKey(attributeValueIds: string[]): string {
  return [...attributeValueIds].sort().join('|')
}

// For a variant picker: is `valueId` (for `attributeId`) reachable given
// whatever's already selected for the OTHER attributes? i.e. does any
// variant exist that has both this value and every other currently-picked
// value? With nothing else picked yet, this just checks "does any variant
// have this value at all" — so e.g. a Colour with zero variants never
// shows, and once Blue is picked, only sizes that actually exist in Blue
// remain selectable for Size.
//
// `requireStock` (on by default) also excludes combos with no available
// stock — so if Blue/L has dead stock but Blue/M doesn't, L disappears
// from Size once Blue is picked (and vice versa: a colour whose every size
// is dead stock disappears entirely). Pass requireStock: false (the item
// picker's "show out-of-stock variants" toggle) to fall back to pure
// existence — combos that were never actually created still never show.
export function isAttributeValueReachable(
  variants: VariantWithValues[],
  selectedValues: Record<string, string>,
  attributeId: string,
  valueId: string,
  requireStock = true
): boolean {
  const otherSelections = Object.entries(selectedValues)
    .filter(([attrId]) => attrId !== attributeId)
    .map(([, vId]) => vId)
  const required = [...otherSelections, valueId]

  return variants.some((v) => {
    const ids = new Set(v.variant_attribute_values.map((vv) => vv.attribute_value_id))
    if (!required.every((id) => ids.has(id))) return false
    return requireStock ? computeAvailable(v) > 0 : true
  })
}

export function formatRs(amount: number | null): string {
  if (amount === null) return '-'
  return `Rs. ${amount.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`
}

// Splits a comma-separated bulk-entry field ("S, M, L, XL") into clean,
// deduped values, preserving input order.
export function parseValuesList(text: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of text.split(',')) {
    const value = raw.trim()
    if (value && !seen.has(value.toLowerCase())) {
      seen.add(value.toLowerCase())
      result.push(value)
    }
  }
  return result
}
