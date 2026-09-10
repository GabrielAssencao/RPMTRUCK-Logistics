import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { executarComAuditoria } from '@/lib/auditoria'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { corTemaValida } from '@/data/temasELogos'
import { obterPreferenciasVisuaisEfetivas } from '@/lib/preferenciasVisuaisUsuario'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const preferenciasSchema = z.object({
  corTema: z.string().trim().toLowerCase().refine(corTemaValida),
  temaClaro: z.boolean(),
}).strict()

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session?.empresaId || !auth.usuario) {
    return NextResponse.json({ erro: auth.error || 'Não autenticado.' }, { status: auth.status })
  }

  const preferencias = await obterPreferenciasVisuaisEfetivas(prisma, auth.usuario, auth.session.empresaId)
  return NextResponse.json(preferencias, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session?.empresaId || !auth.usuario) {
    return NextResponse.json({ erro: auth.error || 'Não autenticado.' }, { status: auth.status })
  }

  const gestor = auth.session.role === 'GESTOR_EMPRESA' || auth.session.role === 'GESTOR'
  if (!gestor && !auth.usuario.podePersonalizarTema) {
    return NextResponse.json({ erro: 'O tema desta conta é administrado pelo gestor.' }, { status: 403 })
  }

  const limited = await applyRateLimit(
    request,
    `company-self-theme:${auth.session.empresaId}:${auth.session.userId}`,
    RATE_LIMITS.ADMIN_MUTATION.limit,
    RATE_LIMITS.ADMIN_MUTATION.windowMs,
  )
  if (limited) return limited

  const parsed = preferenciasSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Preferências visuais inválidas.' }, { status: 400 })
  }

  const atualizado = await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.usuario.update({
    where: { id: auth.session.userId },
    data: parsed.data,
    select: {
      corTema: true,
      temaClaro: true,
      rotuloEquipe: true,
      podePersonalizarTema: true,
    },
  }))

  return NextResponse.json({ ...atualizado, herdadoDoGestor: false })
}
