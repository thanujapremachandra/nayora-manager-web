import type { ProfitBreakdown, DateRange } from '@/lib/db/analytics'

// exceljs is dynamically imported so its ~250kB doesn't load on every visit
// to Home — only when an export is actually triggered (mirrors export-excel.ts).
export async function buildProfitWorkbook(data: ProfitBreakdown, range: DateRange): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Profit by product')

  sheet.addRow([`Profit & cost breakdown: ${range.from} to ${range.to}`])
  sheet.addRow([])
  sheet.addRow(['Product', 'Qty sold', 'Revenue', 'Cost', 'Profit', 'Margin %']).font = { bold: true }

  for (const row of data.byProduct) {
    sheet.addRow([
      row.productName,
      row.qty,
      row.revenue,
      row.cost,
      row.profit,
      row.marginPct === null ? '' : Number(row.marginPct.toFixed(1)),
    ])
  }

  sheet.addRow([])
  sheet.addRow(['Total', '', data.totalRevenue, data.totalCost, data.totalProfit]).font = { bold: true }

  sheet.getColumn(1).width = 28
  for (let i = 2; i <= 6; i++) sheet.getColumn(i).width = 14

  return workbook.xlsx.writeBuffer()
}
