import type { TypedClient } from '@/lib/supabase/client'
import type { Database, ExportColumn } from '@/lib/supabase/types'

export async function listExportColumns(client: TypedClient): Promise<ExportColumn[]> {
  const { data, error } = await client.from('export_columns').select('*').order('position', { ascending: true })
  if (error) throw new Error(`Failed to load export columns: ${error.message}`)
  return data
}

export async function createExportColumn(
  client: TypedClient,
  input: Database['public']['Tables']['export_columns']['Insert']
): Promise<ExportColumn> {
  const { data, error } = await client.from('export_columns').insert(input).select().single()
  if (error) throw new Error(`Failed to add column: ${error.message}`)
  return data
}

export async function updateExportColumn(
  client: TypedClient,
  id: string,
  patch: Database['public']['Tables']['export_columns']['Update']
): Promise<ExportColumn> {
  const { data, error } = await client.from('export_columns').update(patch).eq('id', id).select().single()
  if (error) throw new Error(`Failed to update column: ${error.message}`)
  return data
}

export async function deleteExportColumn(client: TypedClient, id: string): Promise<void> {
  const { error } = await client.from('export_columns').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete column: ${error.message}`)
}
