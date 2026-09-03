import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(
    request,
    `admin-chat:${auth.session.userId}`,
    RATE_LIMITS.CHAT_READ.limit,
    RATE_LIMITS.CHAT_READ.windowMs,
  )
  if (limited) return limited

  const conversas = await prisma.conversaSuporte.findMany({
    orderBy: { atualizado_em: 'desc' },
    take: 100,
    select: {
      id: true,
      atualizado_em: true,
      empresa: { select: { id: true, nome: true, email: true, status: true } },
      mensagens: {
        orderBy: { criado_em: 'desc' },
        take: 1,
        select: { conteudo: true, criado_em: true, autor: { select: { role: true } } },
      },
      _count: {
        select: { mensagens: { where: { lida_em: null, autor: { role: { not: 'ADMIN_RPM' } } } } },
      },
    },
  })

  return NextResponse.json(
    {
      conversas: conversas.map(({ _count, ...conversa }) => ({
        ...conversa,
        ultimaMensagem: conversa.mensagens[0] || null,
        mensagens: undefined,
        naoLidas: _count.mensagens,
      })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
