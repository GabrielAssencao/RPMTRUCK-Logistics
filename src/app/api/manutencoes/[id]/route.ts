import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'

const schema = z.object({ status: z.enum(['PENDENTE', 'CONCLUIDA', 'CANCELADA', 'NAO_REALIZADA']) })

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const atual = await prisma.historicoVeiculo.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId }, include: { veiculo: true } })
  if (!atual) return NextResponse.json({ erro: 'Manutenção não encontrada.' }, { status: 404 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Status inválido.' }, { status: 400 })
  const h = await prisma.historicoVeiculo.update({ where: { id: atual.id }, data: { status: parsed.data.status, data_conclusao: parsed.data.status === 'CONCLUIDA' ? new Date() : null } })
  return NextResponse.json({ id: h.id, veiculoPlaca: atual.veiculo.placa, veiculoModelo: atual.veiculo.modelo, dataAgendada: h.data_agendada.toISOString().slice(0, 10), tipo: h.tipo, pecas: h.pecas_substituidas || h.descricao || '', custo: h.custo, kmAtual: h.km_atual, status: h.status, origem: h.origem })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const atual = await prisma.historicoVeiculo.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId }, select: { id: true } })
  if (!atual) return NextResponse.json({ erro: 'Manutenção não encontrada.' }, { status: 404 })
  await prisma.historicoVeiculo.delete({ where: { id: atual.id } })
  return NextResponse.json({ sucesso: true })
}
