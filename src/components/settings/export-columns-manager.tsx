'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  createExportColumn,
  updateExportColumn,
  deleteExportColumn,
} from '@/lib/db/export-columns'
import { SOURCE_LABELS } from '@/lib/export-helpers'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { ExportColumn, ExportColumnSource } from '@/lib/supabase/types'

interface Props {
  initialColumns: ExportColumn[]
}

const SOURCES = Object.keys(SOURCE_LABELS) as ExportColumnSource[]

export function ExportColumnsManager({ initialColumns }: Props) {
  const [columns, setColumns] = useState(initialColumns)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [adding, setAdding] = useState(false)

  function patchLocal(id: string, patch: Partial<ExportColumn>) {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  async function saveColumn(column: ExportColumn) {
    await updateExportColumn(createClient(), column.id, {
      header_label: column.header_label,
      source: column.source,
      fallback_value: column.fallback_value,
      true_value: column.true_value,
      false_value: column.false_value,
    })
  }

  async function handleAdd() {
    setAdding(true)
    try {
      const created = await createExportColumn(createClient(), {
        position: columns.length + 1,
        header_label: 'New column',
        source: 'fixed',
        fallback_value: '',
      })
      setColumns((prev) => [...prev, created])
    } finally {
      setAdding(false)
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= columns.length) return

    const reordered = [...columns]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)

    const supabase = createClient()
    await Promise.all(
      reordered.map((c, i) => updateExportColumn(supabase, c.id, { position: i + 1 }))
    )
    setColumns(reordered.map((c, i) => ({ ...c, position: i + 1 })))
  }

  async function handleDelete() {
    if (!confirmDeleteId) return
    setDeleting(true)
    try {
      await deleteExportColumn(createClient(), confirmDeleteId)
      setColumns((prev) => prev.filter((c) => c.id !== confirmDeleteId))
    } finally {
      setDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Define the courier Excel&apos;s columns, in order. Each one pulls from an order field (with
        an optional fallback) or always writes a fixed value.
      </p>

      <div className="space-y-3">
        {columns.map((column, index) => (
          <div key={column.id} className="card p-4">
            <div className="flex items-start gap-3">
              <span className="mt-2.5 w-6 shrink-0 text-center text-sm font-medium text-gray-400">
                {index + 1}
              </span>

              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="Header label (e.g. TrackingNumber)"
                    value={column.header_label}
                    onChange={(e) => patchLocal(column.id, { header_label: e.target.value })}
                    onBlur={() => saveColumn(column)}
                  />
                  <select
                    className="input text-sm"
                    value={column.source}
                    onChange={(e) => {
                      const source = e.target.value as ExportColumnSource
                      patchLocal(column.id, { source })
                      saveColumn({ ...column, source })
                    }}
                  >
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {SOURCE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>

                {column.source === 'exchange' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="Value when exchange"
                      value={column.true_value ?? ''}
                      onChange={(e) => patchLocal(column.id, { true_value: e.target.value })}
                      onBlur={() => saveColumn(column)}
                    />
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="Value when not"
                      value={column.false_value ?? ''}
                      onChange={(e) => patchLocal(column.id, { false_value: e.target.value })}
                      onBlur={() => saveColumn(column)}
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder={column.source === 'fixed' ? 'Always this value' : 'Fallback value (used when blank)'}
                    value={column.fallback_value ?? ''}
                    onChange={(e) => patchLocal(column.id, { fallback_value: e.target.value })}
                    onBlur={() => saveColumn(column)}
                  />
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <button
                  onClick={() => handleMove(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => handleMove(index, 1)}
                  disabled={index === columns.length - 1}
                  aria-label="Move down"
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => setConfirmDeleteId(column.id)}
                  aria-label="Delete column"
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleAdd} disabled={adding} className="btn-secondary">
        + Add column
      </button>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        confirming={deleting}
        title="Delete this column?"
        description="It will no longer appear in future Excel exports."
        confirmLabel="Delete column"
      />
    </div>
  )
}
