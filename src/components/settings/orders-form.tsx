'use client'

import { useSettingsSection } from './use-settings-section'
import { SaveBar } from '@/components/ui/save-bar'
import type { Settings } from '@/lib/supabase/types'

// Settings → Orders: entry mode, courier charge, exchange/bank behaviour,
// and automatic weight.
export function OrdersForm({ settings }: { settings: Settings }) {
  const s = useSettingsSection(settings, {
    default_order_entry_mode: settings.default_order_entry_mode,
    default_courier_charge: settings.default_courier_charge,
    exchange_keep_courier_charge: settings.exchange_keep_courier_charge,
    bank_transfer_collect: settings.bank_transfer_collect,
    auto_weight_enabled: settings.auto_weight_enabled,
    auto_weight_mode: settings.auto_weight_mode,
    auto_weight_threshold: settings.auto_weight_threshold,
    auto_weight_over_grams: settings.auto_weight_over_grams,
    auto_weight_under_grams: settings.auto_weight_under_grams,
  })

  return (
    <div className="space-y-6">
      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Order entry</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            How the order dialog opens when creating an order. You can still switch per order.
          </p>
        </div>
        <div className="p-5">
          <label htmlFor="default_order_entry_mode" className="label mb-1">Default item entry mode</label>
          <select
            id="default_order_entry_mode"
            className="input w-56"
            value={s.values.default_order_entry_mode}
            onChange={(e) => s.set('default_order_entry_mode', e.target.value as 'stock' | 'text')}
          >
            <option value="stock">Pick items from stock</option>
            <option value="text">Write the order (free text)</option>
          </select>
        </div>
      </div>

      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Courier charge</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Added on top of the order total to get the amount the courier collects.
          </p>
        </div>
        <div className="p-5">
          <label htmlFor="default_courier_charge" className="label mb-1">Flat courier charge (Rs.)</label>
          <input
            id="default_courier_charge"
            type="number"
            min={0}
            className="input w-32"
            value={s.values.default_courier_charge}
            onChange={(e) => s.set('default_courier_charge', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Exchange & bank transfer</h2>
          <p className="mt-0.5 text-xs text-gray-500">What the courier collects for special order types.</p>
        </div>
        <div className="space-y-4 p-5">
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={s.values.exchange_keep_courier_charge}
              onChange={(e) => s.set('exchange_keep_courier_charge', e.target.checked)}
            />
            <span>
              Keep the courier charge on exchanges
              <span className="block text-xs text-gray-500">
                On → collect just the courier charge. Off → collect Rs. 0.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={s.values.bank_transfer_collect}
              onChange={(e) => s.set('bank_transfer_collect', e.target.checked)}
            />
            <span>
              Collect the full amount on bank transfers
              <span className="block text-xs text-gray-500">
                On → collect total + courier like COD. Off → collect Rs. 0 (already paid).
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Automatic weight</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Fill an order&apos;s weight automatically when none is entered by hand. A manually entered
            weight always overrides this.
          </p>
        </div>
        <div className="space-y-4 p-5">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={s.values.auto_weight_enabled}
              onChange={(e) => s.set('auto_weight_enabled', e.target.checked)}
            />
            Enable automatic weight
          </label>

          {s.values.auto_weight_enabled && (
            <div className="space-y-4 border-l-2 border-gray-100 pl-4">
              <div>
                <label htmlFor="auto_weight_mode" className="label mb-1">Decide weight by</label>
                <select
                  id="auto_weight_mode"
                  className="input w-56"
                  value={s.values.auto_weight_mode}
                  onChange={(e) => s.set('auto_weight_mode', e.target.value as 'count' | 'price')}
                >
                  <option value="count">Item count (total quantity)</option>
                  <option value="price">Item subtotal (Rs., before courier)</option>
                </select>
              </div>
              <div>
                <label htmlFor="auto_weight_threshold" className="label mb-1">
                  Threshold {s.values.auto_weight_mode === 'price' ? '(Rs.)' : '(items)'}
                </label>
                <input
                  id="auto_weight_threshold"
                  type="number"
                  min={0}
                  className="input w-32"
                  value={s.values.auto_weight_threshold}
                  onChange={(e) => s.set('auto_weight_threshold', Number(e.target.value))}
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Over this value uses the heavier weight; at or under it uses the lighter one.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="auto_weight_over_grams" className="label mb-1">Over threshold (grams)</label>
                  <input
                    id="auto_weight_over_grams"
                    type="number"
                    min={0}
                    className="input w-32"
                    value={s.values.auto_weight_over_grams}
                    onChange={(e) => s.set('auto_weight_over_grams', Number(e.target.value))}
                  />
                </div>
                <div>
                  <label htmlFor="auto_weight_under_grams" className="label mb-1">At / under (grams)</label>
                  <input
                    id="auto_weight_under_grams"
                    type="number"
                    min={0}
                    className="input w-32"
                    value={s.values.auto_weight_under_grams}
                    onChange={(e) => s.set('auto_weight_under_grams', Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <SaveBar dirty={s.dirty} saving={s.saving} saved={s.saved} error={s.error} onSave={s.save} onCancel={s.cancel} />
    </div>
  )
}
