import type { Order, OrderItem, OrderTracking, Variant, Product } from '@/lib/supabase/types'
import { computeAvailable } from '@/lib/supabase/types'

export type VariantSummary = Pick<Variant, 'id' | 'name' | 'image_url' | 'price' | 'cost' | 'on_hand' | 'reserved' | 'product_id'> & {
  products: Pick<Product, 'name' | 'price_mode' | 'global_price' | 'global_cost'>
  variant_attribute_values: { attribute_values: { value: string } }[]
}

export type OrderItemWithVariant = OrderItem & { variants: VariantSummary }

export type OrderWithDetails = Order & {
  order_items: OrderItemWithVariant[]
  order_tracking: OrderTracking[]
}

// Prefers the snapshot captured when the item was added (so renaming a
// product/variant afterward doesn't rewrite history on old orders) — falls
// back to a live lookup only for rows added before the snapshot columns
// existed.
export function orderItemLabel(item: OrderItemWithVariant): string {
  const productName = item.product_name_snapshot ?? item.variants.products.name
  const variantLabel = item.variant_label_snapshot ?? liveVariantLabel(item.variants)
  return variantLabel ? `${productName} — ${variantLabel}` : productName
}

function liveVariantLabel(variant: VariantSummary): string {
  if (variant.name) return variant.name
  return variant.variant_attribute_values.map((v) => v.attribute_values.value).join(' / ')
}

// A single-line summary of what an order contains, for list views and the
// printed summary. Written orders (items_text set) show their typed text
// with line breaks flattened to ", " — on a one-line summary a swallowed
// newline would make two items read as one. Stock orders show their item
// labels with quantities. Empty for an order with neither.
export function orderContentsSummary(order: Pick<OrderWithDetails, 'items_text' | 'order_items'>): string {
  if (order.items_text && order.items_text.trim()) {
    return order.items_text
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(', ')
  }
  return order.order_items.map((i) => `${orderItemLabel(i)} ×${i.qty}`).join(', ')
}

export function variantEffectivePrice(variant: VariantSummary): number | null {
  if (variant.products.price_mode === 'global') return variant.products.global_price
  return variant.price ?? variant.products.global_price
}

export function variantAvailable(variant: Pick<Variant, 'on_hand' | 'reserved'>): number {
  return computeAvailable(variant as Variant)
}

export type StockState = 'reserved' | 'deducted' | 'none'

// Where this order's stock currently sits:
// - 'reserved': held in `reserved`, not yet physically gone (pending/issue,
//   or frozen with stock kept).
// - 'deducted': physically gone — sent, on_hand and reserved both reduced.
// - 'none': no claim on stock at all (frozen+released, cancelled, returned).
export function stockStateFor(order: Pick<Order, 'status' | 'freeze_stock_mode'>): StockState {
  if (order.status === 'sent') return 'deducted'
  if (order.status === 'pending' || order.status === 'issue') return 'reserved'
  if (order.status === 'frozen') return order.freeze_stock_mode === 'reserved' ? 'reserved' : 'none'
  return 'none' // cancelled, returned
}

export function targetStockState(status: Order['status']): StockState {
  if (status === 'sent') return 'deducted'
  if (status === 'pending' || status === 'issue') return 'reserved'
  return 'none' // cancelled, returned (frozen is never a dropdown target)
}

export function orderHoldsReservation(order: Pick<Order, 'status' | 'freeze_stock_mode'>): boolean {
  return stockStateFor(order) === 'reserved'
}

export const STATUS_STYLES: Record<Order['status'], string> = {
  pending: 'bg-blue-100 text-blue-700',
  frozen: 'bg-cyan-100 text-cyan-700',
  issue: 'bg-red-100 text-red-700',
  sent: 'bg-green-100 text-green-700',
  returned: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-200 text-gray-600',
}

export const STATUS_LABELS: Record<Order['status'], string> = {
  pending: 'Pending',
  frozen: 'Frozen',
  issue: 'Issue',
  sent: 'Sent',
  returned: 'Returned',
  cancelled: 'Cancelled',
}

export function dupPhoneAlertKey(sessionId: string, phone: string): string {
  return `dup_phone:${sessionId}:${phone}`
}
