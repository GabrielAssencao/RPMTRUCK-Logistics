import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { textoOperacional } from '@/lib/domainValidation'
import { executarComAuditoria } from '@/lib/auditoria'

export const dynamic = 'force-dynamic'

const criarTarefaSchema = z.object({
  titulo: textoOperacional(3, 160),
  descricao: textoOperacional(1, 2000).optional().nullable(),
  prazo: z.string().datetime().optional().nullable(),
  prioridade: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']).default('MEDIA'),
  responsavelId: z.string().uuid(),
  modulo: z.enum(['FROTA', 'GESTAO', 'MOTORISTAS', 'NOTIFICACOES', 'TAREFAS', 'RELATORIOS']).optional().nullable(),
  origemId: z.string().trim().max(100).regex(/^[A-Za-z0-9:_-]+$/).optional().nullable(),
}).strict()

function podeDelegar(role: string) {
  return ['GESTOR_EMPRESA', 'GESTOR'].includes(role)
}

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'TAREFAS' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const gestor = ['GESTOR_EMPRESA', 'GESTOR'].includes(auth.session.role)
  const tarefas = await prisma.tarefa.findMany({
    where: {
      empresaId: auth.session.empresaId,
      ...(gestor ? {} : { responsavelId: auth.session.userId }),
    },
    include: {
      responsavel: { select: { id: true, nome: true, email: true, role: true } },
      criador: { select: { id: true, nome: true } },
    },
    orderBy: [{ status: 'asc' }, { prazo: 'asc' }, { criado_em: 'desc' }],
    take: 200,
  })
  return NextResponse.json(tarefas)
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'TAREFAS' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  if (!podeDelegar(auth.session.role)) return NextResponse.json({ erro: 'Seu perfil não pode delegar tarefas.' }, { status: 403 })

  const parsed = criarTarefaSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da tarefa inválidos.' }, { status: 400 })

  const responsavel = await prisma.usuario.findFirst({
    where: { id: parsed.data.responsavelId, empresaId: auth.session.empresaId },
    select: { id: true, nome: true },
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
    if (tarefaAtiva) {
      return NextResponse.json({ erro: 'Esta pendência já possui uma tarefa ativa.' }, { status: 409 })
    }
  }

  const tarefa = await executarComAuditoria({ usuarioId: auth.session.userId }, async tx => {
    const criada = await tx.tarefa.create({
      data: {
        titulo: parsed.data.titulo,
        descricao: parsed.data.descricao || null,
        prazo: parsed.data.prazo ? new Date(parsed.data.prazo) : null,
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
