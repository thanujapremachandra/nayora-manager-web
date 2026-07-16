'use client'

import { useState } from 'react'
import { PrintStyles } from './print-styles'
import { CustomSlipNodes } from './custom-slip-front'
import { DefaultSlipFrontContent } from './slip-front'
import { SlipBackContent } from './slip-back'
import { SLIP_BOX_WIDTH_MM, SLIP_BOX_HEIGHT_MM } from '@/lib/slip-template'
import { pageDimensionsMm, backPlacementFor } from '@/lib/slip-placement'
import type { OrderWithDetails } from '@/lib/order-helpers'
import type { Settings, SlipPlacementLayout, SlipPlacement } from '@/lib/supabase/types'

type SlipOrder = OrderWithDetails & { backText?: string }

interface Props {
  orders: SlipOrder[]
  settings: Settings
  layout: SlipPlacementLayout
  defaultDuplex?: boolean
}

// Imported rows (see import-orders.ts) carry free-form "Context" text
// instead of real order_items, so the back prints that text rather than an
// item list — same ref_id/date header as the normal back for consistency.
function BackContent({ order }: { order: SlipOrder }) {
  if (order.backText !== undefined) {
    return (
      <div className="flex h-full w-full flex-col">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-[12pt] font-bold">{order.ref_id}</h2>
          <p className="text-[8pt] text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
        </div>
        <p className="mt-2 flex-1 whitespace-pre-wrap text-[9pt]">{order.backText}</p>
      </div>
    )
  }
  return <SlipBackContent order={order} />
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return []
  const pages: T[][] = []
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size))
  return pages
}

function ScaledBox({ placement, children }: { placement: SlipPlacement; children: React.ReactNode }) {
  const scaleX = placement.width / SLIP_BOX_WIDTH_MM
  const scaleY = placement.height / SLIP_BOX_HEIGHT_MM
  return (
    <div
      className="absolute overflow-hidden"
      style={{ left: `${placement.x}mm`, top: `${placement.y}mm`, width: `${placement.width}mm`, height: `${placement.height}mm` }}
    >
      <div
        className="relative origin-top-left"
        style={{ width: `${SLIP_BOX_WIDTH_MM}mm`, height: `${SLIP_BOX_HEIGHT_MM}mm`, transform: `scale(${scaleX}, ${scaleY})`, fontSize: '10pt' }}
      >
        {children}
      </div>
    </div>
  )
}

export function PlacementSlipView({ orders, settings, layout, defaultDuplex = true }: Props) {
  const [duplex, setDuplex] = useState(defaultDuplex)
  const page = pageDimensionsMm(layout.orientation)
  const perPage = layout.placements.length
  const pages = chunk(orders, perPage)
  const hasCustomFront = !!(settings.slip_template && settings.slip_template.nodes.length > 0)

  if (perPage === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        No slips placed yet — add at least one in Settings → Slip Placement before printing.
      </div>
    )
  }

  return (
    <div>
      <PrintStyles orientation={layout.orientation} margin="0" />

      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-surface p-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {orders.length} slip(s) — {pages.length} sheet(s) · {perPage} per sheet · {layout.orientation}
          </p>
          <label className="mt-1 flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <input type="checkbox" checked={duplex} onChange={(e) => setDuplex(e.target.checked)} />
            Double-sided (print order details on the back)
          </label>
        </div>
        <button onClick={() => window.print()} className="btn-primary">
          Print / Save as PDF
        </button>
      </div>

      {pages.map((pageOrders, pageIndex) => {
        const isLastSheet = pageIndex === pages.length - 1
        // A front is always followed by something (its own back, if duplex
        // is on; the next sheet's front, if not) — except the very last
        // front when duplex is off, which is the final page overall.
        const frontBreak = duplex ? 'always' : isLastSheet ? 'auto' : 'always'

        return (
        <div key={pageIndex}>
          <div className="relative" style={{ width: `${page.width}mm`, height: `${page.height}mm`, pageBreakAfter: frontBreak }}>
            {pageOrders.map((order, slotIndex) => (
              <ScaledBox key={order.id} placement={layout.placements[slotIndex]}>
                {hasCustomFront ? (
                  <CustomSlipNodes template={settings.slip_template!} ctx={{ order, items: order.order_items, settings }} />
                ) : (
                  <DefaultSlipFrontContent order={order} settings={settings} />
                )}
              </ScaledBox>
            ))}
          </div>

          {duplex && (
            <div
              className="relative"
              style={{
                width: `${page.width}mm`,
                height: `${page.height}mm`,
                pageBreakAfter: isLastSheet ? 'auto' : 'always',
              }}
            >
              {pageOrders.map((order, slotIndex) => (
                <ScaledBox key={order.id} placement={backPlacementFor(layout.placements[slotIndex], layout)}>
                  <BackContent order={order} />
                </ScaledBox>
              ))}
            </div>
          )}
        </div>
        )
      })}
    </div>
  )
}
