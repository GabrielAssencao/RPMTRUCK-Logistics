import type { PlanoTipo, StatusEmpresa } from '@prisma/client'

export const SITUACOES_FINANCEIRAS = {
  PREVIEW: 'Em teste (Preview)',
  AGUARDANDO_PAGAMENTO_INICIAL: 'Aguardando primeiro pagamento',
  PAGAMENTO_INICIAL_VENCIDO: 'Primeiro pagamento vencido — não ingressou',
  REGULAR: 'Regular',
  INADIMPLENTE: 'Inadimplente',
  SUSPENSA: 'Suspensa pelo administrador',
} as const

export const PRAZO_PAGAMENTO_INICIAL_MS = 3 * 24 * 60 * 60 * 1000

export function podeRegularizarFinanceiro(role: string, situacao: string | undefined) {
  return (role === 'GESTOR_EMPRESA' || role === 'GESTOR')
    && (situacao === 'INADIMPLENTE' || situacao === 'PAGAMENTO_INICIAL_VENCIDO')
}

export function competenciaBrasil(agora: Date) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric' }).formatToParts(agora)
  return { ano: Number(partes.find(parte => parte.type === 'year')!.value), mes: Number(partes.find(parte => parte.type === 'month')!.value) }
}

/** Instante do bloqueio: meia-noite de Brasília depois do dia contratado. */
export function limiteVencimentoMensal(ano: number, mes: number, dia: number) {
  if (dia !== 5 && dia !== 28) throw new Error('DIA_VENCIMENTO_INVALIDO')
  return new Date(Date.UTC(ano, mes - 1, dia + 1, 3))
}

interface EstadoFinanceiro {
  plano: PlanoTipo
  status: StatusEmpresa
  pagamentoInicialVenceEm: Date | null
  primeiraMensalidadePagaEm: Date | null
  faturas: readonly { vencimento: Date | null }[] // Somente pendentes de valor positivo.
}

/** Classificação independente do bloqueio manual; pagar não reativa uma suspensão administrativa. */
export function avaliarSituacaoFinanceira(empresa: EstadoFinanceiro, agora = new Date()) {
  const temPendente = empresa.faturas.length > 0
  const primeiraPaga = empresa.primeiraMensalidadePagaEm !== null
  const vencida = empresa.faturas.some(fatura => {
    const vencimento = fatura.vencimento ?? (!primeiraPaga ? empresa.pagamentoInicialVenceEm : null)
    return vencimento !== null && vencimento <= agora
  })
  let situacao: keyof typeof SITUACOES_FINANCEIRAS = empresa.plano === 'PREVIEW' ? 'PREVIEW'
    : vencida ? (primeiraPaga ? 'INADIMPLENTE' : 'PAGAMENTO_INICIAL_VENCIDO')
      : temPendente && !primeiraPaga ? 'AGUARDANDO_PAGAMENTO_INICIAL' : 'REGULAR'
  if (empresa.status === 'INATIVO') situacao = 'SUSPENSA'
  else if (empresa.status === 'INADIMPLENTE' && empresa.plano !== 'PREVIEW') situacao = primeiraPaga ? 'INADIMPLENTE' : 'PAGAMENTO_INICIAL_VENCIDO'
  const bloqueado = empresa.status !== 'ATIVO' || (empresa.plano !== 'PREVIEW' && vencida)
  const mensagem = situacao === 'PAGAMENTO_INICIAL_VENCIDO'
    ? 'O prazo do primeiro pagamento terminou. Regularize a mensalidade e a implantação com o suporte para ingressar no plano.'
    : situacao === 'INADIMPLENTE' ? 'Acesso suspenso por cobrança vencida. Procure o suporte para regularizar o plano.'
      : 'O acesso desta empresa foi suspenso pelo administrador.'
  return { situacao, descricao: SITUACOES_FINANCEIRAS[situacao], bloqueado, mensagem }
}
