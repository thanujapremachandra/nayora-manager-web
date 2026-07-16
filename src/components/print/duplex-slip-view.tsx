'use client'

import { useState } from 'react'
import { PrintStyles } from './print-styles'
import { SlipFront } from './slip-front'
import { SlipBack } from './slip-back'
import type { OrderWithDetails } from '@/lib/order-helpers'
import type { Settings } from '@/lib/supabase/types'

interface Props {
  orders: OrderWithDetails[]
  settings: Settings
}

const PER_PAGE = 3

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = []
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size))
  return pages
}

export function DuplexSlipView({ orders, settings }: Props) {
  const [duplex, setDuplex] = useState(true)
  const pages = chunk(orders, PER_PAGE)

  return (
    <div>
      <PrintStyles />

      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-surface p-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{orders.length} slip(s) — {pages.length} sheet(s)</p>
          {duplex ? (
            <p className="text-xs text-gray-500">
              Print double-sided, flip on the <strong>long edge</strong>. Single-column slips don&apos;t
              need left/right mirroring like a grid would — each back lines up directly behind its front.
            </p>
          ) : (
            <p className="text-xs text-gray-500">Fronts only — no order-detail backs will print.</p>
          )}
          <label className="mt-1 flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <input type="checkbox" checked={duplex} onChange={(e) => setDuplex(e.target.checked)} />
            Double-sided (print order details on the back)
          </label>
        </div>
        <button onClick={() => window.print()} className="btn-primary">
          Print / Save as PDF
        </button>
      </div>

      {/* Page order is front, back, front, back… so each physical sheet
          gets its matching back when duplex-printed. Single column means
          row position is unaffected by a long-edge (left/right) flip, so
          fronts and backs render in the same top-to-bottom order. */}
      {pages.map((page, i) => (
        <div key={i}>
          <div className="slip-page">
            {page.map((order) => (
              <SlipFront key={order.id} order={order} settings={settings} />
            ))}
          </div>
          {duplex && (
            <div className="slip-page">
              {page.map((order) => (
                <SlipBack key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
