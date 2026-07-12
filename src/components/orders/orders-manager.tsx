'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listSessions, createSession, listSessionOrderCounts, getSession } from '@/lib/db/sessions'
import { listOrdersBySession, listOrdersByStatus, searchOrders } from '@/lib/db/orders'
import { SessionCard } from './session-card'
import { SessionDetail } from './session-detail'
import { OrderSummaryPopup } from './order-summary-popup'
import { TrackingPoolPanel } from './tracking-pool-panel'
import { orderContentsSummary, STATUS_LABELS } from '@/lib/order-helpers'
import type { Session, Settings, Order } from '@/lib/supabase/types'
import type { SessionCounts } from '@/lib/db/sessions'
import type { OrderWithDetails } from '@/lib/order-helpers'

interface Props {
  initialSessions: Session[]
  initialCounts: Map<string, SessionCounts>
  settings: Settings
  initialStatusFilter?: Order['status'] | null
  initialFilteredOrders?: OrderWithDetails[]
}

function todayName(): string {
  return new Date().toLocaleDateString('en-LK', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function OrdersManager({
  initialSessions,
  initialCounts,
  settings,
  initialStatusFilter = null,
  initialFilteredOrders = [],
}: Props) {
  const [sessions, setSessions] = useState(initialSessions)
  const [counts, setCounts] = useState(initialCounts)
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [activeOrders, setActiveOrders] = useState<OrderWithDetails[]>([])
  const [newSessionName, setNewSessionName] = useState(todayName())
  const [creatingSession, setCreatingSession] = useState(false)

  const [globalSearch, setGlobalSearch] = useState('')
  const [globalResults, setGlobalResults] = useState<OrderWithDetails[]>([])
  const [searching, setSearching] = useState(false)
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState(initialStatusFilter)
  const [filteredOrders, setFilteredOrders] = useState(initialFilteredOrders)

  useEffect(() => {
    if (!globalSearch.trim() || activeSession) {
      setGlobalResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchOrders(createClient(), globalSearch.trim())
        setGlobalResults(results)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [globalSearch, activeSession])

  useEffect(() => {
    if (!statusFilter) return
    listOrdersByStatus(createClient(), statusFilter).then(setFilteredOrders)
  }, [statusFilter])

  async function refreshSessions() {
    const supabase = createClient()
    const [sessionList, countMap] = await Promise.all([listSessions(supabase), listSessionOrderCounts(supabase)])
    setSessions(sessionList)
    setCounts(countMap)
  }

  async function openSession(session: Session) {
    const orders = await listOrdersBySession(createClient(), session.id)
    setActiveOrders(orders)
    setActiveSession(session)
  }

  async function handleOpenSessionForOrder(order: OrderWithDetails) {
    const session = await getSession(createClient(), order.session_id)
    await openSession(session)
  }

  async function handleCreateSession() {
    if (!newSessionName.trim()) return
    setCreatingSession(true)
    try {
      const session = await createSession(createClient(), newSessionName.trim())
      await refreshSessions()
      await openSession(session)
      setNewSessionName(todayName())
    } finally {
      setCreatingSession(false)
    }
  }

  async function handleBackToSessions() {
    setActiveSession(null)
    await refreshSessions()
  }

  const sessionsSorted = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [sessions]
  )

  if (activeSession) {
    return (
      <SessionDetail
        session={activeSession}
        initialOrders={activeOrders}
        settings={settings}
        onBack={handleBackToSessions}
        onSessionChanged={refreshSessions}
      />
    )
  }

  // Either a status-filter quick-link (from the Home dashboard) or a free
  // text search produces the same flat, cross-session results list.
  const flatResults = statusFilter ? filteredOrders : globalSearch.trim() ? globalResults : null

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Handler</h1>
          <p className="mt-1 text-sm text-gray-500">Sessions, dispatch, and tracking.</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className="input w-40"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
          />
          <button onClick={handleCreateSession} disabled={creatingSession} className="btn-primary whitespace-nowrap">
            + New session
          </button>
        </div>
      </div>

      <TrackingPoolPanel />

      <input
        type="search"
        placeholder="Search all orders — ref id, name, phone, tracking, item…"
        className="input mt-4 max-w-md"
        value={globalSearch}
        onChange={(e) => {
          setGlobalSearch(e.target.value)
          setStatusFilter(null)
        }}
      />

      {statusFilter && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700">
            Showing {STATUS_LABELS[statusFilter].toLowerCase()} orders
          </span>
          <button onClick={() => setStatusFilter(null)} className="text-gray-500 hover:text-gray-700">
            Clear
          </button>
        </div>
      )}

      {flatResults ? (
        <div className="mt-6">
          {searching ? (
            <p className="text-sm text-gray-500">Searching…</p>
          ) : flatResults.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">
              {statusFilter ? `No ${STATUS_LABELS[statusFilter].toLowerCase()} orders.` : `No orders match "${globalSearch}".`}
            </p>
          ) : (
            <ul className="space-y-2">
              {flatResults.map((order) => (
                <li key={order.id} className="card flex items-center justify-between gap-3 p-3">
                  <button onClick={() => setViewingOrderId(order.id)} className="min-w-0 flex-1 text-left">
                    <p className="font-mono text-sm font-semibold text-gray-900">{order.ref_id}</p>
                    <p className="text-sm text-gray-600">{order.customer_name} · {order.phone1}</p>
                    <p className="truncate text-xs text-gray-400">
                      {orderContentsSummary(order) || 'No items'}
                    </p>
                  </button>
                  <button
                    onClick={() => handleOpenSessionForOrder(order)}
                    className="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Open session →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : sessions.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <h3 className="text-sm font-semibold text-gray-900">No sessions yet</h3>
          <p className="mt-1 max-w-xs text-sm text-gray-500">
            Create a session to start logging today&apos;s orders.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessionsSorted.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              counts={counts.get(session.id) ?? { total: 0, pending: 0, frozen: 0 }}
              onOpen={() => openSession(session)}
            />
          ))}
        </div>
      )}

      <OrderSummaryPopup orderId={viewingOrderId} settings={settings} onClose={() => setViewingOrderId(null)} />
    </div>
  )
}
