import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { executarComAuditoria } from '@/lib/auditoria'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

const schema = z.object({
  valor: z.coerce.number().min(0).max(9_999_999_999.99).optional(),
  status: z.literal('PAGO').optional(),
}).strict().refine((data) => data.valor !== undefined || data.status !== undefined)

export async function PATCH(request: NextRequest, context: RouteContext<'/api/faturas/[id]'>) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `admin-fatura:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Alteração inválida.' }, { status: 400 })
  const { id } = await context.params

  try {
    const resultado = await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'SUPERADMIN' }, async (tx) => {
      const atual = await tx.fatura.findUnique({ where: { id } })
      if (!atual) throw new Error('NAO_ENCONTRADA')
      if (atual.status !== 'PENDENTE') throw new Error('JA_LIQUIDADA')
      const alterada = await tx.fatura.updateMany({
        where: { id, status: 'PENDENTE' },
        data: {
          ...(parsed.data.valor !== undefined ? { valor: parsed.data.valor } : {}),
          ...(parsed.data.status === 'PAGO' ? { status: 'PAGO' as const, pago_em: new Date(), pago_por_id: auth.session!.userId } : {}),
        },
      })
      if (alterada.count !== 1) throw new Error('JA_LIQUIDADA')
      const fatura = await tx.fatura.findUniqueOrThrow({ where: { id } })
      if (parsed.data.status === 'PAGO') {
        const total = await tx.fatura.aggregate({ where: { empresaId: fatura.empresaId, status: 'PAGO' }, _sum: { valor: true } })
        await tx.empresa.update({
          where: { id: fatura.empresaId },
          data: { total_pago_historico: Number(total._sum.valor ?? 0).toFixed(2).replace('.', ',') },
        })
      }
      return fatura
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return NextResponse.json(resultado)
  } catch (error) {
    const codigo = error instanceof Error ? error.message : ''
    if (codigo === 'NAO_ENCONTRADA') return NextResponse.json({ erro: 'Fatura não encontrada.' }, { status: 404 })
    if (codigo === 'JA_LIQUIDADA') return NextResponse.json({ erro: 'A fatura já foi liquidada em outra sessão e não pode mais ser alterada.' }, { status: 409 })
    console.error('Erro ao atualizar fatura:', error)
    return NextResponse.json({ erro: 'Não foi possível atualizar a fatura.' }, { status: 500 })
  }
}
