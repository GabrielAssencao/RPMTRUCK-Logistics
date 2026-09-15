import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { textoOperacional } from '@/lib/domainValidation'
import { executarComAuditoria } from '@/lib/auditoria'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { anteriorAoDiaDaReferencia, anteriorAoMinutoDaReferencia, inicioDoMinuto } from '@/lib/dataHoraOperacional'
import { calcularNotificacaoTarefa, type ModoNotificacaoTarefa } from '@/lib/tarefaNotificacao'

const atualizarSchema = z.object({
  titulo: textoOperacional(3, 160).optional(),
  descricao: textoOperacional(1, 2000).nullable().optional(),
  prazo: z.string().datetime().nullable().optional(),
  inicio: z.string().datetime().nullable().optional(),
  duracaoMinutos: z.number().int().min(15).max(10_080).nullable().optional(),
  exibirCalendario: z.boolean().optional(),
  diaInteiro: z.boolean().optional(),
  modoNotificacao: z.enum(['AUTOMATICA', 'PERSONALIZADA']).optional(),
  notificarEm: z.string().datetime().nullable().optional(),
  prioridade: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']).optional(),
  status: z.enum(['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']).optional(),
  responsavelId: z.string().uuid().optional(),
  ordem: z.number().int().min(0).max(1_000_000_000).optional(),
}).strict().refine((dados) => Object.keys(dados).length > 0, { message: 'Informe ao menos uma alteração.' })

function eGestor(role: string) {
  return ['GESTOR_EMPRESA', 'GESTOR'].includes(role)
}

