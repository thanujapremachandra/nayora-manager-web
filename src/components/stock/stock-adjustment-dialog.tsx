'use client'

import { useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { adjustStock } from '@/lib/db/stock-adjustments'
import { rearmAlert, lowStockAlertKey } from '@/lib/db/dismissed-alerts'
import type { StockAdjustment } from '@/lib/supabase/types'

const REASONS: { value: StockAdjustment['reason']; label: string }[] = [
  { value: 'restock', label: 'Restock (received new stock)' },
  { value: 'damage', label: 'Damage' },
  { value: 'correction', label: 'Correction (miscount)' },
  { value: 'restore', label: 'Restore' },
]

interface Props {
  open: boolean
  onClose: () => void
  onAdjusted: () => void
  variant: { id: string; label: string; onHand: number; reserved: number } | null
}

export function StockAdjustmentDialog({ open, onClose, onAdjusted, variant }: Props) {
  const [reason, setReason] = useState<StockAdjustment['reason']>('restock')
  const [delta, setDelta] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setReason('restock')
    setDelta('')
    setNote('')
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!variant) return
    const deltaNum = Number(delta)
    if (!deltaNum) {
      setError('Enter a non-zero amount.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      await adjustStock(supabase, {
        variantId: variant.id,
        delta: deltaNum,
        reason,
        note: note || null,
      })
      if (reason === 'restock') {
        await rearmAlert(supabase, lowStockAlertKey(variant.id))
      }
      onAdjusted()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adjustment failed')
    } finally {
      setSaving(false)
    }
  }

  if (!variant) return null

  return (
    <Dialog open={open} onClose={handleClose} title="Adjust stock" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
          <p className="font-medium text-gray-900">{variant.label}</p>
          <p className="text-gray-500">
            On hand: {variant.onHand} · Reserved: {variant.reserved} · Available:{' '}
            {variant.onHand - variant.reserved}
          </p>
        </div>

        <div>
          <label htmlFor="reason" className="label mb-1">
            Reason
          </label>
          <select
            id="reason"
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value as StockAdjustment['reason'])}
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="delta" className="label mb-1">
            Amount <span className="text-gray-400">(use a minus sign to reduce, e.g. -2)</span>
          </label>
          <input
            id="delta"
            type="number"
            required
            className="input"
            placeholder="e.g. 10 or -2"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="note" className="label mb-1">
            Note <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            id="note"
            rows={2}
            className="input resize-none"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={handleClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Apply adjustment'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
