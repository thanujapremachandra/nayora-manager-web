import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/db/settings'
import { listExportColumns } from '@/lib/db/export-columns'
import { SettingsTabs } from '@/components/settings/settings-tabs'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createClient()

  try {
    const [settings, exportColumns] = await Promise.all([getSettings(supabase), listExportColumns(supabase)])

    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Business info and operational defaults.</p>

        <div className="mt-6">
          <SettingsTabs settings={settings} initialExportColumns={exportColumns} />
        </div>
      </div>
    )
  } catch (err) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="card p-6">
          <p className="text-sm text-red-700">
            Could not load settings: {err instanceof Error ? err.message : 'Unknown error'}. Make sure
            you&apos;ve run the migrations and your environment variables are set.
          </p>
        </div>
      </div>
    )
  }
}
