import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

// The @supabase/ssr factory passes the schema object as SchemaName (position 3)
// instead of SchemaName = 'public', causing Schema to resolve to never.
// We retype the return explicitly so SupabaseClient gets correct 4-arg form:
//   SupabaseClient<Database, 'public', 'public', Database['public']>
export type TypedClient = SupabaseClient<Database, 'public', 'public', Database['public']>

export function createClient(): TypedClient {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as unknown as TypedClient
}
