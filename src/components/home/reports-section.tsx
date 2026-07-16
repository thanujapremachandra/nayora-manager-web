'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getRevenueOverTime,
  getProfitBreakdown,
  getTopProductsReport,
  getOrderStatsReport,
  type DateRange,
  type RevenuePoint,
  type ProfitBreakdown,
  type SalesSummary,
  type OrderStatsReport,
} from '@/lib/db/analytics'
import { DateRangePicker } from './date-range-picker'
import { SimpleBarChart } from './simple-bar-chart'
import { formatRs } from '@/lib/stock-helpers'
import { STATUS_LABELS } from '@/lib/order-helpers'
import { buildProfitWorkbook } from '@/lib/export-reports'
import { downloadWorkbook } from '@/lib/export-excel'
import type { Settings } from '@/lib/supabase/types'

type ReportType = 'revenue' | 'profit' | 'top' | 'stats'

const REPORT_TABS: { id: ReportType; label: string }[] = [
  { id: 'revenue', label: 'Revenue over time' },
  { id: 'profit', label: 'Profit & cost' },
  { id: 'top', label: 'Top products' },
  { id: 'stats', label: 'Order stats' },
]

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function defaultRange(): DateRange {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 29)
  return { from: toIsoDate(from), to: toIsoDate(to) }
}

interface Props {
  settings: Settings
}

