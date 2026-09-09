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

export type TipoCodigoBoleto =
  | 'CODIGO_BARRAS_BANCARIO'
  | 'LINHA_DIGITAVEL_BANCARIA'
  | 'CODIGO_BARRAS_ARRECADACAO'
  | 'LINHA_DIGITAVEL_ARRECADACAO'
  | 'DESCONHECIDO'

export function identificarCodigoBoleto(valor: string | null | undefined) {
  const codigo = (valor ?? '').replace(/\D/g, '')
  let tipo: TipoCodigoBoleto = 'DESCONHECIDO'
  if (codigo.length === 44) tipo = codigo.startsWith('8') ? 'CODIGO_BARRAS_ARRECADACAO' : 'CODIGO_BARRAS_BANCARIO'
  else if (codigo.length === 47 && !codigo.startsWith('8')) tipo = 'LINHA_DIGITAVEL_BANCARIA'
  else if (codigo.length === 48 && codigo.startsWith('8')) tipo = 'LINHA_DIGITAVEL_ARRECADACAO'

  return {
    codigo,
    tipo,
    valido: tipo !== 'DESCONHECIDO' && linhaDigitavelValida(codigo),
    descricao: tipo === 'CODIGO_BARRAS_ARRECADACAO'
      ? 'Código de barras de conta de consumo/arrecadação: 44 dígitos. A linha digitável impressa correspondente possui 48.'
      : tipo === 'CODIGO_BARRAS_BANCARIO'
        ? 'Código de barras de boleto bancário: 44 dígitos. A linha digitável impressa correspondente possui 47.'
        : tipo === 'LINHA_DIGITAVEL_ARRECADACAO'
          ? 'Linha digitável de conta de consumo/arrecadação: 48 dígitos.'
          : tipo === 'LINHA_DIGITAVEL_BANCARIA'
            ? 'Linha digitável de boleto bancário: 47 dígitos.'
            : 'Código não reconhecido como boleto bancário ou conta de arrecadação.',
  }
}

export function linhaDigitavelEstruturalmenteValida(valor: string | null | undefined) {
  const linha = somenteDigitosBoleto(valor)
  return linha.length === 44 || linha.length === 47 || (linha.length === 48 && linha.startsWith('8'))
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

function modulo11Arrecadacao(campo: string) {
  let soma = 0
  let peso = 2
  for (let indice = campo.length - 1; indice >= 0; indice -= 1) {
    soma += Number(campo[indice]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  if (resto === 0 || resto === 1) return 0
  if (resto === 10) return 1
  return 11 - resto
}

function digitoArrecadacao(campo: string, identificador: string) {
  if (identificador === '6' || identificador === '7') return modulo10(campo)
  if (identificador === '8' || identificador === '9') return modulo11Arrecadacao(campo)
  return null
}

function codigoBarrasArrecadacaoDaLinha(linha: string) {
  return [0, 12, 24, 36].map((inicio) => linha.slice(inicio, inicio + 11)).join('')
}

export function codigoBarrasDoBoleto(valor: string | null | undefined) {
  const linha = somenteDigitosBoleto(valor)
  if (linha.length === 47) {
    return `${linha.slice(0, 4)}${linha[32]}${linha.slice(33)}${linha.slice(4, 9)}${linha.slice(10, 20)}${linha.slice(21, 31)}`
  }
  if (linha.length === 48 && linha.startsWith('8')) return codigoBarrasArrecadacaoDaLinha(linha)
  return linha.length === 44 ? linha : ''
}

/** Converte os 44 dígitos codificados nas barras para a representação digitável oficial. */
export function linhaDigitavelDoCodigoBarras(valor: string | null | undefined) {
  const codigo = somenteDigitosBoleto(valor)
  if (codigo.length !== 44) return codigo

  if (codigo.startsWith('8')) {
    const identificador = codigo[2]
    const blocos = [0, 11, 22, 33].map((inicio) => codigo.slice(inicio, inicio + 11))
    const linha = blocos.map((bloco) => {
      const digito = digitoArrecadacao(bloco, identificador)
      return digito === null ? bloco : `${bloco}${digito}`
    }).join('')
    return linha.length === 48 ? linha : codigo
  }

  const campo1 = `${codigo.slice(0, 4)}${codigo.slice(19, 24)}`
  const campo2 = codigo.slice(24, 34)
  const campo3 = codigo.slice(34, 44)
  return `${campo1}${modulo10(campo1)}${campo2}${modulo10(campo2)}${campo3}${modulo10(campo3)}${codigo[4]}${codigo.slice(5, 19)}`
}

/** Valida os três DVs de campo da linha bancária. O banco ainda deve conferir os dados finais. */
export function linhaDigitavelValida(valor: string | null | undefined): boolean {
  const linha = somenteDigitosBoleto(valor)
  if (linha.length === 47) {
    return modulo10(linha.slice(0, 9)) === Number(linha[9])
      && modulo10(linha.slice(10, 20)) === Number(linha[20])
      && modulo10(linha.slice(21, 31)) === Number(linha[31])
  }
  if (linha.length === 44) {
    if (!linha.startsWith('8')) return /^\d{44}$/.test(linha)
    const digitoGeral = digitoArrecadacao(`${linha.slice(0, 3)}${linha.slice(4)}`, linha[2])
    return digitoGeral !== null && digitoGeral === Number(linha[3])
  }
  if (linha.length !== 48 || !linha.startsWith('8')) return false
  const identificador = linha[2]
  const blocosValidos = [0, 12, 24, 36].every((inicio) => {
    const bloco = linha.slice(inicio, inicio + 11)
    const digito = digitoArrecadacao(bloco, identificador)
    return digito !== null && digito === Number(linha[inicio + 11])
  })
  return blocosValidos && linhaDigitavelValida(codigoBarrasArrecadacaoDaLinha(linha))
}

export function formatarLinhaDigitavel(valor: string | null | undefined) {
  const linha = somenteDigitosBoleto(valor)
  if (linha.length === 47) {
    return `${linha.slice(0, 5)}.${linha.slice(5, 10)} ${linha.slice(10, 15)}.${linha.slice(15, 21)} ${linha.slice(21, 26)}.${linha.slice(26, 32)} ${linha[32]} ${linha.slice(33)}`
  }
  if (linha.length === 48) return linha.match(/.{1,12}/g)?.join(' ') ?? linha
  if (linha.length === 44) return linha.match(/.{1,11}/g)?.join(' ') ?? linha
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
