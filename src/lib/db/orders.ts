import type { TypedClient } from '@/lib/supabase/client'
import type { Database, Order, OrderTracking, Session } from '@/lib/supabase/types'
import type { OrderWithDetails, OrderItemWithVariant, StockState } from '@/lib/order-helpers'
import { stockStateFor, targetStockState } from '@/lib/order-helpers'
import { adjustStock, recordSale, recordRestore } from '@/lib/db/stock-adjustments'

const ORDER_SELECT = `
  *,
  order_items (
    *,
    variants (
      id, name, image_url, price, cost, on_hand, reserved, product_id,
      products ( name, price_mode, global_price, global_cost ),
      variant_attribute_values ( attribute_values ( value ) )
    )
  ),
  order_tracking ( * )
`

// Same rationale as products.ts's hydrate(): nested-select shapes are too
// complex to express via hand-written Database types without a live project
// to generate from. Asserted once at this boundary.
function hydrate(raw: unknown): OrderWithDetails[] {
  return raw as OrderWithDetails[]
}

export async function listOrdersBySession(client: TypedClient, sessionId: string): Promise<OrderWithDetails[]> {
  const { data, error } = await client
    .from('orders')
    .select(ORDER_SELECT)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw new Error(`Failed to load orders: ${error.message}`)
  return hydrate(data)
}

export async function getOrder(client: TypedClient, id: string): Promise<OrderWithDetails> {
  const { data, error } = await client.from('orders').select(ORDER_SELECT).eq('id', id).single()
  if (error) throw new Error(`Failed to load order: ${error.message}`)
  return hydrate([data])[0]
}

export async function getOrdersByIds(client: TypedClient, ids: string[]): Promise<OrderWithDetails[]> {
  if (ids.length === 0) return []
  const { data, error } = await client.from('orders').select(ORDER_SELECT).in('id', ids)
  if (error) throw new Error(`Failed to load orders: ${error.message}`)
  return hydrate(data)
}

// Cross-session flat view for the Home dashboard's "Frozen orders" /
// "Issue orders" quick links — relies on the idx_orders_status index.
export async function listOrdersByStatus(client: TypedClient, status: Order['status']): Promise<OrderWithDetails[]> {
  const { data, error } = await client
    .from('orders')
    .select(ORDER_SELECT)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(100)
  if (error) throw new Error(`Failed to load ${status} orders: ${error.message}`)
  return hydrate(data)
}

// Scales with order volume: three targeted, indexed lookups (direct order
// fields, tracking numbers, product names) merged by id, instead of
// fetching a broad page of orders and filtering in JS.
export async function searchOrders(client: TypedClient, query: string): Promise<OrderWithDetails[]> {
  const q = `%${query.trim()}%`
  const orderIds = new Set<string>()

  const { data: direct, error: directError } = await client
    .from('orders')
    .select('id')
    .or(`ref_id.ilike.${q},customer_name.ilike.${q},phone1.ilike.${q},phone2.ilike.${q}`)
    .limit(50)
  if (directError) throw new Error(`Failed to search orders: ${directError.message}`)
  direct.forEach((o) => orderIds.add(o.id))

  const { data: tracking, error: trackingError } = await client
    .from('order_tracking')
    .select('order_id')
    .ilike('tracking_number', q)
    .limit(50)
  if (trackingError) throw new Error(`Failed to search tracking: ${trackingError.message}`)
  tracking.forEach((t) => orderIds.add(t.order_id))

  const { data: products, error: productsError } = await client.from('products').select('id').ilike('name', q).limit(20)
  if (productsError) throw new Error(`Failed to search products: ${productsError.message}`)
  if (products.length > 0) {
    const { data: variants, error: variantsError } = await client
      .from('variants')
      .select('id')
      .in(
        'product_id',
        products.map((p) => p.id)
      )
    if (variantsError) throw new Error(`Failed to search variants: ${variantsError.message}`)
    if (variants.length > 0) {
      const { data: items, error: itemsError } = await client
        .from('order_items')
        .select('order_id')
        .in(
          'variant_id',
          variants.map((v) => v.id)
        )
        .limit(50)
      if (itemsError) throw new Error(`Failed to search order items: ${itemsError.message}`)
      items.forEach((i) => orderIds.add(i.order_id))
    }
  }

  if (orderIds.size === 0) return []

  const { data, error } = await client
    .from('orders')
    .select(ORDER_SELECT)
    .in('id', Array.from(orderIds))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(50)
  if (error) throw new Error(`Failed to load search results: ${error.message}`)
  return hydrate(data)
}

