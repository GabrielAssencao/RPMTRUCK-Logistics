import { randomBytes } from 'node:crypto'
import type { CategoriaTicketSuporte, PlanoTipo } from '@prisma/client'
import { CATEGORIA_TICKET_LABEL, obterPoliticaSuporte } from '@/lib/suporteConfig'

function anoMesSaoPaulo(data: Date) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(data)
  const ano = Number(partes.find((parte) => parte.type === 'year')?.value)
  const mes = Number(partes.find((parte) => parte.type === 'month')?.value)
  return { ano, mes }
}

export function inicioCompetencia(data = new Date()) {
  const { ano, mes } = anoMesSaoPaulo(data)
  return new Date(Date.UTC(ano, mes - 1, 1))
}

export function gerarProtocoloTicket(data = new Date()) {
  const { ano, mes } = anoMesSaoPaulo(data)
  const competencia = `${ano}${String(mes).padStart(2, '0')}`
  return `SUP-${competencia}-${randomBytes(5).toString('hex').toUpperCase()}`
}

export function calcularCoberturaTicket(plano: PlanoTipo, ticketsJaAbertos: number) {
  const politica = obterPoliticaSuporte(plano)
  const ordemNaCompetencia = ticketsJaAbertos + 1
  return {
    ...politica,
    ordemNaCompetencia,
    cobravelExtra: ordemNaCompetencia > politica.limiteMensal,
  }
}

export function montarRespostaAutomatica(
  categoria: CategoriaTicketSuporte,
  plano: PlanoTipo,
  cobravelExtra: boolean,
) {
  const politica = obterPoliticaSuporte(plano)
  const orientacao: Record<CategoriaTicketSuporte, string> = {
    SUPORTE_TECNICO: 'Para agilizar, informe o módulo, dispositivo e navegador utilizados.',
    REPORTAR_ERRO: 'Para agilizar, envie os passos para reproduzir o erro, o horário aproximado e uma captura de tela sem dados sensíveis.',
    DUVIDA_OPERACIONAL: 'Descreva o fluxo que deseja executar e em qual etapa surgiu a dúvida.',
    SOLICITACAO: 'Nossa equipe avaliará escopo, prioridade e eventual impacto comercial antes de confirmar a execução.',
    FINANCEIRO: 'Não envie senhas, dados bancários completos ou informações de cartão por este canal.',
  }
  const cobertura = cobravelExtra
    ? 'Este chamado excedeu a franquia mensal do plano e foi sinalizado como atendimento adicional. O suporte não será interrompido.'
    : 'Este chamado está incluído na franquia mensal do seu plano.'

  return `Recebemos seu ticket de ${CATEGORIA_TICKET_LABEL[categoria].toLocaleLowerCase('pt-BR')}. ${cobertura} O prazo inicial de resposta do plano é de até ${politica.prazoRespostaHoras} horas úteis. ${orientacao[categoria]} Você pode complementar as informações por este canal.`
}
