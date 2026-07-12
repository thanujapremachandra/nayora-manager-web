'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { WeightInput } from '@/components/ui/weight-input'
import { createClient } from '@/lib/supabase/client'
import {
  createOrder,
  updateOrder,
  deleteOrder,
  getOrder,
  addOrderItem,
  updateOrderItemQty,
  removeOrderItem,
  findOrdersByPhone,
} from '@/lib/db/orders'
import { claimNextFromPool } from '@/lib/db/tracking-pool'
import { dismissAlert, isAlertDismissed } from '@/lib/db/dismissed-alerts'
import { dupPhoneAlertKey, orderItemLabel } from '@/lib/order-helpers'
import { computeCollectableAmount, effectiveWeightGrams, formatWeight } from '@/lib/pricing'
import { keepDecimal, keepPhone } from '@/lib/input-format'
import { formatRs } from '@/lib/stock-helpers'
import { ProductPicker } from './product-picker'
import { OrderSummaryPopup } from './order-summary-popup'
import type { OrderWithDetails } from '@/lib/order-helpers'
import type { Order, Settings } from '@/lib/supabase/types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  orderId: string | null
  sessionId: string
  settings: Settings
}

export function OrderDialog({ open, onClose, onSaved, orderId, sessionId, settings }: Props) {
  const [order, setOrder] = useState<OrderWithDetails | null>(null)
  const [loading, setLoading] = useState(false)

  const [customerName, setCustomerName] = useState('')
  const [address, setAddress] = useState('')
  const [phone1, setPhone1] = useState('')
  const [phone2, setPhone2] = useState('')
  const [paymentType, setPaymentType] = useState<'cod' | 'bank'>('cod')
  const [remarks, setRemarks] = useState('')
  const [weightGrams, setWeightGrams] = useState<number | null>(null)
  const [isExchange, setIsExchange] = useState(false)
  const [packageDescription, setPackageDescription] = useState('')
  const [showOrderDiscount, setShowOrderDiscount] = useState(false)
  const [orderDiscount, setOrderDiscount] = useState('')
  const [entryMode, setEntryMode] = useState<'stock' | 'text'>(settings.default_order_entry_mode)
  const [itemsText, setItemsText] = useState('')
  const [collectAmount, setCollectAmount] = useState('')
  const [legacyMode, setLegacyMode] = useState(false)
  const [exchangeKeepCourier, setExchangeKeepCourier] = useState(settings.exchange_keep_courier_charge)
  const [bankCollect, setBankCollect] = useState(settings.bank_transfer_collect)
  const [autoWeightOverride, setAutoWeightOverride] = useState(settings.auto_weight_enabled)
  const [removeCourier, setRemoveCourier] = useState(false)
  const [confirmExchange, setConfirmExchange] = useState<{ next: boolean } | null>(null)
  const [confirmPayment, setConfirmPayment] = useState<{ next: 'cod' | 'bank' } | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  const [autofillResults, setAutofillResults] = useState<Order[]>([])
  const [showAutofill, setShowAutofill] = useState(false)
  const [dupWarning, setDupWarning] = useState<Order | null>(null)
  const [dupDismissed, setDupDismissed] = useState(false)
  const [previousOrders, setPreviousOrders] = useState<Order[]>([])
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [poolEmptyNotice, setPoolEmptyNotice] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    if (orderId) {
      setLoading(true)
      refetch(orderId).finally(() => setLoading(false))
    } else {
      setOrder(null)
      setCustomerName('')
      setAddress('')
      setPhone1('')
      setPhone2('')
      setPaymentType('cod')
      setRemarks('')
      setWeightGrams(null)
      setIsExchange(false)
      setPackageDescription('')
      setShowOrderDiscount(false)
      setOrderDiscount('')
      setEntryMode(settings.default_order_entry_mode)
      setItemsText('')
      setCollectAmount('')
      setLegacyMode(false)
      setExchangeKeepCourier(settings.exchange_keep_courier_charge)
      setBankCollect(settings.bank_transfer_collect)
      setAutoWeightOverride(settings.auto_weight_enabled)
      setRemoveCourier(false)
      setPreviousOrders([])
      setDupWarning(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch is stable in spirit (only reads orderId/open); including it would require useCallback for no real benefit here.
  }, [open, orderId])

  // Same rationale as ProductDialog's refetch: never toggles loading itself
  // (so nested edits don't blank the form), and always calls onSaved() so
  // the session's order list behind this dialog stays live.
  async function refetch(id: string) {
    try {
      const supabase = createClient()
      const data = await getOrder(supabase, id)
      setOrder(data)
      setCustomerName(data.customer_name)
      setAddress(data.address)
      setPhone1(data.phone1)
      setPhone2(data.phone2 ?? '')
      setPaymentType(data.payment_type)
      setRemarks(data.remarks ?? '')
      setWeightGrams(data.weight_grams)
      setIsExchange(data.is_exchange)
      setPackageDescription(data.package_description ?? '')
      setShowOrderDiscount(data.order_discount !== null)
      setOrderDiscount(data.order_discount?.toString() ?? '')
      setEntryMode(data.items_text !== null ? 'text' : data.order_items.length > 0 ? 'stock' : settings.default_order_entry_mode)
      setItemsText(data.items_text ?? '')
      setCollectAmount(data.items_text !== null ? (data.items_amount?.toString() ?? '') : '')
      setLegacyMode(data.legacy_mode)
      setExchangeKeepCourier(data.exchange_keep_courier_override ?? settings.exchange_keep_courier_charge)
      setBankCollect(data.bank_collect_override ?? settings.bank_transfer_collect)
      setAutoWeightOverride(data.auto_weight_override ?? settings.auto_weight_enabled)
      setRemoveCourier(data.courier_charge_override === 0)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order')
    }
  }

  // ─── Phone lookup: autofill + dup-in-session + previous orders ───
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (phone1.trim().length < 3) {
      setAutofillResults([])
      setPreviousOrders([])
      setDupWarning(null)
      return
    }
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient()
      const matches = await findOrdersByPhone(supabase, phone1.trim())
      const others = matches.filter((m) => m.id !== order?.id)
      setAutofillResults(others)

      const dup = others.find((m) => m.session_id === sessionId)
      if (dup) {
        const key = dupPhoneAlertKey(sessionId, phone1.trim())
        const dismissed = await isAlertDismissed(supabase, key)
        setDupWarning(dismissed ? null : dup)
        setDupDismissed(dismissed)
      } else {
        setDupWarning(null)
      }

      setPreviousOrders(others.filter((m) => m.session_id !== sessionId))
    }, 300)
  }, [phone1, sessionId, order?.id])

  function applyAutofill(match: Order) {
    setCustomerName(match.customer_name)
    setAddress(match.address)
    if (match.phone2) setPhone2(match.phone2)
    setShowAutofill(false)
  }

  async function handleDismissDup() {
    if (!dupWarning) return
    await dismissAlert(createClient(), dupPhoneAlertKey(sessionId, phone1.trim()))
    setDupDismissed(true)
    setDupWarning(null)
  }

  // ─── Create / save basic fields ────────────────────────────────
  function basicPatch() {
    const isText = entryMode === 'text'
    return {
      customer_name: customerName.trim(),
      address: address.trim(),
      phone1: phone1.trim(),
      phone2: phone2.trim() || null,
      payment_type: paymentType,
      remarks: remarks.trim() || null,
      weight_grams: weightGrams,
      is_exchange: isExchange,
      package_description: packageDescription.trim() || null,
      order_discount: showOrderDiscount && orderDiscount !== '' ? Number(orderDiscount) : null,
      // Written orders store their typed contents (kept as '' when empty, so
      // the mode itself persists — a null would read back as a stock order) and
      // their typed amount in items_amount (courier is added on top, like a
      // stock order). cod_amount_override stays null here — it's only for
      // imported orders' exact-COD override.
      items_text: isText ? itemsText : null,
      items_amount: isText && collectAmount !== '' ? Number(collectAmount) : null,
      cod_amount_override: null,
      // Legacy overrides are only stored while legacy mode is on; otherwise the
      // order inherits the global settings (nulls). Removing the courier charge
      // rides on courier_charge_override = 0.
      legacy_mode: legacyMode,
      exchange_keep_courier_override: legacyMode ? exchangeKeepCourier : null,
      bank_collect_override: legacyMode ? bankCollect : null,
      auto_weight_override: legacyMode ? autoWeightOverride : null,
      courier_charge_override: legacyMode && removeCourier ? 0 : null,
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!customerName.trim() || !address.trim() || !phone1.trim()) {
      setError('Name, address, and phone are required.')
      return
    }
    setSaving(true)
    setError(null)
    setPoolEmptyNotice(false)
    try {
      const supabase = createClient()
      const created = await createOrder(supabase, { session_id: sessionId, ...basicPatch() }, [])
      const trackingNumber = await claimNextFromPool(supabase, created.id)
      if (trackingNumber === null) setPoolEmptyNotice(true)
      await refetch(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveBasic() {
    if (!order) return
    try {
      await updateOrder(createClient(), order.id, basicPatch())
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  // Written-mode fields (text + amount). Persists on blur without refetching —
  // the values are already in local state and the COD line reads from it, so a
  // refetch would only risk disrupting the field being edited.
  async function handleSaveWritten() {
    if (!order) return
    try {
      await updateOrder(createClient(), order.id, basicPatch())
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleSetEntryMode(mode: 'stock' | 'text') {
    setEntryMode(mode)
    if (!order) return
    try {
      if (mode === 'text') {
        // Persist the mode straight away — items_text is stored even when empty
        // ('' still reads back as "written"), so choosing "Write it" survives
        // leaving and reopening the order.
        await updateOrder(createClient(), order.id, { items_text: itemsText })
      } else {
        // Back to stock: clear the written contents/amount so COD comes from items.
        setItemsText('')
        setCollectAmount('')
        await updateOrder(createClient(), order.id, {
          items_text: null,
          items_amount: null,
          cod_amount_override: null,
        })
      }
      await refetch(order.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch mode')
    }
  }

  // Persist a single field immediately with its new value — avoids the stale
  // closure that `setTimeout(handleSaveBasic)` had (it captured the pre-change
  // state, so the write sometimes saved the OLD value — the reason a payment
  // switch could look like it "didn't change").
  async function persistField(patch: Parameters<typeof updateOrder>[2]) {
    if (!order) return
    try {
      await updateOrder(createClient(), order.id, patch)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  // ─── Payment buffer (COD ↔ bank transfer) ───────────────────────
  // Bank transfer normally zeroes the COD, so on an existing order the switch
  // goes through a small confirm rather than flipping silently.
  function handlePaymentClick(next: 'cod' | 'bank') {
    if (next === paymentType) return
    if (!order) {
      setPaymentType(next)
      return
    }
    setConfirmPayment({ next })
  }

  async function applyPaymentChange() {
    if (!confirmPayment || !order) return
    const next = confirmPayment.next
    setConfirmPayment(null)
    setPaymentType(next)
    try {
      await updateOrder(createClient(), order.id, { payment_type: next })
      await refetch(order.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment')
    }
  }

  // ─── Exchange buffer + legacy overrides ─────────────────────────
  // The exchange toggle changes what the courier collects, so on an existing
  // order it goes through a small confirm ("this is being changed") rather than
  // flipping on a stray click. During creation there's no DB row yet, so it's
  // a plain state change.
  function handleExchangeClick(next: boolean) {
    if (!order) {
      setIsExchange(next)
      return
    }
    setConfirmExchange({ next })
  }

  async function applyExchangeChange() {
    if (!confirmExchange || !order) return
    const next = confirmExchange.next
    setConfirmExchange(null)
    setIsExchange(next)
    try {
      await updateOrder(createClient(), order.id, { is_exchange: next })
      await refetch(order.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update exchange')
    }
  }

  async function handleToggleLegacy(next: boolean) {
    setLegacyMode(next)
    if (!order) return
    try {
      // Entering legacy snapshots the current effective values into the
      // per-order overrides, so the order is truly detached from later
      // settings changes; leaving clears them back to "inherit".
      await updateOrder(createClient(), order.id, {
        legacy_mode: next,
        exchange_keep_courier_override: next ? exchangeKeepCourier : null,
        bank_collect_override: next ? bankCollect : null,
        auto_weight_override: next ? autoWeightOverride : null,
        courier_charge_override: next && removeCourier ? 0 : null,
      })
      await refetch(order.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle legacy mode')
    }
  }

  async function handleToggleRemoveCourier(value: boolean) {
    setRemoveCourier(value)
    if (!order) return
    try {
      // Removing the courier charge for this one order = a 0 courier override.
      await updateOrder(createClient(), order.id, { courier_charge_override: value ? 0 : null })
      await refetch(order.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  // Explicit "Save" for the whole edit form — a reliable catch-all on top of
  // the per-field autosaves.
  async function handleSaveAll() {
    if (!order) return
    setSaving(true)
    setError(null)
    try {
      await updateOrder(createClient(), order.id, basicPatch())
      await refetch(order.id)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleLegacyOverride(
    field: 'exchange_keep_courier_override' | 'bank_collect_override' | 'auto_weight_override',
    value: boolean
  ) {
    if (field === 'exchange_keep_courier_override') setExchangeKeepCourier(value)
    if (field === 'bank_collect_override') setBankCollect(value)
    if (field === 'auto_weight_override') setAutoWeightOverride(value)
    if (!order) return
    try {
      await updateOrder(createClient(), order.id, { [field]: value })
      await refetch(order.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleAddItem(input: { variantId: string; qty: number; unitPrice: number }) {
    if (!order) return
    try {
      await addOrderItem(createClient(), order.id, input)
      await refetch(order.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item')
    }
  }

  async function handleQtyChange(itemId: string, variantId: string, previousQty: number, newQty: number) {
    if (!order || !Number.isFinite(newQty) || newQty < 1) return
    try {
      await updateOrderItemQty(createClient(), itemId, variantId, order.id, previousQty, newQty)
      await refetch(order.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item')
    }
  }

  async function handleRemoveItem(itemId: string, variantId: string, qty: number) {
    if (!order) return
    try {
      await removeOrderItem(createClient(), itemId, variantId, qty, order.id)
      await refetch(order.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item')
    }
  }

  async function handleDelete() {
    if (!order) return
    setSaving(true)
    try {
      await deleteOrder(createClient(), order)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete order')
    } finally {
      setSaving(false)
      setConfirmDelete(false)
    }
  }

  const isCreating = !order
  const canToggleMode = !order || order.order_items.length === 0

  // A synthetic order built from the *current* form state so the COD line and
  // auto-weight hint reflect unsaved edits live (rather than the last-fetched
  // DB row). Mirrors exactly what basicPatch() will persist.
  const previewOrder = order
    ? {
        ...order,
        payment_type: paymentType,
        is_exchange: isExchange,
        order_discount: showOrderDiscount && orderDiscount !== '' ? Number(orderDiscount) : null,
        cod_amount_override: null,
        items_amount: entryMode === 'text' && collectAmount !== '' ? Number(collectAmount) : null,
        weight_grams: weightGrams,
        legacy_mode: legacyMode,
        exchange_keep_courier_override: legacyMode ? exchangeKeepCourier : null,
        bank_collect_override: legacyMode ? bankCollect : null,
        auto_weight_override: legacyMode ? autoWeightOverride : null,
        courier_charge_override: legacyMode && removeCourier ? 0 : null,
      }
    : null

  const cod = previewOrder ? computeCollectableAmount(previewOrder, previewOrder.order_items, settings) : 0
  // When no weight is typed, show what auto-weight would fill in (if on).
  const autoWeightPreview =
    previewOrder && weightGrams === null
      ? effectiveWeightGrams({ ...previewOrder, weight_grams: null }, previewOrder.order_items, settings)
      : null

  return (
    <>
      <Dialog open={open} onClose={onClose} title={isCreating ? 'New order' : order.ref_id} size="slideover">
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <form onSubmit={isCreating ? handleCreate : (e) => e.preventDefault()} className="space-y-5">
          <div className="max-w-2xl space-y-5">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleToggleLegacy(!legacyMode)}
                title="Detach this order from the global Settings and control each behaviour by hand."
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  legacyMode
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {legacyMode ? '● Legacy mode' : 'Legacy mode'}
              </button>
            </div>

            {legacyMode && (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800">
                  This order ignores the global Settings — control each below.
                </p>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={exchangeKeepCourier}
                    onChange={(e) => handleLegacyOverride('exchange_keep_courier_override', e.target.checked)}
                  />
                  Keep courier charge on exchange
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={bankCollect}
                    onChange={(e) => handleLegacyOverride('bank_collect_override', e.target.checked)}
                  />
                  Collect full amount on bank transfer
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={autoWeightOverride}
                    onChange={(e) => handleLegacyOverride('auto_weight_override', e.target.checked)}
                  />
                  Auto-set weight
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={removeCourier}
                    onChange={(e) => handleToggleRemoveCourier(e.target.checked)}
                  />
                  Remove courier charge (collect Rs. 0 courier)
                </label>
              </div>
            )}

            {/* Customer fields */}
            <div className="space-y-3">
              <div>
                <label className="label mb-1">Customer name</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  onBlur={handleSaveBasic}
                />
              </div>
              <div>
                <label className="label mb-1">Address</label>
                <textarea
                  rows={2}
                  required
                  className="input resize-none"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onBlur={handleSaveBasic}
                />
              </div>
              <div className="relative grid grid-cols-2 gap-3">
                <div>
                  <label className="label mb-1">Phone 1</label>
                  <input
                    type="tel"
                    required
                    className="input"
                    value={phone1}
                    onChange={(e) => setPhone1(keepPhone(e.target.value))}
                    onFocus={() => setShowAutofill(true)}
                    onBlur={() => {
                      setTimeout(() => setShowAutofill(false), 150)
                      handleSaveBasic()
                    }}
                  />
                  {showAutofill && autofillResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                      {autofillResults.slice(0, 5).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onMouseDown={() => applyAutofill(m)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          <span className="font-medium text-gray-900">{m.customer_name}</span>
                          <span className="block truncate text-xs text-gray-500">{m.address}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="label mb-1">
                    Phone 2 <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    className="input"
                    value={phone2}
                    onChange={(e) => setPhone2(keepPhone(e.target.value))}
                    onBlur={handleSaveBasic}
                  />
                </div>
              </div>

              {dupWarning && !dupDismissed && (
                <div className="flex items-start justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <span>This phone number already has an order in this session ({dupWarning.customer_name}).</span>
                  <button onClick={handleDismissDup} className="shrink-0 font-medium hover:underline">
                    Dismiss
                  </button>
                </div>
              )}

              {previousOrders.length > 0 && (
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="mb-1 text-xs font-medium text-gray-500">Previous orders</p>
                  <div className="flex flex-wrap gap-1.5">
                    {previousOrders.slice(0, 6).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setViewingOrderId(p.id)}
                        className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-100"
                      >
                        {p.ref_id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Payment + weight + exchange */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label mb-1">Payment</label>
                <select
                  className="input"
                  value={paymentType}
                  onChange={(e) => handlePaymentClick(e.target.value as 'cod' | 'bank')}
                >
                  <option value="cod">Cash on delivery</option>
                  <option value="bank">Bank transfer</option>
                </select>
              </div>
              <div>
                <label className="label mb-1">Weight</label>
                <WeightInput
                  grams={weightGrams}
                  onChange={(g) => {
                    setWeightGrams(g)
                    void persistField({ weight_grams: g })
                  }}
                />
                {autoWeightPreview !== null && (
                  <p className="mt-1 text-xs text-gray-400">
                    Auto: {formatWeight(autoWeightPreview)} (leave blank to use it)
                  </p>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isExchange}
                onChange={(e) => handleExchangeClick(e.target.checked)}
              />
              Exchange order (sending a replacement, collecting the old item back)
            </label>

            <div>
              <label className="label mb-1">
                Package description <span className="text-gray-400">(optional — defaults to &quot;Clothing&quot;)</span>
              </label>
              <input
                type="text"
                className="input"
                placeholder="Clothing"
                value={packageDescription}
                onChange={(e) => setPackageDescription(e.target.value)}
                onBlur={handleSaveBasic}
              />
            </div>

            <div>
              <label className="label mb-1">Remarks</label>
              <textarea
                rows={2}
                className="input resize-none"
                placeholder="Only fill if needed (e.g. urgent)"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                onBlur={handleSaveBasic}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showOrderDiscount}
                onChange={(e) => {
                  setShowOrderDiscount(e.target.checked)
                  setTimeout(handleSaveBasic, 0)
                }}
              />
              Apply order-level discount
            </label>
            {showOrderDiscount && (
              <input
                type="text"
                inputMode="decimal"
                className="input w-40"
                placeholder="Discount (Rs.)"
                value={orderDiscount}
                onChange={(e) => setOrderDiscount(keepDecimal(e.target.value))}
                onBlur={handleSaveBasic}
              />
            )}
          </div>

            {isCreating ? (
              <>
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                <button type="submit" disabled={saving} className="btn-primary w-full">
                  {saving ? 'Creating…' : 'Create order'}
                </button>
                <p className="text-center text-xs text-gray-400">You&apos;ll add items next.</p>
              </>
            ) : (
              <>
                {poolEmptyNotice && (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  No tracking numbers available in the pool — add one manually below, or upload more in the Order Handler pool manager.
                </div>
              )}

            {/* Items */}
                <section className="border-t border-gray-200 pt-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {entryMode === 'text' ? 'Order contents' : 'Items'}
                    </h3>
                    <div className="flex items-center gap-2">
                      {canToggleMode && (
                        <div className="inline-flex overflow-hidden rounded-lg border border-gray-300 text-xs">
                          <button
                            type="button"
                            onClick={() => handleSetEntryMode('stock')}
                            className={`px-2.5 py-1 font-medium ${entryMode === 'stock' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                          >
                            From stock
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetEntryMode('text')}
                            className={`px-2.5 py-1 font-medium ${entryMode === 'text' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                          >
                            Write it
                          </button>
                        </div>
                      )}
                      {entryMode === 'stock' && (
                        <button type="button" onClick={() => setPickerOpen(true)} className="btn-secondary py-1.5 text-sm">
                          + Add item
                        </button>
                      )}
                    </div>
                  </div>
                  {entryMode === 'text' ? (
                    <div className="space-y-3">
                      <textarea
                        rows={4}
                        className="input resize-none"
                        placeholder="Write the order contents — one item per line, or however you like."
                        value={itemsText}
                        onChange={(e) => setItemsText(e.target.value)}
                        onBlur={handleSaveWritten}
                      />
                      <div>
                        <label className="label mb-1">Order amount (Rs.)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="input w-40"
                          placeholder="0"
                          value={collectAmount}
                          onChange={(e) => setCollectAmount(keepDecimal(e.target.value))}
                          onBlur={handleSaveWritten}
                        />
                        <p className="mt-1 text-xs text-gray-400">
                          Written orders don&apos;t draw from stock — enter the item amount. The courier
                          charge is added on top (see COD below).
                        </p>
                      </div>
                    </div>
                  ) : order.order_items.length === 0 ? (
                    <p className="text-sm text-gray-500">No items yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {order.order_items.map((item) => (
                        <li key={item.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-400">
                            {item.variants.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.variants.image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M2.25 12.75v-7.5A2.25 2.25 0 014.5 3h15a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0119.5 21H4.5a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                              </svg>
                            )}
                          </span>
                          <span className="flex-1 truncate">{orderItemLabel(item)}</span>
                          <input
                            type="number"
                            min={1}
                            className="input w-16 py-1 text-center"
                            defaultValue={item.qty}
                            onBlur={(e) => handleQtyChange(item.id, item.variant_id, item.qty, Number(e.target.value))}
                          />
                          <span className="w-20 text-right">{formatRs(item.unit_price * item.qty)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id, item.variant_id, item.qty)}
                            className="text-red-600 hover:text-red-700"
                            aria-label="Remove item"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-sm font-semibold text-gray-900">
                  <span>
                    COD amount{' '}
                    {!isExchange && paymentType === 'cod' && (
                      <span className="font-normal text-gray-400">(incl. courier charge)</span>
                    )}
                  </span>
                  <span>{formatRs(cod)}</span>
                </div>

                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

                <div className="flex items-center gap-3 border-t border-gray-200 pt-4">
                  <button type="button" onClick={handleSaveAll} disabled={saving} className="btn-primary">
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                  {savedFlash && <span className="text-sm font-medium text-green-700">Saved ✓</span>}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm font-medium text-red-600 hover:text-red-700">
                    Delete order
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </Dialog>

      <ProductPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onAdd={handleAddItem} />
      <OrderSummaryPopup orderId={viewingOrderId} settings={settings} onClose={() => setViewingOrderId(null)} />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        confirming={saving}
        title={`Delete order ${order?.ref_id}?`}
        description="This releases any reserved stock (or restores it if already sent) and permanently deletes the order."
        confirmLabel="Delete order"
      />

      <ConfirmDialog
        open={confirmExchange !== null}
        onClose={() => setConfirmExchange(null)}
        onConfirm={applyExchangeChange}
        danger={false}
        title={confirmExchange?.next ? 'Mark as exchange?' : 'Remove exchange?'}
        description={
          confirmExchange?.next
            ? 'This order will be set as an exchange — saved to the database now.'
            : 'This order will no longer be an exchange — saved to the database now.'
        }
        confirmLabel={confirmExchange?.next ? 'Set exchange' : 'Remove exchange'}
      />

      <ConfirmDialog
        open={confirmPayment !== null}
        onClose={() => setConfirmPayment(null)}
        onConfirm={applyPaymentChange}
        danger={false}
        title={confirmPayment?.next === 'bank' ? 'Switch to bank transfer?' : 'Switch to cash on delivery?'}
        description={
          confirmPayment?.next === 'bank'
            ? 'Payment changes to bank transfer — saved to the database now. (Bank orders collect Rs. 0 unless changed in Settings.)'
            : 'Payment changes to cash on delivery — saved to the database now.'
        }
        confirmLabel={confirmPayment?.next === 'bank' ? 'Use bank transfer' : 'Use cash on delivery'}
      />
    </>
  )
}