// ─── Phone-based autofill / dup / history ─────────────────────────

export async function findOrdersByPhone(client: TypedClient, phone: string): Promise<Order[]> {
  if (phone.trim().length < 3) return []
  const q = `%${phone.trim()}%`
  const { data, error } = await client
    .from('orders')
    .select('*')
    .or(`phone1.ilike.${q},phone2.ilike.${q}`)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(10)
  if (error) throw new Error(`Failed to look up phone: ${error.message}`)
  return data
}

// ─── Create / update / delete ──────────────────────────────────────

export interface NewOrderItemInput {
  variantId: string
  qty: number
  unitPrice: number
  lineDiscount?: number | null
}

export async function createOrder(
  client: TypedClient,
  order: Database['public']['Tables']['orders']['Insert'],
  items: NewOrderItemInput[]
): Promise<Order> {
  const { data: created, error } = await client.from('orders').insert(order).select().single()
  if (error) throw new Error(`Failed to create order: ${error.message}`)

  for (const item of items) {
    await addOrderItem(client, created.id, item)
  }

  return created
}

export async function updateOrder(
  client: TypedClient,
  id: string,
  patch: Database['public']['Tables']['orders']['Update']
): Promise<Order> {
  const { data, error } = await client.from('orders').update(patch).eq('id', id).select().single()
  if (error) throw new Error(`Failed to update order: ${error.message}`)
  return data
}

// Deletes the order, unwinding whatever stock claim it currently holds first.
export async function deleteOrder(client: TypedClient, order: OrderWithDetails): Promise<void> {
  await transitionStock(client, order, 'none')
  const { error } = await client.from('orders').delete().eq('id', order.id)
  if (error) throw new Error(`Failed to delete order: ${error.message}`)
}

// The core stock state machine. An order's stock claim is always one of
// 'reserved' (held, not yet gone), 'deducted' (sent — physically gone), or
// 'none' (no claim). Every status change resolves to a target state and
// this function performs whichever stock operation bridges the two, so
// stock is always correct no matter which states are being crossed
// (including "undo"-style transitions like sent -> pending).
async function transitionStock(client: TypedClient, order: OrderWithDetails, to: StockState): Promise<void> {
  const from = stockStateFor(order)
  if (from === to) return

  for (const item of order.order_items) {
    const ctx = { variantId: item.variant_id, qty: item.qty, orderId: order.id }

    if (from === 'reserved' && to === 'deducted') {
      await recordSale(client, ctx)
    } else if (from === 'reserved' && to === 'none') {
      await adjustStock(client, { variantId: ctx.variantId, delta: -ctx.qty, reason: 'release', orderId: ctx.orderId })
    } else if (from === 'deducted' && to === 'reserved') {
      await recordRestore(client, ctx)
      await adjustStock(client, { variantId: ctx.variantId, delta: ctx.qty, reason: 'reserve', orderId: ctx.orderId })
    } else if (from === 'deducted' && to === 'none') {
      await recordRestore(client, ctx)
    } else if (from === 'none' && to === 'reserved') {
      await adjustStock(client, { variantId: ctx.variantId, delta: ctx.qty, reason: 'reserve', orderId: ctx.orderId })
    } else if (from === 'none' && to === 'deducted') {
      await recordSale(client, { ...ctx, clearReservation: false })
    }
  }
}

// ─── Items ──────────────────────────────────────────────────────────

