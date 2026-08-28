import type { PlanoTipo } from '@prisma/client'

export const CONTAS_PAGAR_BUCKET = 'contas-pagar'
export const CONTA_PAGAR_MAX_FILE_BYTES = 5 * 1024 * 1024

export const CAPACIDADES_CONTAS_PAGAR: Record<PlanoTipo, {
  leituraAutomatica: boolean
  alertasVisuais: boolean
  copiarEAbrirPortal: boolean
  exportacaoLote: boolean
}> = {
  PREVIEW: { leituraAutomatica: true, alertasVisuais: true, copiarEAbrirPortal: true, exportacaoLote: true },
  ESSENCIAL: { leituraAutomatica: false, alertasVisuais: false, copiarEAbrirPortal: false, exportacaoLote: false },
  AVANCADO: { leituraAutomatica: true, alertasVisuais: true, copiarEAbrirPortal: true, exportacaoLote: false },
  ENTERPRISE: { leituraAutomatica: true, alertasVisuais: true, copiarEAbrirPortal: true, exportacaoLote: true },
}

export function somenteDigitosBoleto(valor: string | null | undefined) {
  return (valor ?? '').replace(/\D/g, '').slice(0, 48)
}

function modulo10(campo: string) {
  let soma = 0
  let peso = 2
  for (let indice = campo.length - 1; indice >= 0; indice -= 1) {
    const produto = Number(campo[indice]) * peso
    soma += produto > 9 ? Math.floor(produto / 10) + (produto % 10) : produto
    peso = peso === 2 ? 1 : 2
  }
  return (10 - (soma % 10)) % 10
}

/** Valida os três DVs de campo da linha bancária. O banco ainda deve conferir os dados finais. */
export function linhaDigitavelValida(valor: string | null | undefined) {
  const linha = somenteDigitosBoleto(valor)
  if (linha.length === 47) {
    return modulo10(linha.slice(0, 9)) === Number(linha[9])
      && modulo10(linha.slice(10, 20)) === Number(linha[20])
      && modulo10(linha.slice(21, 31)) === Number(linha[31])
  }
  // Convênios/arrecadação usam 48 posições e regras de DV dependentes do segmento.
  // Mantemos apenas a validação estrutural e exigimos revisão humana antes de copiar.
  return linha.length === 48 && linha.startsWith('8')
}

export function formatarLinhaDigitavel(valor: string | null | undefined) {
  const linha = somenteDigitosBoleto(valor)
  if (linha.length === 47) {
    return `${linha.slice(0, 5)}.${linha.slice(5, 10)} ${linha.slice(10, 15)}.${linha.slice(15, 21)} ${linha.slice(21, 26)}.${linha.slice(26, 32)} ${linha[32]} ${linha.slice(33)}`
  }
  if (linha.length === 48) return linha.match(/.{1,12}/g)?.join(' ') ?? linha
  return linha
}

export type NivelVencimento = 'VERDE' | 'AMARELO' | 'VERMELHO'

export function diasAteVencimento(vencimento: Date, agora = new Date()) {
  const hojeUtc = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const vencimentoUtc = Date.UTC(vencimento.getUTCFullYear(), vencimento.getUTCMonth(), vencimento.getUTCDate())
  return Math.round((vencimentoUtc - hojeUtc) / 86_400_000)
}

export function nivelVencimento(vencimento: Date, agora = new Date()): NivelVencimento {
  const dias = diasAteVencimento(vencimento, agora)
  if (dias <= 0) return 'VERMELHO'
  if (dias <= 4) return 'AMARELO'
  return 'VERDE'
}

export function normalizarPortalFinanceiroUrl(valor: string | null | undefined) {
  const texto = valor?.trim()
  if (!texto) return null
  let url: URL
  try {
    url = new URL(texto)
  } catch {
    throw new Error('PORTAL_INSEGURO')
  }
  if (url.protocol !== 'https:') throw new Error('PORTAL_INSEGURO')
  url.username = ''
  url.password = ''
  url.hash = ''
  return url.toString()
}
