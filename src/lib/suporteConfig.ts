import type {
  CategoriaTicketSuporte,
  PlanoTipo,
  PrioridadeTicketSuporte,
  StatusTicketSuporte,
} from '@prisma/client'
import { PLANOS_CONFIG } from '@/utils/planos'

export const CATEGORIAS_TICKET = [
  'SUPORTE_TECNICO',
  'REPORTAR_ERRO',
  'DUVIDA_OPERACIONAL',
  'SOLICITACAO',
  'FINANCEIRO',
] as const satisfies readonly CategoriaTicketSuporte[]

export const CATEGORIA_TICKET_LABEL: Record<CategoriaTicketSuporte, string> = {
  SUPORTE_TECNICO: 'Suporte técnico',
  REPORTAR_ERRO: 'Reportar erro',
  DUVIDA_OPERACIONAL: 'Dúvida operacional',
  SOLICITACAO: 'Solicitação',
  FINANCEIRO: 'Financeiro',
}

export const STATUS_TICKET_LABEL: Record<StatusTicketSuporte, string> = {
  ABERTO: 'Aberto',
  EM_ATENDIMENTO: 'Em atendimento',
  AGUARDANDO_CLIENTE: 'Aguardando cliente',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
}

export const PRIORIDADE_TICKET_LABEL: Record<PrioridadeTicketSuporte, string> = {
  BAIXA: 'Baixa',
  NORMAL: 'Normal',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
}

export function obterPoliticaSuporte(plano: PlanoTipo) {
  const configuracao = PLANOS_CONFIG[plano]
  return {
    limiteMensal: configuracao.ticketsSuporteMes,
    prazoRespostaHoras: configuracao.prazoRespostaSuporteHoras,
  }
}

export function prioridadeInicialTicket(categoria: CategoriaTicketSuporte): PrioridadeTicketSuporte {
  return categoria === 'REPORTAR_ERRO' ? 'ALTA' : categoria === 'FINANCEIRO' ? 'BAIXA' : 'NORMAL'
}
