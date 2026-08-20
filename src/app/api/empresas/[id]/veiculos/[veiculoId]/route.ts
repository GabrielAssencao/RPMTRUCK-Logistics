import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: NextRequest, { params }: { params: { id: string; veiculoId: string } }) {
  const auth = await requireAdminAuth(request); if (auth.error) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const veiculo = await prisma.veiculo.findFirst({ where: { id: params.veiculoId, empresaId: params.id }, select: { id: true } })
  if (!veiculo) return NextResponse.json({ erro: 'Veículo não encontrado.' }, { status: 404 })
  try { await prisma.veiculo.delete({ where: { id: veiculo.id } }); return NextResponse.json({ sucesso: true }) } catch { return NextResponse.json({ erro: 'Veículo possui histórico vinculado.' }, { status: 409 }) }
}
