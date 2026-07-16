import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateSettings } from '@/lib/db/settings'
import type { Database, Settings } from '@/lib/supabase/types'

type SettingsPatch = Database['public']['Tables']['settings']['Update']

// Shared state/dirty/save plumbing for the per-category settings forms.
// Each form owns only its slice of fields, so saving one tab never
// clobbers unsaved edits on another.
export function useSettingsSection<T extends SettingsPatch>(settings: Settings, initial: T) {
  const [values, setValues] = useState<T>(initial)
  const [baseline, setBaseline] = useState<T>(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = JSON.stringify(values) !== JSON.stringify(baseline)

  function set<K extends keyof T>(key: K, value: T[K]) {
    setSaved(false)
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await updateSettings(createClient(), settings.id, values)
      setBaseline(values)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setValues(baseline)
    setError(null)
  }

  return { values, set, dirty, saving, saved, error, save, cancel }
}
