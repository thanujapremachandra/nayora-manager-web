'use client'

import { useEffect } from 'react'

// Slips and summaries are physical paper — they must always render
// black-on-white, whatever theme the app is in. Mounted by PrintStyles (so
// every print view gets it automatically): forces light theme while a print
// view is on screen and restores the user's preference on unmount.
export function ForceLightTheme() {
  useEffect(() => {
    const el = document.documentElement
    const previous = el.dataset.theme
    el.dataset.theme = 'light'
    return () => {
      if (previous) el.dataset.theme = previous
    }
  }, [])

  return null
}
