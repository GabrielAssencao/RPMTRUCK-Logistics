import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { executarComAuditoria } from '@/lib/auditoria'
import { listarPlanosComerciais } from '@/lib/planosComerciais'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { valorMonetarioSchema } from '@/lib/domainValidation'
import { PLANOS } from '@/utils/planos'

export const dynamic = 'force-dynamic'

const atualizarPlanoSchema = z.object({
  plano: z.enum(PLANOS),
  versao: z.coerce.number().int().min(1),
  precoBase: valorMonetarioSchema.multipleOf(0.01),
  taxaImplantacao: valorMonetarioSchema.multipleOf(0.01),
  precoUsuarioAdicional: valorMonetarioSchema.max(80_000).multipleOf(0.01),
  precoVeiculoAdicional: valorMonetarioSchema.max(80_000).multipleOf(0.01),
}).strict()

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(
    request,
    `admin-read:${auth.session.userId}:planos`,
    RATE_LIMITS.ADMIN_READ.limit,
    RATE_LIMITS.ADMIN_READ.windowMs,
  )
  if (limited) return limited

  const planos = await listarPlanosComerciais()
  return NextResponse.json({ planos }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(
    request,
    `admin-mutation:${auth.session.userId}:planos`,
    RATE_LIMITS.ADMIN_MUTATION.limit,
    RATE_LIMITS.ADMIN_MUTATION.windowMs,
  )
  if (limited) return limited

  const parsed = atualizarPlanoSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Valores comerciais inválidos.' }, { status: 400 })
  }

  const atualizado = await executarComAuditoria(
    { usuarioId: auth.session.userId, origem: 'SUPERADMIN' },
    (tx) => tx.planoComercial.updateMany({
      where: { plano: parsed.data.plano, versao: parsed.data.versao },
      data: {
        precoBase: parsed.data.precoBase,
        taxaImplantacao: parsed.data.taxaImplantacao,
        precoUsuarioAdicional: parsed.data.precoUsuarioAdicional,
        precoVeiculoAdicional: parsed.data.precoVeiculoAdicional,
        versao: { increment: 1 },
      },
    }),
    { isolationLevel: 'Serializable' },
  )

  if (atualizado.count !== 1) {
    return NextResponse.json(
      { erro: 'Os valores deste plano foram alterados por outra sessão. Recarregue antes de salvar.' },
      { status: 409 },
    )
  }

  return NextResponse.json({
    sucesso: true,
    plano: parsed.data.plano,
    versao: parsed.data.versao + 1,
  })
}
