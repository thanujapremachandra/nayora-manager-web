import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/db/settings'
import { listProducts } from '@/lib/db/products'
import { listDismissedAlertKeys } from '@/lib/db/dismissed-alerts'
import { getVariantSalesTotals } from '@/lib/db/analytics'
import { StockManager } from '@/components/stock/stock-manager'

export const metadata: Metadata = { title: 'Stock' }

interface Props {
  searchParams: Promise<{ status?: string }>
}

export default async function StockPage({ searchParams }: Props) {
  const { status } = await searchParams
  const supabase = await createClient()

  try {
    const [settings, products, dismissedAlertKeys, sales] = await Promise.all([
      getSettings(supabase),
      listProducts(supabase),
      listDismissedAlertKeys(supabase),
      getVariantSalesTotals(supabase),
    ])

    return (
      <StockManager
        initialProducts={products}
        initialDismissedAlertKeys={Array.from(dismissedAlertKeys)}
        settings={settings}
        initialStatusFilter={status}
        variantSales={sales}
      />
    )
  } catch (err) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-red-700">
          Could not load stock data: {err instanceof Error ? err.message : 'Unknown error'}.
        </p>
      </div>
    )
  }
}
