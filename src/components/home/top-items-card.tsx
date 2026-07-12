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
        <ul className="mt-2 space-y-1.5">
          {items.map((item, i) => (
            <li key={item.variantId} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-gray-700">
                <span className="mr-1.5 text-gray-400">{i + 1}.</span>
                {item.label}
              </span>
              <span className="shrink-0 font-medium text-gray-900">
                {metric === 'qty' ? `${item.qty} sold` : formatRs(item.revenue)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
