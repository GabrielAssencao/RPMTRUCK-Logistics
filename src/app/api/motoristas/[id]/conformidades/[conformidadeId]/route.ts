import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { executarComAuditoria } from '@/lib/auditoria'
import { atualizarConformidadeMotoristaSchema, dataSomenteDia } from '@/lib/conformidadeMotorista'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

async function limitar(request: NextRequest, usuarioId: string) {
  return applyRateLimit(request, `driver-compliance:${usuarioId}`, RATE_LIMITS.TASK_MUTATION.limit, RATE_LIMITS.TASK_MUTATION.windowMs)
}

export async function PATCH(request: NextRequest, context: RouteContext<'/api/motoristas/[id]/conformidades/[conformidadeId]'>) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await limitar(request, auth.session.userId)
  if (limited) return limited
  const { id, conformidadeId } = await context.params
  const atual = await prisma.conformidadeMotorista.findFirst({ where: { id: conformidadeId, motoristaId: id, empresaId: auth.session.empresaId } })
  if (!atual) return NextResponse.json({ erro: 'Registro não encontrado.' }, { status: 404 })
  const parsed = atualizarConformidadeMotoristaSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Alteração inválida.' }, { status: 400 })
  try {
    const emitidoEm = parsed.data.emitidoEm === undefined ? atual.emitidoEm : dataSomenteDia(parsed.data.emitidoEm)
    const validade = parsed.data.validade === undefined ? atual.validade : dataSomenteDia(parsed.data.validade)
    if (emitidoEm && validade && validade < emitidoEm) return NextResponse.json({ erro: 'A validade não pode ser anterior à emissão.' }, { status: 400 })
    const dados = { ...parsed.data, emitidoEm: parsed.data.emitidoEm === undefined ? undefined : emitidoEm, validade: parsed.data.validade === undefined ? undefined : validade }
    const item = await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.conformidadeMotorista.update({ where: { id: atual.id }, data: dados }))
    return NextResponse.json(item)
  } catch (error) {
    if (error instanceof Error && error.message === 'DATA_INVALIDA') return NextResponse.json({ erro: 'Data inválida.' }, { status: 400 })
    console.error('Erro ao atualizar conformidade:', error)
    return NextResponse.json({ erro: 'Não foi possível atualizar a conformidade.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext<'/api/motoristas/[id]/conformidades/[conformidadeId]'>) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA', acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await limitar(request, auth.session.userId)
  if (limited) return limited
  const { id, conformidadeId } = await context.params
  const removido = await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.conformidadeMotorista.deleteMany({ where: { id: conformidadeId, motoristaId: id, empresaId: auth.session!.empresaId! } }))
  if (removido.count !== 1) return NextResponse.json({ erro: 'Registro não encontrado.' }, { status: 404 })
  return NextResponse.json({ sucesso: true })
}
