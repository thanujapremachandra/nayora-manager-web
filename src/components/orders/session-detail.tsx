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
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
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
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-surface px-3.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Sessions
          </button>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{session.name}</h1>
          <p className="text-sm text-gray-500">{orders.length} order(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && (
            <>
              {/* Green: the "good outcome" action */}
              <button
                onClick={handleMarkSentBulk}
                className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2.5 text-sm font-semibold text-green-700 shadow-sm transition-colors hover:opacity-85"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Mark {selectedIds.size} as sent
              </button>
              <button
                onClick={() => setConfirmDeleteBulk(true)}
                className="inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:opacity-85"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Delete {selectedIds.size}
              </button>
            </>
          )}
          {session.status === 'pending' && (
            // Warm peach: closes the day out
            <button
              onClick={handleRequestComplete}
              className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 shadow-sm transition-colors hover:opacity-85"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
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
              className="inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:opacity-85"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Delete session
            </button>
          )}

          {/* Export / print actions grouped in one dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
              className="btn-secondary"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-3.5 w-3.5 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {exportMenuOpen && (
              <>
                {/* invisible backdrop: click anywhere else to close */}
                <div className="fixed inset-0 z-30" onClick={() => setExportMenuOpen(false)} aria-hidden />
                <div
                  role="menu"
                  className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-surface py-1.5 shadow-xl"
                >
                  <button
                    role="menuitem"
                    onClick={() => {
                      setExportMenuOpen(false)
                      void handleExportExcel()
                    }}
                    disabled={exporting}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5 text-green-600" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m-9.75 0h7.5" />
                    </svg>
                    {exporting ? 'Exporting…' : 'Export to Excel'}
                  </button>
                  <a
                    role="menuitem"
                    href={printHref('/print/slips')}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setExportMenuOpen(false)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5 text-brand-500" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659" />
                    </svg>
                    Print slips
                  </a>
                  <a
                    role="menuitem"
                    href={printHref('/print/summary')}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setExportMenuOpen(false)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5 text-amber-600" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                    </svg>
                    Print summary
                  </a>
                </div>
              </>
            )}
          </div>

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
