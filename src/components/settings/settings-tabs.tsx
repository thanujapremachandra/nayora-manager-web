'use client'

import { useState } from 'react'
import { BusinessForm } from './business-form'
import { OrdersForm } from './orders-form'
import { StockForm } from './stock-form'
import { AppearanceForm } from './appearance-form'
import { ExportColumnsManager } from './export-columns-manager'
import { SlipDesigner } from './slip-designer'
import { SlipPlacementDesigner } from './slip-placement-designer'
import type { Settings, ExportColumn } from '@/lib/supabase/types'

interface Props {
  settings: Settings
  initialExportColumns: ExportColumn[]
}

// One tab per concern so no tab needs much scrolling. Each form saves its
// own slice of the settings row independently (floating save bar on change).
const TABS = ['Business', 'Orders', 'Stock', 'Appearance', 'Excel Export', 'Slip Designer', 'Slip Placement'] as const
type Tab = (typeof TABS)[number]

export function SettingsTabs({ settings, initialExportColumns }: Props) {
  const [tab, setTab] = useState<Tab>('Business')

  return (
    <div>
      <div role="tablist" aria-label="Settings sections" className="seg mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`tabpanel-${t}`}
            onClick={() => setTab(t)}
            className={`seg-item px-4 py-2 text-sm ${tab === t ? 'seg-item-active' : ''}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'Business' && <div className="max-w-2xl"><BusinessForm settings={settings} /></div>}
        {tab === 'Orders' && <div className="max-w-2xl"><OrdersForm settings={settings} /></div>}
        {tab === 'Stock' && <div className="max-w-2xl"><StockForm settings={settings} /></div>}
        {tab === 'Appearance' && <div className="max-w-2xl"><AppearanceForm settings={settings} /></div>}
        {tab === 'Excel Export' && <div className="max-w-2xl"><ExportColumnsManager initialColumns={initialExportColumns} /></div>}
        {tab === 'Slip Designer' && <SlipDesigner settings={settings} />}
        {tab === 'Slip Placement' && <SlipPlacementDesigner settings={settings} />}
      </div>
    </div>
  )
}
