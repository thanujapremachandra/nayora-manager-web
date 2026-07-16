import { AppNav } from '@/components/nav'
import { WhatsNew } from '@/components/whats-new'
import { UpdatePrompt } from '@/components/update-prompt'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/db/settings'
import { buildThemeCss } from '@/lib/brand-color'

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
    const css = buildThemeCss({
      brand: settings.brand_color,
      cardLight: settings.card_color_light,
      cardDark: settings.card_color_dark,
      bgLight: settings.bg_color_light,
      bgDark: settings.bg_color_dark,
    })
    if (css) brandCss = css
  } catch {
    // No settings row / transient failure — fall back to the defaults.
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Custom primary color: overrides the brand CSS variables app-wide.
          Rendered server-side, so there's no color flash. */}
      {brandCss && <style dangerouslySetInnerHTML={{ __html: brandCss }} />}

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
