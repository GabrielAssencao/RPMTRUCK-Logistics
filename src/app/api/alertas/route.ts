import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { escopoAlertaVisivel } from '@/lib/alertas'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(
    request,
    `alert-read:${auth.session.userId}`,
    RATE_LIMITS.ALERT_READ.limit,
    RATE_LIMITS.ALERT_READ.windowMs,
  )
  if (limited) return limited

  const alertas = await prisma.alertaSistema.findMany({
    where: {
      ...escopoAlertaVisivel(auth.session.userId),
      leituras: { none: { usuarioId: auth.session.userId } },
    },
    orderBy: [{ severidade: 'desc' }, { inicio_em: 'desc' }],
    take: 10,
    select: { id: true, titulo: true, mensagem: true, severidade: true, inicio_em: true, fim_em: true },
  })

  return NextResponse.json({ alertas }, { headers: { 'Cache-Control': 'private, no-store' } })
}
