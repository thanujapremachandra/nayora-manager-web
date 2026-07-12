import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/db/settings'
import { listOrdersBySession, getOrdersByIds } from '@/lib/db/orders'
import { isExportable } from '@/lib/export-helpers'
import { DuplexSlipView } from '@/components/print/duplex-slip-view'
import { PlacementSlipView } from '@/components/print/placement-slip-view'

export const metadata: Metadata = { title: 'Print slips' }

interface Props {
  searchParams: Promise<{ session?: string; orders?: string }>
}

export default async function PrintSlipsPage({ searchParams }: Props) {
  const { session, orders: orderIds } = await searchParams
  const supabase = await createClient()

  try {
    const settings = await getSettings(supabase)
    const allOrders = orderIds
      ? await getOrdersByIds(supabase, orderIds.split(','))
      : session
        ? await listOrdersBySession(supabase, session)
        : []

    const printable = allOrders.filter(isExportable)

    if (printable.length === 0) {
      return (
        <div className="p-8 text-center text-sm text-gray-500">
          No printable orders found (frozen, cancelled, returned, and issue orders are skipped).
        </div>
      )
    }

    // A custom placement layout (Settings → Slip Placement) takes over the
    // whole page arrangement; without one, fall back to the built-in
    // single-column layout.
    if (settings.slip_placement_layout && settings.slip_placement_layout.placements.length > 0) {
      return <PlacementSlipView orders={printable} settings={settings} layout={settings.slip_placement_layout} />
    }

    return <DuplexSlipView orders={printable} settings={settings} />
  } catch (err) {
    return (
      <div className="p-8 text-center text-sm text-red-700">
        Could not load slips: {err instanceof Error ? err.message : 'Unknown error'}.
      </div>
    )
  }
}
