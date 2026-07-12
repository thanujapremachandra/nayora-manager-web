// Nayora Clothing — service worker
// Strategy: app-shell (static) cached first; everything else network-first.

const CACHE_VERSION = 'v1'
const SHELL_CACHE = `nayora-shell-${CACHE_VERSION}`
const STATIC_CACHE = `nayora-static-${CACHE_VERSION}`

const SHELL_URLS = ['/', '/stock', '/orders', '/settings', '/offline']
const STATIC_EXTENSIONS = ['.js', '.css', '.woff2', '.woff', '.ttf', '.png', '.svg', '.ico']

function isStatic(url) {
  return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext))
}

function isSupabase(url) {
  return url.hostname.includes('supabase.co')
}

// ─── Install ─────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {
        // Shell caching failing is non-fatal at install time
      })
      .then(() => self.skipWaiting())
  )
})

// ─── Activate ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== STATIC_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

// ─── Fetch ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Never intercept Supabase API calls
  if (isSupabase(url)) return

  // Static assets → cache-first
  if (isStatic(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request)
        if (cached) return cached
        const response = await fetch(event.request)
        if (response.ok) cache.put(event.request, response.clone())
        return response
      })
    )
    return
  }

  // Navigation requests → network-first with shell fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((r) => r ?? caches.match('/'))
      )
    )
    return
  }
})
