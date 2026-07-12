import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { listOrdersBySession, getOrdersByIds } from '@/lib/db/orders'
import { getSession } from '@/lib/db/sessions'
import { getSettings } from '@/lib/db/settings'
import { isExportable } from '@/lib/export-helpers'
import { SummaryView } from '@/components/print/summary-view'

export const metadata: Metadata = { title: 'Print order summary' }

interface Props {
  searchParams: Promise<{ session?: string; orders?: string }>
}

export default async function PrintSummaryPage({ searchParams }: Props) {
  const { session: sessionId, orders: orderIds } = await searchParams
  const supabase = await createClient()

  try {
    const [settings, session] = await Promise.all([
      getSettings(supabase),
      sessionId ? getSession(supabase, sessionId) : Promise.resolve(null),
    ])

    const allOrders = orderIds
      ? await getOrdersByIds(supabase, orderIds.split(','))
      : sessionId
        ? await listOrdersBySession(supabase, sessionId)
        : []

    const printable = allOrders.filter(isExportable)

    if (printable.length === 0) {
      return (
        <div className="p-8 text-center text-sm text-gray-500">
          No printable orders found (frozen, cancelled, returned, and issue orders are skipped).
        </div>
      )
    }

    return <SummaryView sessionName={session?.name ?? 'Selected orders'} orders={printable} settings={settings} />
  } catch (err) {
    return (
      <div className="p-8 text-center text-sm text-red-700">
        Could not load order summary: {err instanceof Error ? err.message : 'Unknown error'}.
      </div>
    )
  }
}
