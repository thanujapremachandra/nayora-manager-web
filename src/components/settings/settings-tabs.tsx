'use client'

import { useState } from 'react'
import { SettingsForm } from './settings-form'
import { ExportColumnsManager } from './export-columns-manager'
import { SlipDesigner } from './slip-designer'
import { SlipPlacementDesigner } from './slip-placement-designer'
import { VersionInfo } from './version-info'
import type { Settings, ExportColumn } from '@/lib/supabase/types'

interface Props {
  settings: Settings
  initialExportColumns: ExportColumn[]
}

const TABS = ['General', 'Excel Export', 'Slip Designer', 'Slip Placement'] as const
type Tab = (typeof TABS)[number]

export function SettingsTabs({ settings, initialExportColumns }: Props) {
  const [tab, setTab] = useState<Tab>('General')

  return (
    <div>
      <div role="tablist" aria-label="Settings sections" className="mb-6 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`tabpanel-${t}`}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-b-2 border-brand-600 text-brand-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'General' && (
          <div className="max-w-2xl space-y-6">
            <SettingsForm settings={settings} />
            <VersionInfo />
          </div>
        )}
        {tab === 'Excel Export' && <div className="max-w-2xl"><ExportColumnsManager initialColumns={initialExportColumns} /></div>}
        {tab === 'Slip Designer' && <SlipDesigner settings={settings} />}
        {tab === 'Slip Placement' && <SlipPlacementDesigner settings={settings} />}
      </div>
    </div>
  )
}
