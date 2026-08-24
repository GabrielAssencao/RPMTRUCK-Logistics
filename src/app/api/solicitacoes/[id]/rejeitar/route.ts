import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executarComAuditoria } from '@/lib/auditoria'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(request);if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `admin-mutation:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited
  const solicitacao = await prisma.solicitacaoAcesso.findUnique({ where: { id: params.id } })
  if (!solicitacao) return NextResponse.json({ erro: 'Solicitação não encontrada.' }, { status: 404 })
  if (solicitacao.status !== 'PENDENTE') return NextResponse.json({ erro: 'Solicitação já processada.' }, { status: 400 })
  await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'SUPERADMIN' }, (tx) => tx.solicitacaoAcesso.update({ where: { id: solicitacao.id }, data: { status: 'REJEITADO' } }))
  return NextResponse.json({ sucesso: true })
}