async function limitarMutacao(request: NextRequest, empresaId: string, usuarioId: string) {
  return applyRateLimit(
    request,
    `task-mutation:${empresaId}:${usuarioId}`,
    RATE_LIMITS.TASK_MUTATION.limit,
    RATE_LIMITS.TASK_MUTATION.windowMs,
  )
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const auth = await requireEmpresaAuth(request, { modulo: 'TAREFAS', acao: 'ESCRITA', exigirDelegacaoTarefas: true })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await limitarMutacao(request, auth.session.empresaId, auth.session.userId)
  if (limited) return limited

  const parsed = atualizarSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Alteração de tarefa inválida.' }, { status: 400 })

  const atual = await prisma.tarefa.findFirst({ where: { id, empresaId: auth.session.empresaId } })
  if (!atual) return NextResponse.json({ erro: 'Tarefa não encontrada.' }, { status: 404 })

  const gestor = eGestor(auth.session.role)
  const somenteFluxo = Object.keys(parsed.data).every((campo) => campo === 'status' || campo === 'ordem')
  const operadorResponsavel = auth.session.role === 'OPERADOR' && atual.responsavelId === auth.session.userId
  if (!gestor && !(somenteFluxo && operadorResponsavel)) {
    return NextResponse.json({ erro: 'Você não pode alterar esta tarefa.' }, { status: 403 })
  }

  if (parsed.data.responsavelId) {
    const responsavel = await prisma.usuario.findFirst({
      where: {
        id: parsed.data.responsavelId,
        empresaId: auth.session.empresaId,
        ativo: true,
        excluidoEm: null,
        OR: [{ role: 'GESTOR_EMPRESA' }, { modulosAcesso: { has: 'TAREFAS' } }],
      },
      select: { id: true },
    })
    if (!responsavel) return NextResponse.json({ erro: 'Responsável inválido.' }, { status: 400 })
  }

  const novoInicio = parsed.data.inicio === undefined
    ? atual.inicio
    : parsed.data.inicio ? new Date(parsed.data.inicio) : null
  const novoPrazo = parsed.data.prazo === undefined
    ? atual.prazo
    : parsed.data.prazo ? new Date(parsed.data.prazo) : null
  const novoDiaInteiro = parsed.data.diaInteiro ?? atual.diaInteiro
  const novoModo: ModoNotificacaoTarefa = parsed.data.modoNotificacao
    ?? (atual.modoNotificacao === 'PERSONALIZADA' ? 'PERSONALIZADA' : 'AUTOMATICA')
  const novaPrioridade = parsed.data.prioridade ?? atual.prioridade as 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'

  if (
    parsed.data.inicio
    && novoInicio
    && inicioDoMinuto(novoInicio).getTime() !== (atual.inicio ? inicioDoMinuto(atual.inicio).getTime() : undefined)
    && (novoDiaInteiro ? anteriorAoDiaDaReferencia(novoInicio) : anteriorAoMinutoDaReferencia(novoInicio))
  ) {
    return NextResponse.json({ erro: 'O início da tarefa não pode ser alterado para uma data passada.' }, { status: 400 })
  }

  if (novoInicio && novoPrazo && novoPrazo < novoInicio) {
    return NextResponse.json({ erro: 'O prazo não pode ser anterior ao início.' }, { status: 400 })
  }
  const reprogramarNotificacao = ['inicio', 'prazo', 'prioridade', 'modoNotificacao', 'notificarEm']
    .some((campo) => Object.hasOwn(parsed.data, campo))
  let novoLembrete: Date | null | undefined
  if (reprogramarNotificacao) {
    const personalizada = parsed.data.notificarEm === undefined
      ? atual.lembreteEm
      : parsed.data.notificarEm ? new Date(parsed.data.notificarEm) : null
    try {
      novoLembrete = calcularNotificacaoTarefa({
        inicio: novoInicio,
        prazo: novoPrazo,
        prioridade: novaPrioridade,
        modo: novoModo,
        personalizada,
        agora: personalizada && atual.lembreteEm && personalizada.getTime() === atual.lembreteEm.getTime()
          ? new Date(0)
          : new Date(),
      })
    } catch (error) {
      return NextResponse.json({ erro: error instanceof Error ? error.message : 'Notificação inválida.' }, { status: 400 })
    }
  }

  const tarefa = await executarComAuditoria({ usuarioId: auth.session.userId }, async (tx) => {
    let ordemDestino = parsed.data.ordem
    if (parsed.data.status && parsed.data.status !== atual.status && ordemDestino === undefined) {
      const ultimaOrdem = await tx.tarefa.aggregate({
        where: { empresaId: atual.empresaId, status: parsed.data.status },
        _max: { ordem: true },
      })
      ordemDestino = Math.min((ultimaOrdem._max.ordem ?? 0) + 1000, 1_000_000_000)
    }

    const atualizada = await tx.tarefa.update({
      where: { id: atual.id },
      data: {
        titulo: parsed.data.titulo,
        descricao: parsed.data.descricao,
        duracaoMinutos: parsed.data.duracaoMinutos,
        exibirCalendario: parsed.data.exibirCalendario,
        diaInteiro: parsed.data.diaInteiro,
        prioridade: parsed.data.prioridade,
        status: parsed.data.status,
        responsavelId: parsed.data.responsavelId,
        prazo: parsed.data.prazo === undefined ? undefined : novoPrazo,
        inicio: parsed.data.inicio === undefined ? undefined : novoInicio,
        modoNotificacao: reprogramarNotificacao ? novoModo : undefined,
        lembreteEm: novoLembrete,
        lembreteEnviadoEm: reprogramarNotificacao || parsed.data.responsavelId !== undefined ? null : undefined,
        ordem: ordemDestino,
        concluido_em: parsed.data.status === 'CONCLUIDA' ? new Date() : parsed.data.status ? null : undefined,
      },
      include: {
        responsavel: { select: { id: true, nome: true, email: true, role: true } },
        criador: { select: { id: true, nome: true } },
      },
    })

    if (parsed.data.status === 'CONCLUIDA' || parsed.data.status === 'CANCELADA') {
      await tx.notificacao.updateMany({
        where: { tarefaId: atualizada.id, lida: false },
        data: { lida: true },
      })
    }

    if (parsed.data.responsavelId && parsed.data.responsavelId !== atual.responsavelId) {
      await tx.notificacao.create({
        data: {
          titulo: 'Tarefa atribuída a você',
          mensagem: atualizada.titulo,
          modulo: 'TAREFAS',
          empresaId: atualizada.empresaId,
          usuarioId: atualizada.responsavelId,
          tarefaId: atualizada.id,
        },
      })
    }
    if (parsed.data.status && atual.criadorId !== auth.session!.userId) {
      await tx.notificacao.create({
        data: {
          titulo: 'Tarefa atualizada',
          mensagem: `${atualizada.titulo}: ${parsed.data.status.replace('_', ' ')}`,
          modulo: 'TAREFAS',
          empresaId: atualizada.empresaId,
          usuarioId: atualizada.criadorId,
          tarefaId: atualizada.id,
        },
      })
    }
    return atualizada
  })

  return NextResponse.json(tarefa)
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const auth = await requireEmpresaAuth(request, { modulo: 'TAREFAS', acao: 'GESTAO', exigirDelegacaoTarefas: true })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await limitarMutacao(request, auth.session.empresaId, auth.session.userId)
  if (limited) return limited

  const tarefa = await prisma.tarefa.findFirst({ where: { id, empresaId: auth.session.empresaId } })
  if (!tarefa) return NextResponse.json({ erro: 'Tarefa não encontrada.' }, { status: 404 })

  await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.tarefa.delete({ where: { id: tarefa.id } }))
  return NextResponse.json({ sucesso: true })
}
