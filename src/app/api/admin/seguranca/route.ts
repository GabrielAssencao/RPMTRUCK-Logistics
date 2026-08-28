import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const limited = await applyRateLimit(
    request,
    `admin-security:${auth.session.userId}`,
    RATE_LIMITS.ADMIN_READ.limit,
    RATE_LIMITS.ADMIN_READ.windowMs,
  )
  if (limited) return limited

  const agora = new Date()
  const ativoDesde = new Date(agora.getTime() - 5 * 60 * 1000)
  const ultimas24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000)

  const [sessoes, eventos, auditoria, falhasLogin, bloqueiosRateLimit] = await Promise.all([
    prisma.sessaoUsuario.findMany({
      where: { revogadaEm: null, expiraEm: { gt: agora }, ultimaAtividade: { gte: ativoDesde } },
      orderBy: { ultimaAtividade: 'desc' },
      take: 50,
      select: {
        id: true,
        criadoEm: true,
        ultimaAtividade: true,
        expiraEm: true,
        userAgent: true,
        usuario: { select: { id: true, nome: true, email: true, role: true } },
        empresa: { select: { id: true, nome: true } },
      },
    }),
    prisma.eventoSeguranca.findMany({
      orderBy: { criadoEm: 'desc' },
      take: 50,
      select: {
        id: true,
        tipo: true,
        criadoEm: true,
        ipHash: true,
        userAgent: true,
        usuario: { select: { id: true, nome: true, email: true } },
        empresa: { select: { id: true, nome: true } },
      },
    }),
    prisma.auditoriaLog.findMany({
      orderBy: { criadoEm: 'desc' },
      take: 50,
      select: {
        id: true,
        tabela: true,
        acao: true,
        registroId: true,
        empresaId: true,
        usuarioId: true,
        origem: true,
        criadoEm: true,
      },
    }),
    prisma.eventoSeguranca.count({ where: { tipo: 'LOGIN_FALHA', criadoEm: { gte: ultimas24h } } }),
    prisma.eventoSeguranca.count({ where: { tipo: 'RATE_LIMIT', criadoEm: { gte: ultimas24h } } }),
  ])

  const userIds = [...new Set(auditoria.map((item) => item.usuarioId).filter((id): id is string => Boolean(id)))]
  const companyIds = [...new Set(auditoria.map((item) => item.empresaId).filter((id): id is string => Boolean(id)))]
  const [usuariosAuditoria, empresasAuditoria] = await Promise.all([
    prisma.usuario.findMany({ where: { id: { in: userIds } }, select: { id: true, nome: true, email: true } }),
    prisma.empresa.findMany({ where: { id: { in: companyIds } }, select: { id: true, nome: true } }),
  ])
  const usuariosPorId = new Map(usuariosAuditoria.map((item) => [item.id, item]))
  const empresasPorId = new Map(empresasAuditoria.map((item) => [item.id, item]))

  return NextResponse.json(
    {
      resumo: { sessoesAtivas: sessoes.length, falhasLogin24h: falhasLogin, bloqueiosRateLimit24h: bloqueiosRateLimit },
      sessoes,
      eventos: eventos.map((evento) => ({
        ...evento,
        ipCorrelacao: evento.ipHash?.slice(0, 12) || null,
        ipHash: undefined,
      })),
      auditoria: auditoria.map((item) => ({
        ...item,
        usuario: item.usuarioId ? usuariosPorId.get(item.usuarioId) || null : null,
        empresa: item.empresaId ? empresasPorId.get(item.empresaId) || null : null,
      })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
