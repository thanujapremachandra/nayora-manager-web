'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  listOrdersBySession,
  freezeOrder,
  unfreezeOrder,
  setOrderStatus,
  markSentBulk,
  deleteOrder,
  completeSessionWithDispatch,
  undoSessionComplete,
  listFrozenOrders,
} from '@/lib/db/orders'
import { deleteSession } from '@/lib/db/sessions'
import { listExportColumns } from '@/lib/db/export-columns'
import { claimNextFromPool } from '@/lib/db/tracking-pool'
import { buildCourierWorkbook, downloadWorkbook } from '@/lib/export-excel'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import { OrderRow } from './order-row'
import { OrderDialog } from './order-dialog'
import { FreezeDialog } from './freeze-dialog'
import type { OrderWithDetails } from '@/lib/order-helpers'
import type { Session, Order, Settings } from '@/lib/supabase/types'

interface Props {
  session: Session
  initialOrders: OrderWithDetails[]
  settings: Settings
  onBack: () => void
  onSessionChanged: () => void
}

const CONFIRM_STATUSES: Order['status'][] = ['cancelled', 'returned']

export function SessionDetail({ session: initialSession, initialOrders, settings, onBack, onSessionChanged }: Props) {
  const [session, setSession] = useState(initialSession)
  const [orders, setOrders] = useState(initialOrders)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [freezingOrder, setFreezingOrder] = useState<OrderWithDetails | null>(null)
  const [confirmComplete, setConfirmComplete] = useState<{ frozenRefs: string[] } | null>(null)
  const [confirmStatusChange, setConfirmStatusChange] = useState<{ order: OrderWithDetails; status: Order['status'] } | null>(null)
  const [completing, setCompleting] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportNotice, setExportNotice] = useState<string | null>(null)
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(false)
  const [confirmDeleteBulk, setConfirmDeleteBulk] = useState(false)
  const [deletingOrders, setDeletingOrders] = useState(false)
  const [deletingSession, setDeletingSession] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offerTracking, setOfferTracking] = useState<OrderWithDetails | null>(null)
  const [assigningTracking, setAssigningTracking] = useState(false)
  const [assignedTracking, setAssignedTracking] = useState<string | 'empty' | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return orders
    const q = search.trim().toLowerCase()
    return orders.filter(
      (o) =>
        o.ref_id.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.phone1.includes(q) ||
        (o.phone2?.includes(q) ?? false) ||
        o.order_tracking.some((t) => t.tracking_number.toLowerCase().includes(q)) ||
        o.order_items.some((i) => i.variants.products.name.toLowerCase().includes(q)) ||
        (o.items_text?.toLowerCase().includes(q) ?? false)
    )
  }, [orders, search])

  async function refresh() {
    const data = await listOrdersBySession(createClient(), session.id)
    setOrders(data)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleMarkSentBulk() {
    const targets = orders.filter((o) => selectedIds.has(o.id))
    try {
      await markSentBulk(createClient(), targets)
      setSelectedIds(new Set())
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark sent')
    }
  }

  async function handleDeleteBulk() {
    const targets = orders.filter((o) => selectedIds.has(o.id))
    setDeletingOrders(true)
    try {
      const supabase = createClient()
      for (const order of targets) {
        await deleteOrder(supabase, order)
      }
      setSelectedIds(new Set())
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete order(s)')
    } finally {
      setDeletingOrders(false)
      setConfirmDeleteBulk(false)
    }
  }

  async function handleFreezeChoice(mode: 'reserved' | 'released') {
    if (!freezingOrder) return
    try {
      await freezeOrder(createClient(), freezingOrder, mode)
      setFreezingOrder(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to freeze order')
    }
  }

  async function handleUnfreeze(order: OrderWithDetails) {
    try {
      await unfreezeOrder(createClient(), order)
      await refresh()
      if (order.order_tracking.length === 0) {
        setOfferTracking(order)
        setAssignedTracking(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unfreeze order')
    }
  }

  async function handleAssignTracking() {
    if (!offerTracking) return
    setAssigningTracking(true)
    try {
      const result = await claimNextFromPool(createClient(), offerTracking.id)
      setAssignedTracking(result ?? 'empty')
      if (result) await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign tracking')
    } finally {
      setAssigningTracking(false)
    }
  }

  // Cancelled/returned have stock side effects (release or restore) — confirm first.
  function handleSetStatus(order: OrderWithDetails, status: Order['status']) {
    if (CONFIRM_STATUSES.includes(status)) {
      setConfirmStatusChange({ order, status })
      return
    }
    void applyStatusChange(order, status)
  }

  async function applyStatusChange(order: OrderWithDetails, status: Order['status']) {
    try {
      await setOrderStatus(createClient(), order, status)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  async function handleConfirmStatusChange() {
    if (!confirmStatusChange) return
    await applyStatusChange(confirmStatusChange.order, confirmStatusChange.status)
    setConfirmStatusChange(null)
  }

  async function handleRequestComplete() {
    const frozen = await listFrozenOrders(createClient(), session.id)
    setConfirmComplete({ frozenRefs: frozen.map((f) => f.ref_id) })
  }

  async function handleConfirmComplete() {
    setCompleting(true)
    try {
      const batchTimestamp = await completeSessionWithDispatch(createClient(), session, orders)
      setSession((s) => ({ ...s, status: 'completed', completed_at: batchTimestamp }))
      await refresh()
      onSessionChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete session')
    } finally {
      setCompleting(false)
      setConfirmComplete(null)
    }
  }

  async function handleUndoComplete() {
    setUndoing(true)
    try {
      await undoSessionComplete(createClient(), session)
      setSession((s) => ({ ...s, status: 'pending', completed_at: null }))
      await refresh()
      onSessionChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo')
    } finally {
      setUndoing(false)
    }
  }

  // Sessions cascade-delete their orders at the DB level, which would
  // silently skip our stock-unwinding logic (releasing reservations,
  // restoring sent stock). Only empty sessions are deletable from here —
  // delete the orders first (which unwinds their stock correctly) to empty one out.
  async function handleDeleteSession() {
    setDeletingSession(true)
    try {
      await deleteSession(createClient(), session.id)
      onSessionChanged()
      onBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session')
      setDeletingSession(false)
    }
  }

  // Selected orders take priority over the whole session's orders when
  // printing, but the session id always comes along so the print views can
  // show "Session: <name>" in their header either way.
  function printHref(basePath: string): string {
    if (selectedIds.size > 0) {
      return `${basePath}?session=${session.id}&orders=${Array.from(selectedIds).join(',')}`
    }
    return `${basePath}?session=${session.id}`
  }

  async function handleExportExcel() {
    setExporting(true)
    try {
      const supabase = createClient()
      const columns = await listExportColumns(supabase)
      if (columns.length === 0) {
        setError('No export columns configured — set them up in Settings → Excel Export.')
        return
      }
      const { buffer, exportedCount, skippedCount } = await buildCourierWorkbook(columns, orders, settings)
      downloadWorkbook(buffer, `${session.name.replace(/[^a-z0-9]+/gi, '-')}-courier-export.xlsx`)
      setExportNotice(`Exported ${exportedCount} order(s).${skippedCount > 0 ? ` Skipped ${skippedCount} (frozen/cancelled/returned/issue).` : ''}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={onBack} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            ← Sessions
          </button>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{session.name}</h1>
          <p className="text-sm text-gray-500">{orders.length} order(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && (
            <>
              <button onClick={handleMarkSentBulk} className="btn-secondary">
                Mark {selectedIds.size} as sent
              </button>
              <button
                onClick={() => setConfirmDeleteBulk(true)}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                Delete {selectedIds.size} selected
              </button>
            </>
          )}
          {session.status === 'pending' && (
            <button onClick={handleRequestComplete} className="btn-secondary">
              Complete session
            </button>
          )}
          {session.status === 'completed' && (
            <button onClick={handleUndoComplete} disabled={undoing} className="btn-secondary">
              {undoing ? 'Undoing…' : 'Undo complete'}
            </button>
          )}
          {orders.length === 0 && (
            <button
              onClick={() => setConfirmDeleteSession(true)}
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              Delete session
            </button>
          )}
          <button onClick={handleExportExcel} disabled={exporting} className="btn-secondary">
            {exporting ? 'Exporting…' : 'Export to Excel'}
          </button>
          <a href={printHref('/print/slips')} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            Print slips
          </a>
          <a href={printHref('/print/summary')} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            Print summary
          </a>
          <button onClick={() => setCreatingOrder(true)} className="btn-primary">
            + Add order
          </button>
        </div>
      </div>

      {exportNotice && (
        <p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {exportNotice}
        </p>
      )}

      <input
        type="search"
        placeholder="Search ref id, name, phone, tracking, item…"
        className="input mt-4 max-w-md"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            {orders.length === 0 ? 'No orders yet — add the first one.' : 'No orders match your search.'}
          </p>
        ) : (
          filtered.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              settings={settings}
              selected={selectedIds.has(order.id)}
              onToggleSelect={() => toggleSelect(order.id)}
              onEdit={() => setEditingOrderId(order.id)}
              onFreeze={() => setFreezingOrder(order)}
              onUnfreeze={() => handleUnfreeze(order)}
              onSetStatus={(status) => handleSetStatus(order, status)}
              onChanged={refresh}
            />
          ))
        )}
      </div>

      <OrderDialog
        open={creatingOrder}
        onClose={() => setCreatingOrder(false)}
        onSaved={refresh}
        orderId={null}
        sessionId={session.id}
        settings={settings}
      />
      <OrderDialog
        open={editingOrderId !== null}
        onClose={() => setEditingOrderId(null)}
        onSaved={refresh}
        orderId={editingOrderId}
        sessionId={session.id}
        settings={settings}
      />

      <FreezeDialog open={freezingOrder !== null} onClose={() => setFreezingOrder(null)} onChoose={handleFreezeChoice} />

      <ConfirmDialog
        open={confirmComplete !== null}
        onClose={() => setConfirmComplete(null)}
        onConfirm={handleConfirmComplete}
        confirming={completing}
        danger={false}
        title="Complete session?"
        description={
          confirmComplete && confirmComplete.frozenRefs.length > 0
            ? `${confirmComplete.frozenRefs.join(', ')} ${confirmComplete.frozenRefs.length === 1 ? 'is' : 'are'} frozen and will be skipped. All other pending orders will be marked sent.`
            : 'All pending orders in this session will be marked sent to courier.'
        }
        confirmLabel="Complete session"
      />

      <ConfirmDialog
        open={confirmStatusChange !== null}
        onClose={() => setConfirmStatusChange(null)}
        onConfirm={handleConfirmStatusChange}
        title={`Mark ${confirmStatusChange?.order.ref_id} as ${confirmStatusChange?.status}?`}
        description={
          confirmStatusChange?.order.status === 'sent'
            ? 'This restores its stock since the order had already been dispatched.'
            : 'This releases any stock currently reserved for this order.'
        }
        confirmLabel="Confirm"
      />

      <ConfirmDialog
        open={confirmDeleteSession}
        onClose={() => setConfirmDeleteSession(false)}
        onConfirm={handleDeleteSession}
        confirming={deletingSession}
        title={`Delete "${session.name}"?`}
        description="This session has no orders, so deleting it is safe and permanent."
        confirmLabel="Delete session"
      />

      <ConfirmDialog
        open={confirmDeleteBulk}
        onClose={() => setConfirmDeleteBulk(false)}
        onConfirm={handleDeleteBulk}
        confirming={deletingOrders}
        title={`Delete ${selectedIds.size} order(s)?`}
        description="This releases any reserved stock (or restores it if already sent) for each order, then deletes them permanently."
        confirmLabel="Delete orders"
      />

      {/* Offer to assign a pool tracking number when unfreezing an untracked order */}
      {offerTracking && (
        <Dialog
          open
          onClose={() => setOfferTracking(null)}
          title={`Assign tracking number to ${offerTracking.ref_id}?`}
          size="sm"
        >
          {assignedTracking === null ? (
            <>
              <p className="text-sm text-gray-600">
                This order was unfrozen without a tracking number. Assign the next available number
                from the pool?
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleAssignTracking}
                  disabled={assigningTracking}
                  className="btn-primary"
                >
                  {assigningTracking ? 'Assigning…' : 'Assign from pool'}
                </button>
                <button onClick={() => setOfferTracking(null)} className="btn-secondary">
                  Skip
                </button>
              </div>
            </>
          ) : assignedTracking === 'empty' ? (
            <>
              <p className="text-sm text-gray-600">
                The tracking pool is empty. Upload more numbers in the pool manager, then add one
                manually to this order.
              </p>
              <button onClick={() => setOfferTracking(null)} className="btn-primary mt-4">
                OK
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Tracking number{' '}
                <span className="font-mono font-semibold">{assignedTracking}</span> assigned to{' '}
                {offerTracking.ref_id}.
              </p>
              <button onClick={() => setOfferTracking(null)} className="btn-primary mt-4">
                Done
              </button>
            </>
          )}
        </Dialog>
      )}
    </div>
  )
}
