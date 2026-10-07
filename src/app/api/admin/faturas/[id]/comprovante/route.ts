import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { ArquivoCobrancaPixError, criarUrlAssinadaCobrancaPix } from '@/lib/financeiro/cobrancaPixStorage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: RouteContext<'/api/admin/faturas/[id]/comprovante'>) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `admin-fatura-arquivo:${auth.session.userId}`, RATE_LIMITS.ADMIN_READ.limit, RATE_LIMITS.ADMIN_READ.windowMs)
  if (limited) return limited
  const { id } = await context.params
  const fatura = await prisma.fatura.findUnique({ where: { id }, select: { comprovantePath: true, comprovanteNome: true } })
  if (!fatura?.comprovantePath) return NextResponse.json({ erro: 'Comprovante não encontrado.' }, { status: 404 })
  try { return NextResponse.redirect(await criarUrlAssinadaCobrancaPix(fatura.comprovantePath, fatura.comprovanteNome ?? 'comprovante.pdf')) } catch (error) {
    if (error instanceof ArquivoCobrancaPixError) return NextResponse.json({ erro: error.message }, { status: error.status })
    return NextResponse.json({ erro: "Documento indisponivel." }, { status: 503 })
  }
}
