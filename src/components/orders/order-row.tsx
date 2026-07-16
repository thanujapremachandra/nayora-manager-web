'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setTracking, removeTracking, findDuplicateTracking, updateOrder } from '@/lib/db/orders'
import { computeCollectableAmount, effectiveWeightGrams, formatWeight, gramsToKgG, kgGToGrams } from '@/lib/pricing'
import { STATUS_LABELS, orderContentsSummary } from '@/lib/order-helpers'
import { StatusBadge } from './status-badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { keepDigits } from '@/lib/input-format'
import type { OrderWithDetails } from '@/lib/order-helpers'
import type { Order, Settings } from '@/lib/supabase/types'

const STATUS_OPTIONS: Order['status'][] = ['pending', 'issue', 'sent', 'returned', 'cancelled']

interface Props {
  order: OrderWithDetails
  settings: Settings
  selected: boolean
  onToggleSelect: () => void
  onEdit: () => void
  onFreeze: () => void
  onUnfreeze: () => void
  onSetStatus: (status: Order['status']) => void
  onChanged: () => void
}

export function OrderRow({ order, settings, selected, onToggleSelect, onEdit, onFreeze, onUnfreeze, onSetStatus, onChanged }: Props) {
  const [quickEditOpen, setQuickEditOpen] = useState(false)
  const [trackingValue, setTrackingValue] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [weightG, setWeightG] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState<{ value: string; refId: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [quickEditError, setQuickEditError] = useState<string | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cod = computeCollectableAmount(order, order.order_items, settings)
  const itemsSummary = orderContentsSummary(order)

  const tracking = order.order_tracking[0] ?? null

  function startQuickEdit() {
    const { kg, g } = gramsToKgG(order.weight_grams)
    setWeightKg(order.weight_grams === null ? '' : kg.toString())
    setWeightG(order.weight_grams === null ? '' : g.toString())
    setTrackingValue(tracking?.tracking_number ?? '')
    setQuickEditError(null)
    setQuickEditOpen(true)
  }

  async function persistQuickEdit(trackingNumber: string) {
    const supabase = createClient()
    const weightGrams = weightKg === '' && weightG === '' ? null : kgGToGrams(Number(weightKg || 0), Number(weightG || 0))
    await updateOrder(supabase, order.id, { weight_grams: weightGrams })

    if (trackingNumber) {
      await setTracking(supabase, order.id, trackingNumber)
    } else if (tracking) {
      await removeTracking(supabase, tracking.id)
    }

    setQuickEditOpen(false)
    setDuplicateWarning(null)
    onChanged()
  }

  async function submitQuickEdit(e: React.FormEvent) {
    e.preventDefault()
    const trackingNumber = trackingValue.trim()
    setSaving(true)
    setQuickEditError(null)
    try {
      if (trackingNumber && trackingNumber !== tracking?.tracking_number) {
        const duplicate = await findDuplicateTracking(createClient(), trackingNumber, order.id)
        if (duplicate) {
          setDuplicateWarning({ value: trackingNumber, refId: duplicate.refId })
          return
        }
      }
      await persistQuickEdit(trackingNumber)
    } catch (err) {
      setQuickEditError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function handleTouchStart() {
    longPressTimer.current = setTimeout(startQuickEdit, 500)
  }
  function handleTouchEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  return (
    <div
      className="card card-hover mb-2 p-3.5"
      onContextMenu={(e) => {
        e.preventDefault()
        startQuickEdit()
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      {/* Mobile: wrapping stack. Desktop: one row, info spread across
          fixed columns (identity | contents | tracking | weight | COD | controls). */}
      <div className="flex flex-wrap items-start gap-3 md:grid md:grid-cols-[1.25rem_1.4fr_1.5fr_minmax(7rem,1fr)_5rem_6.5rem_auto] md:items-center">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} className="mt-1.5 h-4 w-4 md:mt-0" aria-label={`Select order ${order.ref_id}`} />

        <button onClick={onEdit} className="min-w-0 flex-1 text-left md:flex-none">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-gray-900">{order.ref_id}</span>
            <StatusBadge status={order.status} />
            {order.is_exchange && (
              <span className="status-pill border-purple-700/25 bg-purple-100 text-purple-700">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-purple-700" />
                Exchange
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-gray-700">
            {order.customer_name} <span className="text-gray-400">·</span> {order.phone1}
          </p>
        </button>

        <p className="w-full truncate text-xs text-gray-500 md:w-auto" title={itemsSummary}>
          {itemsSummary || 'No items'}
        </p>

        {/* Tracking (desktop column; wraps below on mobile) */}
        <div className="min-w-0">
          {!quickEditOpen &&
            (tracking ? (
              <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                <button onClick={startQuickEdit} className="truncate font-mono hover:underline">
                  {tracking.tracking_number}
                </button>
                <button onClick={() => removeTracking(createClient(), tracking.id).then(onChanged)} aria-label="Remove tracking" className="shrink-0 text-gray-400 hover:text-red-600">
                  ×
                </button>
              </span>
            ) : (
              <button onClick={startQuickEdit} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                + Tracking
              </button>
            ))}
        </div>

        <p className="text-xs text-gray-500">{formatWeight(effectiveWeightGrams(order, order.order_items, settings))}</p>

        <p className="text-right font-display text-sm font-semibold text-gray-900">Rs. {cod.toLocaleString()}</p>

        <div className="flex items-center gap-2">
          <select
            value={order.status === 'frozen' ? '' : order.status}
            onChange={(e) => onSetStatus(e.target.value as Order['status'])}
            className="input w-auto py-1 text-xs"
            aria-label="Order status"
          >
            {order.status === 'frozen' && <option value="">Frozen</option>}
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          {order.status === 'frozen' ? (
            <button onClick={onUnfreeze} className="btn-secondary py-1 text-xs">
              Unfreeze
            </button>
          ) : (
            order.status === 'pending' && (
              <button onClick={onFreeze} className="btn-secondary py-1 text-xs">
                Freeze
              </button>
            )
          )}
        </div>
      </div>

      {/* Weight + tracking quick edit — right-click or long-press a row */}
      <div className={quickEditOpen ? 'mt-2' : 'hidden'}>
        {quickEditOpen ? (
          <form onSubmit={submitQuickEdit} className="flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-2">
            <div>
              <label className="block text-[10px] font-medium text-gray-500">Weight</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  placeholder="kg"
                  className="input w-14 py-1 text-xs"
                  value={weightKg}
                  onChange={(e) => setWeightKg(keepDigits(e.target.value))}
                />
                <input
                  type="number"
                  min={0}
                  max={999}
                  placeholder="g"
                  className="input w-14 py-1 text-xs"
                  value={weightG}
                  onChange={(e) => setWeightG(keepDigits(e.target.value))}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500">Tracking number</label>
              <input
                autoFocus
                type="text"
                placeholder="Tracking number"
                className="input w-36 py-1 text-xs"
                value={trackingValue}
                onChange={(e) => setTrackingValue(e.target.value)}
              />
            </div>
            <button type="submit" disabled={saving} className="btn-primary py-1 text-xs">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setQuickEditOpen(false)} className="btn-secondary py-1 text-xs">
              Cancel
            </button>
            {quickEditError && <span className="text-xs text-red-600">{quickEditError}</span>}
          </form>
        ) : null}
      </div>

      <ConfirmDialog
        open={duplicateWarning !== null}
        onClose={() => setDuplicateWarning(null)}
        onConfirm={() => duplicateWarning && persistQuickEdit(duplicateWarning.value)}
        title="Tracking number already in use"
        description={`"${duplicateWarning?.value}" is already on order ${duplicateWarning?.refId}. Use it here anyway?`}
        confirmLabel="Use anyway"
      />
    </div>
  )
}
