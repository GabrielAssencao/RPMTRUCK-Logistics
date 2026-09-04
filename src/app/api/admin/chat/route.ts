import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(request, `admin-chat:${auth.session.userId}`, RATE_LIMITS.CHAT_READ.limit, RATE_LIMITS.CHAT_READ.windowMs)
  if (limited) return limited

  const tickets = await prisma.conversaSuporte.findMany({
    orderBy: { atualizado_em: 'desc' },
    take: 200,
    select: {
      id: true,
      protocolo: true,
      assunto: true,
      categoria: true,
      status: true,
      prioridade: true,
      cobravelExtra: true,
      franquiaNoMomento: true,
      ordemNaCompetencia: true,
      criado_em: true,
      atualizado_em: true,
      primeiraRespostaEm: true,
      encerradoEm: true,
      empresa: { select: { id: true, nome: true, email: true, status: true, plano: true } },
      mensagens: {
        orderBy: { criado_em: 'desc' },
        take: 1,
        select: { conteudo: true, criado_em: true, automatica: true, autor: { select: { role: true } } },
      },
      _count: {
        select: {
          mensagens: {
            where: { lida_em: null, tipo: 'USUARIO', autor: { role: { not: 'ADMIN_RPM' } } },
          },
        },
      },
    },
  })

  return NextResponse.json({
    tickets: tickets.map(({ _count, mensagens, ...ticket }) => ({
      ...ticket,
      ultimaMensagem: mensagens[0] || null,
      naoLidas: _count.mensagens,
    })),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
