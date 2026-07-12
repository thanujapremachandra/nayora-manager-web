'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSettings } from '@/lib/db/settings'
import {
  getRevenueOverTime,
  getProfitBreakdown,
  getTopProductsReport,
  getOrderStatsReport,
  type DateRange,
} from '@/lib/db/analytics'
import { RevenueReport, ProfitReport, TopProductsReport, OrderStatsReportView } from '@/components/home/reports-section'
import { PrintStyles } from '@/components/print/print-styles'

const REPORT_LABELS: Record<string, string> = {
  revenue: 'Revenue over time',
  profit: 'Profit & cost breakdown',
  top: 'Top products',
  stats: 'Order stats',
}

export default function PrintReportPage() {
  return (
    <Suspense>
      <PrintReportContent />
    </Suspense>
  )
}

function PrintReportContent() {
  const params = useSearchParams()
  const type = params.get('type') ?? 'revenue'
  const range: DateRange = { from: params.get('from') ?? '', to: params.get('to') ?? '' }

  const [content, setContent] = useState<React.ReactNode>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const supabase = createClient()
        const settings = await getSettings(supabase)

        if (type === 'revenue') {
          const data = await getRevenueOverTime(supabase, settings, range)
          if (!cancelled) setContent(<RevenueReport data={data} />)
        } else if (type === 'profit') {
          const data = await getProfitBreakdown(supabase, range)
          if (!cancelled) setContent(<ProfitReport data={data} />)
        } else if (type === 'top') {
          const data = await getTopProductsReport(supabase, range)
          if (!cancelled) setContent(<TopProductsReport data={data} />)
        } else {
          const data = await getOrderStatsReport(supabase, settings, range)
          if (!cancelled) setContent(<OrderStatsReportView data={data} />)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load report')
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- range is derived fresh from params each render; including it as an object would re-trigger every render.
  }, [type, range.from, range.to])

  return (
    <div className="p-6 print:p-0">
      <PrintStyles />

      <div className="no-print mb-4 flex items-center justify-between border-b border-gray-200 pb-4">
        <p className="text-sm font-semibold text-gray-900">{REPORT_LABELS[type] ?? type}</p>
        <button onClick={() => window.print()} className="btn-primary">
          Print / Save as PDF
        </button>
      </div>

      <h1 className="text-[14pt] font-bold">{REPORT_LABELS[type] ?? type}</h1>
      <p className="text-[10pt] text-gray-500">
        {range.from} to {range.to}
      </p>

      <div className="mt-4 text-[10pt]">
        {error ? <p className="text-red-700">{error}</p> : content ?? <p className="text-gray-500">Loading…</p>}
      </div>
    </div>
  )
}
