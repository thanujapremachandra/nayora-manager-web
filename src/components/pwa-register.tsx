'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    // Dev-mode registration is a common, hard-to-spot source of "my
    // changes aren't showing up" — the service worker's cache-first
    // strategy for static assets keeps serving whatever JS bundle was
    // cached the first time, independent of any server restart, until the
    // browser's old registration is explicitly cleared. Only register in
    // production, where the cache versioning in sw.js is actually meant to
    // apply.
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.error('SW registration failed:', err))
    }
  }, [])

  return null
}
