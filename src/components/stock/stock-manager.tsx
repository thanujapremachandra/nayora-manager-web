'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listProducts, deleteProduct } from '@/lib/db/products'
import { dismissAlert, listDismissedAlertKeys } from '@/lib/db/dismissed-alerts'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ProductCard } from './product-card'
import { ProductDialog } from './product-dialog'
import { computeAvailable } from '@/lib/supabase/types'
import { formatRs } from '@/lib/stock-helpers'
import type { Settings } from '@/lib/supabase/types'
import type { ProductWithDetails, VariantStatus } from '@/lib/stock-helpers'
import type { VariantSalesTotal } from '@/lib/db/analytics'
import { variantStatus, effectiveThreshold } from '@/lib/stock-helpers'

type StatusFilter = 'all' | VariantStatus
type SortBy = 'name' | 'quantity' | 'stock_value' | 'sold' | 'revenue'

interface Props {
  initialProducts: ProductWithDetails[]
  initialDismissedAlertKeys: string[]
  settings: Settings
  initialStatusFilter?: string
  variantSales: Record<string, VariantSalesTotal>
}

function isStatusFilter(value: string | undefined): value is StatusFilter {
  return value === 'in_stock' || value === 'low_stock' || value === 'out_of_stock' || value === 'backordered'
}

// Matches the product name, or any of its attribute names/values — so
// searching "blue" finds a product with a Blue variant even if "blue"
// isn't in the product's own name.
function matchesSearch(product: ProductWithDetails, query: string): boolean {
  const q = query.toLowerCase()
  if (product.name.toLowerCase().includes(q)) return true
  return product.product_attributes.some(
    (attr) =>
      attr.name.toLowerCase().includes(q) || attr.attribute_values.some((v) => v.value.toLowerCase().includes(q))
  )
}

// Worst variant status wins for the product-level pill.
const STATUS_PRIORITY: VariantStatus[] = ['backordered', 'out_of_stock', 'low_stock', 'in_stock']

function productStatus(product: ProductWithDetails, threshold: number): VariantStatus {
  const statuses = new Set(product.variants.map((v) => variantStatus(v, threshold)))
  return STATUS_PRIORITY.find((s) => statuses.has(s)) ?? 'in_stock'
}

const STATUS_PILLS: Record<VariantStatus, { label: string; pill: string; dot: string }> = {
  in_stock: { label: 'In stock', pill: 'border-green-700/25 bg-green-100 text-green-700', dot: 'bg-green-600' },
  low_stock: { label: 'Low stock', pill: 'border-amber-700/25 bg-amber-100 text-amber-700', dot: 'bg-amber-600' },
  out_of_stock: { label: 'Out of stock', pill: 'border-red-700/25 bg-red-100 text-red-700', dot: 'bg-red-600' },
  backordered: { label: 'Backordered', pill: 'border-red-700/25 bg-red-100 text-red-700', dot: 'bg-red-600' },
}

function productPriceLabel(p: ProductWithDetails): string {
  if (p.price_mode === 'global') return p.global_price !== null ? formatRs(p.global_price) : '-'
  const prices = p.variants.map((v) => v.price ?? p.global_price).filter((x): x is number => x !== null)
  if (prices.length === 0) return '-'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? formatRs(min) : `${formatRs(min)} – ${formatRs(max)}`
}