export async function addOrderItem(
  client: TypedClient,
  orderId: string,
  item: NewOrderItemInput
): Promise<void> {
  // Snapshot the product/variant description as it is right now — fetched
  // fresh here (not trusted from the caller) so it's always accurate to
  // what was actually in stock at the moment this item was added. See
  // order-helpers.ts's orderItemLabel for why this matters.
  const { data: variant, error: variantError } = await client
    .from('variants')
    .select('name, products ( name ), variant_attribute_values ( attribute_values ( value ) )')
    .eq('id', item.variantId)
    .single()
  if (variantError) throw new Error(`Failed to load variant: ${variantError.message}`)

  const variantLabelSnapshot =
    variant.name ?? variant.variant_attribute_values.map((vv) => vv.attribute_values.value).join(' / ')

  const { error } = await client.from('order_items').insert({
    order_id: orderId,
    variant_id: item.variantId,
    qty: item.qty,
    unit_price: item.unitPrice,
    line_discount: item.lineDiscount ?? null,
    product_name_snapshot: variant.products.name,
    variant_label_snapshot: variantLabelSnapshot,
  })
  if (error) throw new Error(`Failed to add item: ${error.message}`)

  await adjustStock(client, {
    variantId: item.variantId,
    delta: item.qty,
    reason: 'reserve',
    orderId,
  })
}

export async function updateOrderItemQty(
  client: TypedClient,
  itemId: string,
  variantId: string,
  orderId: string,
  previousQty: number,
  newQty: number
): Promise<void> {
  const { error } = await client.from('order_items').update({ qty: newQty }).eq('id', itemId)
  if (error) throw new Error(`Failed to update item: ${error.message}`)

  const delta = newQty - previousQty
  if (delta !== 0) {
    await adjustStock(client, { variantId, delta, reason: delta > 0 ? 'reserve' : 'release', orderId })
  }
}

export async function removeOrderItem(
  client: TypedClient,
  itemId: string,
  variantId: string,
  qty: number,
  orderId: string
): Promise<void> {
  const { error } = await client.from('order_items').delete().eq('id', itemId)
  if (error) throw new Error(`Failed to remove item: ${error.message}`)

  await adjustStock(client, { variantId, delta: -qty, reason: 'release', orderId })
}

// ─── Freeze / unfreeze ───────────────────────────────────────────────

export async function freezeOrder(
  client: TypedClient,
  order: OrderWithDetails,
  mode: 'reserved' | 'released'
): Promise<void> {
  await transitionStock(client, order, mode === 'reserved' ? 'reserved' : 'none')
  await updateOrder(client, order.id, { status: 'frozen', freeze_stock_mode: mode })
}

export async function unfreezeOrder(client: TypedClient, order: OrderWithDetails): Promise<void> {
  await transitionStock(client, order, 'reserved')
  await updateOrder(client, order.id, { status: 'pending', freeze_stock_mode: null })
}

// ─── Status transitions ──────────────────────────────────────────────

export async function markSent(client: TypedClient, order: OrderWithDetails, batchTimestamp?: string): Promise<void> {
  await transitionStock(client, order, 'deducted')
  await updateOrder(client, order.id, {
    status: 'sent',
    freeze_stock_mode: null,
    dispatched_via_session_complete_at: batchTimestamp ?? null,
  })
}

export async function markSentBulk(client: TypedClient, orders: OrderWithDetails[], batchTimestamp?: string): Promise<void> {
  for (const order of orders) {
    await markSent(client, order, batchTimestamp)
  }
}

// Covers every dropdown transition (pending/issue/sent/returned/cancelled).
// Frozen has its own dedicated freeze/unfreeze flow above. Any transition
// away from a batch-dispatched 'sent' clears the batch marker, since the
// order is no longer part of that completed batch.
export async function setOrderStatus(client: TypedClient, order: OrderWithDetails, newStatus: Order['status']): Promise<void> {
  if (newStatus === order.status) return
  await transitionStock(client, order, targetStockState(newStatus))
  await updateOrder(client, order.id, {
    status: newStatus,
    freeze_stock_mode: null,
    dispatched_via_session_complete_at: null,
  })
}

// ─── Session completion (dispatch all qualifying orders) + undo ──────

export async function listFrozenOrders(client: TypedClient, sessionId: string): Promise<Pick<Order, 'id' | 'ref_id'>[]> {
  const { data, error } = await client
    .from('orders')
    .select('id, ref_id')
    .eq('session_id', sessionId)
    .eq('status', 'frozen')
  if (error) throw new Error(`Failed to load frozen orders: ${error.message}`)
  return data
}

