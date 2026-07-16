import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/db/settings'
import { getSessionTrend, getSalesSummary, getStockHealth, getAttentionCounts } from '@/lib/db/analytics'
import { KpiCard } from '@/components/home/kpi-card'
import { TopItemsCard } from '@/components/home/top-items-card'
import { StockHealthCard } from '@/components/home/stock-health-card'
import { AttentionCard } from '@/components/home/attention-card'
import { ReportsSection } from '@/components/home/reports-section'
import { formatRs } from '@/lib/stock-helpers'

export const metadata: Metadata = { title: 'Home' }

export default async function HomePage() {
  const supabase = await createClient()

  try {
    const settings = await getSettings(supabase)
    const [trend, sales, stockHealth, attention] = await Promise.all([
      getSessionTrend(supabase, settings),
      getSalesSummary(supabase),
      getStockHealth(supabase, settings),
      getAttentionCounts(supabase),
    ])

    const sentTotal = trend.reduce((sum, p) => sum + p.sentCount, 0)
    const codTotal = trend.reduce((sum, p) => sum + p.codTotal, 0)

    return (
      <div className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Last {trend.length} sessions · last 90 days of sales.</p>
          </div>
          <Link href="/import" className="btn-secondary">
            Import Data
          </Link>
        </div>

        {/* KPI row */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Orders sent (recent sessions)" value={sentTotal.toString()} />
          <KpiCard label="COD revenue (recent sessions)" value={formatRs(codTotal)} />
          <KpiCard
            label="Profit (last 90 days)"
            value={formatRs(sales.totalProfit)}
            tone={sales.totalProfit >= 0 ? 'success' : 'danger'}
          />
          <KpiCard
            label="Stock value at cost"
            value={formatRs(stockHealth.stockValueAtCost)}
            hint={`${stockHealth.lowStockCount + stockHealth.outOfStockCount + stockHealth.backorderedCount} item(s) need restocking`}
          />
        </div>

        {/* Reports (in the old trend-chart slot — the trend widget is gone) */}
        <ReportsSection settings={settings} />

        {/* Items + health */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TopItemsCard title="Top items by quantity" items={sales.topByQty} metric="qty" />
          <TopItemsCard title="Top items by revenue" items={sales.topByRevenue} metric="revenue" />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StockHealthCard health={stockHealth} />
          <AttentionCard attention={attention} />
        </div>
      </div>
    )
  } catch (err) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-red-700">
          Could not load the dashboard: {err instanceof Error ? err.message : 'Unknown error'}.
        </p>
      </div>
    )
  }
}
