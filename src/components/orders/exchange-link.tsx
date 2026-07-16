'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { getOrder, searchOrders, updateOrder } from '@/lib/db/orders'
import { adjustStock } from '@/lib/db/stock-adjustments'
import { orderItemLabel } from '@/lib/order-helpers'
import { StatusBadge } from './status-badge'
import type { OrderWithDetails } from '@/lib/order-helpers'

interface Props {
  order: OrderWithDetails
  onChanged: () => void
}

// Links an exchange order to the order it replaces ("exchanged from"),
// found by ref id / tracking number / name. After linking, a follow-up
// dialog asks what the customer actually sent back — returned items go
// straight back into stock (per-item quantities, since people sometimes
// keep part of the original order). Chains naturally: the source order can
// itself be an exchange.
export function ExchangeLink({ order, onChanged }: Props) {
  const [source, setSource] = useState<OrderWithDetails | null>(null)
  const [loadingSource, setLoadingSource] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OrderWithDetails[]>([])
  const [searching, setSearching] = useState(false)
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isWritten = order.items_text !== null

  // Load the linked source order for display.
  useEffect(() => {
    let cancelled = false
    if (!order.exchange_source_order_id) {
      setSource(null)
      return
    }
    setLoadingSource(true)
    getOrder(createClient(), order.exchange_source_order_id)
      .then((data) => {
        if (!cancelled) setSource(data)
      })
      .catch(() => {
        if (!cancelled) setSource(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingSource(false)
      })
    return () => {
      cancelled = true
    }
  }, [order.exchange_source_order_id])

  // Debounced partner search (ref / tracking / name / phone).
  useEffect(() => {
    if (order.exchange_source_order_id || query.trim().length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const found = await searchOrders(createClient(), query.trim())
        setResults(
          found
            .filter((o) => o.id !== order.id)
            // A written order exchanges a written order (there are no stock
            // items to swap); stock orders can exchange anything.
            .filter((o) => (isWritten ? o.items_text !== null : true))
            .slice(0, 6)
        )
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, order.exchange_source_order_id, order.id, isWritten])

  async function link(partner: OrderWithDetails) {
    setError(null)
    try {
      await updateOrder(createClient(), order.id, { exchange_source_order_id: partner.id })
      setQuery('')
      setResults([])
      setSource(partner)
      onChanged()
      // Immediately ask what came back — that's the half people forget.
      if (partner.items_text === null && partner.order_items.length > 0) {
        setReturnDialogOpen(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link order')
    }
  }

  async function unlink() {
    setError(null)
    try {
      await updateOrder(createClient(), order.id, { exchange_source_order_id: null })
      setSource(null)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink')
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-purple-700/25 bg-purple-100/40 p-3">
      <p className="text-xs font-semibold text-purple-700">Exchanged from</p>

      {order.exchange_source_order_id ? (
        loadingSource ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : source ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm shadow-sm">
              <span className="font-mono font-semibold text-gray-900">{source.ref_id}</span>
              <span className="text-gray-500">{source.customer_name}</span>
              <StatusBadge status={source.status} />
              {source.is_exchange && (
                <span className="text-xs text-purple-700" title="This order is itself an exchange — part of a chain.">
                  ⛓ chain
                </span>
              )}
            </span>
            {source.items_text === null && source.order_items.length > 0 && (
              <button
                type="button"
                onClick={() => setReturnDialogOpen(true)}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                Returned items…
              </button>
            )}
            <button
              type="button"
              onClick={unlink}
              className="text-xs font-medium text-red-600 hover:text-red-700"
            >
              Unlink
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            Linked order no longer exists.
            <button type="button" onClick={unlink} className="text-xs font-medium text-red-600 hover:text-red-700">
              Clear
            </button>
          </div>
        )
      ) : (
        <div>
          <input
            type="search"
            className="input"
            placeholder="Search by ref id, tracking number, name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isWritten && (
            <p className="mt-1 text-xs text-gray-500">
              This is a written order — only written orders can be picked as its exchange source.
            </p>
          )}
          {searching && <p className="mt-2 text-xs text-gray-500">Searching…</p>}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="mt-2 text-xs text-gray-500">No matching orders.</p>
          )}
          {results.length > 0 && (
            <ul className="mt-2 space-y-1">
              {results.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => link(o)}
                    className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-surface px-3 py-2 text-left text-sm shadow-sm transition-colors hover:bg-gray-100"
                  >
                    <span className="font-mono font-semibold text-gray-900">{o.ref_id}</span>
                    <span className="min-w-0 flex-1 truncate text-gray-600">{o.customer_name}</span>
                    {o.order_tracking[0] && (
                      <span className="font-mono text-xs text-gray-400">{o.order_tracking[0].tracking_number}</span>
                    )}
                    <StatusBadge status={o.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}

      {source && (
        <ExchangeReturnDialog
          open={returnDialogOpen}
          onClose={() => setReturnDialogOpen(false)}
          source={source}
          newRef={order.ref_id}
        />
      )}
    </div>
  )
}

// "What did the customer actually send back?" — per-item quantities from the
// source order, restocked via the normal audit-logged adjustment path.
// People sometimes keep part of the original order, so nothing is assumed.
function ExchangeReturnDialog({
  open,
  onClose,
  source,
  newRef,
}: {
  open: boolean
  onClose: () => void
  source: OrderWithDetails
  newRef: string
}) {
  const [returnQty, setReturnQty] = useState<Record<string, number>>({})
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (open) {
      // Default to "everything came back" — adjust down for kept items.
      const initial: Record<string, number> = {}
      source.order_items.forEach((item) => {
        initial[item.id] = item.qty
      })
      setReturnQty(initial)
      setDone(false)
      setError(null)
    }
  }, [open, source])

  const anySelected = Object.values(returnQty).some((q) => q > 0)

  async function apply() {
    setApplying(true)
    setError(null)
    try {
      const supabase = createClient()
      for (const item of source.order_items) {
        const qty = returnQty[item.id] ?? 0
        if (qty > 0) {
          await adjustStock(supabase, {
            variantId: item.variant_id,
            delta: qty,
            reason: 'restore',
            note: `Exchange return (${newRef} ← ${source.ref_id})`,
            orderId: source.id,
          })
        }
      }
      setDone(true)
      setTimeout(onClose, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restock items')
    } finally {
      setApplying(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Returned items from ${source.ref_id}`}
      size="md"
      footer={
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={applying}>
            Customer kept everything
          </button>
          <button type="button" onClick={apply} disabled={applying || !anySelected || done} className="btn-primary">
            {applying ? 'Restocking…' : done ? 'Restocked ✓' : 'Return selected to stock'}
          </button>
        </div>
      }
    >
      <p className="text-sm text-gray-500">
        Set how many of each item actually came back — they&apos;ll be added back to stock (logged as
        an adjustment). Items the customer kept stay at 0.
      </p>
      <ul className="mt-3 space-y-2">
        {source.order_items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-100 px-3.5 py-2.5 text-sm">
            <span className="min-w-0 flex-1 truncate text-gray-700">{orderItemLabel(item)}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={item.qty}
                className="input w-16 py-1 text-center text-sm"
                value={returnQty[item.id] ?? 0}
                onChange={(e) => {
                  const n = Math.max(0, Math.min(item.qty, Number(e.target.value) || 0))
                  setReturnQty((prev) => ({ ...prev, [item.id]: n }))
                }}
                aria-label={`Returned quantity for ${orderItemLabel(item)}`}
              />
              <span className="text-xs text-gray-400">of {item.qty}</span>
            </div>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </Dialog>
  )
}