export async function completeSessionWithDispatch(
  client: TypedClient,
  session: Session,
  orders: OrderWithDetails[]
): Promise<string> {
  const batchTimestamp = new Date().toISOString()
  const qualifying = orders.filter((o) => o.status === 'pending')
  await markSentBulk(client, qualifying, batchTimestamp)

  const { error } = await client
    .from('sessions')
    .update({ status: 'completed', completed_at: batchTimestamp })
    .eq('id', session.id)
  if (error) throw new Error(`Failed to complete session: ${error.message}`)

  return batchTimestamp
}

// Reverts exactly the orders that a specific "Complete session" action
// touched (matched by the shared batch timestamp) back to pending, restoring
// their stock. Orders changed individually since are untouched because
// their status is no longer 'sent' or their batch marker no longer matches.
export async function undoSessionComplete(client: TypedClient, session: Session): Promise<void> {
  if (!session.completed_at) throw new Error('Session was not completed')

  const { data, error } = await client
    .from('orders')
    .select(ORDER_SELECT)
    .eq('session_id', session.id)
    .eq('status', 'sent')
    .eq('dispatched_via_session_complete_at', session.completed_at)
  if (error) throw new Error(`Failed to load batch orders: ${error.message}`)

  for (const order of hydrate(data)) {
    await transitionStock(client, order, 'reserved')
    await updateOrder(client, order.id, { status: 'pending', dispatched_via_session_complete_at: null })
  }

  const { error: sessionError } = await client
    .from('sessions')
    .update({ status: 'pending', completed_at: null })
    .eq('id', session.id)
  if (sessionError) throw new Error(`Failed to revert session: ${sessionError.message}`)
}

// ─── Tracking ─────────────────────────────────────────────────────────

export async function addTracking(client: TypedClient, orderId: string, trackingNumber: string): Promise<OrderTracking> {
  const { data, error } = await client
    .from('order_tracking')
    .insert({ order_id: orderId, tracking_number: trackingNumber })
    .select()
    .single()
  if (error) throw new Error(`Failed to add tracking: ${error.message}`)
  return data
}

export async function removeTracking(client: TypedClient, id: string): Promise<void> {
  const { error } = await client.from('order_tracking').delete().eq('id', id)
  if (error) throw new Error(`Failed to remove tracking: ${error.message}`)
}

// Only one tracking number per order (user-confirmed — not multiple per
// spec's original assumption). Clears any existing ones before adding the
// new one, so this is always safe to call regardless of current state.
export async function setTracking(client: TypedClient, orderId: string, trackingNumber: string): Promise<OrderTracking> {
  const { error: deleteError } = await client.from('order_tracking').delete().eq('order_id', orderId)
  if (deleteError) throw new Error(`Failed to clear previous tracking: ${deleteError.message}`)
  return addTracking(client, orderId, trackingNumber)
}

export interface DuplicateTracking {
  orderId: string
  refId: string
}

// The courier can reuse a tracking number by mistake, or it might be a
// genuine intentional reuse (e.g. a replacement shipment) — so this is a
// warning the UI confirms, not a hard block. Excludes the order being
// edited so re-saving its own existing number doesn't false-positive.
export async function findDuplicateTracking(
  client: TypedClient,
  trackingNumber: string,
  excludeOrderId: string
): Promise<DuplicateTracking | null> {
  const { data: matches, error } = await client
    .from('order_tracking')
    .select('order_id')
    .eq('tracking_number', trackingNumber)
    .neq('order_id', excludeOrderId)
    .limit(1)
  if (error) throw new Error(`Failed to check tracking number: ${error.message}`)
  if (matches.length === 0) return null

  const { data: order, error: orderError } = await client
    .from('orders')
    .select('ref_id')
    .eq('id', matches[0].order_id)
    .single()
  if (orderError) throw new Error(`Failed to load matching order: ${orderError.message}`)

  return { orderId: matches[0].order_id, refId: order.ref_id }
}

export type { OrderWithDetails, OrderItemWithVariant }
