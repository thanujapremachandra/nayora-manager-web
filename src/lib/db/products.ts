import type { TypedClient } from '@/lib/supabase/client'
import type { Database, Product, ProductAttribute, AttributeValue, Variant } from '@/lib/supabase/types'
import type { ProductWithDetails, AttributeWithValues } from '@/lib/stock-helpers'
import { cartesianProduct, comboKey } from '@/lib/stock-helpers'

const PRODUCT_SELECT = `
  *,
  product_attributes ( *, attribute_values ( * ) ),
  variants ( *, variant_attribute_values ( attribute_value_id ) )
`

// The embedded-resource shape from a nested select is structurally what
// ProductWithDetails describes, but Supabase's generated type for ad-hoc
// embeds is too complex to express without `supabase gen types` against a
// live project. We assert the known shape once, here, at the data boundary.
function hydrate(raw: unknown): ProductWithDetails[] {
  const rows = raw as ProductWithDetails[]
  for (const product of rows) {
    product.product_attributes.sort((a, b) => a.position - b.position)
    for (const attr of product.product_attributes) {
      attr.attribute_values.sort((a, b) => a.position - b.position)
    }
  }
  return rows
}

export async function listProducts(client: TypedClient): Promise<ProductWithDetails[]> {
  // `id` tiebreaker for deterministic ordering — see getSessionTrend in
  // analytics.ts for why ties on created_at alone are a real bug, not just
  // a cosmetic one.
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (error) throw new Error(`Failed to load products: ${error.message}`)
  return hydrate(data)
}

export async function getProduct(client: TypedClient, id: string): Promise<ProductWithDetails> {
  const { data, error } = await client.from('products').select(PRODUCT_SELECT).eq('id', id).single()

  if (error) throw new Error(`Failed to load product: ${error.message}`)
  return hydrate([data])[0]
}

export async function createProduct(
  client: TypedClient,
  input: Database['public']['Tables']['products']['Insert']
): Promise<Product> {
  const { data, error } = await client.from('products').insert(input).select().single()
  if (error) throw new Error(`Failed to create product: ${error.message}`)
  return data
}

export async function updateProduct(
  client: TypedClient,
  id: string,
  patch: Database['public']['Tables']['products']['Update']
): Promise<Product> {
  const { data, error } = await client.from('products').update(patch).eq('id', id).select().single()
  if (error) throw new Error(`Failed to update product: ${error.message}`)
  return data
}

// order_items.variant_id is ON DELETE RESTRICT (by design — order history
// must never silently disappear), so deleting a product/variant that's
// been ordered fails outright rather than corrupting past orders. This
// turns that raw FK-violation error into something a non-technical
// operator can actually act on.
const ORDER_HISTORY_BLOCK_MESSAGE =
  "Can't delete — it's been used in at least one order, and order history is never removed automatically. " +
  'If you no longer want it visible, leave the stock at 0 instead of deleting it.'

function friendlyDeleteError(error: { code?: string; message: string }, fallback: string): Error {
  if (error.code === '23503') return new Error(ORDER_HISTORY_BLOCK_MESSAGE)
  return new Error(`${fallback}: ${error.message}`)
}

export async function deleteProduct(client: TypedClient, id: string): Promise<void> {
  const { error } = await client.from('products').delete().eq('id', id)
  if (error) throw friendlyDeleteError(error, 'Failed to delete product')
}

// ─── Attributes ────────────────────────────────────────────────

export async function createAttribute(
  client: TypedClient,
  productId: string,
  name: string,
  position: number
): Promise<ProductAttribute> {
  const { data, error } = await client
    .from('product_attributes')
    .insert({ product_id: productId, name, position })
    .select()
    .single()
  if (error) throw new Error(`Failed to add attribute: ${error.message}`)
  return data
}

export async function renameAttribute(
  client: TypedClient,
  id: string,
  name: string
): Promise<ProductAttribute> {
  const { data, error } = await client
    .from('product_attributes')
    .update({ name })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`Failed to rename attribute: ${error.message}`)
  return data
}

export async function reorderAttribute(
  client: TypedClient,
  id: string,
  position: number
): Promise<void> {
  const { error } = await client.from('product_attributes').update({ position }).eq('id', id)
  if (error) throw new Error(`Failed to reorder attribute: ${error.message}`)
}

