import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { nomeOperacional, textoOperacional, valorMonetarioSchema } from '@/lib/domainValidation'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const schema = z.object({
  nome: nomeOperacional(3, 80),
  grupo: z.string().trim().max(40).optional(),
  descricao: textoOperacional(3, 300).optional(),
  plano: z.enum(['ESSENCIAL', 'AVANCADO']),
  escopo: z.enum(['NOVAS_EMPRESAS', 'TODAS_EMPRESAS', 'EMPRESAS_ATIVAS']),
  precoBaseInicial: valorMonetarioSchema.multipleOf(0.01),
  mesesPrecoInicial: z.coerce.number().int().min(1).max(60),
  precoBaseRenovacao: valorMonetarioSchema.multipleOf(0.01),
  taxaImplantacao: valorMonetarioSchema.multipleOf(0.01),
  limiteAdesoes: z.coerce.number().int().min(1).max(100_000).nullable(),
  visivelSolicitacao: z.boolean(),
}).strict()

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `admin-read:${auth.session.userId}:promocoes`, RATE_LIMITS.ADMIN_READ.limit, RATE_LIMITS.ADMIN_READ.windowMs)
  if (limited) return limited
  const rows = await prisma.promocaoComercial.findMany({ orderBy: { criado_em: 'desc' }, include: { _count: { select: { empresas: true, solicitacoes: true, configuracoesPix: true } } } })
  return NextResponse.json({
    promocoes: rows.map(row => ({
      ...row,
      precoBaseInicial: Number(row.precoBaseInicial),
      precoBaseRenovacao: Number(row.precoBaseRenovacao),
      taxaImplantacao: Number(row.taxaImplantacao),
    })),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const limited = await applyRateLimit(request, `admin-promocao:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ erro: 'Dados da promoção inválidos.' }, { status: 400 })
    if (parsed.data.visivelSolicitacao && parsed.data.escopo !== 'NOVAS_EMPRESAS') {
      return NextResponse.json({ erro: 'Somente promoções para novas empresas podem aparecer na solicitação de acesso.' }, { status: 400 })
    }
    const promocao = await prisma.promocaoComercial.create({
      data: { ...parsed.data, grupo: parsed.data.grupo || null, descricao: parsed.data.descricao || null },
      select: { id: true },
    })
    return NextResponse.json({ sucesso: true, id: promocao.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ erro: 'Já existe uma promoção com este nome.' }, { status: 409 })
    }
    console.error('Falha ao criar promoção:', error)
    return NextResponse.json({ erro: 'Não foi possível criar a promoção.' }, { status: 500 })
  }
}