export function ReportsSection({ settings }: Props) {
  const [reportType, setReportType] = useState<ReportType>('revenue')
  const [range, setRange] = useState<DateRange>(defaultRange)
  const [revenueData, setRevenueData] = useState<RevenuePoint[] | null>(null)
  const [profitData, setProfitData] = useState<ProfitBreakdown | null>(null)
  const [topData, setTopData] = useState<SalesSummary | null>(null)
  const [statsData, setStatsData] = useState<OrderStatsReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const supabase = createClient()
        if (reportType === 'revenue') {
          const data = await getRevenueOverTime(supabase, settings, range)
          if (!cancelled) setRevenueData(data)
        } else if (reportType === 'profit') {
          const data = await getProfitBreakdown(supabase, range)
          if (!cancelled) setProfitData(data)
        } else if (reportType === 'top') {
          const data = await getTopProductsReport(supabase, range)
          if (!cancelled) setTopData(data)
        } else {
          const data = await getOrderStatsReport(supabase, settings, range)
          if (!cancelled) setStatsData(data)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load report')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [reportType, range, settings])

  function handlePrint() {
    const params = new URLSearchParams({ type: reportType, from: range.from, to: range.to })
    window.open(`/print/report?${params.toString()}`, '_blank')
  }

  async function handleExportProfit() {
    if (!profitData) return
    setExporting(true)
    try {
      const buffer = await buildProfitWorkbook(profitData, range)
      downloadWorkbook(buffer, `profit-by-product_${range.from}_${range.to}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="card mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Reports</h3>
        <DateRangePicker range={range} onChange={setRange} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="seg">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportType(tab.id)}
              className={`seg-item ${reportType === tab.id ? 'seg-item-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {reportType === 'profit' && (
            <button
              type="button"
              onClick={handleExportProfit}
              disabled={exporting || !profitData}
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              {exporting ? 'Exporting…' : 'Export to Excel'}
            </button>
          )}
          <button type="button" onClick={handlePrint} className="btn-secondary px-3 py-1.5 text-xs">
            Print / PDF
          </button>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : reportType === 'revenue' && revenueData ? (
          <RevenueReport data={revenueData} />
        ) : reportType === 'profit' && profitData ? (
          <ProfitReport data={profitData} />
        ) : reportType === 'top' && topData ? (
          <TopProductsReport data={topData} />
        ) : reportType === 'stats' && statsData ? (
          <OrderStatsReportView data={statsData} />
        ) : null}
      </div>
    </div>
  )
}

export function RevenueReport({ data }: { data: RevenuePoint[] }) {
  const total = data.reduce((sum, p) => sum + p.revenue, 0)
  const orders = data.reduce((sum, p) => sum + p.orderCount, 0)
  return (
    <div>
      <div className="mb-3 flex gap-6 text-sm">
        <div>
          <p className="text-xs text-gray-500">Total revenue</p>
          <p className="font-semibold text-gray-900">{formatRs(total)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Orders sent</p>
          <p className="font-semibold text-gray-900">{orders}</p>
        </div>
      </div>
      <SimpleBarChart
        points={data.map((p) => ({ label: p.date.slice(5), value: p.revenue, tooltip: `${p.date}: ${formatRs(p.revenue)}` }))}
        emptyMessage="No sent orders in this range."
      />
    </div>
  )
}

export function ProfitReport({ data }: { data: ProfitBreakdown }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-6 text-sm">
        <div>
          <p className="text-xs text-gray-500">Revenue</p>
          <p className="font-semibold text-gray-900">{formatRs(data.totalRevenue)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Cost</p>
          <p className="font-semibold text-gray-900">{formatRs(data.totalCost)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Profit</p>
          <p className={`font-semibold ${data.totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {formatRs(data.totalProfit)}
          </p>
        </div>
      </div>
      {data.byProduct.length === 0 ? (
        <p className="text-sm text-gray-500">No sent orders in this range.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="py-1.5 font-medium">Product</th>
              <th className="py-1.5 text-right font-medium">Qty</th>
              <th className="py-1.5 text-right font-medium">Revenue</th>
              <th className="py-1.5 text-right font-medium">Cost</th>
              <th className="py-1.5 text-right font-medium">Profit</th>
              <th className="py-1.5 text-right font-medium">Margin</th>
            </tr>
          </thead>
          <tbody>
            {data.byProduct.map((row) => (
              <tr key={row.productName} className="border-b border-gray-100">
                <td className="truncate py-1.5 text-gray-700">{row.productName}</td>
                <td className="py-1.5 text-right text-gray-700">{row.qty}</td>
                <td className="py-1.5 text-right text-gray-700">{formatRs(row.revenue)}</td>
                <td className="py-1.5 text-right text-gray-700">{formatRs(row.cost)}</td>
                <td className={`py-1.5 text-right font-medium ${row.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatRs(row.profit)}
                </td>
                <td className="py-1.5 text-right text-gray-500">
                  {row.marginPct === null ? '-' : `${row.marginPct.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function TopProductsReport({ data }: { data: SalesSummary }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <h4 className="mb-1.5 text-xs font-semibold text-gray-500">By quantity</h4>
        {data.topByQty.length === 0 ? (
          <p className="text-sm text-gray-500">No sent orders in this range.</p>
        ) : (
          <ul className="space-y-1">
            {data.topByQty.map((item) => (
              <li key={item.variantId} className="flex items-center justify-between text-sm">
                <span className="truncate text-gray-700">{item.label}</span>
                <span className="font-medium text-gray-900">{item.qty}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4 className="mb-1.5 text-xs font-semibold text-gray-500">By revenue</h4>
        {data.topByRevenue.length === 0 ? (
          <p className="text-sm text-gray-500">No sent orders in this range.</p>
        ) : (
          <ul className="space-y-1">
            {data.topByRevenue.map((item) => (
              <li key={item.variantId} className="flex items-center justify-between text-sm">
                <span className="truncate text-gray-700">{item.label}</span>
                <span className="font-medium text-gray-900">{formatRs(item.revenue)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function OrderStatsReportView({ data }: { data: OrderStatsReport }) {
  const statusPoints = Object.entries(data.byStatus).map(([status, count]) => ({
    label: STATUS_LABELS[status as keyof typeof STATUS_LABELS],
    value: count,
  }))

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-6 text-sm">
        <div>
          <p className="text-xs text-gray-500">Total orders</p>
          <p className="font-semibold text-gray-900">{data.totalOrders}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Avg. order value (sent)</p>
          <p className="font-semibold text-gray-900">{formatRs(data.avgOrderValue)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Exchanges</p>
          <p className="font-semibold text-gray-900">{data.exchangeCount}</p>
        </div>
      </div>
      <SimpleBarChart points={statusPoints} emptyMessage="No orders in this range." />
    </div>
  )
}
