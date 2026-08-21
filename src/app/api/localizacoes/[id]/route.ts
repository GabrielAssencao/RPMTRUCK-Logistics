import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { nomeOperacional } from '@/lib/domainValidation'
import { executarComAuditoria } from '@/lib/auditoria'

const schema = z.object({ nome: nomeOperacional(2, 100).optional(), cidadeUF: nomeOperacional(2, 100).optional(), capacidade: z.coerce.number().int().min(0).max(100000).optional() }).strict()

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const atual = await prisma.localizacao.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId }, select: { id: true } })
  if (!atual) return NextResponse.json({ erro: 'Localização não encontrada.' }, { status: 404 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
  return NextResponse.json(await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.localizacao.update({ where: { id: atual.id }, data: parsed.data })))
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const atual = await prisma.localizacao.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId }, select: { id: true } })
  if (!atual) return NextResponse.json({ erro: 'Localização não encontrada.' }, { status: 404 })
  await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.localizacao.delete({ where: { id: atual.id } }))
  return NextResponse.json({ sucesso: true })
}
