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

  const totals = useMemo(() => {
    let orders = 0
    let pending = 0
    let frozen = 0
    counts.forEach((c) => {
      orders += c.total
      pending += c.pending
      frozen += c.frozen
    })
    return { orders, pending, frozen, completedSessions: sessions.filter((s) => s.status === 'completed').length }
  }, [counts, sessions])

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
                <li key={order.id} className="card card-hover flex items-center justify-between gap-3 p-3">
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
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <h3 className="text-sm font-semibold text-gray-900">No sessions yet</h3>
          <p className="mt-1 max-w-xs text-sm text-gray-500">
            Create a session to start logging today&apos;s orders.
          </p>
        </div>
      ) : (
        <>
          {/* Totals across all sessions */}
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total orders</p>
              <p className="mt-1 font-display text-2xl font-bold text-gray-900">{totals.orders}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Pending orders</p>
              <p className="mt-1 font-display text-2xl font-bold text-blue-700">{totals.pending}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Frozen orders</p>
              <p className="mt-1 font-display text-2xl font-bold text-cyan-600">{totals.frozen}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Sessions</p>
              <p className="mt-1 font-display text-2xl font-bold text-gray-900">
                {sessions.length}
                <span className="ml-1.5 text-sm font-medium text-gray-400">
                  {totals.completedSessions} done
                </span>
              </p>
            </div>
          </div>

          {/* Desktop: sessions table */}
          <div className="card mt-4 hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-100/50 text-left text-xs text-gray-500">
                  <th className="px-4 py-3 font-medium">Session</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Orders</th>
                  <th className="px-4 py-3 font-medium">Frozen</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sessionsSorted.map((session) => {
                  const c = counts.get(session.id) ?? { total: 0, pending: 0, frozen: 0 }
                  return (
                    <tr
                      key={session.id}
                      onClick={() => openSession(session)}
                      className="cursor-pointer border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-100/60"
                    >
                      <td className="px-4 py-3 font-semibold text-gray-900">{session.name}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(session.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-display font-semibold text-gray-900">{c.total}</td>
                      <td className="px-4 py-3">
                        {c.frozen > 0 ? <span className="font-medium text-cyan-600">{c.frozen}</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`status-pill ${
                            session.status === 'completed'
                              ? 'border-green-700/25 bg-green-100 text-green-700'
                              : 'border-blue-700/25 bg-blue-100 text-blue-700'
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`h-1.5 w-1.5 rounded-full ${session.status === 'completed' ? 'bg-green-600' : 'bg-blue-700'}`}
                          />
                          {session.status === 'completed' ? 'Completed' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-brand-600">Open →</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:hidden">
            {sessionsSorted.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                counts={counts.get(session.id) ?? { total: 0, pending: 0, frozen: 0 }}
                onOpen={() => openSession(session)}
              />
            ))}
          </div>
        </>
      )}

      <OrderSummaryPopup orderId={viewingOrderId} settings={settings} onClose={() => setViewingOrderId(null)} />
    </div>
  )
}
