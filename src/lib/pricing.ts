import type { Order, OrderItem, Settings } from '@/lib/supabase/types'

export function computeItemTotal(item: Pick<OrderItem, 'unit_price' | 'qty' | 'line_discount'>): number {
  return item.unit_price * item.qty - (item.line_discount ?? 0)
}

export function computeOrderTotal(
  order: Pick<Order, 'order_discount'>,
  items: Pick<OrderItem, 'unit_price' | 'qty' | 'line_discount'>[]
): number {
  const itemsTotal = items.reduce((sum, item) => sum + computeItemTotal(item), 0)
  return itemsTotal - (order.order_discount ?? 0)
}

export function courierChargeFor(
  order: Pick<Order, 'courier_charge_override'>,
  settings: Pick<Settings, 'default_courier_charge'>
): number {
  return order.courier_charge_override ?? settings.default_courier_charge
}

// ─── Per-order "legacy" overrides ─────────────────────────────
// An order in legacy_mode is detached from the three global behaviour
// settings and uses its own *_override value instead (falling back to the
// global value only when the override was never set). When legacy_mode is
// off the overrides are ignored and the global setting always wins.
type LegacyOrder = Pick<
  Order,
  'legacy_mode' | 'exchange_keep_courier_override' | 'bank_collect_override' | 'auto_weight_override'
>

export function exchangeKeepsCourier(
  order: Pick<Order, 'legacy_mode' | 'exchange_keep_courier_override'>,
  settings: Pick<Settings, 'exchange_keep_courier_charge'>
): boolean {
  if (order.legacy_mode) return order.exchange_keep_courier_override ?? settings.exchange_keep_courier_charge
  return settings.exchange_keep_courier_charge
}

export function bankTransferCollects(
  order: Pick<Order, 'legacy_mode' | 'bank_collect_override'>,
  settings: Pick<Settings, 'bank_transfer_collect'>
): boolean {
  if (order.legacy_mode) return order.bank_collect_override ?? settings.bank_transfer_collect
  return settings.bank_transfer_collect
}

export function orderAutoWeightOn(
  order: Pick<Order, 'legacy_mode' | 'auto_weight_override'>,
  settings: Pick<Settings, 'auto_weight_enabled'>
): boolean {
  if (order.legacy_mode) return order.auto_weight_override ?? settings.auto_weight_enabled
  return settings.auto_weight_enabled
}

// What the courier actually collects from the customer — printed in the
// slip's COD box and in the Excel "Amount" column (must match exactly).
// cod_amount_override always wins when set. Exchange and bank-transfer orders
// default to collecting nothing, but each can be flipped (globally in Settings,
// or per-order in legacy mode) to keep the courier charge / full amount.
export function computeCollectableAmount(
  order: Pick<
    Order,
    | 'payment_type'
    | 'cod_amount_override'
    | 'is_exchange'
    | 'courier_charge_override'
    | 'order_discount'
    | 'items_amount'
  > &
    LegacyOrder,
  items: Pick<OrderItem, 'unit_price' | 'qty' | 'line_discount'>[],
  settings: Pick<
    Settings,
    'default_courier_charge' | 'exchange_keep_courier_charge' | 'bank_transfer_collect'
  >
): number {
  if (order.cod_amount_override !== null && order.cod_amount_override !== undefined) {
    return order.cod_amount_override
  }

  const courier = courierChargeFor(order, settings)
  // Stock orders total their items; written orders total the typed amount.
  // Both then behave identically w.r.t. courier / exchange / bank rules.
  const total = computeOrderTotal(order, items) + (order.items_amount ?? 0)

  if (order.is_exchange) {
    return exchangeKeepsCourier(order, settings) ? courier : 0
  }
  if (order.payment_type === 'bank') {
    return bankTransferCollects(order, settings) ? total + courier : 0
  }

  return total + courier
}

// Item subtotal before courier charge / order discount — the basis for
// auto-weight's "by price" mode.
function itemsSubtotal(items: Pick<OrderItem, 'unit_price' | 'qty' | 'line_discount'>[]): number {
  return items.reduce((sum, item) => sum + computeItemTotal(item), 0)
}

// The weight to actually use for an order: a manually entered weight always
// wins; otherwise, if auto-weight is on, it's derived from the item count or
// subtotal (over the threshold → "over" grams, at/under → "under" grams).
// Returns null when there's no manual weight and auto-weight is off.
export function effectiveWeightGrams(
  order: Pick<Order, 'weight_grams' | 'items_amount'> & Pick<Order, 'legacy_mode' | 'auto_weight_override'>,
  items: Pick<OrderItem, 'unit_price' | 'qty' | 'line_discount'>[],
  settings: Pick<
    Settings,
    | 'auto_weight_enabled'
    | 'auto_weight_mode'
    | 'auto_weight_threshold'
    | 'auto_weight_over_grams'
    | 'auto_weight_under_grams'
  >
): number | null {
  if (order.weight_grams !== null && order.weight_grams !== undefined) return order.weight_grams
  if (!orderAutoWeightOn(order, settings)) return null

  // "price" counts stock items and any written amount; "count" counts item qty.
  const metric =
    settings.auto_weight_mode === 'price'
      ? itemsSubtotal(items) + (order.items_amount ?? 0)
      : items.reduce((sum, item) => sum + item.qty, 0)

  return metric > settings.auto_weight_threshold
    ? settings.auto_weight_over_grams
    : settings.auto_weight_under_grams
}

export function gramsToKgG(grams: number | null): { kg: number; g: number } {
  const total = grams ?? 0
  return { kg: Math.floor(total / 1000), g: total % 1000 }
}

export function kgGToGrams(kg: number, g: number): number {
  // Normalize overflow grams (e.g. 1500g entered as g -> 1kg 500g).
  return kg * 1000 + g
}

export function formatWeight(grams: number | null): string {
  if (grams === null) return '-'
  const { kg, g } = gramsToKgG(grams)
  if (kg === 0) return `${g} g`
  if (g === 0) return `${kg} kg`
  return `${kg} kg ${g} g`
}
