import ExcelJS from 'exceljs'

export const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const EXCEL_MONEY = '"R$" #,##0.00'
export const EXCEL_DATE = 'dd/mm/yyyy'

export function fracionarTextoExcel(text: string, maxLength = 750, maxNewlines = 10) {
  const parts: string[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(text.length, start + maxLength), newlines = 0
    for (let i = start; i < end; i++) if (text[i] === '\n' && ++newlines > maxNewlines) { end = i; break }
    parts.push(text.slice(start, end)); start = end
  }
  return parts.length ? parts : ['']
}

// Excel caps row height at 409 points. Keep unusually long report content in
// readable continuation rows instead of silently clipping it in the main table.
export function preservarTextosExtensosExcel(book: ExcelJS.Workbook) {
  const details: Array<[string, string, number, string]> = []
  for (const sheet of book.worksheets) sheet.eachRow(row => {
    row.eachCell(cell => {
      if (typeof cell.value !== 'string' || cell.type === ExcelJS.ValueType.Merge) return
      const width = Number(sheet.getColumn(cell.col).width ?? 14)
      const estimated = cell.value.split(/\r?\n/).reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / Math.max(8, width - 3))), 0)
      if (estimated <= 23) return
      const text = cell.value
      fracionarTextoExcel(text).forEach((part, index) => details.push([sheet.name, cell.address, index + 1, part]))
      cell.value = `${text.slice(0, Math.min(600, Math.max(100, (width - 3) * 15)))}\n[Texto completo na aba Textos completos: ${sheet.name}, ${cell.address}]`
      cell.alignment = { ...cell.alignment, wrapText: true }
      ajustarAlturaExcel(row, sheet)
    })
  })
  if (!details.length) return
  const sheet = book.addWorksheet('Textos completos')
  sheet.columns = [{ header: 'ABA DE ORIGEM', width: 28 }, { header: 'CÉLULA', width: 16 }, { header: 'PARTE', width: 12 }, { header: 'TEXTO COMPLETO (LEIA AS PARTES EM ORDEM)', width: 80 }]
  details.forEach(row => sheet.addRow(row))
  formatarTabelaExcel(sheet)
}

// Excel does not reliably auto-fit wrapped or merged cells when opening XLSX.
export function ajustarAlturaExcel(row: ExcelJS.Row, sheet: ExcelJS.Worksheet, minimum = 24) {
  let lines = 1
  row.eachCell(cell => {
    if (cell.type === ExcelJS.ValueType.Merge) return
    let width = Number(sheet.getColumn(cell.col).width ?? 14)
    for (const range of sheet.model.merges ?? []) {
      const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range)
      if (!match) continue
      if (sheet.getCell(`${match[1]}${match[2]}`).address !== cell.address || match[2] !== match[4]) continue
      width = 0
      for (let col = Number(sheet.getCell(`${match[1]}1`).col); col <= Number(sheet.getCell(`${match[3]}1`).col); col++) width += Number(sheet.getColumn(col).width ?? 14)
    }
    const count = cell.text.split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / Math.max(8, width - 3))), 0)
    lines = Math.max(lines, count)
  })
  row.height = Math.min(409, Math.max(minimum, lines * 16 + 8))
}

export function formatarTabelaExcel(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }]
  sheet.properties.defaultRowHeight = 24
  sheet.getRow(1).height = 32
  sheet.getRow(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18232F' } }
  sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount } }
  sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1', printArea: `A1:${sheet.getColumn(sheet.columnCount).letter}${Math.max(1, sheet.rowCount)}` }
  sheet.headerFooter.oddFooter = '&LRPMTruck&CPage &P / &N'
  sheet.eachRow((row, index) => {
    if (index === 1) return
    row.font = { name: 'Calibri', size: 11 }
    row.eachCell(cell => {
      cell.alignment = { vertical: 'top', wrapText: true, horizontal: typeof cell.value === 'number' ? 'right' : 'left' }
      if (typeof cell.value === 'string') cell.numFmt = '@'
      if (cell.value instanceof Date) cell.numFmt = EXCEL_DATE
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 ? 'FFFFFFFF' : 'FFF1F5F9' } }
    })
    ajustarAlturaExcel(row, sheet)
  })
  ajustarAlturaExcel(sheet.getRow(1), sheet, 32)
}
