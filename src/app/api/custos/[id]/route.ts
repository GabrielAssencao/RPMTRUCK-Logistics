import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { textoOperacional, valorMonetarioSchema } from '@/lib/domainValidation'

const schema = z.object({ status: z.enum(['PAGO', 'PENDENTE']).optional(), descricao: textoOperacional(3, 500).optional(), valor: valorMonetarioSchema.positive().optional() }).strict()

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const atual = await prisma.custo.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId } })
  if (!atual) return NextResponse.json({ erro: 'Custo não encontrado.' }, { status: 404 })
  if (atual.relatorioArquivoId) return NextResponse.json({ erro: 'Este custo já foi arquivado e não pode mais ser alterado.' }, { status: 409 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Alteração inválida.' }, { status: 400 })
  const custo = await prisma.custo.update({ where: { id: atual.id }, data: parsed.data })
  return NextResponse.json({ ...custo, data: custo.data.toISOString().slice(0, 10), duplaId: custo.veiculoId })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const atual = await prisma.custo.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId }, select: { id: true, relatorioArquivoId: true } })
  if (!atual) return NextResponse.json({ erro: 'Custo não encontrado.' }, { status: 404 })
  if (atual.relatorioArquivoId) return NextResponse.json({ erro: 'Este custo já foi arquivado e não pode mais ser excluído.' }, { status: 409 })
  await prisma.custo.delete({ where: { id: atual.id } })
  return NextResponse.json({ sucesso: true })
}
