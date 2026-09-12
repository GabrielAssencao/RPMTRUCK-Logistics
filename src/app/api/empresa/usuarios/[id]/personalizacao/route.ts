import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { corTemaValida, normalizarCorTema } from '@/data/temasELogos'
import { executarComAuditoria } from '@/lib/auditoria'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { prisma } from '@/lib/prisma'
import { ESTILOS_FUNDO_EMPRESA, estiloFundoEmpresaValido } from '@/lib/empresaPreferences'

const personalizacaoSchema = z.object({
  corTema: z.string().trim().toLowerCase().refine(corTemaValida),
  temaClaro: z.boolean(),
  rotuloEquipe: z.string().trim().max(48).nullable(),
  podePersonalizarTema: z.boolean(),
  estiloFundo: z.enum(ESTILOS_FUNDO_EMPRESA),
}).strict()

async function autorizarGestor(request: NextRequest, limitarMutacao = false) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId) {
    return { auth: null, response: NextResponse.json({ erro: auth.error || 'Não autenticado.' }, { status: auth.status }) }
  }
  const limited = limitarMutacao ? await applyRateLimit(
      request,
      `company-theme-mutation:${auth.session.empresaId}:${auth.session.userId}`,
      RATE_LIMITS.ADMIN_MUTATION.limit,
      RATE_LIMITS.ADMIN_MUTATION.windowMs,
    ) : null
  return { auth, response: limited }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { auth, response } = await autorizarGestor(request)
  if (response) return response
  if (!auth?.session?.empresaId) return NextResponse.json({ erro: 'Acesso não autorizado.' }, { status: 403 })

  const usuario = await prisma.usuario.findFirst({
    where: { id, empresaId: auth.session.empresaId, excluidoEm: null },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      ativo: true,
      corTema: true,
      temaClaro: true,
      rotuloEquipe: true,
      podePersonalizarTema: true,
      estiloFundo: true,
    },
  })
  if (!usuario) return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  if (usuario.role === 'GESTOR_EMPRESA' || usuario.role === 'ADMIN_RPM') {
    return NextResponse.json({ erro: 'A personalização do gestor deve ser alterada nas configurações da conta.' }, { status: 400 })
  }

  const gestor = await prisma.usuario.findFirst({
    where: { empresaId: auth.session.empresaId, role: 'GESTOR_EMPRESA', excluidoEm: null },
    select: { corTema: true, temaClaro: true, estiloFundo: true },
    orderBy: { criado_em: 'asc' },
  })

  return NextResponse.json({
    ...usuario,
    corTema: normalizarCorTema(usuario.corTema ?? gestor?.corTema),
    temaClaro: usuario.temaClaro ?? gestor?.temaClaro ?? false,
    estiloFundo: estiloFundoEmpresaValido(usuario.estiloFundo ?? gestor?.estiloFundo)
      ? (usuario.estiloFundo ?? gestor?.estiloFundo)
      : 'DESLIGADO',
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { auth, response } = await autorizarGestor(request, true)
  if (response) return response
  if (!auth?.session?.empresaId) return NextResponse.json({ erro: 'Acesso não autorizado.' }, { status: 403 })

  const parsed = personalizacaoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Personalização inválida.' }, { status: 400 })

  const alvo = await prisma.usuario.findFirst({
    where: { id, empresaId: auth.session.empresaId, excluidoEm: null },
    select: { id: true, role: true },
  })
  if (!alvo) return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  if (alvo.role === 'GESTOR_EMPRESA' || alvo.role === 'ADMIN_RPM') {
    return NextResponse.json({ erro: 'O tema do gestor não pode ser alterado por esta tela.' }, { status: 400 })
  }

  const atualizado = await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.usuario.update({
    where: { id: alvo.id },
    data: {
      corTema: parsed.data.corTema,
      temaClaro: parsed.data.temaClaro,
      rotuloEquipe: parsed.data.rotuloEquipe || null,
      podePersonalizarTema: parsed.data.podePersonalizarTema,
      estiloFundo: parsed.data.estiloFundo,
    },
    select: {
      id: true,
      corTema: true,
      temaClaro: true,
      rotuloEquipe: true,
      podePersonalizarTema: true,
      estiloFundo: true,
    },
  }))

  return NextResponse.json(atualizado)
}
