'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getSettings } from '@/lib/db/settings'
import { parseImportWorkbook, importRowToOrder, type ImportedOrderRow } from '@/lib/import-orders'
import { PlacementSlipView } from '@/components/print/placement-slip-view'
import { formatWeight } from '@/lib/pricing'
import { formatRs } from '@/lib/stock-helpers'
import type { Settings } from '@/lib/supabase/types'

export default function ImportPage() {
  const [rows, setRows] = useState<ImportedOrderRow[] | null>(null)
  const [missingColumns, setMissingColumns] = useState<string[] | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    setParseError(null)
    setRows(null)
    setMissingColumns(null)
    try {
      const result = await parseImportWorkbook(file)
      if (result.missingColumns.length > 0) {
        setMissingColumns(result.missingColumns)
      } else {
        setRows(result.rows)
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to read this file. Is it a valid .xlsx?')
    } finally {
      setParsing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const validRows = rows?.filter((r) => r.errors.length === 0) ?? []
  const invalidRows = rows?.filter((r) => r.errors.length > 0) ?? []

  async function handlePrint() {
    setPrinting(true)
    try {
      const supabase = createClient()
      const data = await getSettings(supabase)
      setSettings(data)
    } finally {
      setPrinting(false)
    }
  }

  if (settings && rows) {
    return (
      <div>
        <div className="no-print p-4">
          <button onClick={() => setSettings(null)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            ← Back to review
          </button>
        </div>
        {settings.slip_placement_layout ? (
          <PlacementSlipView
            orders={validRows.map(importRowToOrder)}
            settings={settings}
            layout={settings.slip_placement_layout}
            defaultDuplex={validRows.some((r) => r.context !== null)}
          />
        ) : (
          <p className="p-8 text-center text-sm text-gray-500">
            No slip placement layout configured yet — set one up in Settings → Slip Placement before printing.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Data</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload a courier-style .xlsx sheet to print slips — nothing here is saved to the database.
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Back to home
        </Link>
      </div>

      <div className="card mt-6 p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileSelected}
          disabled={parsing}
          className="text-sm"
        />
        {parsing && <p className="mt-2 text-sm text-gray-500">Reading file…</p>}
        {parseError && <p role="alert" className="mt-2 text-sm text-red-700">{parseError}</p>}
        {missingColumns && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            This sheet is missing required column(s): {missingColumns.join(', ')}
          </p>
        )}
        <p className="mt-3 text-xs text-gray-400">
          Expected columns: TrackingNumber, Reference, PackageDescription, Receiver Name, ReceiverAddress,
          ReceiverCity, ReceiverContactNo, NoOfPcs, Kilo, Gram, Amount, Exchange, Remark, Context. Context prints on
          the back of the slip during double-sided printing.
        </p>
      </div>

      {rows && (
        <div className="card mt-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-900">
              {validRows.length} valid · {invalidRows.length} error(s)
            </p>
            <button onClick={handlePrint} disabled={validRows.length === 0 || printing} className="btn-primary">
              {printing ? 'Loading…' : `Print ${validRows.length} slip(s)`}
            </button>
          </div>

          <div className="mt-3 max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="py-1.5 pr-2 font-medium">Row</th>
                  <th className="py-1.5 pr-2 font-medium">Reference</th>
                  <th className="py-1.5 pr-2 font-medium">Customer</th>
                  <th className="py-1.5 pr-2 font-medium">Address</th>
                  <th className="py-1.5 pr-2 font-medium">City</th>
                  <th className="py-1.5 pr-2 font-medium">Phone</th>
                  <th className="py-1.5 pr-2 font-medium">Weight</th>
                  <th className="py-1.5 pr-2 font-medium">Amount</th>
                  <th className="py-1.5 pr-2 font-medium">Context (back)</th>
                  <th className="py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowNumber} className={`border-b border-gray-100 ${row.errors.length > 0 ? 'bg-red-50' : ''}`}>
                    <td className="py-1.5 pr-2 text-gray-500">{row.rowNumber}</td>
                    <td className="py-1.5 pr-2 font-mono text-gray-900">{row.refId || '-'}</td>
                    <td className="py-1.5 pr-2 text-gray-700">{row.customerName || '-'}</td>
                    <td className="max-w-[14rem] truncate py-1.5 pr-2 text-gray-700">{row.address || '-'}</td>
                    <td className="py-1.5 pr-2 text-gray-700">{row.city ?? '-'}</td>
                    <td className="py-1.5 pr-2 text-gray-700">{row.phone1 || '-'}</td>
                    <td className="py-1.5 pr-2 text-gray-700">{formatWeight(row.weightGrams)}</td>
                    <td className="py-1.5 pr-2 text-gray-700">{formatRs(row.codAmount)}</td>
                    <td className="max-w-[12rem] truncate py-1.5 pr-2 text-gray-700">{row.context ?? '-'}</td>
                    <td className="py-1.5">
                      {row.errors.length === 0 ? (
                        <span className="text-green-700">✓ Valid</span>
                      ) : (
                        <span className="text-red-700" title={row.errors.join('; ')}>
                          ✗ {row.errors[0]}
                          {row.errors.length > 1 ? ` (+${row.errors.length - 1} more)` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
