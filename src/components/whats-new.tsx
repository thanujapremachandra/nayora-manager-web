'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { APP_VERSION, CHANGELOG, compareVersions, type ChangelogEntry } from '@/lib/changelog'

const STORAGE_KEY = 'nayora:lastSeenVersion'

// Shows a "What's new" popup once per version. It reads the last version the
// user acknowledged from localStorage: if the running build is newer, it lists
// everything they haven't seen and, on dismiss, records the current version so
// it won't show again until the next release.
export function WhatsNew() {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null)

  useEffect(() => {
    let lastSeen: string | null = null
    try {
      lastSeen = localStorage.getItem(STORAGE_KEY)
    } catch {
      return // storage blocked (private mode etc.) — just skip
    }

    if (lastSeen === APP_VERSION) return // already acknowledged this version

    if (lastSeen === null) {
      // Brand-new device: don't greet a first-time user with old release notes.
      try {
        localStorage.setItem(STORAGE_KEY, APP_VERSION)
      } catch {}
      return
    }

    const unseen = CHANGELOG.filter((e) => compareVersions(e.version, lastSeen) > 0)
    // Fall back to the latest entry if the stored version isn't in the list.
    setEntries(unseen.length > 0 ? unseen : CHANGELOG.slice(0, 1))
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, APP_VERSION)
    } catch {}
    setEntries(null)
  }

  if (!entries || entries.length === 0) return null

  return (
    <Dialog
      open
      onClose={dismiss}
      title="What's new"
      size="md"
      footer={
        <div className="flex justify-end">
          <button onClick={dismiss} className="btn-primary">
            Got it
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {entries.map((entry) => (
          <ChangelogBody key={entry.version} entry={entry} />
        ))}
      </div>
    </Dialog>
  )
}

export function ChangelogBody({ entry }: { entry: ChangelogEntry }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{entry.title}</h3>
        <span className="shrink-0 text-xs text-gray-400">
          v{entry.version} · {entry.date}
        </span>
      </div>
      {entry.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.image}
          alt=""
          className="mt-2 w-full rounded-lg border border-gray-200 object-cover"
        />
      )}
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
        {entry.changes.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
    </div>
  )
}
