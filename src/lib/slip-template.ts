import type { Order, Settings, SlipFieldKey, SlipNode, SlipTransform } from '@/lib/supabase/types'
import type { OrderItemWithVariant } from '@/lib/order-helpers'
import { computeCollectableAmount, effectiveWeightGrams, formatWeight } from '@/lib/pricing'
import { formatRs } from '@/lib/stock-helpers'

// The slip box's printable content area (matches .slip-box in print-styles.tsx,
// minus its padding) — the canvas in the designer represents exactly this.
export const SLIP_BOX_WIDTH_MM = 178
export const SLIP_BOX_HEIGHT_MM = 74

export const SLIP_FIELD_LABELS: Record<SlipFieldKey, string> = {
  business_name: 'Business name',
  customer_name: 'Customer name',
  address: 'Address',
  phone_numbers: 'Phone number(s)',
  ref_id: 'Reference ID',
  tracking_number: 'Tracking number',
  cod_amount: 'COD amount',
  weight: 'Weight',
  footer_text: 'Footer text',
  remark: 'Remark',
  custom_text: 'Custom text',
  box: 'Box / line',
}

export const TRANSFORM_LABELS: Record<SlipTransform, string> = {
  none: 'No change',
  uppercase: 'UPPERCASE',
  lowercase: 'lowercase',
  prefix: 'Add text before',
  suffix: 'Add text after',
}

export interface SlipContext {
  order: Pick<
    Order,
    | 'customer_name'
    | 'address'
    | 'phone1'
    | 'phone2'
    | 'ref_id'
    | 'weight_grams'
    | 'payment_type'
    | 'cod_amount_override'
    | 'is_exchange'
    | 'courier_charge_override'
    | 'order_discount'
    | 'items_amount'
    | 'remarks'
    | 'legacy_mode'
    | 'exchange_keep_courier_override'
    | 'bank_collect_override'
    | 'auto_weight_override'
  > & { order_tracking?: { tracking_number: string }[] }
  items: Pick<OrderItemWithVariant, 'unit_price' | 'qty' | 'line_discount'>[]
  settings: Settings
}

function resolveFieldValue(node: SlipNode, ctx: SlipContext): string {
  switch (node.fieldKey) {
    case 'business_name':
      return ctx.settings.business_name
    case 'customer_name':
      return ctx.order.customer_name
    case 'address':
      return ctx.order.address
    case 'phone_numbers':
      return ctx.order.phone2 ? `${ctx.order.phone1} / ${ctx.order.phone2}` : ctx.order.phone1
    case 'ref_id':
      return ctx.order.ref_id
    case 'tracking_number':
      return ctx.order.order_tracking?.map((t) => t.tracking_number).join(', ') ?? ''
    case 'cod_amount':
      return formatRs(computeCollectableAmount(ctx.order, ctx.items, ctx.settings))
    case 'weight':
      return formatWeight(effectiveWeightGrams(ctx.order, ctx.items, ctx.settings))
    case 'footer_text':
      return ctx.settings.slip_footer_text
    case 'remark':
      return ctx.order.remarks ?? ''
    case 'custom_text':
      return node.customText ?? ''
    case 'box':
      return '' // rendered as a shape, never as text
    default:
      return ''
  }
}

export function resolveSlipNodeText(node: SlipNode, ctx: SlipContext): string {
  const raw = resolveFieldValue(node, ctx)
  if (!raw) return '' // empty stays empty — no prefix/suffix/case change tacked onto nothing
  switch (node.transform) {
    case 'uppercase':
      return raw.toUpperCase()
    case 'lowercase':
      return raw.toLowerCase()
    case 'prefix':
      return `${node.transformArg ?? ''}${raw}`
    case 'suffix':
      return `${raw}${node.transformArg ?? ''}`
    default:
      return raw
  }
}

export function createSlipNode(fieldKey: SlipFieldKey, x: number, y: number): SlipNode {
  if (fieldKey === 'box') {
    return {
      id: crypto.randomUUID(),
      fieldKey,
      x,
      y,
      width: 60,
      height: 20,
      fontSize: 10,
      bold: false,
      align: 'left',
      transform: 'none',
    }
  }

  return {
    id: crypto.randomUUID(),
    fieldKey,
    customText: fieldKey === 'custom_text' ? 'Custom text' : undefined,
    x,
    y,
    width: fieldKey === 'address' || fieldKey === 'footer_text' ? 90 : 55,
    fontSize: fieldKey === 'business_name' ? 16 : 10,
    bold: fieldKey === 'business_name' || fieldKey === 'ref_id',
    align: 'left',
    transform: 'none',
  }
}

// Sample data so the designer can show a realistic live preview without a
// real order. Not persisted anywhere.
export function sampleSlipContext(settings: Settings): SlipContext {
  return {
    order: {
      customer_name: 'S. Perera',
      address: '123 Galle Road, Colombo 4',
      phone1: '0771234567',
      phone2: '0719876543',
      ref_id: 'NYR-0007',
      order_tracking: [{ tracking_number: 'CT123456789LK' }],
      weight_grams: 1200,
      payment_type: 'cod',
      cod_amount_override: null,
      is_exchange: false,
      courier_charge_override: null,
      order_discount: null,
      items_amount: null,
      remarks: 'Handle with care',
      legacy_mode: false,
      exchange_keep_courier_override: null,
      bank_collect_override: null,
      auto_weight_override: null,
    },
    items: [{ unit_price: 1500, qty: 2, line_discount: null }],
    settings,
  }
}
