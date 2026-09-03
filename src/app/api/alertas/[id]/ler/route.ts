import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { escopoAlertaVisivel } from '@/lib/alertas'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(
    request,
    `alert-mutation:${auth.session.userId}`,
    RATE_LIMITS.ALERT_MUTATION.limit,
    RATE_LIMITS.ALERT_MUTATION.windowMs,
  )
  if (limited) return limited

  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ erro: 'Alerta inválido.' }, { status: 400 })

  const alerta = await prisma.alertaSistema.findFirst({
    where: { id, ...escopoAlertaVisivel(auth.session.userId) },
    select: { id: true },
  })
  if (!alerta) return NextResponse.json({ erro: 'Alerta não encontrado.' }, { status: 404 })

  await prisma.alertaLeitura.upsert({
    where: { alertaId_usuarioId: { alertaId: id, usuarioId: auth.session.userId } },
    create: { alertaId: id, usuarioId: auth.session.userId },
    update: { lido_em: new Date() },
  })
  return NextResponse.json({ sucesso: true }, { headers: { 'Cache-Control': 'no-store' } })
}
