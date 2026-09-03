import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminRole, requireAuth } from '@/lib/auth'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { textoOperacional } from '@/lib/domainValidation'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const mensagemSchema = z.object({
  mensagem: textoOperacional(1, 2000),
  empresaId: z.string().uuid().optional(),
}).strict()

async function resolverEscopo(request: NextRequest, empresaIdInformada?: string | null) {
  const auth = await requireAuth(request)
  if (auth.error || !auth.session) return { error: auth.error, status: auth.status } as const

  if (isAdminRole(auth.session.role)) {
    const empresaId = empresaIdInformada || null
    if (!empresaId || !z.string().uuid().safeParse(empresaId).success) {
      return { error: 'Selecione uma empresa válida.', status: 400 } as const
    }
    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { id: true, nome: true } })
    if (!empresa) return { error: 'Empresa não encontrada.', status: 404 } as const
    return { auth, empresaId, empresa, admin: true } as const
  }

  const empresaAuth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (empresaAuth.error || !empresaAuth.session?.empresaId || !empresaAuth.empresa) {
    return { error: empresaAuth.error, status: empresaAuth.status } as const
  }
  return {
    auth,
    empresaId: empresaAuth.session.empresaId,
    empresa: { id: empresaAuth.empresa.id, nome: empresaAuth.empresa.nome },
    admin: false,
  } as const
}

export async function GET(request: NextRequest) {
  const escopo = await resolverEscopo(request, request.nextUrl.searchParams.get('empresaId'))
  if ('error' in escopo) return NextResponse.json({ erro: escopo.error }, { status: escopo.status })

  const limited = await applyRateLimit(
    request,
    `chat-read:${escopo.auth.session!.userId}`,
    RATE_LIMITS.CHAT_READ.limit,
    RATE_LIMITS.CHAT_READ.windowMs,
  )
  if (limited) return limited

  const conversa = await prisma.conversaSuporte.findUnique({
    where: { empresaId: escopo.empresaId },
    select: { id: true },
  })
  if (!conversa) {
    return NextResponse.json(
      { empresa: escopo.empresa, conversaId: null, mensagens: [], naoLidas: 0 },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  }

  const papelRemetente = escopo.admin ? { not: 'ADMIN_RPM' as const } : 'ADMIN_RPM' as const
  await prisma.mensagemSuporte.updateMany({
    where: { conversaId: conversa.id, lida_em: null, autor: { role: papelRemetente } },
    data: { lida_em: new Date() },
  })

  const mensagens = await prisma.mensagemSuporte.findMany({
    where: { conversaId: conversa.id },
    orderBy: { criado_em: 'desc' },
    take: 100,
    select: {
      id: true,
      conteudo: true,
      criado_em: true,
      lida_em: true,
      autor: { select: { id: true, nome: true, role: true } },
    },
  })

  return NextResponse.json(
    { empresa: escopo.empresa, conversaId: conversa.id, mensagens: mensagens.reverse(), naoLidas: 0 },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function POST(request: NextRequest) {
  const preAuth = await requireAuth(request)
  if (preAuth.error || !preAuth.session) return NextResponse.json({ erro: preAuth.error }, { status: preAuth.status })

  const parsed = mensagemSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Mensagem inválida. Use até 2.000 caracteres.' }, { status: 400 })

  const escopo = await resolverEscopo(request, parsed.data.empresaId)
  if ('error' in escopo) return NextResponse.json({ erro: escopo.error }, { status: escopo.status })

  const limited = await applyRateLimit(
    request,
    `chat-send:${escopo.auth.session!.userId}`,
    RATE_LIMITS.CHAT_SEND.limit,
    RATE_LIMITS.CHAT_SEND.windowMs,
  )
  if (limited) return limited

  const mensagem = await prisma.$transaction(async (tx) => {
    const conversa = await tx.conversaSuporte.upsert({
      where: { empresaId: escopo.empresaId },
      create: { empresaId: escopo.empresaId },
      update: { atualizado_em: new Date() },
      select: { id: true },
    })
    return tx.mensagemSuporte.create({
      data: {
        conversaId: conversa.id,
        autorId: escopo.auth.session!.userId,
        conteudo: parsed.data.mensagem,
      },
      select: {
        id: true,
        conteudo: true,
        criado_em: true,
        lida_em: true,
        autor: { select: { id: true, nome: true, role: true } },
      },
    })
  })

  return NextResponse.json({ mensagem }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
