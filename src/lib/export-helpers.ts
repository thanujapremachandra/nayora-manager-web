import type { ExportColumn, Settings } from '@/lib/supabase/types'
import type { OrderWithDetails } from '@/lib/order-helpers'
import { computeCollectableAmount, effectiveWeightGrams, gramsToKgG } from '@/lib/pricing'

function receiverCity(address: string): string {
  // Replicates the operator's manual process: the city is the last word
  // of the address line.
  const trimmed = address.trim().replace(/[.,]+$/, '')
  const parts = trimmed.split(/\s+/)
  return parts[parts.length - 1] ?? ''
}

function receiverContact(order: Pick<OrderWithDetails, 'phone1' | 'phone2'>): string {
  return order.phone2 ? `${order.phone1}/${order.phone2}` : order.phone1
}

export function resolveColumnValue(column: ExportColumn, order: OrderWithDetails, settings: Settings): string | number {
  switch (column.source) {
    case 'tracking_numbers':
      return order.order_tracking.map((t) => t.tracking_number).join(', ') || (column.fallback_value ?? '')
    case 'ref_id':
      return order.ref_id
    case 'package_description':
      return order.package_description || (column.fallback_value ?? '')
    case 'receiver_name':
      return order.customer_name
    case 'receiver_address':
      return order.address
    case 'receiver_city':
      return receiverCity(order.address) || (column.fallback_value ?? '')
    case 'receiver_contact':
      return receiverContact(order)
    case 'kilo':
      return gramsToKgG(effectiveWeightGrams(order, order.order_items, settings)).kg
    case 'gram':
      return gramsToKgG(effectiveWeightGrams(order, order.order_items, settings)).g
    case 'amount':
      return computeCollectableAmount(order, order.order_items, settings)
    case 'exchange':
      return order.is_exchange ? column.true_value ?? '1' : column.false_value ?? '0'
    case 'remark':
      return order.remarks || (column.fallback_value ?? '0')
    case 'fixed':
      return column.fallback_value ?? ''
    default:
      return ''
  }
}

// Frozen orders are always excluded (spec). Cancelled/returned/issue orders
// aren't actually being dispatched right now, so they're excluded too.
export function isExportable(order: Pick<OrderWithDetails, 'status'>): boolean {
  return order.status === 'pending' || order.status === 'sent'
}

export const SOURCE_LABELS: Record<ExportColumn['source'], string> = {
  tracking_numbers: 'Tracking number(s)',
  ref_id: 'Reference (our ref id)',
  package_description: 'Package description',
  receiver_name: 'Receiver name',
  receiver_address: 'Receiver address',
  receiver_city: 'Receiver city (last word of address)',
  receiver_contact: 'Receiver contact (phone1/phone2)',
  kilo: 'Weight — kilograms',
  gram: 'Weight — grams',
  amount: 'Amount (COD total incl. courier charge)',
  exchange: 'Exchange flag',
  remark: 'Remark',
  fixed: 'Fixed value (always the same)',
}
