'use client'

import { useSettingsSection } from './use-settings-section'
import { SaveBar } from '@/components/ui/save-bar'
import type { Settings } from '@/lib/supabase/types'

// Settings → Business: identity + the slip footer line.
export function BusinessForm({ settings }: { settings: Settings }) {
  const s = useSettingsSection(settings, {
    business_name: settings.business_name,
    address: settings.address,
    phone1: settings.phone1,
    phone2: settings.phone2,
    slip_footer_text: settings.slip_footer_text,
  })

  return (
    <div className="space-y-6">
      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Business info</h2>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label htmlFor="business_name" className="label mb-1">Business name</label>
            <input
              id="business_name"
              type="text"
              className="input"
              value={s.values.business_name}
              onChange={(e) => s.set('business_name', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="address" className="label mb-1">Address</label>
            <textarea
              id="address"
              rows={2}
              className="input resize-none"
              value={s.values.address}
              onChange={(e) => s.set('address', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="phone1" className="label mb-1">Phone 1</label>
              <input
                id="phone1"
                type="tel"
                className="input"
                value={s.values.phone1}
                onChange={(e) => s.set('phone1', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="phone2" className="label mb-1">
                Phone 2 <span className="text-gray-400">(optional)</span>
              </label>
              <input
                id="phone2"
                type="tel"
                className="input"
                value={s.values.phone2 ?? ''}
                onChange={(e) => s.set('phone2', e.target.value || null)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Courier slip footer</h2>
          <p className="mt-0.5 text-xs text-gray-500">Printed at the bottom of every slip.</p>
        </div>
        <div className="p-5">
          <textarea
            rows={2}
            className="input resize-none font-mono text-xs"
            value={s.values.slip_footer_text}
            onChange={(e) => s.set('slip_footer_text', e.target.value)}
          />
        </div>
      </div>

      <SaveBar dirty={s.dirty} saving={s.saving} saved={s.saved} error={s.error} onSave={s.save} onCancel={s.cancel} />
    </div>
  )
}
