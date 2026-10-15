import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { executarComAuditoria } from '@/lib/auditoria'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const alterarSchema = z.object({ ativa: z.boolean() }).strict()

async function autorizar(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return { error: NextResponse.json({ erro: auth.error }, { status: auth.status }) }
  const limited = await applyRateLimit(request, `admin-mutation:${auth.session.userId}:promocoes`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  return { error: limited, userId: auth.session.userId }
}

export async function PATCH(request: NextRequest, context: RouteContext<'/api/admin/promocoes/[id]'>) {
  const auth = await autorizar(request)
  if (auth.error) return auth.error
  const parsed = alterarSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Estado da promoção inválido.' }, { status: 400 })
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ erro: 'Promoção inválida.' }, { status: 400 })
  const atualizada = await executarComAuditoria({ usuarioId: auth.userId, origem: 'SUPERADMIN' }, tx => tx.promocaoComercial.updateMany({
    where: { id },
    data: { ativa: parsed.data.ativa },
  }))
  if (!atualizada.count) return NextResponse.json({ erro: 'Promoção não encontrada.' }, { status: 404 })
  return NextResponse.json({ sucesso: true })
}

export async function DELETE(request: NextRequest, context: RouteContext<'/api/admin/promocoes/[id]'>) {
  const auth = await autorizar(request)
  if (auth.error) return auth.error
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ erro: 'Promoção inválida.' }, { status: 400 })
  const resultado = await executarComAuditoria({ usuarioId: auth.userId, origem: 'SUPERADMIN' }, async tx => {
    const promocao = await tx.promocaoComercial.findUnique({ where: { id }, include: { _count: { select: { empresas: true, solicitacoes: true, configuracoesPix: true } } } })
    if (!promocao) return 'NAO_ENCONTRADA'
    if (promocao._count.empresas || promocao._count.solicitacoes || promocao._count.configuracoesPix) return 'EM_USO'
    await tx.promocaoComercial.delete({ where: { id } })
    return 'EXCLUIDA'
  }, { isolationLevel: 'Serializable' })
  if (resultado === 'NAO_ENCONTRADA') return NextResponse.json({ erro: 'Promoção não encontrada.' }, { status: 404 })
  if (resultado === 'EM_USO') return NextResponse.json({ erro: 'Esta promoção possui histórico ou arquivos vinculados. Arquive-a para manter a rastreabilidade.' }, { status: 409 })
  return NextResponse.json({ sucesso: true })
}
