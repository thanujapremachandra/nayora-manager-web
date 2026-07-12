'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { getOrder } from '@/lib/db/orders'
import { orderItemLabel } from '@/lib/order-helpers'
import { computeCollectableAmount } from '@/lib/pricing'
import { formatRs } from '@/lib/stock-helpers'
import type { OrderWithDetails } from '@/lib/order-helpers'
import type { Settings } from '@/lib/supabase/types'

interface Props {
  orderId: string | null
  settings: Settings
  onClose: () => void
}

export function OrderSummaryPopup({ orderId, settings, onClose }: Props) {
  const [order, setOrder] = useState<OrderWithDetails | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!orderId) {
      setOrder(null)
      return
    }
    setLoading(true)
    getOrder(createClient(), orderId)
      .then(setOrder)
      .finally(() => setLoading(false))
  }, [orderId])

  if (!orderId) return null

  const cod = order ? computeCollectableAmount(order, order.order_items, settings) : 0

  return (
    <Dialog open={orderId !== null} onClose={onClose} title={order ? order.ref_id : 'Order'} size="md">
      {loading || !order ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-gray-900">{order.customer_name}</p>
            <p className="text-gray-500">{order.address}</p>
          </div>
          <p className="text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
          {order.items_text && order.items_text.trim() ? (
            <p className="whitespace-pre-wrap border-t border-gray-100 pt-2 text-gray-700">{order.items_text}</p>
          ) : (
          <ul className="space-y-2 border-t border-gray-100 pt-2">
            {order.order_items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-gray-700">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-400">
                    {item.variants.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.variants.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M2.25 12.75v-7.5A2.25 2.25 0 014.5 3h15a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0119.5 21H4.5a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate">
                    {orderItemLabel(item)} × {item.qty}
                  </span>
                </div>
                <span className="shrink-0">{formatRs(item.unit_price * item.qty)}</span>
              </li>
            ))}
          </ul>
          )}
          <div className="flex justify-between border-t border-gray-100 pt-2 font-semibold text-gray-900">
            <span>COD</span>
            <span>{formatRs(cod)}</span>
          </div>
        </div>
      )}
    </Dialog>
  )
}
