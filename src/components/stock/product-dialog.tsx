'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { createClient } from '@/lib/supabase/client'
import {
  createProduct,
  updateProduct,
  deleteProduct,
  deleteVariant,
  getProduct,
  createAttributeWithValues,
  syncVariants,
} from '@/lib/db/products'
import { listProductImages, addProductImages, deleteProductImage } from '@/lib/db/product-images'
import { AttributeEditor } from './attribute-editor'
import { VariantRow } from './variant-row'
import { ProductImageGallery } from './product-image-gallery'
import { StockAdjustmentDialog } from './stock-adjustment-dialog'
import type { ProductWithDetails } from '@/lib/stock-helpers'
import type { ProductImage } from '@/lib/supabase/types'
import { variantLabel, parseValuesList } from '@/lib/stock-helpers'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  productId: string | null // null = creating a new product
}

export function ProductDialog({ open, onClose, onSaved, productId }: Props) {
  const [product, setProduct] = useState<ProductWithDetails | null>(null)
  const [images, setImages] = useState<ProductImage[]>([])
  const [loading, setLoading] = useState(false)

  // Basic info (also used for the "create" step before a product row exists)
  const [name, setName] = useState('')
  const [priceMode, setPriceMode] = useState<'global' | 'variant'>('global')
  const [globalPrice, setGlobalPrice] = useState('')
  const [globalCost, setGlobalCost] = useState('')
  const [threshold, setThreshold] = useState('')

  const [newAttrName, setNewAttrName] = useState('')
  const [newAttrValuesText, setNewAttrValuesText] = useState('')
  const [addingAttribute, setAddingAttribute] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateNotice, setGenerateNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [adjustingVariant, setAdjustingVariant] = useState<
    { id: string; label: string; onHand: number; reserved: number } | null
  >(null)
  // Variants created during this dialog session get an "Initial stock"
  // field in the grid instead of forcing a separate Adjust-stock trip.
  const [freshVariantIds, setFreshVariantIds] = useState<Set<string>>(new Set())
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set())
  const [confirmDeleteVariants, setConfirmDeleteVariants] = useState(false)
  const [deletingVariants, setDeletingVariants] = useState(false)
  const [variantBulkError, setVariantBulkError] = useState<string | null>(null)

  function toggleVariantSelect(id: string) {
    setSelectedVariantIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleDeleteVariantsBulk() {
    if (!product) return
    setDeletingVariants(true)
    setVariantBulkError(null)
    try {
      const supabase = createClient()
      for (const id of selectedVariantIds) {
        await deleteVariant(supabase, id)
      }
      setSelectedVariantIds(new Set())
      await refetch(product.id)
      setConfirmDeleteVariants(false)
    } catch (err) {
      setVariantBulkError(err instanceof Error ? err.message : 'Failed to delete variant(s)')
    } finally {
      setDeletingVariants(false)
    }
  }

  useEffect(() => {
    if (!open) return
    if (productId) {
      setLoading(true)
      refetch(productId).finally(() => setLoading(false))
    } else {
      setProduct(null)
      setImages([])
      setName('')
      setPriceMode('global')
      setGlobalPrice('')
      setGlobalCost('')
      setThreshold('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch is stable in spirit (only reads productId/open); including it would require useCallback for no real benefit here.
  }, [open, productId])

  // Used both for the initial load and as a lightweight background refresh
  // after any nested edit (price, image, attribute, variant...) — it never
  // toggles the loading flag itself, so the form doesn't flash "Loading…"
  // on every keystroke's blur. It also tells the Stock Manager grid behind
  // this dialog to refresh, so card thumbnails/prices/stock stay live
  // without needing to close and reopen.
  async function refetch(id: string) {
    try {
      const supabase = createClient()
      const [data, imageList] = await Promise.all([getProduct(supabase, id), listProductImages(supabase, id)])
      setProduct(data)
      setImages(imageList)
      setName(data.name)
      setPriceMode(data.price_mode)
      setGlobalPrice(data.global_price?.toString() ?? '')
      setGlobalCost(data.global_cost?.toString() ?? '')
      setThreshold(data.low_stock_threshold?.toString() ?? '')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product')
    }
  }

  async function handleUploadImages(files: File[]) {
    if (!product) return { added: 0, failed: files.length }
    const supabase = createClient()
    const result = await addProductImages(supabase, product.id, files, images.length)
    await refetch(product.id)
    return result
  }

  async function handleDeleteImage(image: ProductImage) {
    if (!product) return
    const supabase = createClient()
    await deleteProductImage(supabase, image)
    await refetch(product.id)
  }

  function basicPatch() {
    return {
      name: name.trim(),
      price_mode: priceMode,
      global_price: priceMode === 'global' && globalPrice !== '' ? Number(globalPrice) : null,
      global_cost: priceMode === 'global' && globalCost !== '' ? Number(globalCost) : null,
      low_stock_threshold: threshold !== '' ? Number(threshold) : null,
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Product name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const created = await createProduct(supabase, basicPatch())
      // Variants aren't generated yet — set up attributes/values next,
      // then click "Generate variants" once everything's defined.
      await refetch(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveBasic() {
    if (!product) return
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      await updateProduct(supabase, product.id, basicPatch())
      await refetch(product.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddAttribute(e: React.FormEvent) {
    e.preventDefault()
    if (!product || !newAttrName.trim()) return
    setAddingAttribute(true)
    try {
      const supabase = createClient()
      await createAttributeWithValues(
        supabase,
        product.id,
        newAttrName.trim(),
        parseValuesList(newAttrValuesText),
        product.product_attributes.length
      )
      setNewAttrName('')
      setNewAttrValuesText('')
      await refetch(product.id)
    } finally {
      setAddingAttribute(false)
    }
  }

  // The only place variants actually get created — explicit, batched, and
  // safe to click repeatedly (it only ever adds missing combinations).
  async function handleGenerateVariants() {
    if (!product) return
    setGenerating(true)
    setGenerateNotice(null)
    try {
      const supabase = createClient()
      const newIds = await syncVariants(supabase, product.id)
      setFreshVariantIds((prev) => new Set([...prev, ...newIds]))
      setGenerateNotice(
        newIds.length > 0 ? `Created ${newIds.length} new variant(s).` : 'No new combinations to create.'
      )
      await refetch(product.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate variants')
    } finally {
      setGenerating(false)
    }
  }

  async function handleDeleteProduct() {
    if (!product) return
    setSaving(true)
    try {
      const supabase = createClient()
      await deleteProduct(supabase, product.id)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product')
    } finally {
      setSaving(false)
      setConfirmDelete(false)
    }
  }

  const isCreating = !product

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={isCreating ? 'New product' : product.name}
        size="slideover"
      >
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : isCreating ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <BasicFields
              name={name}
              setName={setName}
              priceMode={priceMode}
              setPriceMode={setPriceMode}
              globalPrice={globalPrice}
              setGlobalPrice={setGlobalPrice}
              globalCost={globalCost}
              setGlobalCost={setGlobalCost}
              threshold={threshold}
              setThreshold={setThreshold}
            />
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? 'Creating…' : 'Create product'}
            </button>
            <p className="text-center text-xs text-gray-400">
              You&apos;ll set up colours, sizes, and stock next.
            </p>
          </form>
        ) : (
          <div className="space-y-6">
            <section className="max-w-2xl space-y-4">
              <BasicFields
                name={name}
                setName={setName}
                priceMode={priceMode}
                setPriceMode={setPriceMode}
                globalPrice={globalPrice}
                setGlobalPrice={setGlobalPrice}
                globalCost={globalCost}
                setGlobalCost={setGlobalCost}
                threshold={threshold}
                setThreshold={setThreshold}
                onBlurAny={handleSaveBasic}
              />
            </section>

            <section className="max-w-2xl">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Images</h3>
              <ProductImageGallery images={images} onUpload={handleUploadImages} onDelete={handleDeleteImage} />
            </section>

            <section className="max-w-2xl">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Attributes</h3>
              <div className="space-y-2">
                {product.product_attributes.map((attr) => (
                  <AttributeEditor key={attr.id} attribute={attr} onChanged={() => refetch(product.id)} />
                ))}
              </div>
              <form onSubmit={handleAddAttribute} className="mt-2 space-y-1.5">
                <input
                  type="text"
                  placeholder="New attribute name (e.g. Colour, Size)"
                  className="input text-sm"
                  value={newAttrName}
                  onChange={(e) => setNewAttrName(e.target.value)}
                />
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Values, comma-separated (e.g. Blue, Green, White striped)"
                    className="input text-sm"
                    value={newAttrValuesText}
                    onChange={(e) => setNewAttrValuesText(e.target.value)}
                  />
                  <button type="submit" disabled={addingAttribute} className="btn-secondary px-3 text-sm whitespace-nowrap">
                    {addingAttribute ? 'Adding…' : 'Add attribute'}
                  </button>
                </div>
              </form>

              {product.product_attributes.length > 0 && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleGenerateVariants}
                    disabled={generating}
                    className="btn-primary px-3 py-1.5 text-sm"
                  >
                    {generating ? 'Generating…' : 'Generate variants'}
                  </button>
                  {generateNotice && <p className="text-xs text-gray-500">{generateNotice}</p>}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Variants <span className="text-gray-400">({product.variants.length})</span>
                </h3>
                {selectedVariantIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteVariants(true)}
                    className="text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    Delete {selectedVariantIds.size} selected
                  </button>
                )}
              </div>
              {product.variants.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center">
                  <p className="text-sm text-gray-500">
                    {product.product_attributes.length === 0
                      ? 'No colours/sizes needed? Click below to create a single standard variant.'
                      : 'Add values to your attributes above, then generate variants.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateVariants}
                    disabled={generating}
                    className="btn-secondary mt-3 px-3 py-1.5 text-sm"
                  >
                    {generating ? 'Generating…' : 'Generate variants'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {product.variants.map((variant) => (
                    <VariantRow
                      key={variant.id}
                      product={product}
                      variant={variant}
                      images={images}
                      attributes={product.product_attributes}
                      isOrphaned={
                        product.product_attributes.length > 0 &&
                        variant.variant_attribute_values.length !== product.product_attributes.length
                      }
                      isFresh={freshVariantIds.has(variant.id)}
                      selected={selectedVariantIds.has(variant.id)}
                      onToggleSelect={() => toggleVariantSelect(variant.id)}
                      onChanged={() => refetch(product.id)}
                      onAdjustStock={() =>
                        setAdjustingVariant({
                          id: variant.id,
                          label: variantLabel(variant, product.product_attributes),
                          onHand: variant.on_hand,
                          reserved: variant.reserved,
                        })
                      }
                      onInitialStockSaved={() =>
                        setFreshVariantIds((prev) => {
                          const next = new Set(prev)
                          next.delete(variant.id)
                          return next
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

            <div className="border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                Delete product
              </button>
            </div>
          </div>
        )}
      </Dialog>

      <StockAdjustmentDialog
        open={adjustingVariant !== null}
        onClose={() => setAdjustingVariant(null)}
        onAdjusted={() => product && refetch(product.id)}
        variant={adjustingVariant}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDeleteProduct}
        confirming={saving}
        title={`Delete "${product?.name}"?`}
        description="This permanently deletes the product, its attributes, all variants, and their stock history. This cannot be undone."
        confirmLabel="Delete product"
      />

      <ConfirmDialog
        open={confirmDeleteVariants}
        onClose={() => {
          setConfirmDeleteVariants(false)
          setVariantBulkError(null)
        }}
        onConfirm={handleDeleteVariantsBulk}
        confirming={deletingVariants}
        title={`Delete ${selectedVariantIds.size} variant(s)?`}
        description={
          variantBulkError ?? 'This permanently deletes the selected variants and their stock history. This cannot be undone.'
        }
        confirmLabel="Delete variants"
      />
    </>
  )
}

function BasicFields(props: {
  name: string
  setName: (v: string) => void
  priceMode: 'global' | 'variant'
  setPriceMode: (v: 'global' | 'variant') => void
  globalPrice: string
  setGlobalPrice: (v: string) => void
  globalCost: string
  setGlobalCost: (v: string) => void
  threshold: string
  setThreshold: (v: string) => void
  onBlurAny?: () => void
}) {
  const { name, setName, priceMode, setPriceMode, globalPrice, setGlobalPrice, globalCost, setGlobalCost, threshold, setThreshold, onBlurAny } = props

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="product-name" className="label mb-1">
          Product name
        </label>
        <input
          id="product-name"
          type="text"
          required
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={onBlurAny}
        />
      </div>

      <div>
        <span className="label mb-1 block">Pricing</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setPriceMode('global')
              // basicPatch() reads priceMode from this render's closure —
              // calling onBlurAny synchronously here would save the OLD
              // value, since setPriceMode hasn't been processed by React
              // yet. Deferring to the next tick lets the re-render (with
              // the new priceMode) happen first.
              setTimeout(() => onBlurAny?.(), 0)
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              priceMode === 'global'
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Same for all variants
          </button>
          <button
            type="button"
            onClick={() => {
              setPriceMode('variant')
              setTimeout(() => onBlurAny?.(), 0)
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              priceMode === 'variant'
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Set per variant
          </button>
        </div>
      </div>

      {priceMode === 'global' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="global-price" className="label mb-1">
              Price (Rs.)
            </label>
            <input
              id="global-price"
              type="number"
              className="input"
              value={globalPrice}
              onChange={(e) => setGlobalPrice(e.target.value)}
              onBlur={onBlurAny}
            />
          </div>
          <div>
            <label htmlFor="global-cost" className="label mb-1">
              Cost (Rs.)
            </label>
            <input
              id="global-cost"
              type="number"
              className="input"
              value={globalCost}
              onChange={(e) => setGlobalCost(e.target.value)}
              onBlur={onBlurAny}
            />
          </div>
        </div>
      )}

      <div>
        <label htmlFor="threshold" className="label mb-1">
          Low-stock threshold <span className="text-gray-400">(optional — falls back to the global default)</span>
        </label>
        <input
          id="threshold"
          type="number"
          min={0}
          className="input w-32"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          onBlur={onBlurAny}
        />
      </div>
    </div>
  )
}
