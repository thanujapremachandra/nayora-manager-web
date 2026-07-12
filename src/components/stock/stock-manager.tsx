'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listProducts, deleteProduct } from '@/lib/db/products'
import { dismissAlert, listDismissedAlertKeys } from '@/lib/db/dismissed-alerts'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ProductCard } from './product-card'
import { ProductDialog } from './product-dialog'
import type { Settings } from '@/lib/supabase/types'
import type { ProductWithDetails, VariantStatus } from '@/lib/stock-helpers'
import { variantStatus, effectiveThreshold } from '@/lib/stock-helpers'

type StatusFilter = 'all' | VariantStatus
type SortBy = 'name' | 'quantity' | 'stock_value'

interface Props {
  initialProducts: ProductWithDetails[]
  initialDismissedAlertKeys: string[]
  settings: Settings
  initialStatusFilter?: string
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

export function StockManager({ initialProducts, initialDismissedAlertKeys, settings, initialStatusFilter }: Props) {
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
    }

    return sorted
  }, [products, search, statusFilter, sortBy, settings.default_low_stock_threshold])

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

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Manager</h1>
          <p className="mt-1 text-sm text-gray-500">Products, variants, and stock truth.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setConfirmDeleteIds(Array.from(selectedIds))}
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              Delete {selectedIds.size} selected
            </button>
          )}
          <button onClick={() => setCreatingProduct(true)} className="btn-primary">
            + Add product
          </button>
        </div>
      </div>

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
        </select>
      </div>

      {loadError && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      )}

      {/* Grid */}
      <div className="mt-6">
        {products.length === 0 ? (
          <EmptyState onAdd={() => setCreatingProduct(true)} />
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">No products match your filters.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        )}
      </div>

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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16 text-center">
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
