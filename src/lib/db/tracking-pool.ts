import type { TypedClient } from '@/lib/supabase/client'
import { addTracking } from '@/lib/db/orders'

export interface PoolStats {
  available: number
  assigned: number
  frozen: number
  total: number
}

export interface PoolListEntry {
  id: string
  trackingNumber: string
  status: 'available' | 'assigned' | 'frozen'
  orderId: string | null
  orderRef: string | null
}

export async function getPoolStats(client: TypedClient): Promise<PoolStats> {
  const [totalResult, availableResult, assignedIdsResult] = await Promise.all([
    client.from('tracking_pool').select('*', { count: 'exact', head: true }),
    client.from('tracking_pool').select('*', { count: 'exact', head: true }).is('order_id', null),
    client.from('tracking_pool').select('order_id').not('order_id', 'is', null),
  ])

  const total = totalResult.count ?? 0
  const available = availableResult.count ?? 0
  const assignedIds = (assignedIdsResult.data ?? []).map((e) => e.order_id as string)

  // "On hold" counts pool ENTRIES held by frozen orders, not frozen orders —
  // one frozen order can hold several numbers, and counting orders made the
  // badge undercount (and inflated "assigned" by the same amount).
  let frozen = 0
  if (assignedIds.length > 0) {
    const { data: frozenOrders } = await client
      .from('orders')
      .select('id')
      .in('id', assignedIds)
      .eq('status', 'frozen')
    const frozenSet = new Set((frozenOrders ?? []).map((o) => o.id))
    frozen = assignedIds.filter((id) => frozenSet.has(id)).length
  }

  return { total, available, assigned: total - available - frozen, frozen }
}

// Claim the next available pool entry (FIFO) for an order.
// Mirrors the number into order_tracking so the existing order display,
// search, and export all see it without any changes elsewhere.
// Returns the tracking number, or null if the pool is empty.
export async function claimNextFromPool(client: TypedClient, orderId: string): Promise<string | null> {
  const { data } = await client
    .from('tracking_pool')
    .select('id, tracking_number')
    .is('order_id', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!data) return null

  const { error } = await client
    .from('tracking_pool')
    .update({ order_id: orderId })
    .eq('id', data.id)
    .is('order_id', null) // guard: only claim if still available

  if (error) return null // concurrent claim — treat as pool empty

  await addTracking(client, orderId, data.tracking_number)

  return data.tracking_number
}

// Import an array of tracking number strings into the pool.
// Numbers already in the pool are skipped. Returns {added, skipped}.
export async function importTrackingNumbers(
  client: TypedClient,
  numbers: string[]
): Promise<{ added: number; skipped: number }> {
  if (numbers.length === 0) return { added: 0, skipped: 0 }

  const { data: existing } = await client
    .from('tracking_pool')
    .select('tracking_number')
    .in('tracking_number', numbers)

  const existingSet = new Set((existing ?? []).map((e) => e.tracking_number))
  const newNumbers = numbers.filter((n) => !existingSet.has(n))

  if (newNumbers.length > 0) {
    const { error } = await client
      .from('tracking_pool')
      .insert(newNumbers.map((n) => ({ tracking_number: n })))
    if (error) throw new Error(`Failed to import tracking numbers: ${error.message}`)
  }

  return { added: newNumbers.length, skipped: existingSet.size }
}

// Assign pool numbers to all non-frozen orders that have no tracking yet.
// Processes oldest orders first. Stops early if the pool is exhausted.
export async function backFillTracking(
  client: TypedClient
): Promise<{ assigned: number; poolExhausted: boolean }> {
  const [trackedResult, ordersResult] = await Promise.all([
    client.from('order_tracking').select('order_id'),
    client.from('orders').select('id').neq('status', 'frozen').order('created_at', { ascending: true }),
  ])

  const trackedIds = new Set((trackedResult.data ?? []).map((t) => t.order_id))
  const untracked = (ordersResult.data ?? []).filter((o) => !trackedIds.has(o.id))

  let assigned = 0
  let poolExhausted = false
  for (const order of untracked) {
    const result = await claimNextFromPool(client, order.id)
    if (result === null) {
      poolExhausted = true
      break
    }
    assigned++
  }

  return { assigned, poolExhausted }
}

// Full list for the popup — fetched fresh on each open.
export async function listPoolEntries(client: TypedClient): Promise<PoolListEntry[]> {
  const { data, error } = await client
    .from('tracking_pool')
    .select('id, tracking_number, order_id, created_at')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to load pool: ${error.message}`)

  const assignedIds = (data ?? []).filter((e) => e.order_id !== null).map((e) => e.order_id as string)
  const orderMap = new Map<string, { ref_id: string; status: string }>()

  if (assignedIds.length > 0) {
    const { data: orders } = await client.from('orders').select('id, ref_id, status').in('id', assignedIds)
    ;(orders ?? []).forEach((o) => orderMap.set(o.id, { ref_id: o.ref_id, status: o.status }))
  }

  return (data ?? []).map((e) => {
    if (e.order_id === null) {
      return { id: e.id, trackingNumber: e.tracking_number, status: 'available' as const, orderId: null, orderRef: null }
    }
    const order = orderMap.get(e.order_id)
    return {
      id: e.id,
      trackingNumber: e.tracking_number,
      status: order?.status === 'frozen' ? ('frozen' as const) : ('assigned' as const),
      orderId: e.order_id,
      orderRef: order?.ref_id ?? null,
    }
  })
}

// Remove pool entries by id. Deleting an entry that's already assigned to an
// order only drops the pool record — the order keeps its number in
// order_tracking (the pool is just the reservation ledger). Returns how many
// rows were removed.
export async function deletePoolEntries(client: TypedClient, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const { error, count } = await client
    .from('tracking_pool')
    .delete({ count: 'exact' })
    .in('id', ids)
  if (error) throw new Error(`Failed to delete tracking numbers: ${error.message}`)
  return count ?? 0
}

// Resolves exceljs cell value shapes to plain primitives.
// Formula cells come back as { formula, result }, rich-text as
// { richText: [{text}...] }, hyperlinks as { text, hyperlink }.
function unwrapCellValue(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return value
  if (value instanceof Date) return value
  const obj = value as Record<string, unknown>
  if (Array.isArray(obj.richText)) {
    return (obj.richText as { text: string }[]).map((part) => part.text).join('')
  }
  if ('result' in obj) return unwrapCellValue(obj.result)
  if ('text' in obj) return obj.text
  if ('error' in obj) return null
  return value
}

// Parse a .xlsx file and return all non-empty values from the "TrackingNumber"
// column. Ignores every other column.
export async function parseTrackingExcel(file: File): Promise<string[]> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())

  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  let trackingCol = -1
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const header = String(cell.value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
    if (header === 'trackingnumber') trackingCol = colNumber
  })

  if (trackingCol === -1) return []

  const numbers: string[] = []
  for (let r = 2; r <= sheet.rowCount; r++) {
    const raw = sheet.getRow(r).getCell(trackingCol).value
    const unwrapped = unwrapCellValue(raw)
    if (unwrapped !== null && unwrapped !== undefined) {
      const text = String(unwrapped).trim()
      if (text) numbers.push(text)
    }
  }

  return numbers
}
