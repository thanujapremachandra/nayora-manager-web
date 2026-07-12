import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { listSessions, listSessionOrderCounts } from '@/lib/db/sessions'
import { listOrdersByStatus } from '@/lib/db/orders'
import { getSettings } from '@/lib/db/settings'
import { OrdersManager } from '@/components/orders/orders-manager'
import type { Order } from '@/lib/supabase/types'

export const metadata: Metadata = { title: 'Orders' }

interface Props {
  searchParams: Promise<{ status?: string }>
}

function isOrderStatus(value: string | undefined): value is Order['status'] {
  return value === 'frozen' || value === 'issue'
}

export default async function OrdersPage({ searchParams }: Props) {
  const { status } = await searchParams
  const supabase = await createClient()

  try {
    const [sessions, counts, settings] = await Promise.all([
      listSessions(supabase),
      listSessionOrderCounts(supabase),
      getSettings(supabase),
    ])

    const initialStatusFilter = isOrderStatus(status) ? status : null
    const initialFilteredOrders = initialStatusFilter ? await listOrdersByStatus(supabase, initialStatusFilter) : []

    return (
      <OrdersManager
        initialSessions={sessions}
        initialCounts={counts}
        settings={settings}
        initialStatusFilter={initialStatusFilter}
        initialFilteredOrders={initialFilteredOrders}
      />
    )
  } catch (err) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-red-700">
          Could not load orders: {err instanceof Error ? err.message : 'Unknown error'}.
        </p>
      </div>
    )
  }
}
