import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { executarComAuditoria } from '@/lib/auditoria'
import { dadosDespesa, despesaSchema } from '@/lib/financeiro/despesasPlataforma'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `admin-read:${auth.session.userId}:despesas`, RATE_LIMITS.ADMIN_READ.limit, RATE_LIMITS.ADMIN_READ.windowMs)
  if (limited) return limited
  const query = z.object({ ano: z.coerce.number().int().min(2020).max(2100), pagina: z.coerce.number().int().min(1).max(100_000).default(1) }).safeParse({
    ano: request.nextUrl.searchParams.get('ano'), pagina: request.nextUrl.searchParams.get('pagina') ?? 1,
  })
  if (!query.success) return NextResponse.json({ erro: 'Período inválido.' }, { status: 400 })
  const { ano, pagina } = query.data
  const where = { excluidaEm: null, dataPagamento: { gte: new Date(`${ano}-01-01T00:00:00.000Z`), lt: new Date(`${ano + 1}-01-01T00:00:00.000Z`) } }
  const [rows, total] = await Promise.all([
    prisma.despesaPlataforma.findMany({ where, orderBy: [{ dataPagamento: 'desc' }, { criadoEm: 'desc' }], take: 20, skip: (pagina - 1) * 20 }),
    prisma.despesaPlataforma.count({ where }),
  ])
  return NextResponse.json({ despesas: rows.map(row => ({ ...row, valor: Number(row.valor) })), total, pagina, porPagina: 20 }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `admin-mutation:${auth.session.userId}:despesas`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited
  const parsed = despesaSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message || 'Despesa inválida.' }, { status: 400 })
  const despesa = await executarComAuditoria({ usuarioId: auth.session.userId, origem: 'SUPERADMIN' }, tx => tx.despesaPlataforma.create({
    data: { ...dadosDespesa(parsed.data), criadoPorId: auth.session!.userId }, select: { id: true },
  }))
  return NextResponse.json({ sucesso: true, id: despesa.id }, { status: 201 })
}
