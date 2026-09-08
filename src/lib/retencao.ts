import { randomBytes } from 'node:crypto'

export const POLITICA_RETENCAO_VERSAO = '2026-09'
export const MESES_RETENCAO_SEGURANCA = 6
export const MESES_RETENCAO_TOMBSTONE = 6
export const MESES_RETENCAO_AUDITORIA_SISTEMA = 12
export const ANOS_RETENCAO_COMPROVANTE_EXCLUSAO = 5

export function adicionarAnosUtc(data: Date, anos: number) {
  const resultado = new Date(data)
  resultado.setUTCFullYear(resultado.getUTCFullYear() + anos)
  return resultado
}

export function subtrairMesesUtc(data: Date, meses: number) {
  const resultado = new Date(data)
  resultado.setUTCMonth(resultado.getUTCMonth() - meses)
  return resultado
}

export function subtrairAnosUtc(data: Date, anos: number) {
  return adicionarAnosUtc(data, -anos)
}

export function gerarProtocoloExclusao(data = new Date()) {
  const competencia = `${data.getUTCFullYear()}${String(data.getUTCMonth() + 1).padStart(2, '0')}`
  return `EXC-${competencia}-${randomBytes(4).toString('hex').toUpperCase()}`
}
