import { prisma } from '@/lib/prisma'

interface EntregarLembretesInput {
  empresaId: string
  usuarioId: string
}

const URGENCIA_LEMBRETE: Record<string, string> = {
  LEVE: 'Urgência leve',
  MEDIA: 'Urgência média',
  ALTA: 'Urgência alta',
}

const formatoData = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
})
const formatoHora = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'America/Sao_Paulo',
})

function dataHoraContextual(data: Date) {
  return `${formatoData.format(data)} às ${formatoHora.format(data)}`
}

/**
 * Entrega lembretes vencidos quando o usuário consulta as notificações.
 * O updateMany funciona como claim atômico entre instâncias e evita duplicidade.
 */
export async function entregarLembretesTarefas({ empresaId, usuarioId }: EntregarLembretesInput) {
  const agora = new Date()
  const pendentes = await prisma.tarefa.findMany({
    where: {
      empresaId,
      responsavelId: usuarioId,
      status: { in: ['PENDENTE', 'EM_ANDAMENTO'] },
      lembreteEm: { lte: agora },
      lembreteEnviadoEm: null,
    },
    select: { id: true, titulo: true, empresaId: true, responsavelId: true, prazo: true },
    orderBy: { lembreteEm: 'asc' },
    take: 25,
  })

  let entregues = 0
  for (const tarefa of pendentes) {
    const entregue = await prisma.$transaction(async (tx) => {
      const claim = await tx.tarefa.updateMany({
        where: {
          id: tarefa.id,
          empresaId,
          responsavelId: usuarioId,
          status: { in: ['PENDENTE', 'EM_ANDAMENTO'] },
          lembreteEm: { lte: agora },
          lembreteEnviadoEm: null,
        },
        data: { lembreteEnviadoEm: agora },
      })
      if (claim.count !== 1) return false

      await tx.notificacao.create({
        data: {
          titulo: `Tarefa: ${tarefa.titulo}`,
          mensagem: tarefa.prazo ? `Prazo previsto para ${dataHoraContextual(tarefa.prazo)}.` : 'Esta tarefa está pendente no seu quadro.',
          modulo: 'TAREFAS',
          empresaId: tarefa.empresaId,
          usuarioId: tarefa.responsavelId,
          tarefaId: tarefa.id,
        },
      })
      return true
    })
    if (entregue) entregues += 1
  }

  return entregues
}

export async function entregarLembretesPessoais({ empresaId, usuarioId }: EntregarLembretesInput) {
  const agora = new Date()
  const pendentes = await prisma.lembretePessoal.findMany({
    where: {
      empresaId,
      usuarioId,
      concluido: false,
      notificarEm: { lte: agora },
      notificacaoEm: null,
    },
    select: { id: true, titulo: true, empresaId: true, usuarioId: true, dataHora: true, urgencia: true },
    orderBy: { notificarEm: 'asc' },
    take: 25,
  })

  let entregues = 0
  for (const lembrete of pendentes) {
    const entregue = await prisma.$transaction(async (tx) => {
      const claim = await tx.lembretePessoal.updateMany({
        where: {
          id: lembrete.id,
          empresaId,
          usuarioId,
          concluido: false,
          notificarEm: { lte: agora },
          notificacaoEm: null,
        },
        data: { notificacaoEm: agora },
      })
      if (claim.count !== 1) return false

      await tx.notificacao.create({
        data: {
          titulo: `Lembrete: ${lembrete.titulo}`,
          mensagem: `${URGENCIA_LEMBRETE[lembrete.urgencia] ?? 'Lembrete pessoal'} · Agendado para ${dataHoraContextual(lembrete.dataHora)}.`,
          modulo: 'TAREFAS',
          empresaId: lembrete.empresaId,
          usuarioId: lembrete.usuarioId,
          lembretePessoalId: lembrete.id,
        },
      })
      return true
    })
    if (entregue) entregues += 1
  }

  return entregues
}
