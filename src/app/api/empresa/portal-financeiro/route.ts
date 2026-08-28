import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { executarComAuditoria } from '@/lib/auditoria'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { normalizarPortalFinanceiroUrl } from '@/lib/contasPagar'

const schema = z.object({ nome: z.string().trim().max(80).nullable(), url: z.string().trim().max(500).nullable() }).strict()

export async function PATCH(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'GESTAO', acao: 'GESTAO' })
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `portal-financeiro:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Configuração inválida.' }, { status: 400 })
  try {
    const url = normalizarPortalFinanceiroUrl(parsed.data.url)
    const empresa = await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'API' }, (tx) => tx.empresa.update({
      where: { id: auth.empresaId! },
      data: { portal_financeiro_nome: url ? parsed.data.nome || 'Portal financeiro' : null, portal_financeiro_url: url },
      select: { portal_financeiro_nome: true, portal_financeiro_url: true },
    }))
    return NextResponse.json({ sucesso: true, portalFinanceiro: empresa.portal_financeiro_url ? { nome: empresa.portal_financeiro_nome, url: empresa.portal_financeiro_url } : null })
  } catch (error) {
    if (error instanceof Error && error.message === 'PORTAL_INSEGURO') return NextResponse.json({ erro: 'Use somente o endereço HTTPS oficial do banco ou ERP.' }, { status: 400 })
    return NextResponse.json({ erro: 'Não foi possível salvar o portal financeiro.' }, { status: 500 })
  }
}
