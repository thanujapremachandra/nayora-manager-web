import type { TypedClient } from '@/lib/supabase/client'
import type { Database, Settings } from '@/lib/supabase/types'

export async function getSettings(client: TypedClient): Promise<Settings> {
  const { data, error } = await client
    .from('settings')
    .select('*')
    .single()

  if (error) throw new Error(`Failed to load settings: ${error.message}`)
  return data
}

export async function updateSettings(
  client: TypedClient,
  id: string,
  patch: Database['public']['Tables']['settings']['Update']
): Promise<Settings> {
  const { data, error } = await client
    .from('settings')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update settings: ${error.message}`)
  return data
}
