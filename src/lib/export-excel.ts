import type { ExportColumn, Settings } from '@/lib/supabase/types'
import type { OrderWithDetails } from '@/lib/order-helpers'
import { resolveColumnValue, isExportable } from '@/lib/export-helpers'

// Generates a fresh worksheet matching the configured column layout (no
// uploaded template to preserve cell-for-cell — see Settings → Excel Export).
// exceljs is dynamically imported so its ~250kB doesn't load on every visit
// to the Orders page — only when an export is actually triggered.
export async function buildCourierWorkbook(
  columns: ExportColumn[],
  orders: OrderWithDetails[],
  settings: Settings
): Promise<{ buffer: ArrayBuffer; exportedCount: number; skippedCount: number }> {
  const ExcelJS = (await import('exceljs')).default
  const exportable = orders.filter(isExportable)

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Courier Export')

  sheet.addRow(columns.map((c) => c.header_label)).font = { bold: true }

  for (const order of exportable) {
    sheet.addRow(columns.map((c) => resolveColumnValue(c, order, settings)))
  }

  columns.forEach((_, i) => {
    sheet.getColumn(i + 1).width = 18
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return { buffer, exportedCount: exportable.length, skippedCount: orders.length - exportable.length }
}

export function downloadWorkbook(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
