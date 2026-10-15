import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { executarComAuditoria } from '@/lib/auditoria'
import { dadosDespesa, despesaSchema } from '@/lib/financeiro/despesasPlataforma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

async function autorizar(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return { error: NextResponse.json({ erro: auth.error }, { status: auth.status }) }
  const limited = await applyRateLimit(request, `admin-mutation:${auth.session.userId}:despesas`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  return { error: limited, userId: auth.session.userId }
}

export async function PATCH(request: NextRequest, context: RouteContext<'/api/admin/despesas/[id]'>) {
  const auth = await autorizar(request)
  if (auth.error) return auth.error
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ erro: 'Despesa inválida.' }, { status: 400 })
  const parsed = despesaSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message || 'Despesa inválida.' }, { status: 400 })
  const atualizada = await executarComAuditoria({ usuarioId: auth.userId, origem: 'SUPERADMIN' }, tx => tx.despesaPlataforma.updateMany({
    where: { id, excluidaEm: null }, data: dadosDespesa(parsed.data),
  }))
  if (!atualizada.count) return NextResponse.json({ erro: 'Despesa não encontrada.' }, { status: 404 })
  return NextResponse.json({ sucesso: true })
}

export async function DELETE(request: NextRequest, context: RouteContext<'/api/admin/despesas/[id]'>) {
  const auth = await autorizar(request)
  if (auth.error) return auth.error
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ erro: 'Despesa inválida.' }, { status: 400 })
  const atualizada = await executarComAuditoria({ usuarioId: auth.userId, origem: 'SUPERADMIN' }, tx => tx.despesaPlataforma.updateMany({
    where: { id, excluidaEm: null }, data: { excluidaEm: new Date(), excluidaPorId: auth.userId },
  }))
  if (!atualizada.count) return NextResponse.json({ erro: 'Despesa não encontrada.' }, { status: 404 })
  return NextResponse.json({ sucesso: true })
}
