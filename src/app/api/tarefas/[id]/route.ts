import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { textoOperacional } from '@/lib/domainValidation'

const atualizarSchema = z.object({
  titulo: textoOperacional(3, 160).optional(),
  descricao: textoOperacional(1, 2000).nullable().optional(),
  prazo: z.string().datetime().nullable().optional(),
  prioridade: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']).optional(),
  status: z.enum(['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']).optional(),
  responsavelId: z.string().uuid().optional(),
}).strict()

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'TAREFAS' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const parsed = atualizarSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Alteração de tarefa inválida.' }, { status: 400 })

  const atual = await prisma.tarefa.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId } })
  if (!atual) return NextResponse.json({ erro: 'Tarefa não encontrada.' }, { status: 404 })

  const gestor = ['GESTOR_EMPRESA', 'GESTOR'].includes(auth.session.role)
  const somenteStatus = Object.keys(parsed.data).every(campo => campo === 'status')
  const operadorResponsavel = auth.session.role === 'OPERADOR' && atual.responsavelId === auth.session.userId
  if (!gestor && !(somenteStatus && operadorResponsavel)) {
    return NextResponse.json({ erro: 'Você não pode alterar esta tarefa.' }, { status: 403 })
  }

  if (parsed.data.responsavelId) {
    const responsavel = await prisma.usuario.findFirst({
      where: { id: parsed.data.responsavelId, empresaId: auth.session.empresaId }, select: { id: true },
    })
    if (!responsavel) return NextResponse.json({ erro: 'Responsável inválido.' }, { status: 400 })
  }

  const tarefa = await prisma.$transaction(async tx => {
    const atualizada = await tx.tarefa.update({
      where: { id: atual.id },
      data: {
        ...parsed.data,
        prazo: parsed.data.prazo === undefined ? undefined : parsed.data.prazo ? new Date(parsed.data.prazo) : null,
        concluido_em: parsed.data.status === 'CONCLUIDA' ? new Date() : parsed.data.status ? null : undefined,
      },
      include: {
        responsavel: { select: { id: true, nome: true, email: true, role: true } },
        criador: { select: { id: true, nome: true } },
      },
    })

    if (parsed.data.responsavelId && parsed.data.responsavelId !== atual.responsavelId) {
      await tx.notificacao.create({
        data: {
          titulo: 'Tarefa atribuída a você', mensagem: atualizada.titulo, modulo: 'TAREFAS',
          empresaId: atualizada.empresaId, usuarioId: atualizada.responsavelId, tarefaId: atualizada.id,
        },
      })
    }
    if (parsed.data.status && atual.criadorId !== auth.session!.userId) {
      await tx.notificacao.create({
        data: {
          titulo: 'Tarefa atualizada', mensagem: `${atualizada.titulo}: ${parsed.data.status.replace('_', ' ')}`,
          modulo: 'TAREFAS', empresaId: atualizada.empresaId, usuarioId: atualizada.criadorId, tarefaId: atualizada.id,
        },
      })
    }
    return atualizada
  })

  return NextResponse.json(tarefa)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'TAREFAS' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const tarefa = await prisma.tarefa.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId } })
  if (!tarefa) return NextResponse.json({ erro: 'Tarefa não encontrada.' }, { status: 404 })
  const gestor = ['GESTOR_EMPRESA', 'GESTOR'].includes(auth.session.role)
  if (!gestor) return NextResponse.json({ erro: 'Apenas o gestor pode excluir tarefas.' }, { status: 403 })

  await prisma.tarefa.delete({ where: { id: tarefa.id } })
  return NextResponse.json({ sucesso: true })
}
