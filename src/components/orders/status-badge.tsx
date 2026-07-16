import { STATUS_LABELS } from '@/lib/order-helpers'
import type { Order } from '@/lib/supabase/types'

// Reference-style status pill: tinted background, hairline border, leading
// dot. All colors ride the theme variables, so they adapt to dark mode.
const STYLES: Record<Order['status'], { pill: string; dot: string }> = {
  pending: { pill: 'border-blue-700/25 bg-blue-100 text-blue-700', dot: 'bg-blue-700' },
  frozen: { pill: 'border-cyan-700/25 bg-cyan-100 text-cyan-700', dot: 'bg-cyan-600' },
  issue: { pill: 'border-red-700/25 bg-red-100 text-red-700', dot: 'bg-red-600' },
  sent: { pill: 'border-green-700/25 bg-green-100 text-green-700', dot: 'bg-green-600' },
  returned: { pill: 'border-orange-700/25 bg-orange-100 text-orange-700', dot: 'bg-orange-700' },
  cancelled: { pill: 'border-gray-400/30 bg-gray-200 text-gray-600', dot: 'bg-gray-400' },
}

export function StatusBadge({ status }: { status: Order['status'] }) {
  const s = STYLES[status]
  return (
    <span className={`status-pill ${s.pill}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {STATUS_LABELS[status]}
    </span>
  )
}
