'use client'

import { useEffect, useState } from 'react'
import { useSettingsSection } from './use-settings-section'
import { SaveBar } from '@/components/ui/save-bar'
import { VersionInfo } from './version-info'
import { buildBrandCss, isValidHex, normalizeHex, DEFAULT_BRAND_HEX } from '@/lib/brand-color'
import type { Settings } from '@/lib/supabase/types'

// A few ready-made choices (default violet, the reference dashboard's
// green/peach family, and some safe classics).
const PRESETS = ['#7c3aed', '#4ade80', '#fb923c', '#f43f5e', '#0ea5e9', '#eab308', '#14b8a6']

// Settings → Appearance: pick the app's primary color. Saved to the DB so
// every device follows it; previewed live while picking.
export function AppearanceForm({ settings }: { settings: Settings }) {
  const s = useSettingsSection(settings, { brand_color: settings.brand_color })
  const [hexInput, setHexInput] = useState(settings.brand_color ?? '')

  const effective = s.values.brand_color && isValidHex(s.values.brand_color)
    ? normalizeHex(s.values.brand_color)
    : DEFAULT_BRAND_HEX

  // Live preview: a <style> appended to <body> comes after the layout's
  // server-rendered override in the DOM, so it wins while this tab is open.
  useEffect(() => {
    let el = document.getElementById('brand-preview') as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = 'brand-preview'
      document.body.appendChild(el)
    }
    el.textContent = buildBrandCss(effective)
    return () => {
      el?.remove()
    }
  }, [effective])

  function pick(hex: string) {
    const normalized = normalizeHex(hex)
    setHexInput(normalized)
    s.set('brand_color', normalized === DEFAULT_BRAND_HEX ? null : normalized)
  }

  function handleHexTyped(raw: string) {
    setHexInput(raw)
    if (isValidHex(raw)) s.set('brand_color', normalizeHex(raw))
  }

  return (
    <div className="space-y-6">
      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Primary color</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Used for buttons, links, highlights and charts — in both light and dark mode. Saved for
            every device.
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="color"
              aria-label="Pick primary color"
              className="h-11 w-16 cursor-pointer rounded-xl border border-gray-300 bg-surface p-1"
              value={effective}
              onChange={(e) => pick(e.target.value)}
            />
            <input
              type="text"
              placeholder={DEFAULT_BRAND_HEX}
              className="input w-32 font-mono text-sm"
              value={hexInput}
              onChange={(e) => handleHexTyped(e.target.value)}
              aria-label="Hex color code"
            />
            <button
              type="button"
              onClick={() => {
                setHexInput('')
                s.set('brand_color', null)
              }}
              className="btn-secondary px-3 py-2 text-xs"
            >
              Reset to default
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => pick(p)}
                aria-label={`Use ${p}`}
                className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                  effective === p ? 'border-gray-900' : 'border-transparent'
                }`}
                style={{ backgroundColor: p }}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="btn-primary pointer-events-none px-4 py-2 text-xs">Preview button</span>
            <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700">
              Preview chip
            </span>
            <span className="font-medium text-brand-600">Preview link</span>
          </div>
        </div>
      </div>

      <VersionInfo />

      <SaveBar dirty={s.dirty} saving={s.saving} saved={s.saved} error={s.error} onSave={s.save} onCancel={s.cancel} />
    </div>
  )
}
