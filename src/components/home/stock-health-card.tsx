import Link from 'next/link'
import type { StockHealth } from '@/lib/db/analytics'
import { formatRs } from '@/lib/stock-helpers'

interface Props {
  health: StockHealth
}

export function StockHealthCard({ health }: Props) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-900">Stock health</h3>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500">Value at cost</p>
          <p className="font-semibold text-gray-900">{formatRs(health.stockValueAtCost)}</p>
        </div>
        <div>
          <p className="text-gray-500">Value at price</p>
          <p className="font-semibold text-gray-900">{formatRs(health.stockValueAtPrice)}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 text-sm">
        <Link href="/stock" className="flex justify-between text-gray-600 hover:text-brand-600">
          <span>In stock</span>
          <span className="font-medium">{health.inStockCount}</span>
        </Link>
        <Link href="/stock?status=low_stock" className="flex justify-between text-amber-700 hover:underline">
          <span>Low stock</span>
          <span className="font-medium">{health.lowStockCount}</span>
        </Link>
        <Link href="/stock?status=out_of_stock" className="flex justify-between text-gray-600 hover:text-brand-600">
          <span>Out of stock</span>
          <span className="font-medium">{health.outOfStockCount}</span>
        </Link>
        <Link href="/stock?status=backordered" className="flex justify-between text-red-700 hover:underline">
          <span>Backordered</span>
          <span className="font-medium">{health.backorderedCount}</span>
        </Link>
      </div>
    </div>
  )
}
