import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'

const atualizarPermissoesSchema = z.object({
  acessoDashboardGeral: z.boolean(),
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  if (!['GESTOR_EMPRESA', 'GESTOR'].includes(auth.session.role)) {
    return NextResponse.json({ erro: 'Apenas o gestor pode alterar permissões.' }, { status: 403 })
  }

  const parsed = atualizarPermissoesSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Permissão inválida.' }, { status: 400 })

  const usuario = await prisma.usuario.findFirst({
    where: { id: params.id, empresaId: auth.session.empresaId },
    select: { id: true, role: true },
  })
  if (!usuario) return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  if (usuario.role === 'GESTOR_EMPRESA') {
    return NextResponse.json({ erro: 'O gestor já possui acesso integral ao painel.' }, { status: 400 })
  }

  const atualizado = await prisma.usuario.update({
    where: { id: usuario.id },
    data: { acessoDashboardGeral: parsed.data.acessoDashboardGeral },
    select: { id: true, acessoDashboardGeral: true },
  })
  return NextResponse.json(atualizado)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  if (!['GESTOR_EMPRESA', 'GESTOR'].includes(auth.session.role)) return NextResponse.json({ erro: 'Apenas o gestor pode remover usuários.' }, { status: 403 })
  if (params.id === auth.session.userId) return NextResponse.json({ erro: 'Você não pode remover a própria conta.' }, { status: 400 })
  const usuario = await prisma.usuario.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId }, select: { id: true, role: true } })
  if (!usuario) return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  if (usuario.role === 'GESTOR_EMPRESA') return NextResponse.json({ erro: 'O gestor principal não pode ser removido por esta tela.' }, { status: 400 })
  try { await prisma.usuario.delete({ where: { id: usuario.id } }); return NextResponse.json({ sucesso: true }) } catch { return NextResponse.json({ erro: 'Usuário possui tarefas ou registros vinculados.' }, { status: 409 }) }
}
