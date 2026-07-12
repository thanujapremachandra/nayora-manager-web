'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { createClient } from '@/lib/supabase/client'
import { listProducts } from '@/lib/db/products'
import { variantLabel, effectivePrice, isAttributeValueReachable } from '@/lib/stock-helpers'
import { computeAvailable } from '@/lib/supabase/types'
import type { ProductWithDetails, VariantWithValues } from '@/lib/stock-helpers'

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (input: { variantId: string; qty: number; unitPrice: number }) => void
}

export function ProductPicker({ open, onClose, onAdd }: Props) {
  const [products, setProducts] = useState<ProductWithDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [activeProduct, setActiveProduct] = useState<ProductWithDetails | null>(null)
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({}) // attributeId -> valueId
  const [qty, setQty] = useState(1)
  const [pendingOversell, setPendingOversell] = useState<VariantWithValues | null>(null)
  const [showDeadStock, setShowDeadStock] = useState(false)

  useEffect(() => {
    if (!open) {
      setActiveProduct(null)
      setSelectedValues({})
      setQty(1)
      setSearch('')
      setShowDeadStock(false)
      return
    }
    setLoading(true)
    listProducts(createClient())
      .then(setProducts)
      .finally(() => setLoading(false))
  }, [open])

  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  )

  const matchedVariant = useMemo(() => {
    if (!activeProduct) return null
    const required = activeProduct.product_attributes.map((a) => a.id)
    if (required.some((attrId) => !selectedValues[attrId])) return null
    const selectedIds = new Set(Object.values(selectedValues))
    return (
      activeProduct.variants.find((v) => {
        const valueIds = v.variant_attribute_values.map((vv) => vv.attribute_value_id)
        return valueIds.length === selectedIds.size && valueIds.every((id) => selectedIds.has(id))
      }) ?? null
    )
  }, [activeProduct, selectedValues])

  function attemptAdd(variant: VariantWithValues) {
    const available = computeAvailable(variant)
    if (available <= 0) {
      setPendingOversell(variant)
      return
    }
    confirmAdd(variant)
  }

  function confirmAdd(variant: VariantWithValues) {
    if (!activeProduct) return
    const price = effectivePrice(activeProduct, variant) ?? 0
    onAdd({ variantId: variant.id, qty, unitPrice: price })
    setQty(1)
    setPendingOversell(null)
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} title={activeProduct ? activeProduct.name : 'Add item'} size="lg">
        {!activeProduct ? (
          <div className="space-y-3">
            <input
              type="search"
              placeholder="Search products…"
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {loading ? (
              <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                {products.length === 0
                  ? 'No products yet. Add some in Stock Manager first.'
                  : 'No products match your search.'}
              </p>
            ) : (
              <div className="max-h-96 space-y-1 overflow-y-auto">
                {filtered.map((product) => {
                  const thumbnail = product.variants.find((v) => v.image_url)?.image_url ?? null
                  return (
                    <button
                      key={product.id}
                      onClick={() => setActiveProduct(product)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-gray-50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-400">
                        {thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumbnail} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M2.25 12.75v-7.5A2.25 2.25 0 014.5 3h15a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0119.5 21H4.5a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                          </svg>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-gray-900">{product.name}</span>
                        <span className="text-xs text-gray-500">{product.variants.length} variant(s)</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setActiveProduct(null)
                  setSelectedValues({})
                }}
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                ← Back to products
              </button>
              <label className="flex items-center gap-1.5 text-xs text-gray-500">
                <input type="checkbox" checked={showDeadStock} onChange={(e) => setShowDeadStock(e.target.checked)} />
                Show out-of-stock variants
              </label>
            </div>

            {activeProduct.product_attributes.map((attr) => {
              const reachableValues = attr.attribute_values.filter((value) =>
                isAttributeValueReachable(activeProduct.variants, selectedValues, attr.id, value.id, !showDeadStock)
              )
              if (reachableValues.length === 0) return null

              return (
                <div key={attr.id}>
                  <p className="label mb-1.5">{attr.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {reachableValues.map((value) => {
                      const selected = selectedValues[attr.id] === value.id
                      return (
                        <button
                          key={value.id}
                          onClick={() => setSelectedValues((prev) => ({ ...prev, [attr.id]: value.id }))}
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                            selected
                              ? 'border-brand-500 bg-brand-50 text-brand-700'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {value.value}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {matchedVariant && (
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-400">
                      {matchedVariant.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={matchedVariant.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M2.25 12.75v-7.5A2.25 2.25 0 014.5 3h15a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0119.5 21H4.5a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                        </svg>
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {variantLabel(matchedVariant, activeProduct.product_attributes)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Available: {computeAvailable(matchedVariant)} · Rs.{' '}
                        {effectivePrice(activeProduct, matchedVariant) ?? 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      className="input w-16 py-1.5 text-center text-sm"
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                    />
                    <button onClick={() => attemptAdd(matchedVariant)} className="btn-primary py-1.5">
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={pendingOversell !== null}
        onClose={() => setPendingOversell(null)}
        onConfirm={() => pendingOversell && confirmAdd(pendingOversell)}
        danger={false}
        title="Add anyway?"
        description={`Only ${pendingOversell ? computeAvailable(pendingOversell) : 0} available — this may already be a backorder. You can add it anyway if you've received unlogged stock.`}
        confirmLabel="Add anyway"
      />
    </>
  )
}
