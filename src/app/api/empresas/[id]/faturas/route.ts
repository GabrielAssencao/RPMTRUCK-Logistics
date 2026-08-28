import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executarComAuditoria } from '@/lib/auditoria'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

const schema = z.object({
  mes: z.string().trim().min(3).max(20),
  ano: z.coerce.number().int().min(2020).max(2100),
  tipo: z.string().trim().min(2).max(50),
  valor: z.coerce.number().min(0).max(9_999_999_999.99),
}).strict()

export async function GET(request: NextRequest, context: RouteContext<'/api/empresas/[id]/faturas'>) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `admin-faturas-read:${auth.session.userId}`, RATE_LIMITS.ADMIN_READ.limit, RATE_LIMITS.ADMIN_READ.windowMs)
  if (limited) return limited
  const { id } = await context.params
  const faturas = await prisma.fatura.findMany({ where: { empresaId: id }, orderBy: [{ ano: 'desc' }, { criado_em: 'desc' }], take: 500 })
  return NextResponse.json(faturas, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest, context: RouteContext<'/api/empresas/[id]/faturas'>) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `admin-faturas-create:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da fatura inválidos.' }, { status: 400 })
  const { id } = await context.params
  const empresa = await prisma.empresa.findUnique({ where: { id }, select: { id: true } })
  if (!empresa) return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })
  const fatura = await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'SUPERADMIN' }, (tx) => tx.fatura.create({ data: { ...parsed.data, empresaId: id } }))
  return NextResponse.json(fatura, { status: 201 })
}
