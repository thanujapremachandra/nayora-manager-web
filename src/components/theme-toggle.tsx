'use client'

import { useEffect, useState } from 'react'

type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'nayora:theme'
const ORDER: ThemeMode[] = ['system', 'light', 'dark']

function apply(mode: ThemeMode) {
  const dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

const ICONS: Record<ThemeMode, React.ReactNode> = {
  system: (
    // monitor
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
    </svg>
  ),
  light: (
    // sun
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  ),
  dark: (
    // moon
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  ),
}

const LABELS: Record<ThemeMode, string> = {
  system: 'Theme: system',
  light: 'Theme: light',
  dark: 'Theme: dark',
}

// Cycles system → light → dark. Preference persists per device in
// localStorage; "system" also live-follows OS theme changes.
export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
      if (stored === 'light' || stored === 'dark' || stored === 'system') setMode(stored)
    } catch {}
  }, [])

  useEffect(() => {
    if (!mounted) return
    apply(mode)
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode, mounted])

  function cycle() {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]
    setMode(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
  }

  // Render the system icon until mounted so server and client HTML match.
  const shown = mounted ? mode : 'system'

  return (
    <button
      onClick={cycle}
      title={LABELS[shown]}
      aria-label={LABELS[shown]}
      className={`flex items-center gap-3 rounded-xl text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 ${
        showLabel ? 'w-full px-3 py-2.5' : 'p-2'
      }`}
    >
      {ICONS[shown]}
      {showLabel && <span className="capitalize">{shown} theme</span>}
    </button>
  )
}
