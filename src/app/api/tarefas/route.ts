import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { textoOperacional } from '@/lib/domainValidation'
import { executarComAuditoria } from '@/lib/auditoria'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { anteriorAoMinutoDaReferencia } from '@/lib/dataHoraOperacional'

export const dynamic = 'force-dynamic'

const criarTarefaSchema = z.object({
  titulo: textoOperacional(3, 160),
  descricao: textoOperacional(1, 2000).optional().nullable(),
  prazo: z.string().datetime().optional().nullable(),
  inicio: z.string().datetime().optional().nullable(),
  duracaoMinutos: z.number().int().min(15).max(10_080).optional().nullable(),
  exibirCalendario: z.boolean().default(true),
  lembreteEm: z.string().datetime().optional().nullable(),
  prioridade: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']).default('MEDIA'),
  responsavelId: z.string().uuid(),
  modulo: z.enum(['FROTA', 'GESTAO', 'MOTORISTAS', 'NOTIFICACOES', 'TAREFAS', 'RELATORIOS']).optional().nullable(),
  origemId: z.string().trim().max(100).regex(/^[A-Za-z0-9:_-]+$/).optional().nullable(),
}).strict().superRefine((dados, contexto) => {
  const inicio = dados.inicio ? new Date(dados.inicio) : null
  const prazo = dados.prazo ? new Date(dados.prazo) : null
  const lembrete = dados.lembreteEm ? new Date(dados.lembreteEm) : null
  if (inicio && prazo && prazo < inicio) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['prazo'], message: 'O prazo não pode ser anterior ao início.' })
  }
  const referencia = inicio ?? prazo
  if (lembrete && referencia && lembrete > referencia) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['lembreteEm'], message: 'O lembrete deve ocorrer antes da tarefa.' })
  }
})

const filtrosSchema = z.object({
  responsavelId: z.string().uuid().optional(),
  prioridade: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']).optional(),
  status: z.enum(['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']).optional(),
}).strict()

function podeDelegar(role: string) {
  return ['GESTOR_EMPRESA', 'GESTOR'].includes(role)
}

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'TAREFAS', exigirDelegacaoTarefas: true })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(
    request,
    `task-read:${auth.session.empresaId}:${auth.session.userId}`,
    RATE_LIMITS.TASK_READ.limit,
    RATE_LIMITS.TASK_READ.windowMs,
  )
  if (limited) return limited

  const filtros = filtrosSchema.safeParse({
    responsavelId: request.nextUrl.searchParams.get('responsavelId') ?? undefined,
    prioridade: request.nextUrl.searchParams.get('prioridade') ?? undefined,
    status: request.nextUrl.searchParams.get('status') ?? undefined,
  })
  if (!filtros.success) return NextResponse.json({ erro: 'Filtros do cronograma inválidos.' }, { status: 400 })

  const gestor = podeDelegar(auth.session.role)
  const tarefas = await prisma.tarefa.findMany({
    where: {
      empresaId: auth.session.empresaId,
      ...(gestor
        ? (filtros.data.responsavelId ? { responsavelId: filtros.data.responsavelId } : {})
        : { responsavelId: auth.session.userId }),
      ...(filtros.data.prioridade ? { prioridade: filtros.data.prioridade } : {}),
      ...(filtros.data.status ? { status: filtros.data.status } : {}),
    },
    include: {
      responsavel: { select: { id: true, nome: true, email: true, role: true } },
      criador: { select: { id: true, nome: true } },
    },
    orderBy: [{ status: 'asc' }, { ordem: 'asc' }, { prazo: 'asc' }, { criado_em: 'desc' }],
    take: 500,
  })
  return NextResponse.json(tarefas)
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'TAREFAS', acao: 'GESTAO', exigirDelegacaoTarefas: true })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(
    request,
    `task-mutation:${auth.session.empresaId}:${auth.session.userId}`,
    RATE_LIMITS.TASK_MUTATION.limit,
    RATE_LIMITS.TASK_MUTATION.windowMs,
  )
  if (limited) return limited

  const parsed = criarTarefaSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da tarefa inválidos.' }, { status: 400 })
  if (parsed.data.inicio && anteriorAoMinutoDaReferencia(new Date(parsed.data.inicio))) {
    return NextResponse.json({ erro: 'O início da tarefa não pode ser anterior ao momento do cadastro.' }, { status: 400 })
  }

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
  if (!responsavel) return NextResponse.json({ erro: 'Responsável não pertence à empresa.' }, { status: 400 })

  if (parsed.data.origemId) {
    const tarefaAtiva = await prisma.tarefa.findFirst({
      where: {
        empresaId: auth.session.empresaId,
        origem_id: parsed.data.origemId,
        status: { in: ['PENDENTE', 'EM_ANDAMENTO'] },
      },
      select: { id: true },
    })
    if (tarefaAtiva) return NextResponse.json({ erro: 'Esta pendência já possui uma tarefa ativa.' }, { status: 409 })
  }

  const tarefa = await executarComAuditoria({ usuarioId: auth.session.userId }, async (tx) => {
    const ultimaOrdem = await tx.tarefa.aggregate({
      where: { empresaId: auth.session!.empresaId!, status: 'PENDENTE' },
      _max: { ordem: true },
    })
    const criada = await tx.tarefa.create({
      data: {
        titulo: parsed.data.titulo,
        descricao: parsed.data.descricao || null,
        prazo: parsed.data.prazo ? new Date(parsed.data.prazo) : null,
        inicio: parsed.data.inicio ? new Date(parsed.data.inicio) : null,
        duracaoMinutos: parsed.data.duracaoMinutos ?? null,
        exibirCalendario: parsed.data.exibirCalendario,
        lembreteEm: parsed.data.lembreteEm ? new Date(parsed.data.lembreteEm) : null,
        ordem: Math.min((ultimaOrdem._max.ordem ?? 0) + 1000, 1_000_000_000),
        prioridade: parsed.data.prioridade,
        modulo: parsed.data.modulo || null,
        origem_id: parsed.data.origemId || null,
        empresaId: auth.session!.empresaId!,
        criadorId: auth.session!.userId,
        responsavelId: responsavel.id,
      },
      include: {
        responsavel: { select: { id: true, nome: true, email: true, role: true } },
        criador: { select: { id: true, nome: true } },
      },
    })
    await tx.notificacao.create({
      data: {
        titulo: 'Nova tarefa atribuída',
        mensagem: `${criada.titulo}${criada.prazo ? ` — prazo ${criada.prazo.toLocaleDateString('pt-BR')}` : ''}`,
        modulo: 'TAREFAS',
        empresaId: criada.empresaId,
        usuarioId: criada.responsavelId,
        tarefaId: criada.id,
      },
    })
    return criada
  })

  return NextResponse.json(tarefa, { status: 201 })
}
