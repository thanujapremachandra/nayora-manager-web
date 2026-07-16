import type { OrderWithDetails } from '@/lib/order-helpers'

// Headers are matched case-insensitively with spaces stripped, so "Receiver
// Name" and "ReceiverName" both resolve to the same column.
const REQUIRED_HEADERS = ['reference', 'receivername', 'receiveraddress', 'receivercontactno', 'amount'] as const
const COLUMN_KEYS: Record<string, string> = {
  trackingnumber: 'trackingNumber',
  reference: 'reference',
  packagedescription: 'packageDescription',
  receivername: 'receiverName',
  receiveraddress: 'receiverAddress',
  receivercity: 'receiverCity',
  receivercontactno: 'receiverContactNo',
  noofpcs: 'noOfPcs',
  kilo: 'kilo',
  gram: 'gram',
  amount: 'amount',
  exchange: 'exchange', // parsed but unused this version
  remark: 'remark',
  context: 'context',
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '')
}

export interface ImportedOrderRow {
  rowNumber: number // 1-based, matching the sheet's row number (for error messages)
  trackingNumber: string | null
  refId: string
  packageDescription: string | null
  customerName: string
  address: string
  city: string | null
  phone1: string
  noOfPcs: number | null
  weightGrams: number
  codAmount: number
  remarks: string | null
  context: string | null
  errors: string[]
}

export interface ParsedImport {
  rows: ImportedOrderRow[]
  missingColumns: string[]
}

// exceljs doesn't always hand back a plain string/number — formula cells
// come back as { formula, result }, rich-text cells as { richText: [...] },
// and hyperlink cells as { text, hyperlink }. Stringifying those directly
// (as the old code did) produces the literal text "[object Object]" — this
// unwraps down to the actual displayed value first.
function unwrapCellValue(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return value
  if (value instanceof Date) return value
  const obj = value as Record<string, unknown>
  if (Array.isArray(obj.richText)) {
    return (obj.richText as { text: string }[]).map((part) => part.text).join('')
  }
  if ('result' in obj) return unwrapCellValue(obj.result) // formula cell
  if ('text' in obj) return obj.text // hyperlink cell
  if ('error' in obj) return null // #REF!, #N/A, etc. — treat as empty
  return value
}

function cellText(value: unknown): string | null {
  const unwrapped = unwrapCellValue(value)
  if (unwrapped === null || unwrapped === undefined) return null
  const text = String(unwrapped).trim()
  return text === '' ? null : text
}

function cellNumber(value: unknown): number | null {
  const unwrapped = unwrapCellValue(value)
  if (unwrapped === null || unwrapped === undefined || unwrapped === '') return null
  const n = Number(unwrapped)
  return Number.isFinite(n) ? n : null
}

export async function parseImportWorkbook(file: File): Promise<ParsedImport> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())

  const sheet = workbook.worksheets[0]
  if (!sheet) return { rows: [], missingColumns: ['(no worksheet found in file)'] }

  const headerRow = sheet.getRow(1)
  const colIndexToKey = new Map<number, string>()
  headerRow.eachCell((cell, colNumber) => {
    const key = COLUMN_KEYS[normalizeHeader(String(cell.value ?? ''))]
    if (key) colIndexToKey.set(colNumber, key)
  })

  const foundKeys = new Set(colIndexToKey.values())
  const missingColumns = REQUIRED_HEADERS.filter((h) => !foundKeys.has(COLUMN_KEYS[h]))
  if (missingColumns.length > 0) return { rows: [], missingColumns }

  const rows: ImportedOrderRow[] = []
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    if (row.cellCount === 0) continue

    const raw: Record<string, unknown> = {}
    colIndexToKey.forEach((key, colNumber) => {
      raw[key] = row.getCell(colNumber).value
    })

    // A fully blank row (common trailing-row artifact in exported sheets) —
    // skip silently rather than reporting it as an error.
    const isBlank = Object.values(raw).every((v) => cellText(v) === null)
    if (isBlank) continue

    const errors: string[] = []

    const refId = cellText(raw.reference)
    if (!refId) errors.push('Reference is required')

    const customerName = cellText(raw.receiverName)
    if (!customerName) errors.push('Receiver Name is required')

    const address = cellText(raw.receiverAddress)
    if (!address) errors.push('ReceiverAddress is required')

    const phone1 = cellText(raw.receiverContactNo)
    if (!phone1) errors.push('ReceiverContactNo is required')

    const codAmount = cellNumber(raw.amount)
    if (codAmount === null || codAmount < 0) errors.push('Amount must be a valid non-negative number')

    let weightGrams = 0
    const kiloRaw = raw.kilo
    const gramRaw = raw.gram
    if (kiloRaw !== null && kiloRaw !== undefined && cellText(kiloRaw) !== null) {
      const kilo = cellNumber(kiloRaw)
      if (kilo === null || kilo < 0) errors.push('Kilo must be a valid non-negative number')
      else weightGrams += kilo * 1000
    }
    if (gramRaw !== null && gramRaw !== undefined && cellText(gramRaw) !== null) {
      const gram = cellNumber(gramRaw)
      if (gram === null || gram < 0) errors.push('Gram must be a valid non-negative number')
      else weightGrams += gram
    }

    let noOfPcs: number | null = null
    if (cellText(raw.noOfPcs) !== null) {
      noOfPcs = cellNumber(raw.noOfPcs)
      if (noOfPcs === null || noOfPcs < 0) errors.push('NoOfPcs must be a valid non-negative number')
    }

    rows.push({
      rowNumber: r,
      trackingNumber: cellText(raw.trackingNumber),
      refId: refId ?? '',
      packageDescription: cellText(raw.packageDescription),
      customerName: customerName ?? '',
      address: address ?? '',
      city: cellText(raw.receiverCity),
      phone1: phone1 ?? '',
      noOfPcs,
      weightGrams,
      codAmount: codAmount ?? 0,
      remarks: cellText(raw.remark),
      context: cellText(raw.context),
      errors,
    })
  }

  return { rows, missingColumns: [] }
}

// In-memory only — this never touches Supabase. id/session_id are
// fabricated purely so the slip renderer (which expects an OrderWithDetails
// shape) has something to key off of. `backText` is read by PlacementSlipView
// to print the sheet's "Context" column on the back instead of an item list
// (imported rows never have real order_items to list).
export function importRowToOrder(row: ImportedOrderRow): OrderWithDetails & { backText?: string } {
  const now = new Date().toISOString()
  return {
    id: `import-${row.rowNumber}`,
    ref_id: row.refId,
    session_id: 'imported',
    customer_name: row.customerName,
    address: row.address, // city is intentionally excluded — review-table only, never printed
    phone1: row.phone1,
    phone2: null,
    payment_type: 'cod',
    order_discount: null,
    weight_grams: row.weightGrams,
    status: 'pending',
    freeze_stock_mode: null,
    remarks: row.remarks,
    cod_amount_override: row.codAmount,
    courier_charge_override: null,
    is_exchange: false,
    dispatched_via_session_complete_at: null,
    package_description: row.packageDescription,
    items_text: null,
    items_amount: null,
    legacy_mode: false,
    exchange_keep_courier_override: null,
    bank_collect_override: null,
    auto_weight_override: null,
    exchange_source_order_id: null,
    created_at: now,
    updated_at: now,
    backText: row.context ?? undefined,
    order_items: [],
    order_tracking: [],
  }
}
