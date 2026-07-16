'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { createClient } from '@/lib/supabase/client'
import {
  getPoolStats,
  importTrackingNumbers,
  backFillTracking,
  listPoolEntries,
  parseTrackingExcel,
  deletePoolEntries,
} from '@/lib/db/tracking-pool'
import type { PoolStats, PoolListEntry } from '@/lib/db/tracking-pool'

type ListFilter = 'all' | 'available' | 'assigned' | 'frozen'

export function TrackingPoolPanel() {
  const [stats, setStats] = useState<PoolStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ added: number; skipped: number } | null>(null)
  const [backFilling, setBackFilling] = useState(false)
  const [backFillResult, setBackFillResult] = useState<{ assigned: number; poolExhausted: boolean } | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [listEntries, setListEntries] = useState<PoolListEntry[] | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadStats() {
    try {
      const s = await getPoolStats(createClient())
      setStats(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pool stats')
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => {
    void loadStats()
    // Stats go stale when orders are frozen/unfrozen/deleted elsewhere (inside
    // a session view, another tab, …) — refresh whenever this view regains
    // focus or becomes visible again rather than only on first mount.
    const onFocus = () => void loadStats()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadStats()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    setBackFillResult(null)
    setError(null)
    try {
      const numbers = await parseTrackingExcel(file)
      if (numbers.length === 0) {
        setError('No tracking numbers found — make sure the sheet has a "TrackingNumber" column.')
        return
      }
      const result = await importTrackingNumbers(createClient(), numbers)
      setUploadResult(result)
      await loadStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleBackFill() {
    setBackFilling(true)
    setBackFillResult(null)
    setUploadResult(null)
    setError(null)
    try {
      const result = await backFillTracking(createClient())
      setBackFillResult(result)
      await loadStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Back-fill failed')
    } finally {
      setBackFilling(false)
    }
  }

  async function openList() {
    setListOpen(true)
    setLoadingList(true)
    setListEntries(null)
    setListFilter('all')
    setSelectedIds(new Set())
    try {
      const entries = await listPoolEntries(createClient())
      setListEntries(entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load list')
    } finally {
      setLoadingList(false)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDeleteSelected() {
    setDeleting(true)
    setError(null)
    try {
      await deletePoolEntries(createClient(), Array.from(selectedIds))
      setSelectedIds(new Set())
      // Refresh both the open list and the badge counts behind it.
      const [entries] = await Promise.all([listPoolEntries(createClient()), loadStats()])
      setListEntries(entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tracking numbers')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const poolEmpty = stats !== null && stats.available === 0

  const filteredEntries =
    listEntries?.filter((e) => listFilter === 'all' || e.status === listFilter) ?? []

  const filterCounts = listEntries
    ? {
        all: listEntries.length,
        available: listEntries.filter((e) => e.status === 'available').length,
        assigned: listEntries.filter((e) => e.status === 'assigned').length,
        frozen: listEntries.filter((e) => e.status === 'frozen').length,
      }
    : null

  const FILTER_LABELS: Record<ListFilter, string> = {
    all: 'All',
    available: 'Available',
    assigned: 'Assigned',
    frozen: 'On hold',
  }

  const selectedEntries = listEntries?.filter((e) => selectedIds.has(e.id)) ?? []
  const usedSelectedCount = selectedEntries.filter((e) => e.status !== 'available').length
  const allFilteredSelected =
    filteredEntries.length > 0 && filteredEntries.every((e) => selectedIds.has(e.id))

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) filteredEntries.forEach((e) => next.delete(e.id))
      else filteredEntries.forEach((e) => next.add(e.id))
      return next
    })
  }

  return (
    <div className="card mt-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Tracking Number Pool</h3>
          {loadingStats ? (
            <p className="mt-1 text-xs text-gray-400">Loading…</p>
          ) : stats ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  poolEmpty ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}
              >
                {stats.available} available
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {stats.assigned} assigned
              </span>
              {stats.frozen > 0 && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  {stats.frozen} on hold
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                {stats.total} total
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary">
            {uploading ? 'Uploading…' : '+ Upload tracking numbers'}
          </button>
          <button
            onClick={handleBackFill}
            disabled={backFilling || poolEmpty}
            className="btn-secondary"
          >
            {backFilling ? 'Filling…' : 'Back-fill pending orders'}
          </button>
          <button onClick={openList} className="btn-secondary">
            View full list
          </button>
        </div>
      </div>

      {poolEmpty && (
        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          Pool is empty — upload a .xlsx sheet with a TrackingNumber column to add more.
        </div>
      )}

      {uploadResult && (
        <p role="status" className="mt-2 text-xs text-green-700">
          Added {uploadResult.added} number(s).
          {uploadResult.skipped > 0 ? ` Skipped ${uploadResult.skipped} duplicate(s).` : ''}
        </p>
      )}

      {backFillResult && (
        <p role="status" className="mt-2 text-xs text-green-700">
          Assigned {backFillResult.assigned} number(s) to previously untracked orders.
          {backFillResult.poolExhausted ? ' Pool ran out — upload more to fill the rest.' : ''}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* Full list popup — only fetches data when opened */}
      <Dialog open={listOpen} onClose={() => setListOpen(false)} title="Tracking Number Pool" size="lg">
        {loadingList ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : listEntries ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="seg">
                {(['all', 'available', 'assigned', 'frozen'] as ListFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setListFilter(f)}
                    className={`seg-item ${listFilter === f ? 'seg-item-active' : ''}`}
                  >
                    {FILTER_LABELS[f]} ({filterCounts?.[f] ?? 0})
                  </button>
                ))}
              </div>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Delete {selectedIds.size} selected
                </button>
              )}
            </div>

            <div className="mt-3 max-h-[55vh] overflow-y-auto">
              {filteredEntries.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">No entries in this category.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                      <th className="w-8 py-1.5 pr-2 font-medium">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAll}
                          aria-label="Select all shown"
                          className="h-4 w-4"
                        />
                      </th>
                      <th className="py-1.5 pr-6 font-medium">Tracking Number</th>
                      <th className="py-1.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-gray-100">
                        <td className="py-1.5 pr-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(entry.id)}
                            onChange={() => toggleSelect(entry.id)}
                            aria-label={`Select ${entry.trackingNumber}`}
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="py-1.5 pr-6 font-mono text-xs text-gray-900">
                          {entry.trackingNumber}
                        </td>
                        <td className="py-1.5 text-xs">
                          {entry.status === 'available' ? (
                            <span className="text-green-700">Available</span>
                          ) : entry.status === 'frozen' ? (
                            <span className="text-amber-700">On hold · {entry.orderRef}</span>
                          ) : (
                            <span className="text-blue-700">Assigned · {entry.orderRef}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDeleteSelected}
        confirming={deleting}
        title={`Delete ${selectedIds.size} tracking number(s)?`}
        description={
          usedSelectedCount > 0
            ? `${usedSelectedCount} of these ${usedSelectedCount === 1 ? 'is' : 'are'} already assigned to an order. Deleting removes ${usedSelectedCount === 1 ? 'it' : 'them'} from the pool only — the order(s) keep their tracking number. Continue?`
            : 'This permanently removes them from the pool.'
        }
        confirmLabel="Delete"
      />
    </div>
  )
}
