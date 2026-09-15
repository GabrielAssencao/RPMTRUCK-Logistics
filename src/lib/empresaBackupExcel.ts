import 'server-only'

import ExcelJS from 'exceljs'
import { EXCEL_MONEY, formatarTabelaExcel, fracionarTextoExcel } from '@/lib/excelFormatting'

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
  const base = nome.replace(/[\\/*?:[\]]/g, ' ').trim().replace(/^'+|'+$/g, '').slice(0, 31) || 'Dados'
  let candidato = base
  let sufixo = 2
  while (usados.has(candidato.toLowerCase())) {
    candidato = `${base.slice(0, 27)} ${sufixo}`
    sufixo += 1
  }
  usados.add(candidato.toLowerCase())
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
    const originais = new Set(secao.linhas.flatMap(linha => Object.keys(linha)))
    const continuacoes = new Map<string, string>()
    const linhas: LinhaBackup[] = secao.linhas.map(linha => Object.fromEntries(Object.entries(linha).flatMap<[string, ReturnType<typeof valorCelula>]>(([key, raw]) => {
      const value = valorCelula(raw)
      if (typeof value !== 'string') return [[key, value]]
      return fracionarTextoExcel(value).map<[string, ReturnType<typeof valorCelula>]>((part, index) => {
        if (!index) return [key, part]
        const token = `${key}|${index}`
        let name = continuacoes.get(token)
        if (!name) { name = `${key}__parte_${index + 1}`; while (originais.has(name)) name += '_'; originais.add(name); continuacoes.set(token, name) }
        return [name, part]
      })
    })))
    const chaves = Array.from(new Set(linhas.flatMap((linha) => Object.keys(linha))))
    if (chaves.length === 0) {
      planilha.addRow(['Sem registros'])
      continue
    }

    planilha.columns = chaves.map((chave) => ({ header: chave, key: chave, width: Math.min(36, Math.max(14, chave.length + 2)) }))
    for (const linha of linhas) {
      planilha.addRow(Object.fromEntries(chaves.map((chave) => [chave, valorCelula(linha[chave])])))
    }
    for (const chave of chaves) {
      const column = planilha.getColumn(chave)
      const longest = Math.max(chave.length, ...linhas.slice(0, 200).map(row => {
        const value = valorCelula(row[chave])
        if (value instanceof Date) return 20
        if (typeof value === 'number') return String(value).length + 8
        return String(value ?? '').split(/\r?\n/).reduce((max, line) => Math.max(max, line.length), 0)
      }))
      column.width = Math.min(64, Math.max(16, longest + 3))
      if (/^(valor|custo|frete|comissao|mensalidade|total_pago_historico)$/.test(chave)) column.numFmt = EXCEL_MONEY
      if (/^(cpf|cnpj|cnh|rg|placa|renavam|codigo|linha_digitavel|telefone)$/.test(chave)) column.numFmt = '@'
    }
    formatarTabelaExcel(planilha)
  }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
