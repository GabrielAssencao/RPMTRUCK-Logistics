import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'

const schema = z.object({ nome: z.string().trim().min(2).max(100).optional(), cidadeUF: z.string().trim().min(2).max(100).optional(), capacidade: z.coerce.number().int().min(0).max(100000).optional() })

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const atual = await prisma.localizacao.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId }, select: { id: true } })
  if (!atual) return NextResponse.json({ erro: 'Localização não encontrada.' }, { status: 404 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
  return NextResponse.json(await prisma.localizacao.update({ where: { id: atual.id }, data: parsed.data }))
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const atual = await prisma.localizacao.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId }, select: { id: true } })
  if (!atual) return NextResponse.json({ erro: 'Localização não encontrada.' }, { status: 404 })
  await prisma.localizacao.delete({ where: { id: atual.id } })
  return NextResponse.json({ sucesso: true })
}
