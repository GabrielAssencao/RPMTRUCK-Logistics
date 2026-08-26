import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { escopoNotificacoes } from '@/lib/notificacoes'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

const atualizarSchema = z.object({ lida: z.boolean() })

async function obterNotificacaoAutorizada(request: NextRequest, id: string) {
  const auth = await requireAuth(request)
  if (auth.error || !auth.session) return { auth, notificacao: null, limited: null }
  const limited = await applyRateLimit(
    request,
    `notification-mutation:${auth.session.userId}`,
    RATE_LIMITS.NOTIFICATION_MUTATION.limit,
    RATE_LIMITS.NOTIFICATION_MUTATION.windowMs,
  )
  if (limited) return { auth, notificacao: null, limited }
  const notificacao = await prisma.notificacao.findFirst({
    where: { id, ...escopoNotificacoes(auth.session) },
    select: { id: true },
  })
  return { auth, notificacao, limited: null }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { auth, notificacao, limited } = await obterNotificacaoAutorizada(request, params.id)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  if (limited) return limited
  if (!notificacao) return NextResponse.json({ erro: 'Notificação não encontrada.' }, { status: 404 })

  const parsed = atualizarSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Estado de leitura inválido.' }, { status: 400 })

  return NextResponse.json(await prisma.notificacao.update({
    where: { id: notificacao.id },
    data: { lida: parsed.data.lida },
  }))
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { auth, notificacao, limited } = await obterNotificacaoAutorizada(request, params.id)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  if (limited) return limited
  if (!notificacao) return NextResponse.json({ erro: 'Notificação não encontrada.' }, { status: 404 })

  await prisma.notificacao.delete({ where: { id: notificacao.id } })
  return NextResponse.json({ sucesso: true })
}
