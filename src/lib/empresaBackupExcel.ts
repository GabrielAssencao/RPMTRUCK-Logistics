import 'server-only'

import ExcelJS from 'exceljs'

type LinhaBackup = Record<string, unknown>

export interface SecaoBackupEmpresa {
  nome: string
  linhas: LinhaBackup[]
}

function valorCelula(valor: unknown): string | number | boolean | Date | null {
  if (valor === null || valor === undefined) return null
  if (valor instanceof Date) return valor
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') return valor
  if (typeof valor === 'bigint') return valor.toString()
  if (typeof valor === 'object' && 'toNumber' in valor && typeof valor.toNumber === 'function') {
    return valor.toNumber()
  }
  return JSON.stringify(valor)
}

function nomePlanilha(nome: string, usados: Set<string>) {
  const base = nome.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31) || 'Dados'
  let candidato = base
  let sufixo = 2
  while (usados.has(candidato)) {
    candidato = `${base.slice(0, 27)} ${sufixo}`
    sufixo += 1
  }
  usados.add(candidato)
  return candidato
}

export async function gerarBackupEmpresaExcel(secoes: SecaoBackupEmpresa[]) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RPMTRUCK'
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.calcProperties.fullCalcOnLoad = true

  const usados = new Set<string>()
  for (const secao of secoes) {
    const planilha = workbook.addWorksheet(nomePlanilha(secao.nome, usados), {
      views: [{ state: 'frozen', ySplit: 1 }],
    })
    const chaves = Array.from(new Set(secao.linhas.flatMap((linha) => Object.keys(linha))))
    if (chaves.length === 0) {
      planilha.addRow(['Sem registros'])
      continue
    }

    planilha.columns = chaves.map((chave) => ({ header: chave, key: chave, width: Math.min(36, Math.max(14, chave.length + 2)) }))
    for (const linha of secao.linhas) {
      planilha.addRow(Object.fromEntries(chaves.map((chave) => [chave, valorCelula(linha[chave])])))
    }
    planilha.getRow(1).font = { bold: true, color: { argb: 'FF050505' } }
    planilha.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22C55E' } }
    planilha.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: chaves.length } }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
