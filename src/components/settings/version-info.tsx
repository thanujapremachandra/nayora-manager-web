'use client'

import { useState } from 'react'
import { APP_VERSION, CHANGELOG } from '@/lib/changelog'
import { ChangelogBody } from '@/components/whats-new'

// Small "About / Version" card for Settings — shows the running version and,
// on demand, the full release-notes history.
export function VersionInfo() {
  const [showAll, setShowAll] = useState(false)
  const entries = showAll ? CHANGELOG : CHANGELOG.slice(0, 1)

  return (
    <div className="card divide-y divide-gray-100">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Version</h2>
          <p className="mt-0.5 text-xs text-gray-500">Nayora Clothing · v{APP_VERSION}</p>
        </div>
        {CHANGELOG.length > 1 && (
          <button
            onClick={() => setShowAll((s) => !s)}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            {showAll ? 'Show latest only' : 'Show all release notes'}
          </button>
        )}
      </div>
      <div className="space-y-5 p-5">
        {entries.map((entry) => (
          <ChangelogBody key={entry.version} entry={entry} />
        ))}
      </div>
    </div>
  )
}
