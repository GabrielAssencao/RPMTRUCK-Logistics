import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { executarComAuditoria } from '@/lib/auditoria'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { atualizarOcorrenciaVeiculoSchema } from '@/lib/ocorrenciaVeiculoValidation'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export async function PATCH(request: NextRequest, context: RouteContext<'/api/ocorrencias-veiculos/[id]'>) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `vehicle-incidents-write:${auth.session.userId}`, RATE_LIMITS.TASK_MUTATION.limit, RATE_LIMITS.TASK_MUTATION.windowMs)
  if (limited) return limited
  const parsed = atualizarOcorrenciaVeiculoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Alteração inválida.' }, { status: 400 })
  const { id } = await context.params
  const atual = await prisma.ocorrenciaVeiculo.findFirst({ where: { id, empresaId: auth.session.empresaId }, select: { id: true } })
  if (!atual) return NextResponse.json({ erro: 'Ocorrência não encontrada.' }, { status: 404 })
  if (parsed.data.motoristaId) {
    const motorista = await prisma.motorista.findFirst({ where: { id: parsed.data.motoristaId, empresaId: auth.session.empresaId }, select: { id: true } })
    if (!motorista) return NextResponse.json({ erro: 'Motorista inválido para esta empresa.' }, { status: 400 })
  }
  const atualizada = await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.ocorrenciaVeiculo.update({ where: { id: atual.id }, data: parsed.data }))
  return NextResponse.json({ ...atualizada, data: atualizada.data.toISOString().slice(0, 10), valor: atualizada.valor === null ? null : Number(atualizada.valor) })
}
