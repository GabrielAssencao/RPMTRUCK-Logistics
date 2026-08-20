import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { criarNotificacao } from '@/lib/notificacoes'
import { prisma } from '@/lib/prisma'

const atualizarSchema = z.object({
  modelo: z.string().trim().min(2).max(100).optional(), tipo: z.string().trim().min(2).max(80).optional(),
  placa: z.string().trim().min(5).max(12).transform(valor => valor.toUpperCase()).optional(),
  ano: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1).nullable().optional(),
  quilometragem: z.coerce.number().min(0).optional(), status: z.enum(['OPERACIONAL', 'OFICINA', 'INATIVO']).optional(),
  diasAntecedenciaNotif: z.coerce.number().int().min(0).max(365).optional(), localizacaoId: z.string().uuid().nullable().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const parsed = atualizarSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Dados do veículo inválidos.' }, { status: 400 })
  const atual = await prisma.veiculo.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId } })
  if (!atual) return NextResponse.json({ erro: 'Veículo não encontrado.' }, { status: 404 })
  if (parsed.data.localizacaoId) {
    const localizacao = await prisma.localizacao.findFirst({ where: { id: parsed.data.localizacaoId, empresaId: auth.session.empresaId }, select: { id: true } })
    if (!localizacao) return NextResponse.json({ erro: 'Localização inválida.' }, { status: 400 })
  }
  const veiculo = await prisma.veiculo.update({ where: { id: atual.id }, data: parsed.data, include: { localizacao: true, motoristas: { select: { id: true, nome: true } } } })
  if (parsed.data.status && parsed.data.status !== atual.status) {
    await criarNotificacao({ titulo: 'Status da frota alterado', mensagem: `${veiculo.modelo} (${veiculo.placa}): ${parsed.data.status}.`, modulo: 'FROTA', empresaId: auth.session.empresaId, usuarioId: auth.session.userId, veiculoId: veiculo.id })
  }
  return NextResponse.json(veiculo)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  if (!['GESTOR_EMPRESA', 'GESTOR'].includes(auth.session.role)) return NextResponse.json({ erro: 'Apenas o gestor pode remover veículos.' }, { status: 403 })
  const veiculo = await prisma.veiculo.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId }, select: { id: true } })
  if (!veiculo) return NextResponse.json({ erro: 'Veículo não encontrado.' }, { status: 404 })
  try {
    await prisma.veiculo.delete({ where: { id: veiculo.id } })
    return NextResponse.json({ sucesso: true })
  } catch {
    return NextResponse.json({ erro: 'O veículo possui histórico vinculado e não pode ser removido.' }, { status: 409 })
  }
}
