import Link from 'next/link'
import type { StockHealth } from '@/lib/db/analytics'
import { formatRs } from '@/lib/stock-helpers'

interface Props {
  health: StockHealth
}

// Reference-style "row chips": each line is its own raised rounded row with
// the label left and a bold figure right; status rows get a colored dot.
function Row({
  href,
  label,
  value,
  dot,
}: {
  href: string
  label: string
  value: number
  dot?: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl bg-gray-100 px-3.5 py-2.5 text-sm transition-colors hover:bg-gray-200"
    >
      <span className="flex items-center gap-2 text-gray-700">
        {dot && <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />}
        {label}
      </span>
      <span className="font-display font-semibold text-gray-900">{value}</span>
    </Link>
  )
}

export function StockHealthCard({ health }: Props) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-900">Stock health</h3>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500">Value at cost</p>
          <p className="font-display font-semibold text-gray-900">{formatRs(health.stockValueAtCost)}</p>
        </div>
        <div>
          <p className="text-gray-500">Value at price</p>
          <p className="font-display font-semibold text-gray-900">{formatRs(health.stockValueAtPrice)}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <Row href="/stock" label="In stock" value={health.inStockCount} dot="bg-green-600" />
        <Row href="/stock?status=low_stock" label="Low stock" value={health.lowStockCount} dot="bg-amber-600" />
        <Row href="/stock?status=out_of_stock" label="Out of stock" value={health.outOfStockCount} dot="bg-gray-400" />
        <Row href="/stock?status=backordered" label="Backordered" value={health.backorderedCount} dot="bg-red-600" />
      </div>
    </div>
  )
}
