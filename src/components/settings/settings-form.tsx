'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateSettings } from '@/lib/db/settings'
import type { Settings } from '@/lib/supabase/types'

interface Props {
  settings: Settings
}

export function SettingsForm({ settings: initial }: Props) {
  const [settings, setSettings] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function field<K extends keyof Settings>(key: K) {
    return {
      value: (settings[key] ?? '') as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setSettings((s) => ({ ...s, [key]: e.target.value })),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const supabase = createClient()
      const updated = await updateSettings(supabase, settings.id, {
        business_name: settings.business_name,
        address: settings.address,
        phone1: settings.phone1,
        phone2: settings.phone2 || null,
        slip_footer_text: settings.slip_footer_text,
        default_low_stock_threshold: Number(settings.default_low_stock_threshold),
        default_courier_charge: Number(settings.default_courier_charge),
        currency: settings.currency,
        default_order_entry_mode: settings.default_order_entry_mode,
        exchange_keep_courier_charge: settings.exchange_keep_courier_charge,
        bank_transfer_collect: settings.bank_transfer_collect,
        auto_weight_enabled: settings.auto_weight_enabled,
        auto_weight_mode: settings.auto_weight_mode,
        auto_weight_threshold: Number(settings.auto_weight_threshold),
        auto_weight_over_grams: Number(settings.auto_weight_over_grams),
        auto_weight_under_grams: Number(settings.auto_weight_under_grams),
      })
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Business info */}
      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Business info</h2>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label htmlFor="business_name" className="label mb-1">
              Business name
            </label>
            <input id="business_name" type="text" required className="input" {...field('business_name')} />
          </div>

          <div>
            <label htmlFor="address" className="label mb-1">
              Address
            </label>
            <textarea
              id="address"
              rows={2}
              required
              className="input resize-none"
              value={settings.address}
              onChange={(e) => setSettings((s) => ({ ...s, address: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="phone1" className="label mb-1">
                Phone 1
              </label>
              <input id="phone1" type="tel" required className="input" {...field('phone1')} />
            </div>
            <div>
              <label htmlFor="phone2" className="label mb-1">
                Phone 2 <span className="text-gray-400">(optional)</span>
              </label>
              <input id="phone2" type="tel" className="input" {...field('phone2')} />
            </div>
          </div>
        </div>
      </div>

      {/* Slip footer */}
      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Courier slip footer</h2>
          <p className="mt-0.5 text-xs text-gray-500">Printed at the bottom of every slip.</p>
        </div>
        <div className="p-5">
          <textarea
            id="slip_footer_text"
            rows={2}
            required
            className="input resize-none font-mono text-xs"
            value={settings.slip_footer_text}
            onChange={(e) => setSettings((s) => ({ ...s, slip_footer_text: e.target.value }))}
          />
        </div>
      </div>

      {/* Stock */}
      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Stock defaults</h2>
        </div>
        <div className="p-5">
          <label htmlFor="low_stock_threshold" className="label mb-1">
            Low-stock alert threshold (units)
          </label>
          <input
            id="low_stock_threshold"
            type="number"
            min={0}
            required
            className="input w-32"
            value={settings.default_low_stock_threshold}
            onChange={(e) =>
              setSettings((s) => ({ ...s, default_low_stock_threshold: Number(e.target.value) }))
            }
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Products can override this per-item; this is the fallback.
          </p>
        </div>
      </div>

      {/* Order entry default */}
      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Order entry default</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            How the order dialog opens when creating an order. You can still switch per order.
          </p>
        </div>
        <div className="p-5">
          <label htmlFor="default_order_entry_mode" className="label mb-1">
            Default item entry mode
          </label>
          <select
            id="default_order_entry_mode"
            className="input w-56"
            value={settings.default_order_entry_mode}
            onChange={(e) =>
              setSettings((s) => ({ ...s, default_order_entry_mode: e.target.value as 'stock' | 'text' }))
            }
          >
            <option value="stock">Pick items from stock</option>
            <option value="text">Write the order (free text)</option>
          </select>
          <p className="mt-1.5 text-xs text-gray-500">
            Written orders don&apos;t draw from stock — you type the contents and enter the COD amount by hand.
          </p>
        </div>
      </div>

      {/* Courier charge */}
      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Courier charge</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Added on top of the order total to get the amount the courier collects (COD box and
            Excel export &quot;Amount&quot; column). Flat rate — no weight tiers yet.
          </p>
        </div>
        <div className="p-5">
          <label htmlFor="default_courier_charge" className="label mb-1">
            Flat courier charge (Rs.)
          </label>
          <input
            id="default_courier_charge"
            type="number"
            min={0}
            required
            className="input w-32"
            value={settings.default_courier_charge}
            onChange={(e) => setSettings((s) => ({ ...s, default_courier_charge: Number(e.target.value) }))}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Individual orders can override this via <code>courier_charge_override</code> if needed.
          </p>
        </div>
      </div>

      {/* Exchange orders */}
      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Exchange orders</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            What the courier collects on orders marked as an exchange.
          </p>
        </div>
        <div className="p-5">
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.exchange_keep_courier_charge}
              onChange={(e) => setSettings((s) => ({ ...s, exchange_keep_courier_charge: e.target.checked }))}
            />
            <span>
              Keep the courier charge on exchanges
              <span className="block text-xs text-gray-500">
                On → collect just the courier charge. Off → collect Rs. 0 (current behaviour).
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* Bank transfer orders */}
      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Bank-transfer orders</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            What the courier collects on orders paid by bank transfer.
          </p>
        </div>
        <div className="p-5">
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.bank_transfer_collect}
              onChange={(e) => setSettings((s) => ({ ...s, bank_transfer_collect: e.target.checked }))}
            />
            <span>
              Collect the full amount on bank transfers
              <span className="block text-xs text-gray-500">
                On → collect the order total + courier charge, like a COD order. Off → collect Rs. 0
                (current behaviour, since it&apos;s already paid).
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* Auto weight */}
      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Automatic weight</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Fill an order&apos;s weight automatically when none is entered by hand. A manually
            entered weight always overrides this.
          </p>
        </div>
        <div className="space-y-4 p-5">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.auto_weight_enabled}
              onChange={(e) => setSettings((s) => ({ ...s, auto_weight_enabled: e.target.checked }))}
            />
            Enable automatic weight
          </label>

          {settings.auto_weight_enabled && (
            <div className="space-y-4 border-l-2 border-gray-100 pl-4">
              <div>
                <label htmlFor="auto_weight_mode" className="label mb-1">
                  Decide weight by
                </label>
                <select
                  id="auto_weight_mode"
                  className="input w-56"
                  value={settings.auto_weight_mode}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, auto_weight_mode: e.target.value as 'count' | 'price' }))
                  }
                >
                  <option value="count">Item count (total quantity)</option>
                  <option value="price">Item subtotal (Rs., before courier)</option>
                </select>
              </div>

              <div>
                <label htmlFor="auto_weight_threshold" className="label mb-1">
                  Threshold {settings.auto_weight_mode === 'price' ? '(Rs.)' : '(items)'}
                </label>
                <input
                  id="auto_weight_threshold"
                  type="number"
                  min={0}
                  className="input w-32"
                  value={settings.auto_weight_threshold}
                  onChange={(e) => setSettings((s) => ({ ...s, auto_weight_threshold: Number(e.target.value) }))}
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Over this value uses the heavier weight; at or under it uses the lighter one.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="auto_weight_over_grams" className="label mb-1">
                    Over threshold (grams)
                  </label>
                  <input
                    id="auto_weight_over_grams"
                    type="number"
                    min={0}
                    className="input w-32"
                    value={settings.auto_weight_over_grams}
                    onChange={(e) => setSettings((s) => ({ ...s, auto_weight_over_grams: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label htmlFor="auto_weight_under_grams" className="label mb-1">
                    At / under (grams)
                  </label>
                  <input
                    id="auto_weight_under_grams"
                    type="number"
                    min={0}
                    className="input w-32"
                    value={settings.auto_weight_under_grams}
                    onChange={(e) => setSettings((s) => ({ ...s, auto_weight_under_grams: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feedback row */}
      <div className="flex items-center justify-between">
        <div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          {saved && (
            <p role="status" className="text-sm text-green-700">
              Settings saved.
            </p>
          )}
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  )
}
