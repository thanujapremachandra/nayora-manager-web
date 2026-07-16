'use client'

import { useSettingsSection } from './use-settings-section'
import { SaveBar } from '@/components/ui/save-bar'
import type { Settings } from '@/lib/supabase/types'

// Settings → Stock: stock-level defaults.
export function StockForm({ settings }: { settings: Settings }) {
  const s = useSettingsSection(settings, {
    default_low_stock_threshold: settings.default_low_stock_threshold,
  })

  return (
    <div className="space-y-6">
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
            className="input w-32"
            value={s.values.default_low_stock_threshold}
            onChange={(e) => s.set('default_low_stock_threshold', Number(e.target.value))}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Products can override this per-item; this is the fallback.
          </p>
        </div>
      </div>

      <SaveBar dirty={s.dirty} saving={s.saving} saved={s.saved} error={s.error} onSave={s.save} onCancel={s.cancel} />
    </div>
  )
}
