import { AppNav } from '@/components/nav'
import { WhatsNew } from '@/components/whats-new'
import { UpdatePrompt } from '@/components/update-prompt'

// Auth is enforced in middleware.ts (it redirects unauthenticated requests to
// /login before this layout ever renders), so there's no getUser() here — that
// would be a second, redundant cross-region round-trip to Supabase auth on
// every navigation.
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
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
