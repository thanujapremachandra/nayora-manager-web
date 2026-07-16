import type { TypedClient } from '@/lib/supabase/client'
import type { Order, OrderFinancials, OrderItemSale, Settings } from '@/lib/supabase/types'
import { listProducts } from '@/lib/db/products'
import { variantStatus, effectiveThreshold, effectivePrice, effectiveCost } from '@/lib/stock-helpers'

const RECENT_SESSIONS = 14
const SALES_WINDOW_DAYS = 90

// ISO date strings (yyyy-mm-dd) — `to` is treated as inclusive of the whole
// day by callers appending a day's worth of slack when querying.
export interface DateRange {
  from: string
  to: string
}

function rangeBounds(range: DateRange): { gte: string; lt: string } {
  const toExclusive = new Date(range.to)
  toExclusive.setDate(toExclusive.getDate() + 1)
  return { gte: new Date(range.from).toISOString(), lt: toExclusive.toISOString() }
}

// Mirrors pricing.ts's computeCollectableAmount, but against the flat
// order_financials view row instead of a full Order + items[] — kept in
// sync manually since the two data shapes can't share one function.
function financialsCollectable(row: OrderFinancials, settings: Pick<Settings, 'default_courier_charge'>): number {
  if (row.cod_amount_override !== null) return row.cod_amount_override
  if (row.is_exchange || row.payment_type === 'bank') return 0
  const total = row.items_total - (row.order_discount ?? 0)
  const courierCharge = row.courier_charge_override ?? settings.default_courier_charge
  return total + courierCharge
}

export interface SessionTrendPoint {
  sessionId: string
  name: string
  createdAt: string
  sentCount: number
  codTotal: number
}

export async function getSessionTrend(client: TypedClient, settings: Settings): Promise<SessionTrendPoint[]> {
  // `id` is a deterministic tiebreaker — without it, two sessions sharing
  // the same created_at (easy to hit with rapid test data) can come back in
  // a different relative order between two executions of this exact query,
  // since Postgres doesn't guarantee stable ordering for ties. That's a
  // real source of server/client data mismatches, not just a cosmetic one.
  const { data: sessions, error: sessionsError } = await client
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(RECENT_SESSIONS)
  if (sessionsError) throw new Error(`Failed to load recent sessions: ${sessionsError.message}`)
  if (sessions.length === 0) return []

  const { data, error } = await client
    .from('order_financials')
    .select('*')
    .in(
      'session_id',
      sessions.map((s) => s.id)
    )
    .eq('status', 'sent')
  if (error) throw new Error(`Failed to load session trend: ${error.message}`)

  const bySession = new Map<string, { sentCount: number; codTotal: number }>()
  for (const row of data) {
    const entry = bySession.get(row.session_id) ?? { sentCount: 0, codTotal: 0 }
    entry.sentCount += 1
    entry.codTotal += financialsCollectable(row, settings)
    bySession.set(row.session_id, entry)
  }

  return sessions
    .map((s) => ({
      sessionId: s.id,
      name: s.name,
      createdAt: s.created_at,
      sentCount: bySession.get(s.id)?.sentCount ?? 0,
      codTotal: bySession.get(s.id)?.codTotal ?? 0,
    }))
    .reverse() // oldest → newest, left to right
}

export interface TopItem {
  variantId: string
  label: string
  qty: number
  revenue: number
}

export interface SalesSummary {
  topByQty: TopItem[]
  topByRevenue: TopItem[]
  totalRevenue: number
  totalCost: number
  totalProfit: number
}

// All-time per-variant sales for the Stock table. Only 'sent' orders count
// (returned/cancelled never made it or came back); exchange replacements
// consume stock, so their qty counts, but no money is collected, so their
// revenue doesn't. Keyed by variant id — the caller rolls up to products.
export interface VariantSalesTotal {
  qty: number
  revenue: number
}

export async function getVariantSalesTotals(client: TypedClient): Promise<Record<string, VariantSalesTotal>> {
  const { data, error } = await client
    .from('order_item_sales')
    .select('variant_id, qty, line_revenue, is_exchange')
    .eq('order_status', 'sent')
  if (error) throw new Error(`Failed to load sales totals: ${error.message}`)

  const totals: Record<string, VariantSalesTotal> = {}
  for (const row of (data ?? []) as Pick<OrderItemSale, 'variant_id' | 'qty' | 'line_revenue' | 'is_exchange'>[]) {
    const entry = (totals[row.variant_id] ??= { qty: 0, revenue: 0 })
    entry.qty += row.qty
    if (!row.is_exchange) entry.revenue += row.line_revenue
  }
  return totals
}

