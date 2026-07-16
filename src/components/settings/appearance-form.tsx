'use client'

import { useEffect, useState } from 'react'
import { useSettingsSection } from './use-settings-section'
import { SaveBar } from '@/components/ui/save-bar'
import { VersionInfo } from './version-info'
import { buildThemeCss, isValidHex, normalizeHex, DEFAULT_BRAND_HEX } from '@/lib/brand-color'
import type { Settings } from '@/lib/supabase/types'

// A few ready-made choices (default violet, the reference dashboard's
// green/peach family, and some safe classics).
const PRESETS = ['#7c3aed', '#4ade80', '#fb923c', '#f43f5e', '#0ea5e9', '#eab308', '#14b8a6']

type ThemeMode = 'system' | 'light' | 'dark'
const THEME_KEY = 'nayora:theme'
const MODES: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

function applyTheme(mode: ThemeMode) {
  const dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

// Settings → Appearance: theme mode (per device), primary color, and card
// colors per theme (both saved to the DB so every device follows).
export function AppearanceForm({ settings }: { settings: Settings }) {
  const s = useSettingsSection(settings, {
    brand_color: settings.brand_color,
    card_color_light: settings.card_color_light,
    card_color_dark: settings.card_color_dark,
    bg_color_light: settings.bg_color_light,
    bg_color_dark: settings.bg_color_dark,
  })
  const [hexInput, setHexInput] = useState(settings.brand_color ?? '')
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(THEME_KEY) as ThemeMode | null
      if (stored === 'light' || stored === 'dark' || stored === 'system') setThemeMode(stored)
    } catch {}
  }, [])

  function pickThemeMode(mode: ThemeMode) {
    setThemeMode(mode)
    try {
      localStorage.setItem(THEME_KEY, mode)
    } catch {}
    applyTheme(mode)
  }

  const effectiveBrand = s.values.brand_color && isValidHex(s.values.brand_color)
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
    el.textContent = buildThemeCss({
      brand: effectiveBrand,
      cardLight: s.values.card_color_light ?? null,
      cardDark: s.values.card_color_dark ?? null,
      bgLight: s.values.bg_color_light ?? null,
      bgDark: s.values.bg_color_dark ?? null,
    })
    return () => {
      el?.remove()
    }
  }, [effectiveBrand, s.values.card_color_light, s.values.card_color_dark, s.values.bg_color_light, s.values.bg_color_dark])

  function pickBrand(hex: string) {
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
      {/* Theme mode (stored per device, like the sidebar toggle) */}
      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Theme</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Per device — same as the toggle in the sidebar. System follows your device setting.
          </p>
        </div>
        <div className="p-5">
          <div className="seg">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pickThemeMode(m.id)}
                className={`seg-item px-4 py-2 text-sm ${mounted && themeMode === m.id ? 'seg-item-active' : ''}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary color */}
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
              value={effectiveBrand}
              onChange={(e) => pickBrand(e.target.value)}
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
                onClick={() => pickBrand(p)}
                aria-label={`Use ${p}`}
                className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                  effectiveBrand === p ? 'border-gray-900' : 'border-transparent'
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

      {/* Card colors */}
      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Card color</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Background of cards, dialogs and inputs — set separately for light and dark mode. Saved
            for every device.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div>
            <span className="label mb-1.5 block">In light mode</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Card color in light mode"
                className="h-10 w-14 cursor-pointer rounded-xl border border-gray-300 bg-surface p-1"
                value={s.values.card_color_light && isValidHex(s.values.card_color_light) ? normalizeHex(s.values.card_color_light) : '#ffffff'}
                onChange={(e) => s.set('card_color_light', normalizeHex(e.target.value))}
              />
              <button
                type="button"
                onClick={() => s.set('card_color_light', null)}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                Reset
              </button>
            </div>
          </div>
          <div>
            <span className="label mb-1.5 block">In dark mode</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Card color in dark mode"
                className="h-10 w-14 cursor-pointer rounded-xl border border-gray-300 bg-surface p-1"
                value={s.values.card_color_dark && isValidHex(s.values.card_color_dark) ? normalizeHex(s.values.card_color_dark) : '#181722'}
                onChange={(e) => s.set('card_color_dark', normalizeHex(e.target.value))}
              />
              <button
                type="button"
                onClick={() => s.set('card_color_dark', null)}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                Reset
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              Switch the theme above to see each one live.
            </p>
          </div>
        </div>
      </div>

      {/* Page background colors */}
      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Page background</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            The color behind everything — set separately for light and dark mode. Saved for every
            device.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div>
            <span className="label mb-1.5 block">In light mode</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Page background in light mode"
                className="h-10 w-14 cursor-pointer rounded-xl border border-gray-300 bg-surface p-1"
                value={s.values.bg_color_light && isValidHex(s.values.bg_color_light) ? normalizeHex(s.values.bg_color_light) : '#f9fafb'}
                onChange={(e) => s.set('bg_color_light', normalizeHex(e.target.value))}
              />
              <button
                type="button"
                onClick={() => s.set('bg_color_light', null)}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                Reset
              </button>
            </div>
          </div>
          <div>
            <span className="label mb-1.5 block">In dark mode</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Page background in dark mode"
                className="h-10 w-14 cursor-pointer rounded-xl border border-gray-300 bg-surface p-1"
                value={s.values.bg_color_dark && isValidHex(s.values.bg_color_dark) ? normalizeHex(s.values.bg_color_dark) : '#0c0b14'}
                onChange={(e) => s.set('bg_color_dark', normalizeHex(e.target.value))}
              />
              <button
                type="button"
                onClick={() => s.set('bg_color_dark', null)}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                Reset
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              Tip: keep the background darker than the card color in dark mode (and lighter in
              light mode) so cards still stand out.
            </p>
          </div>
        </div>
      </div>

      <VersionInfo />

      <SaveBar dirty={s.dirty} saving={s.saving} saved={s.saved} error={s.error} onSave={s.save} onCancel={s.cancel} />
    </div>
  )
}