export async function deleteAttribute(client: TypedClient, id: string): Promise<void> {
  const { error } = await client.from('product_attributes').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete attribute: ${error.message}`)
}

// ─── Attribute values ───────────────────────────────────────────

export async function createAttributeValue(
  client: TypedClient,
  attributeId: string,
  value: string,
  position: number
): Promise<AttributeValue> {
  const { data, error } = await client
    .from('attribute_values')
    .insert({ attribute_id: attributeId, value, position })
    .select()
    .single()
  if (error) throw new Error(`Failed to add value: ${error.message}`)
  return data
}

// One round trip for any number of values, instead of one insert per value —
// this is what lets "S, M, L, XL, XXL" submit as a single bulk add.
export async function createAttributeValuesBulk(
  client: TypedClient,
  attributeId: string,
  values: string[],
  startPosition: number
): Promise<AttributeValue[]> {
  if (values.length === 0) return []
  const { data, error } = await client
    .from('attribute_values')
    .insert(values.map((value, i) => ({ attribute_id: attributeId, value, position: startPosition + i })))
    .select()
  if (error) throw new Error(`Failed to add values: ${error.message}`)
  return data
}

// Creates an attribute and its initial set of values together (2 round
// trips total, regardless of how many values).
export async function createAttributeWithValues(
  client: TypedClient,
  productId: string,
  name: string,
  values: string[],
  position: number
): Promise<AttributeWithValues> {
  const attribute = await createAttribute(client, productId, name, position)
  const attribute_values = await createAttributeValuesBulk(client, attribute.id, values, 0)
  return { ...attribute, attribute_values }
}

export async function renameAttributeValue(
  client: TypedClient,
  id: string,
  value: string
): Promise<AttributeValue> {
  const { data, error } = await client
    .from('attribute_values')
    .update({ value })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`Failed to rename value: ${error.message}`)
  return data
}

export async function deleteAttributeValue(client: TypedClient, id: string): Promise<void> {
  const { error } = await client.from('attribute_values').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete value: ${error.message}`)
}

// Sum of on_hand across variants that include this attribute value —
// used to warn before a destructive delete.
export async function stockForAttributeValue(client: TypedClient, attributeValueId: string): Promise<number> {
  const { data, error } = await client
    .from('variant_attribute_values')
    .select('variants ( on_hand )')
    .eq('attribute_value_id', attributeValueId)

  if (error) throw new Error(`Failed to check stock: ${error.message}`)
  const rows = data as unknown as { variants: { on_hand: number } | null }[]
  return rows.reduce((sum, row) => sum + (row.variants?.on_hand ?? 0), 0)
}

// ─── Variants ────────────────────────────────────────────────────

export async function updateVariant(
  client: TypedClient,
  id: string,
  patch: Database['public']['Tables']['variants']['Update']
): Promise<Variant> {
  const { data, error } = await client.from('variants').update(patch).eq('id', id).select().single()
  if (error) throw new Error(`Failed to update variant: ${error.message}`)
  return data
}

export async function deleteVariant(client: TypedClient, id: string): Promise<void> {
  const { error } = await client.from('variants').delete().eq('id', id)
  if (error) throw friendlyDeleteError(error, 'Failed to delete variant')
}

// Ensures one variant exists per cartesian combination of the product's
// current attribute values. Never deletes existing variants (stock truth
// takes priority) — orphaned combinations are left for the user to remove
// explicitly. If the product has no attributes at all, ensures exactly one
// "Standard" variant exists so simple (no-variant) products can hold stock.
//
// Batched: one insert for every missing variant and one for all their
// attribute-value links, instead of two round trips per missing variant.
// That N×2 sequential pattern was the actual cause of "add one value, wait
// a long time" — not network/localhost latency by itself.
// Returns the ids of any newly created variants.
export async function syncVariants(client: TypedClient, productId: string): Promise<string[]> {
  const product = await getProduct(client, productId)

  if (product.product_attributes.length === 0) {
    if (product.variants.length === 0) {
      const { data, error } = await client.from('variants').insert({ product_id: productId }).select('id').single()
      if (error) throw new Error(`Failed to create default variant: ${error.message}`)
      return [data.id]
    }
    return []
  }

  const valueGroups = product.product_attributes.map((attr) => attr.attribute_values.map((v) => v.id))
  if (valueGroups.some((g) => g.length === 0)) return [] // an attribute has no values yet

  const combos = cartesianProduct(valueGroups)
  const existingKeys = new Set(
    product.variants.map((v) => comboKey(v.variant_attribute_values.map((vv) => vv.attribute_value_id)))
  )

  const missing = combos.filter((combo) => !existingKeys.has(comboKey(combo)))
  if (missing.length === 0) return []

  // IDs generated client-side (not relying on insert/RETURNING order
  // matching) so each new variant's links are unambiguous.
  const newIds = missing.map(() => crypto.randomUUID())

  const { error: vErr } = await client
    .from('variants')
    .insert(newIds.map((id) => ({ id, product_id: productId })))
  if (vErr) throw new Error(`Failed to create variants: ${vErr.message}`)

  const links = missing.flatMap((combo, i) =>
    combo.map((attribute_value_id) => ({ variant_id: newIds[i], attribute_value_id }))
  )
  const { error: linkErr } = await client.from('variant_attribute_values').insert(links)
  if (linkErr) throw new Error(`Failed to link variant attributes: ${linkErr.message}`)

  return newIds
}