export async function getSalesSummary(client: TypedClient, topN = 8): Promise<SalesSummary> {
  const since = new Date(Date.now() - SALES_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await client
    .from('order_item_sales')
    .select('*')
    .eq('order_status', 'sent')
    .gte('order_created_at', since)
  if (error) throw new Error(`Failed to load sales summary: ${error.message}`)

  const byVariant = new Map<string, { label: string; qty: number; revenue: number; cost: number }>()
  let totalRevenue = 0
  let totalCost = 0

  for (const row of data as OrderItemSale[]) {
    const cost = row.price_mode === 'global' ? row.global_cost ?? 0 : row.variant_cost ?? row.global_cost ?? 0
    const lineCost = cost * row.qty
    totalRevenue += row.line_revenue
    totalCost += lineCost

    const label = row.variant_name ? `${row.product_name} — ${row.variant_name}` : row.product_name
    const entry = byVariant.get(row.variant_id) ?? { label, qty: 0, revenue: 0, cost: 0 }
    entry.qty += row.qty
    entry.revenue += row.line_revenue
    entry.cost += lineCost
    byVariant.set(row.variant_id, entry)
  }

  const items: TopItem[] = Array.from(byVariant.entries()).map(([variantId, v]) => ({
    variantId,
    label: v.label,
    qty: v.qty,
    revenue: v.revenue,
  }))

  return {
    topByQty: [...items].sort((a, b) => b.qty - a.qty).slice(0, topN),
    topByRevenue: [...items].sort((a, b) => b.revenue - a.revenue).slice(0, topN),
    totalRevenue,
    totalCost,
    totalProfit: totalRevenue - totalCost,
  }
}

export interface StockHealth {
  stockValueAtCost: number
  stockValueAtPrice: number
  inStockCount: number
  lowStockCount: number
  outOfStockCount: number
  backorderedCount: number
}

export async function getStockHealth(client: TypedClient, settings: Settings): Promise<StockHealth> {
  const products = await listProducts(client)

  const health: StockHealth = {
    stockValueAtCost: 0,
    stockValueAtPrice: 0,
    inStockCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    backorderedCount: 0,
  }

  for (const product of products) {
    const threshold = effectiveThreshold(product, settings.default_low_stock_threshold)
    for (const variant of product.variants) {
      const cost = effectiveCost(product, variant) ?? 0
      const price = effectivePrice(product, variant) ?? 0
      health.stockValueAtCost += variant.on_hand * cost
      health.stockValueAtPrice += variant.on_hand * price

      const status = variantStatus(variant, threshold)
      if (status === 'in_stock') health.inStockCount += 1
      else if (status === 'low_stock') health.lowStockCount += 1
      else if (status === 'out_of_stock') health.outOfStockCount += 1
      else if (status === 'backordered') health.backorderedCount += 1
    }
  }

  return health
}

// ─── Reports (Home) — all parameterized by an arbitrary date range,
// unlike the fixed-window dashboard widgets above. ─────────────────

export interface RevenuePoint {
  date: string // yyyy-mm-dd
  revenue: number
  orderCount: number
}

export async function getRevenueOverTime(
  client: TypedClient,
  settings: Settings,
  range: DateRange
): Promise<RevenuePoint[]> {
  const { gte, lt } = rangeBounds(range)
  const { data, error } = await client
    .from('order_financials')
    .select('*')
    .eq('status', 'sent')
    .gte('created_at', gte)
    .lt('created_at', lt)
  if (error) throw new Error(`Failed to load revenue report: ${error.message}`)

  const byDate = new Map<string, { revenue: number; orderCount: number }>()
  for (const row of data as OrderFinancials[]) {
    const date = row.created_at.slice(0, 10)
    const entry = byDate.get(date) ?? { revenue: 0, orderCount: 0 }
    entry.revenue += financialsCollectable(row, settings)
    entry.orderCount += 1
    byDate.set(date, entry)
  }

  return Array.from(byDate.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

interface VariantSalesAgg {
  variantId: string
  label: string
  productName: string
  qty: number
  revenue: number
  cost: number
}

async function aggregateItemSales(client: TypedClient, range: DateRange): Promise<VariantSalesAgg[]> {
  const { gte, lt } = rangeBounds(range)
  const { data, error } = await client
    .from('order_item_sales')
    .select('*')
    .eq('order_status', 'sent')
    .gte('order_created_at', gte)
    .lt('order_created_at', lt)
  if (error) throw new Error(`Failed to load sales data: ${error.message}`)

  const byVariant = new Map<string, VariantSalesAgg>()
  for (const row of data as OrderItemSale[]) {
    const cost = row.price_mode === 'global' ? row.global_cost ?? 0 : row.variant_cost ?? row.global_cost ?? 0
    const label = row.variant_name ? `${row.product_name} — ${row.variant_name}` : row.product_name
    const entry =
      byVariant.get(row.variant_id) ??
      { variantId: row.variant_id, label, productName: row.product_name, qty: 0, revenue: 0, cost: 0 }
    entry.qty += row.qty
    entry.revenue += row.line_revenue
    entry.cost += cost * row.qty
    byVariant.set(row.variant_id, entry)
  }
  return Array.from(byVariant.values())
}

export async function getTopProductsReport(client: TypedClient, range: DateRange, topN = 10): Promise<SalesSummary> {
  const agg = await aggregateItemSales(client, range)
  const items: TopItem[] = agg.map((v) => ({ variantId: v.variantId, label: v.label, qty: v.qty, revenue: v.revenue }))
  const totalRevenue = agg.reduce((sum, v) => sum + v.revenue, 0)
  const totalCost = agg.reduce((sum, v) => sum + v.cost, 0)
  return {
    topByQty: [...items].sort((a, b) => b.qty - a.qty).slice(0, topN),
    topByRevenue: [...items].sort((a, b) => b.revenue - a.revenue).slice(0, topN),
    totalRevenue,
    totalCost,
    totalProfit: totalRevenue - totalCost,
  }
}

export interface ProductProfitRow {
  productName: string
  qty: number
  revenue: number
  cost: number
  profit: number
  marginPct: number | null // null when revenue is 0 (nothing sold)
}

export interface ProfitBreakdown {
  totalRevenue: number
  totalCost: number
  totalProfit: number
  byProduct: ProductProfitRow[]
}

export async function getProfitBreakdown(client: TypedClient, range: DateRange): Promise<ProfitBreakdown> {
  const agg = await aggregateItemSales(client, range)

  const byProduct = new Map<string, { productName: string; qty: number; revenue: number; cost: number }>()
  for (const v of agg) {
    const entry = byProduct.get(v.productName) ?? { productName: v.productName, qty: 0, revenue: 0, cost: 0 }
    entry.qty += v.qty
    entry.revenue += v.revenue
    entry.cost += v.cost
    byProduct.set(v.productName, entry)
  }

  const rows: ProductProfitRow[] = Array.from(byProduct.values())
    .map((r) => {
      const profit = r.revenue - r.cost
      return { ...r, profit, marginPct: r.revenue > 0 ? (profit / r.revenue) * 100 : null }
    })
    .sort((a, b) => b.profit - a.profit)

  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0)
  const totalCost = rows.reduce((sum, r) => sum + r.cost, 0)

  return { totalRevenue, totalCost, totalProfit: totalRevenue - totalCost, byProduct: rows }
}

export interface OrderStatsReport {
  totalOrders: number
  byStatus: Record<Order['status'], number>
  exchangeCount: number
  avgOrderValue: number
}

export async function getOrderStatsReport(
  client: TypedClient,
  settings: Settings,
  range: DateRange
): Promise<OrderStatsReport> {
  const { gte, lt } = rangeBounds(range)
  const { data, error } = await client
    .from('order_financials')
    .select('*')
    .gte('created_at', gte)
    .lt('created_at', lt)
  if (error) throw new Error(`Failed to load order stats: ${error.message}`)

  const rows = data as OrderFinancials[]
  const byStatus: Record<Order['status'], number> = {
    pending: 0,
    frozen: 0,
    issue: 0,
    sent: 0,
    returned: 0,
    cancelled: 0,
  }
  let exchangeCount = 0
  let sentValueTotal = 0
  let sentCount = 0

  for (const row of rows) {
    byStatus[row.status] += 1
    if (row.is_exchange) exchangeCount += 1
    if (row.status === 'sent') {
      sentValueTotal += financialsCollectable(row, settings)
      sentCount += 1
    }
  }

  return {
    totalOrders: rows.length,
    byStatus,
    exchangeCount,
    avgOrderValue: sentCount > 0 ? sentValueTotal / sentCount : 0,
  }
}

export interface AttentionCounts {
  frozenCount: number
  issueCount: number
}

export async function getAttentionCounts(client: TypedClient): Promise<AttentionCounts> {
  const [frozen, issue] = await Promise.all([
    client.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'frozen'),
    client.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'issue'),
  ])
  if (frozen.error) throw new Error(`Failed to count frozen orders: ${frozen.error.message}`)
  if (issue.error) throw new Error(`Failed to count issue orders: ${issue.error.message}`)
  return { frozenCount: frozen.count ?? 0, issueCount: issue.count ?? 0 }
}
