import type { TopItem } from '@/lib/db/analytics'
import { formatRs } from '@/lib/stock-helpers'

interface Props {
  title: string
  items: TopItem[]
  metric: 'qty' | 'revenue'
}

export function TopItemsCard({ title, items, metric }: Props) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No sales in the last 90 days.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.map((item, i) => (
            <li
              key={item.variantId}
              className="flex items-center justify-between gap-3 rounded-xl bg-gray-100 px-3.5 py-2.5 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2.5 text-gray-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-xs font-bold text-brand-700">
                  {i + 1}
                </span>
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 font-display font-semibold text-gray-900">
                {metric === 'qty' ? `${item.qty} sold` : formatRs(item.revenue)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
