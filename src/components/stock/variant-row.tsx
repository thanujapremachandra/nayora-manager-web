'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateVariant, deleteVariant } from '@/lib/db/products'
import { adjustStock } from '@/lib/db/stock-adjustments'
import { uploadProductImage } from '@/lib/db/storage'
import { addProductImageRecord } from '@/lib/db/product-images'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { VariantImagePicker } from './variant-image-picker'
import type { Product, ProductImage } from '@/lib/supabase/types'
import type { AttributeWithValues, VariantWithValues } from '@/lib/stock-helpers'
import { variantLabel } from '@/lib/stock-helpers'

interface Props {
  product: Product
  variant: VariantWithValues
  images: ProductImage[]
  attributes: AttributeWithValues[]
  isOrphaned: boolean
  isFresh: boolean
  selected: boolean
  onToggleSelect: () => void
  onChanged: () => void
  onAdjustStock: () => void
  onInitialStockSaved: () => void
}

export function VariantRow({
  product,
  variant,
  images,
  attributes,
  isOrphaned,
  isFresh,
  selected,
  onToggleSelect,
  onChanged,
  onAdjustStock,
  onInitialStockSaved,
}: Props) {
  const [name, setName] = useState(variant.name ?? '')
  const [price, setPrice] = useState(variant.price?.toString() ?? '')
  const [cost, setCost] = useState(variant.cost?.toString() ?? '')
  const [initialStock, setInitialStock] = useState('')
  const [savingStock, setSavingStock] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleSaveInitialStock() {
    const qty = Number(initialStock)
    if (!qty || qty <= 0) {
      onInitialStockSaved()
      return
    }
    setSavingStock(true)
    try {
      const supabase = createClient()
      await adjustStock(supabase, { variantId: variant.id, delta: qty, reason: 'correction', note: 'Initial stock' })
      onInitialStockSaved()
      onChanged()
    } finally {
      setSavingStock(false)
    }
  }

  const label = variantLabel(variant, attributes)
  const isGlobalPricing = product.price_mode === 'global'

  async function saveField(patch: Record<string, string | number | null>) {
    const supabase = createClient()
    await updateVariant(supabase, variant.id, patch)
    onChanged()
  }

  async function handlePickImage(url: string) {
    const supabase = createClient()
    await updateVariant(supabase, variant.id, { image_url: url })
    onChanged()
  }

  async function handleUploadNewImage(file: File) {
    const supabase = createClient()
    const url = await uploadProductImage(supabase, product.id, file)
    await addProductImageRecord(supabase, product.id, url, images.length)
    await updateVariant(supabase, variant.id, { image_url: url })
    onChanged()
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const supabase = createClient()
      await deleteVariant(supabase, variant.id)
      onChanged()
      setConfirmingDelete(false)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete variant')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-start">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        aria-label={`Select ${label}`}
        className="mt-1.5 h-4 w-4 shrink-0"
      />

      {/* Image */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-gray-400 hover:border-brand-300"
      >
        {variant.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={variant.image_url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M2.25 12.75v-7.5A2.25 2.25 0 014.5 3h15a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0119.5 21H4.5a2.25 2.25 0 01-2.25-2.25v-2.25z" />
          </svg>
        )}
      </button>
      <VariantImagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        images={images}
        currentUrl={variant.image_url}
        onPick={handlePickImage}
        onUploadNew={handleUploadNewImage}
      />

      {/* Fields */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{label}</span>
          {isOrphaned && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              Incomplete combo
            </span>
          )}
        </div>

        <input
          type="text"
          placeholder="Name override (optional)"
          className="input py-1.5 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => saveField({ name: name || null })}
        />

        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Price"
            disabled={isGlobalPricing}
            className="input py-1.5 text-sm"
            value={isGlobalPricing ? (product.global_price ?? '') : price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => saveField({ price: price === '' ? null : Number(price) })}
          />
          <input
            type="number"
            placeholder="Cost"
            disabled={isGlobalPricing}
            className="input py-1.5 text-sm"
            value={isGlobalPricing ? (product.global_cost ?? '') : cost}
            onChange={(e) => setCost(e.target.value)}
            onBlur={() => saveField({ cost: cost === '' ? null : Number(cost) })}
          />
        </div>

        {isFresh && variant.on_hand === 0 ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              placeholder="Initial stock"
              className="input py-1.5 text-sm"
              value={initialStock}
              onChange={(e) => setInitialStock(e.target.value)}
              onBlur={handleSaveInitialStock}
              disabled={savingStock}
            />
            <span className="whitespace-nowrap text-xs text-gray-400">units on hand</span>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            On hand: {variant.on_hand} · Reserved: {variant.reserved} · Available:{' '}
            {variant.on_hand - variant.reserved}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 text-xs">
          {!(isFresh && variant.on_hand === 0) && (
            <button
              type="button"
              onClick={onAdjustStock}
              className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3.5 w-3.5" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Adjust
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="inline-flex items-center gap-1 font-medium text-red-600 hover:text-red-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3.5 w-3.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => {
          setConfirmingDelete(false)
          setDeleteError(null)
        }}
        onConfirm={handleDelete}
        confirming={deleting}
        title="Delete variant?"
        description={
          deleteError ??
          `This permanently deletes "${label}" and its ${variant.on_hand} units of recorded stock. This cannot be undone.`
        }
        confirmLabel="Delete variant"
      />
    </div>
  )
}
