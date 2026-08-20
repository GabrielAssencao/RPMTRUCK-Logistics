import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const criarTarefaSchema = z.object({
  titulo: z.string().trim().min(3).max(160),
  descricao: z.string().trim().max(2000).optional().nullable(),
  prazo: z.string().datetime().optional().nullable(),
  prioridade: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']).default('MEDIA'),
  responsavelId: z.string().uuid(),
  modulo: z.string().trim().max(40).optional().nullable(),
  origemId: z.string().trim().max(100).optional().nullable(),
})

function podeDelegar(role: string) {
  return ['GESTOR_EMPRESA', 'GESTOR', 'OPERADOR'].includes(role)
}

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'TAREFAS' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const gestor = ['GESTOR_EMPRESA', 'GESTOR'].includes(auth.session.role)
  const tarefas = await prisma.tarefa.findMany({
    where: {
      empresaId: auth.session.empresaId,
      ...(gestor ? {} : { OR: [{ responsavelId: auth.session.userId }, { criadorId: auth.session.userId }] }),
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

  const tarefa = await prisma.$transaction(async tx => {
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
