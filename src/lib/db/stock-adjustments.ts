import type { TypedClient } from '@/lib/supabase/client'
import type { StockAdjustment, Variant } from '@/lib/supabase/types'

interface AdjustStockInput {
  variantId: string
  delta: number
  reason: StockAdjustment['reason']
  note?: string | null
  orderId?: string | null
}

const RESERVED_REASONS: StockAdjustment['reason'][] = ['reserve', 'release']

// Writes the audit row, then applies the delta to on_hand (or reserved for
// reserve/release reasons). Both writes happen together; in the rare case
// the second fails, the audit row remains as the source of truth for a manual fix.
export async function adjustStock(client: TypedClient, input: AdjustStockInput): Promise<Variant> {
  const { error: logError } = await client.from('stock_adjustments').insert({
    variant_id: input.variantId,
    delta: input.delta,
    reason: input.reason,
    note: input.note ?? null,
    order_id: input.orderId ?? null,
  })
  if (logError) throw new Error(`Failed to log stock adjustment: ${logError.message}`)

  const { data: variant, error: fetchError } = await client
    .from('variants')
    .select('on_hand, reserved')
    .eq('id', input.variantId)
    .single()
  if (fetchError) throw new Error(`Failed to read variant: ${fetchError.message}`)

  const useReserved = RESERVED_REASONS.includes(input.reason)
  const patch = useReserved
    ? { reserved: variant.reserved + input.delta }
    : { on_hand: variant.on_hand + input.delta }

  const { data, error } = await client
    .from('variants')
    .update(patch)
    .eq('id', input.variantId)
    .select()
    .single()

  if (error) throw new Error(`Failed to apply stock adjustment: ${error.message}`)
  return data
}

// Order dispatched: stock physically leaves, and the earlier reservation for
// it is now resolved. Both on_hand and reserved drop by qty together so
// `available` (on_hand - reserved) is unaffected by this transition.
export async function recordSale(
  client: TypedClient,
  input: { variantId: string; qty: number; orderId: string; clearReservation?: boolean }
): Promise<Variant> {
  const clearReservation = input.clearReservation ?? true

  const { error: logError } = await client.from('stock_adjustments').insert({
    variant_id: input.variantId,
    delta: -input.qty,
    reason: 'sold',
    order_id: input.orderId,
  })
  if (logError) throw new Error(`Failed to log sale: ${logError.message}`)

  const { data: variant, error: fetchError } = await client
    .from('variants')
    .select('on_hand, reserved')
    .eq('id', input.variantId)
    .single()
  if (fetchError) throw new Error(`Failed to read variant: ${fetchError.message}`)

  const patch = clearReservation
    ? { on_hand: variant.on_hand - input.qty, reserved: variant.reserved - input.qty }
    : { on_hand: variant.on_hand - input.qty }

  const { data, error } = await client.from('variants').update(patch).eq('id', input.variantId).select().single()
  if (error) throw new Error(`Failed to apply sale: ${error.message}`)
  return data
}

// A previously-sent order is cancelled/returned: the physical stock comes
// back. Reserved is left untouched (it was already cleared at send time).
export async function recordRestore(
  client: TypedClient,
  input: { variantId: string; qty: number; orderId: string }
): Promise<Variant> {
  const { error: logError } = await client.from('stock_adjustments').insert({
    variant_id: input.variantId,
    delta: input.qty,
    reason: 'restore',
    order_id: input.orderId,
  })
  if (logError) throw new Error(`Failed to log restore: ${logError.message}`)

  const { data: variant, error: fetchError } = await client
    .from('variants')
    .select('on_hand')
    .eq('id', input.variantId)
    .single()
  if (fetchError) throw new Error(`Failed to read variant: ${fetchError.message}`)

  const { data, error } = await client
    .from('variants')
    .update({ on_hand: variant.on_hand + input.qty })
    .eq('id', input.variantId)
    .select()
    .single()
  if (error) throw new Error(`Failed to apply restore: ${error.message}`)
  return data
}

export async function listStockAdjustments(
  client: TypedClient,
  variantId: string
): Promise<StockAdjustment[]> {
  const { data, error } = await client
    .from('stock_adjustments')
    .select('*')
    .eq('variant_id', variantId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (error) throw new Error(`Failed to load adjustment history: ${error.message}`)
  return data
}
