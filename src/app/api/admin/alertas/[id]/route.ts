import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { alertaSistemaSchema } from '@/lib/alertas'
import { executarComAuditoria } from '@/lib/auditoria'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

async function autorizar(request: NextRequest, params: Promise<{ id: string }>) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return { response: NextResponse.json({ erro: auth.error }, { status: auth.status }) }
  const limited = await applyRateLimit(request, `admin-alert-mutation:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return { response: limited }
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return { response: NextResponse.json({ erro: 'Alerta inválido.' }, { status: 400 }) }
  return { auth, id }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const acesso = await autorizar(request, params)
  if ('response' in acesso) return acesso.response
  const parsed = alertaSistemaSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message || 'Dados do alerta inválidos.' }, { status: 400 })
  const { inicioEm, fimEm, destinatarioId, ...dados } = parsed.data

  if (destinatarioId) {
    const existe = await prisma.usuario.count({ where: { id: destinatarioId, role: { not: 'ADMIN_RPM' } } })
    if (!existe) return NextResponse.json({ erro: 'Destinatário não encontrado.' }, { status: 404 })
  }

  const existente = await prisma.alertaSistema.count({ where: { id: acesso.id } })
  if (!existente) return NextResponse.json({ erro: 'Alerta não encontrado.' }, { status: 404 })
  const alerta = await executarComAuditoria({ usuarioId: acesso.auth.session!.userId, origem: 'SUPERADMIN' }, (tx) => tx.alertaSistema.update({
    where: { id: acesso.id }, data: { ...dados, inicio_em: inicioEm, fim_em: fimEm, destinatarioId },
  }))
  return NextResponse.json({ alerta }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const acesso = await autorizar(request, params)
  if ('response' in acesso) return acesso.response
  const removido = await executarComAuditoria({ usuarioId: acesso.auth.session!.userId, origem: 'SUPERADMIN' }, (tx) => tx.alertaSistema.deleteMany({ where: { id: acesso.id } }))
  if (!removido.count) return NextResponse.json({ erro: 'Alerta não encontrado.' }, { status: 404 })
  return NextResponse.json({ sucesso: true }, { headers: { 'Cache-Control': 'no-store' } })
}
