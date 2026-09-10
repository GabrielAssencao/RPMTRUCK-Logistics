import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit'
import { recordSecurityEvent } from '@/lib/securityEvents'

export const dynamic = 'force-dynamic'

const revokeSessionSchema = z.object({
  sessionId: z.string().uuid(),
}).strict()

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(request, `sessions-read:${auth.session.userId}`, RATE_LIMITS.SESSION_READ.limit, RATE_LIMITS.SESSION_READ.windowMs)
  if (limited) return limited

  const agora = new Date()
  const sessions = await prisma.sessaoUsuario.findMany({
    where: {
      usuarioId: auth.session.userId,
      revogadaEm: null,
      expiraEm: { gt: agora },
    },
    orderBy: { ultimaAtividade: 'desc' },
    take: 10,
    select: {
      id: true,
      userAgent: true,
      criadoEm: true,
      ultimaAtividade: true,
      expiraEm: true,
    },
  })

  return NextResponse.json({
    sessions: sessions.map((session) => ({
      ...session,
      atual: session.id === auth.session?.sessionId,
    })),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(request, `sessions-mutation:${auth.session.userId}`, RATE_LIMITS.SESSION_MUTATION.limit, RATE_LIMITS.SESSION_MUTATION.windowMs)
  if (limited) return limited

  const parsed = revokeSessionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Sessão inválida.' }, { status: 400 })
  if (parsed.data.sessionId === auth.session.sessionId) {
    return NextResponse.json({ erro: 'Use a opção Sair para encerrar a sessão atual.' }, { status: 409 })
  }

  const revoked = await prisma.sessaoUsuario.updateMany({
    where: {
      id: parsed.data.sessionId,
      usuarioId: auth.session.userId,
      revogadaEm: null,
      expiraEm: { gt: new Date() },
    },
    data: { revogadaEm: new Date() },
  })

  if (revoked.count !== 1) return NextResponse.json({ erro: 'Sessão não encontrada ou já encerrada.' }, { status: 404 })

  await recordSecurityEvent({
    tipo: 'SESSAO_REVOGADA',
    request,
    usuarioId: auth.session.userId,
    empresaId: auth.session.empresaId,
    email: auth.session.email,
    ip: getClientIp(request),
    contexto: { origem: 'configuracoes_usuario' },
  })

  return NextResponse.json({ sucesso: true })
}
