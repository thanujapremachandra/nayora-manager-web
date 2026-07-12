import type { TypedClient } from '@/lib/supabase/client'

export function lowStockAlertKey(variantId: string): string {
  return `low_stock:${variantId}`
}

export async function listDismissedAlertKeys(client: TypedClient): Promise<Set<string>> {
  const { data, error } = await client.from('dismissed_alerts').select('alert_key')
  if (error) throw new Error(`Failed to load dismissed alerts: ${error.message}`)
  return new Set(data.map((row) => row.alert_key))
}

export async function isAlertDismissed(client: TypedClient, alertKey: string): Promise<boolean> {
  const { data, error } = await client
    .from('dismissed_alerts')
    .select('alert_key')
    .eq('alert_key', alertKey)
    .maybeSingle()
  if (error) throw new Error(`Failed to check alert: ${error.message}`)
  return data !== null
}

export async function dismissAlert(client: TypedClient, alertKey: string): Promise<void> {
  const { error } = await client
    .from('dismissed_alerts')
    .upsert({ alert_key: alertKey }, { onConflict: 'alert_key' })
  if (error) throw new Error(`Failed to dismiss alert: ${error.message}`)
}

// Called after a restock so a warning that was dismissed while out of stock
// can re-arm if the variant drops low again later.
export async function rearmAlert(client: TypedClient, alertKey: string): Promise<void> {
  const { error } = await client.from('dismissed_alerts').delete().eq('alert_key', alertKey)
  if (error) throw new Error(`Failed to re-arm alert: ${error.message}`)
}
