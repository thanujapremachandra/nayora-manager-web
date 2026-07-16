'use client'

import { PrintStyles } from './print-styles'
import { orderContentsSummary } from '@/lib/order-helpers'
import { computeCollectableAmount } from '@/lib/pricing'
import { formatRs } from '@/lib/stock-helpers'
import type { OrderWithDetails } from '@/lib/order-helpers'
import type { Settings } from '@/lib/supabase/types'

interface Props {
  sessionName: string
  orders: OrderWithDetails[]
  settings: Settings
}

// A dense manifest, not a card per order: one line per order (ref id, items,
// total), flowing continuously down the page with normal CSS pagination —
// not one order per printed page.
export function SummaryView({ sessionName, orders, settings }: Props) {
  return (
    <div className="p-6 print:p-0">
      <PrintStyles />

      <div className="no-print mb-4 flex items-center justify-between border-b border-gray-200 pb-4">
        <p className="text-sm font-semibold text-gray-900">{orders.length} order(s)</p>
        <button onClick={() => window.print()} className="btn-primary">
          Print / Save as PDF
        </button>
      </div>

      <h1 className="text-[14pt] font-bold">Session: {sessionName}</h1>

      <div className="mt-3 space-y-2 text-[10pt]">
        {orders.map((order) => {
          const total = computeCollectableAmount(order, order.order_items, settings)
          const items = orderContentsSummary(order)
          const tracking = order.order_tracking.map((t) => t.tracking_number).join(', ')
          return (
            <p key={order.id} className="break-inside-avoid leading-snug">
              <span className="font-mono font-semibold">{order.ref_id}</span>
              {tracking && <span className="font-mono text-gray-600"> ({tracking})</span>}
              {' - '}
              <span>{order.customer_name}</span>
              {': '}
              <span>{items || 'No items'}</span>
              {' - '}
              <span className="font-semibold">{formatRs(total)}</span>
            </p>
          )
        })}
      </div>
    </div>
  )
}
