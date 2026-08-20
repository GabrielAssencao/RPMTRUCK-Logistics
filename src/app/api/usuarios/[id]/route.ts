import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({ nome: z.string().trim().min(3).max(100).optional(), email: z.string().email().toLowerCase().optional(), role: z.enum(['GESTOR_EMPRESA', 'OPERADOR', 'VISUALIZADOR']).optional() })

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(request); if (auth.error) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ erro: 'Dados do usuário inválidos.' }, { status: 400 })
  try { return NextResponse.json(await prisma.usuario.update({ where: { id: params.id }, data: parsed.data, select: { id: true, nome: true, email: true, role: true } })) } catch { return NextResponse.json({ erro: 'Usuário não encontrado ou e-mail já utilizado.' }, { status: 409 }) }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(request); if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  if (params.id === auth.session.userId) return NextResponse.json({ erro: 'Você não pode excluir a própria conta.' }, { status: 400 })
  try { await prisma.usuario.delete({ where: { id: params.id } }); return NextResponse.json({ sucesso: true }) } catch { return NextResponse.json({ erro: 'Usuário possui registros vinculados e não pode ser excluído.' }, { status: 409 }) }
}
