import { OperacaoFinanceiraError } from '@/lib/financeiro/operacaoFinanceira'
import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { emitirCobrancaAsaas } from '@/lib/financeiro/asaas'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, context: RouteContext<'/api/empresa/faturas/[id]/cobranca'>) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `emitir-cobranca:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited
  const parsed = z.object({ billingType: z.enum(['PIX', 'UNDEFINED']).default('PIX'), segundaFaturaId: z.string().uuid().optional() }).strict().safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ erro: 'Forma de pagamento inválida.' }, { status: 400 })
  const { id } = await context.params
  try {
    const fatura = await emitirCobrancaAsaas(id, auth.session.empresaId, parsed.data.billingType, parsed.data.segundaFaturaId)
    return NextResponse.json({ sucesso: true, fatura }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof OperacaoFinanceiraError) return NextResponse.json({ erro: error.message }, { status: error.status })
    console.error('Falha ao emitir cobrança no Asaas:', error)
    return NextResponse.json({ erro: 'Não foi possível emitir a cobrança agora.' }, { status: 502 })
  }
}
