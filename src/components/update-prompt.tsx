'use client'

import { useEffect, useState } from 'react'
import { APP_VERSION } from '@/lib/changelog'

// Polls /version and, when the deployed build is newer than the one this tab is
// running, offers a reload. Reloading pulls the fresh HTML (navigation is
// network-first in the service worker), which loads the new bundle — after
// which the "What's new" popup shows the changelog.
export function UpdatePrompt() {
  const [available, setAvailable] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // The service worker (and thus meaningful builds) only run in production;
    // polling in dev would just compare against the same local build.
    if (process.env.NODE_ENV !== 'production') return

    let stopped = false

    async function check() {
      try {
        const res = await fetch('/version', { cache: 'no-store' })
        if (!res.ok) return
        const data: { version?: string } = await res.json()
        if (!stopped && data.version && data.version !== APP_VERSION) {
          setAvailable(true)
        }
      } catch {
        // offline / transient — try again next tick
      }
    }

    check()
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(check, 5 * 60 * 1000)

    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [])

  if (!available || dismissed) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:bottom-4">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg">
        <div className="flex-1 text-sm">
          <p className="font-semibold text-gray-900">A new version is available</p>
          <p className="text-gray-500">Reload to get the latest updates.</p>
        </div>
        <button onClick={() => window.location.reload()} className="btn-primary shrink-0">
          Reload
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
