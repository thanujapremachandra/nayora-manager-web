'use client'

import { useEffect, useState } from 'react'
import { computeAvailable } from '@/lib/supabase/types'
import type { Settings } from '@/lib/supabase/types'
import type { ProductWithDetails } from '@/lib/stock-helpers'
import { variantStatus, effectiveThreshold, effectivePrice, variantLabel, formatRs } from '@/lib/stock-helpers'
import { lowStockAlertKey } from '@/lib/db/dismissed-alerts'

const STATUS_STYLES: Record<string, string> = {
  in_stock: 'bg-green-100 text-green-700',
  low_stock: 'bg-amber-100 text-amber-700',
  out_of_stock: 'bg-gray-200 text-gray-600',
  backordered: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
  backordered: 'Backordered',
}

interface Props {
  product: ProductWithDetails
  settings: Settings
  dismissedAlertKeys: Set<string>
  selected: boolean
  onToggleSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onDismissAlert: (key: string) => void
}

export function ProductCard({
  product,
  settings,
  dismissedAlertKeys,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  onDismissAlert,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const threshold = effectiveThreshold(product, settings.default_low_stock_threshold)
  const totalOnHand = product.variants.reduce((sum, v) => sum + v.on_hand, 0)
  const prices = product.variants
    .map((v) => effectivePrice(product, v))
    .filter((p): p is number => p !== null)
  const priceRange =
    prices.length === 0
      ? '-'
      : Math.min(...prices) === Math.max(...prices)
        ? formatRs(Math.min(...prices))
        : `${formatRs(Math.min(...prices))} - ${formatRs(Math.max(...prices))}`

  const variantImages = product.variants.map((v) => v.image_url).filter((url): url is string => !!url)
  const flaggedCount = product.variants.filter((v) => {
    const status = variantStatus(v, threshold)
    return (status === 'low_stock' || status === 'backordered') && !dismissedAlertKeys.has(lowStockAlertKey(v.id))
  }).length

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-start gap-2 p-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${product.name}`}
          className="mt-1.5 h-4 w-4 shrink-0"
        />

        <button onClick={onEdit} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <ProductThumbnail images={variantImages} name={product.name} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-gray-900">{product.name}</h3>
            <p className="text-xs text-gray-500">
              {product.variants.length} variant{product.variants.length === 1 ? '' : 's'} · {totalOnHand} units ·{' '}
              {priceRange}
            </p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {flaggedCount > 0 && !expanded && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
              {flaggedCount}
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? 'Hide variants' : 'Show variants'}
            aria-expanded={expanded}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${product.name}`}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-1.5 border-t border-gray-100 px-4 py-3">
          {product.variants.map((variant) => {
            const status = variantStatus(variant, threshold)
            const alertKey = lowStockAlertKey(variant.id)
            const showWarning =
              (status === 'low_stock' || status === 'backordered') && !dismissedAlertKeys.has(alertKey)

            return (
              <div key={variant.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-gray-600">{variantLabel(variant, product.product_attributes)}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[status]}`}>
                    {status === 'in_stock' ? `${STATUS_LABELS[status]} (${computeAvailable(variant)})` : STATUS_LABELS[status]}
                  </span>
                  {showWarning && (
                    <button
                      onClick={() => onDismissAlert(alertKey)}
                      title="Dismiss this warning"
                      aria-label="Dismiss low-stock warning"
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Auto-cycles through every variant image when a product has more than one
// (timer-based, not hover, so it also works on touch devices) — otherwise
// just shows the single image/placeholder.
function ProductThumbnail({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (images.length <= 1) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % images.length), 2000)
    return () => clearInterval(timer)
  }, [images.length])

  if (images.length === 0) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[index]} alt={name} className="h-full w-full object-cover" />
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-0.5 flex justify-center gap-0.5">
          {images.map((_, i) => (
            <span
              key={i}
              className={`h-1 w-1 rounded-full ${i === index ? 'bg-white' : 'bg-white/50'}`}
              aria-hidden
            />
          ))}
        </div>
      )}
    </div>
  )
}
