import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit'
import { recordSecurityEvent } from '@/lib/securityEvents'

export async function DELETE(request: NextRequest, context: RouteContext<'/api/admin/seguranca/sessoes/[id]'>) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(request, `admin-session-revoke:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited

  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ erro: 'Sessão inválida.' }, { status: 400 })
  if (id === auth.session.sessionId) return NextResponse.json({ erro: 'A sessão atual do administrador não pode ser encerrada por esta tela.' }, { status: 409 })

  const target = await prisma.sessaoUsuario.findFirst({
    where: { id, revogadaEm: null, expiraEm: { gt: new Date() } },
    select: { id: true, usuarioId: true, empresaId: true, usuario: { select: { email: true } } },
  })
  if (!target) return NextResponse.json({ erro: 'Sessão não encontrada ou já encerrada.' }, { status: 404 })

  const revokedAt = new Date()
  const revoked = await prisma.sessaoUsuario.updateMany({ where: { id: target.id, revogadaEm: null }, data: { revogadaEm: revokedAt } })
  if (revoked.count !== 1) return NextResponse.json({ erro: 'A sessão já foi encerrada por outra operação.' }, { status: 409 })

  await recordSecurityEvent({
    tipo: 'SESSAO_REVOGADA',
    request,
    usuarioId: target.usuarioId,
    empresaId: target.empresaId,
    email: target.usuario.email,
    ip: getClientIp(request),
    contexto: { origem: 'central_seguranca', administradorId: auth.session.userId, sessaoId: target.id },
  })

  return NextResponse.json({ sucesso: true })
}
