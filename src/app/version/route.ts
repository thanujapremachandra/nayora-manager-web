import { NextResponse } from 'next/server'
import { APP_VERSION } from '@/lib/changelog'

// Reports the version of the currently deployed build. The client polls this
// and, when it differs from the APP_VERSION baked into the running bundle,
// shows the "reload to update" prompt. Must never be cached.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { version: APP_VERSION },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
