import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { alertaSistemaSchema } from '@/lib/alertas'
import { executarComAuditoria } from '@/lib/auditoria'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `admin-alert-read:${auth.session.userId}`, RATE_LIMITS.ADMIN_READ.limit, RATE_LIMITS.ADMIN_READ.windowMs)
  if (limited) return limited

  const [alertas, usuarios] = await Promise.all([
    prisma.alertaSistema.findMany({
      orderBy: { criado_em: 'desc' },
      take: 100,
      select: {
        id: true, titulo: true, mensagem: true, severidade: true, ativo: true,
        inicio_em: true, fim_em: true, criado_em: true,
        destinatario: { select: { id: true, nome: true, email: true, empresa: { select: { nome: true } } } },
        criadoPor: { select: { nome: true } },
        _count: { select: { leituras: true } },
      },
    }),
    prisma.usuario.findMany({
      where: { role: { not: 'ADMIN_RPM' } },
      orderBy: [{ empresa: { nome: 'asc' } }, { nome: 'asc' }],
      take: 1000,
      select: { id: true, nome: true, email: true, role: true, empresa: { select: { nome: true } } },
    }),
  ])

  return NextResponse.json({ alertas, usuarios }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `admin-alert-mutation:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited

  const parsed = alertaSistemaSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message || 'Dados do alerta inválidos.' }, { status: 400 })
  const { inicioEm, fimEm, destinatarioId, ...dados } = parsed.data

  if (destinatarioId) {
    const existe = await prisma.usuario.count({ where: { id: destinatarioId, role: { not: 'ADMIN_RPM' } } })
    if (!existe) return NextResponse.json({ erro: 'Destinatário não encontrado.' }, { status: 404 })
  }

  const alerta = await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'SUPERADMIN' }, (tx) => tx.alertaSistema.create({
    data: { ...dados, inicio_em: inicioEm, fim_em: fimEm, destinatarioId, criadoPorId: auth.session!.userId },
  }))
  return NextResponse.json({ alerta }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
