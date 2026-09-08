import type {
  CategoriaTicketSuporte,
  ClassificacaoCobrancaTicket,
  PlanoTipo,
  PrioridadeTicketSuporte,
  StatusTicketSuporte,
} from '@prisma/client'

export interface SupportTicket {
  id: string
  protocolo: string
  assunto: string
  categoria: CategoriaTicketSuporte
  status: StatusTicketSuporte
  prioridade: PrioridadeTicketSuporte
  cobravelExtra: boolean
  franquiaNoMomento: number
  ordemNaCompetencia: number
  classificacaoCobranca: ClassificacaoCobrancaTicket
  classificadoEm?: string | null
  criado_em: string
  atualizado_em: string
  primeiraRespostaEm?: string | null
  encerradoEm?: string | null
  naoLidas: number
  ultimaMensagem: { conteudo: string; criado_em: string; automatica: boolean; autor: { role: string } | null } | null
  empresa?: { id: string; nome: string; email: string; status: string; plano: PlanoTipo }
}

export interface SupportAllowance {
  usados: number
  extras: number
  limite: number
  prazoRespostaHoras: number
}

export interface SupportAdminSummary {
  ticketsAtivos: number
  mensagensNaoLidas: number
  extrasNoMes: number
  bugsConfirmadosNoMes: number
}
