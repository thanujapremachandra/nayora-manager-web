// App version + release notes. This is the single source of truth for both
// the "What's new" popup (shown once per version) and the "reload to update"
// prompt (shown when a newer build is live than the tab you have open).
//
// To ship a release: bump APP_VERSION and add a matching entry to the TOP of
// CHANGELOG, then deploy. Users see the popup on their next visit after the
// new build loads.

export interface ChangelogEntry {
  version: string
  date: string // 'YYYY-MM-DD'
  title: string
  changes: string[]
  // Optional illustration. Either a path to a file you drop in /public
  // (e.g. '/changelog/1-1-0.png' for public/changelog/1-1-0.png) or a full URL.
  image?: string
}

export const APP_VERSION = '1.1.0'

// Newest first.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.1.0',
    date: '2026-07-16',
    title: 'Tracking numbers on slips & faster loads',
    changes: [
      'Added a Tracking Number field to the Slip Designer',
      'Written orders now add the courier charge on top',
      'Much faster page loads',
    ],
    // image: '/changelog/1-1-0.png',
  },
  {
    version: '1.0.0',
    date: '2026-07-01',
    title: 'First release',
    changes: ['Stock, orders, sessions, courier export, slips, tracking pool, and reports.'],
  },
]

// Simple numeric-dotted comparison: 1 if a > b, -1 if a < b, 0 if equal.
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number(n) || 0)
  const pb = b.split('.').map((n) => Number(n) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}