export function StockManager({
  initialProducts,
  initialDismissedAlertKeys,
  settings,
  initialStatusFilter,
  variantSales,
}: Props) {
  const [products, setProducts] = useState(initialProducts)
  const [dismissedAlertKeys, setDismissedAlertKeys] = useState(new Set(initialDismissedAlertKeys))
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    isStatusFilter(initialStatusFilter) ? initialStatusFilter : 'all'
  )
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Roll variant-level sales up to products once.
  const productSales = useMemo(() => {
    const map = new Map<string, VariantSalesTotal>()
    for (const p of products) {
      const total = { qty: 0, revenue: 0 }
      for (const v of p.variants) {
        const s = variantSales[v.id]
        if (s) {
          total.qty += s.qty
          total.revenue += s.revenue
        }
      }
      map.set(p.id, total)
    }
    return map
  }, [products, variantSales])

  const filtered = useMemo(() => {
    let list = products

    if (search.trim()) {
      list = list.filter((p) => matchesSearch(p, search.trim()))
    }

    if (statusFilter !== 'all') {
      list = list.filter((p) => {
        const threshold = effectiveThreshold(p, settings.default_low_stock_threshold)
        return p.variants.some((v) => variantStatus(v, threshold) === statusFilter)
      })
    }

    const sorted = [...list]
    if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === 'quantity') {
      sorted.sort(
        (a, b) =>
          b.variants.reduce((s, v) => s + v.on_hand, 0) - a.variants.reduce((s, v) => s + v.on_hand, 0)
      )
    } else if (sortBy === 'stock_value') {
      const value = (p: ProductWithDetails) =>
        p.variants.reduce((s, v) => s + v.on_hand * ((p.price_mode === 'global' ? p.global_cost : v.cost ?? p.global_cost) ?? 0), 0)
      sorted.sort((a, b) => value(b) - value(a))
    } else if (sortBy === 'sold') {
      sorted.sort((a, b) => (productSales.get(b.id)?.qty ?? 0) - (productSales.get(a.id)?.qty ?? 0))
    } else if (sortBy === 'revenue') {
      sorted.sort((a, b) => (productSales.get(b.id)?.revenue ?? 0) - (productSales.get(a.id)?.revenue ?? 0))
    }

    return sorted
  }, [products, search, statusFilter, sortBy, settings.default_low_stock_threshold, productSales])

  const stats = useMemo(() => {
    let units = 0
    let value = 0
    let needAttention = 0
    for (const p of products) {
      const threshold = effectiveThreshold(p, settings.default_low_stock_threshold)
      if (productStatus(p, threshold) !== 'in_stock') needAttention++
      for (const v of p.variants) {
        units += v.on_hand
        value += v.on_hand * ((p.price_mode === 'global' ? p.global_cost : v.cost ?? p.global_cost) ?? 0)
      }
    }
    return { units, value, needAttention }
  }, [products, settings.default_low_stock_threshold])

  async function refresh() {
    try {
      const supabase = createClient()
      const [productList, dismissed] = await Promise.all([
        listProducts(supabase),
        listDismissedAlertKeys(supabase),
      ])
      setProducts(productList)
      setDismissedAlertKeys(dismissed)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to refresh products')
    }
  }

  async function handleDismissAlert(key: string) {
    setDismissedAlertKeys((prev) => new Set(prev).add(key))
    try {
      const supabase = createClient()
      await dismissAlert(supabase, key)
    } catch {
      // Non-critical — alert will simply reappear on next refresh.
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteIds) return
    setDeleting(true)
    try {
      const supabase = createClient()
      for (const id of confirmDeleteIds) {
        await deleteProduct(supabase, id)
      }
      setSelectedIds(new Set())
      await refresh()
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to delete product(s)')
    } finally {
      setDeleting(false)
      setConfirmDeleteIds(null)
    }
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))
  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) filtered.forEach((p) => next.delete(p.id))
      else filtered.forEach((p) => next.add(p.id))
      return next
    })
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Manager</h1>
          <p className="mt-1 text-sm text-gray-500">Products, variants, and stock truth.</p>
        </div>
        <button onClick={() => setCreatingProduct(true)} className="btn-primary">
          + Add product
        </button>
      </div>

      {/* Stats */}
      {products.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Products</p>
            <p className="mt-1 font-display text-2xl font-bold text-gray-900">{products.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Units on hand</p>
            <p className="mt-1 font-display text-2xl font-bold text-gray-900">{stats.units}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Stock value (cost)</p>
            <p className="mt-1 font-display text-2xl font-bold text-gray-900">{formatRs(stats.value)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Need restocking</p>
            <p className={`mt-1 font-display text-2xl font-bold ${stats.needAttention > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {stats.needAttention}
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search by product or attribute (e.g. Blue, XL)…"
          className="input max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by stock status"
        >
          <option value="all">All stock levels</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
          <option value="backordered">Backordered</option>
        </select>
        <select
          className="input w-auto"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          aria-label="Sort by"
        >
          <option value="name">Sort: Name</option>
          <option value="quantity">Sort: Quantity</option>
          <option value="stock_value">Sort: Stock value</option>
          <option value="sold">Sort: Sold</option>
          <option value="revenue">Sort: Revenue</option>
        </select>
      </div>

      {loadError && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      )}

      <div className="mt-5">
        {products.length === 0 ? (
          <EmptyState onAdd={() => setCreatingProduct(true)} />
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">No products match your filters.</p>
        ) : (
          <>
            {/* Desktop: data table */}
            <div className="card hidden overflow-hidden lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-100/50 text-left text-xs text-gray-500">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all shown"
                        className="h-4 w-4"
                      />
                    </th>
                    <th className="px-2 py-3 font-medium">Product</th>
                    <th className="px-2 py-3 font-medium">Price</th>
                    <th className="px-2 py-3 font-medium">Sold</th>
                    <th className="px-2 py-3 font-medium">Revenue</th>
                    <th className="px-2 py-3 font-medium">Stock</th>
                    <th className="px-2 py-3 font-medium">Status</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => {
                    const threshold = effectiveThreshold(product, settings.default_low_stock_threshold)
                    const status = STATUS_PILLS[productStatus(product, threshold)]
                    const sales = productSales.get(product.id) ?? { qty: 0, revenue: 0 }
                    const onHand = product.variants.reduce((s, v) => s + v.on_hand, 0)
                    const available = product.variants.reduce((s, v) => s + computeAvailable(v), 0)
                    const thumbnail = product.variants.find((v) => v.image_url)?.image_url ?? null
                    const selectedRow = selectedIds.has(product.id)
                    return (
                      <tr
                        key={product.id}
                        onClick={() => setEditingProductId(product.id)}
                        className={`cursor-pointer border-b border-gray-100 transition-colors last:border-0 ${
                          selectedRow ? 'bg-brand-50/60' : 'hover:bg-gray-100/60'
                        }`}
                      >
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedRow}
                            onChange={() => toggleSelect(product.id)}
                            aria-label={`Select ${product.name}`}
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-400">
                              {thumbnail ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M2.25 12.75v-7.5A2.25 2.25 0 014.5 3h15a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0119.5 21H4.5a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                                </svg>
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-900">{product.name}</p>
                              <p className="text-xs text-gray-500">{product.variants.length} variant(s)</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-gray-700">{productPriceLabel(product)}</td>
                        <td className="px-2 py-2.5 font-display font-semibold text-gray-900">{sales.qty}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-gray-700">{formatRs(sales.revenue)}</td>
                        <td className="whitespace-nowrap px-2 py-2.5">
                          <span className="font-display font-semibold text-gray-900">{onHand}</span>
                          <span className="text-xs text-gray-400"> / {available} free</span>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={`status-pill ${status.pill}`}>
                            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setConfirmDeleteIds([product.id])}
                            aria-label={`Delete ${product.name}`}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked product cards (keeps alerts + expand behavior) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  settings={settings}
                  dismissedAlertKeys={dismissedAlertKeys}
                  selected={selectedIds.has(product.id)}
                  onToggleSelect={() => toggleSelect(product.id)}
                  onEdit={() => setEditingProductId(product.id)}
                  onDelete={() => setConfirmDeleteIds([product.id])}
                  onDismissAlert={handleDismissAlert}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Floating bulk-action bar (reference style) */}
      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-surface px-4 py-2.5 shadow-xl">
            <span className="text-sm font-semibold text-gray-900">{selectedIds.size} selected</span>
            <button
              onClick={() => setConfirmDeleteIds(Array.from(selectedIds))}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:opacity-85"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              aria-label="Clear selection"
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <ProductDialog
        open={creatingProduct}
        onClose={() => setCreatingProduct(false)}
        onSaved={refresh}
        productId={null}
      />

      <ProductDialog
        open={editingProductId !== null}
        onClose={() => setEditingProductId(null)}
        onSaved={refresh}
        productId={editingProductId}
      />

      <ConfirmDialog
        open={confirmDeleteIds !== null}
        onClose={() => setConfirmDeleteIds(null)}
        onConfirm={handleConfirmDelete}
        confirming={deleting}
        title={confirmDeleteIds && confirmDeleteIds.length > 1 ? `Delete ${confirmDeleteIds.length} products?` : 'Delete this product?'}
        description="This permanently deletes the product(s), their attributes, all variants, and their stock history. This cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900">No products yet</h3>
      <p className="mt-1 max-w-xs text-sm text-gray-500">
        Add your first product to start tracking colours, sizes, and stock.
      </p>
      <button onClick={onAdd} className="btn-primary mt-4">
        + Add product
      </button>
    </div>
  )
}
