import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { executarComAuditoria } from '@/lib/auditoria'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { avaliarSituacaoFinanceira } from '@/lib/financeiro/situacaoFinanceira'
import { faturasPendentesFinanceiras } from '@/lib/financeiro/acessoFinanceiro'
import { liquidarFatura } from '@/lib/financeiro/faturas'
import { notificarPagamentoConfirmado } from '@/lib/financeiro/notificacoesPagamento'

const schema = z.object({
  valor: z.coerce.number().min(0).max(9_999_999_999.99).optional(),
  status: z.literal('PAGO').optional(),
  acaoEstorno: z.enum(['RECOBRAR', 'ENCERRAR']).optional(),
  vencimento: z.string().datetime().optional(),
}).strict().superRefine((data, context) => {
  const camposComuns = data.valor !== undefined || data.status !== undefined
  if (!camposComuns && !data.acaoEstorno) context.addIssue({ code: 'custom', message: 'Informe uma alteração.' })
  if (data.acaoEstorno && camposComuns) context.addIssue({ code: 'custom', message: 'A decisão do estorno deve ser enviada separadamente.' })
  if (data.acaoEstorno === 'RECOBRAR' && !data.vencimento) context.addIssue({ code: 'custom', path: ['vencimento'], message: 'Informe o novo vencimento.' })
  if (data.acaoEstorno !== 'RECOBRAR' && data.vencimento) context.addIssue({ code: 'custom', path: ['vencimento'], message: 'Vencimento inesperado.' })
})

export async function PATCH(request: NextRequest, context: RouteContext<'/api/faturas/[id]'>) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `admin-fatura:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Alteração inválida.' }, { status: 400 })
  const { id } = await context.params

  try {
    const resultado = await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'SUPERADMIN' }, async (tx) => {
      const atual = await tx.fatura.findUnique({ where: { id } })
      if (!atual) throw new Error('NAO_ENCONTRADA')
      if (parsed.data.acaoEstorno) {
        if (atual.status !== 'ESTORNADA' || atual.gatewayStatus !== 'REFUNDED') throw new Error('ESTORNO_JA_DECIDIDO')
        const vencimento = parsed.data.vencimento ? new Date(parsed.data.vencimento) : null
        if (parsed.data.acaoEstorno === 'RECOBRAR' && (!vencimento || vencimento <= new Date())) throw new Error('VENCIMENTO_INVALIDO')
        const alterada = await tx.fatura.updateMany({
          where: { id, status: 'ESTORNADA', gatewayStatus: 'REFUNDED' },
          data: parsed.data.acaoEstorno === 'ENCERRAR'
            ? { status: 'CANCELADA', gatewayInvoiceUrl: null, pixCopiaECola: null, pixQrPath: null, pixQrNome: null, pixQrMime: null }
            : {
                status: 'PENDENTE', vencimento, provedorPagamento: 'MANUAL', gatewayPaymentId: null,
                gatewayStatus: null, gatewayBillingType: null, gatewayInvoiceUrl: null, gatewayNetValue: null,
                gatewayRecebidoEm: null, gatewaySincronizadoEm: null, gatewayErro: null,
                pixCopiaECola: null, pixQrPath: null, pixQrNome: null, pixQrMime: null,
              },
        })
        if (alterada.count !== 1) throw new Error('ESTORNO_JA_DECIDIDO')
        const fatura = await tx.fatura.findUniqueOrThrow({ where: { id } })
        const empresa = await tx.empresa.findUniqueOrThrow({ where: { id: fatura.empresaId }, include: { faturas: faturasPendentesFinanceiras } })
        return { ...fatura, financeiro: avaliarSituacaoFinanceira(empresa) }
      }
      if (atual.status !== 'PENDENTE') throw new Error('JA_LIQUIDADA')
      if (parsed.data.valor !== undefined) await tx.fatura.update({ where: { id }, data: { valor: parsed.data.valor } })
      const fatura = parsed.data.status === 'PAGO'
        ? await liquidarFatura(tx, id, { pagoEm: new Date(), pagoPorId: auth.session!.userId })
        : await tx.fatura.findUniqueOrThrow({ where: { id } })
      if (parsed.data.status === 'PAGO') await notificarPagamentoConfirmado(tx, [fatura])
      const empresa = await tx.empresa.findUniqueOrThrow({ where: { id: fatura.empresaId }, include: { faturas: faturasPendentesFinanceiras } })
      return { ...fatura, financeiro: avaliarSituacaoFinanceira(empresa) }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return NextResponse.json(resultado)
  } catch (error) {
    const codigo = error instanceof Error ? error.message : ''
    if (codigo === 'ESTORNO_JA_DECIDIDO') return NextResponse.json({ erro: 'Este estorno já foi tratado em outra sessão.' }, { status: 409 })
    if (codigo === 'VENCIMENTO_INVALIDO') return NextResponse.json({ erro: 'Escolha um novo vencimento futuro.' }, { status: 400 })
    if (codigo === 'NAO_ENCONTRADA') return NextResponse.json({ erro: 'Fatura não encontrada.' }, { status: 404 })
    if (codigo === 'JA_LIQUIDADA') return NextResponse.json({ erro: 'A fatura já foi liquidada em outra sessão e não pode mais ser alterada.' }, { status: 409 })
    console.error('Erro ao atualizar fatura:', error)
    return NextResponse.json({ erro: 'Não foi possível atualizar a fatura.' }, { status: 500 })
  }
}
