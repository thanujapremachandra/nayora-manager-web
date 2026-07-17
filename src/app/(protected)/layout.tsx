import { AppNav } from '@/components/nav'
import { WhatsNew } from '@/components/whats-new'
import { UpdatePrompt } from '@/components/update-prompt'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/db/settings'
import { buildThemeCss, overridesFromSettings } from '@/lib/brand-color'

// Auth is enforced in middleware.ts (it redirects unauthenticated requests to
// /login before this layout ever renders), so there's no getUser() here — that
// would be a second, redundant cross-region round-trip to Supabase auth on
// every navigation.
//
// The settings fetch below powers the custom brand color; Next renders the
// layout and page concurrently, so this overlaps the page's own queries
// rather than adding wall time.
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let brandCss: string | null = null
  try {
    const settings = await getSettings(await createClient())
    const css = buildThemeCss(overridesFromSettings(settings))
    if (css) brandCss = css
  } catch {
    // No settings row / transient failure — fall back to the defaults.
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Custom theme colors: override the CSS variables app-wide. Rendered
          server-side (no flash); the Appearance form updates this same
          element by id after saving, so changes stick across the session. */}
      {brandCss && <style id="nayora-theme" dangerouslySetInnerHTML={{ __html: brandCss }} />}

      {/* Sidebar (desktop) */}
      <AppNav />

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      {/* Release-notes popup (once per version) + reload-to-update prompt */}
      <WhatsNew />
      <UpdatePrompt />
    </div>
  )
}
