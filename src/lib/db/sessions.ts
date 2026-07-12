import type { TypedClient } from '@/lib/supabase/client'
import type { Session } from '@/lib/supabase/types'

export async function listSessions(client: TypedClient): Promise<Session[]> {
  // `id` tiebreaker — see analytics.ts's getSessionTrend for why ties on
  // created_at alone aren't safe to leave unresolved.
  const { data, error } = await client
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw new Error(`Failed to load sessions: ${error.message}`)
  return data
}

export async function getSession(client: TypedClient, id: string): Promise<Session> {
  const { data, error } = await client.from('sessions').select('*').eq('id', id).single()
  if (error) throw new Error(`Failed to load session: ${error.message}`)
  return data
}

export async function createSession(client: TypedClient, name: string): Promise<Session> {
  const { data, error } = await client.from('sessions').insert({ name }).select().single()
  if (error) throw new Error(`Failed to create session: ${error.message}`)
  return data
}

export async function deleteSession(client: TypedClient, id: string): Promise<void> {
  const { error } = await client.from('sessions').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete session: ${error.message}`)
}

export interface SessionCounts {
  total: number
  pending: number
  frozen: number
}

// One lightweight query (no nested items) to power the sessions list view —
// avoids fetching full order details for every session just to show counts.
export async function listSessionOrderCounts(client: TypedClient): Promise<Map<string, SessionCounts>> {
  const { data, error } = await client.from('orders').select('session_id, status')
  if (error) throw new Error(`Failed to load order counts: ${error.message}`)

  const counts = new Map<string, SessionCounts>()
  for (const row of data) {
    const entry = counts.get(row.session_id) ?? { total: 0, pending: 0, frozen: 0 }
    entry.total += 1
    if (row.status === 'pending') entry.pending += 1
    if (row.status === 'frozen') entry.frozen += 1
    counts.set(row.session_id, entry)
  }
  return counts
}

