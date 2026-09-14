import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireLembreteAuth } from '@/lib/lembreteAuth'
import { textoOperacional } from '@/lib/domainValidation'
import { calcularNotificacaoLembrete, perfilPodeUsarLembretes } from '@/lib/lembretePessoal'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { anteriorAoMinutoDaReferencia } from '@/lib/dataHoraOperacional'

import { limparLembretesConcluidos } from '@/lib/lembreteRetencao'

export const dynamic = 'force-dynamic'

const criarSchema = z.object({
  titulo: textoOperacional(3, 120),
  descricao: textoOperacional(1, 1000).nullable().optional(),
  dataHora: z.string().datetime(),
  urgencia: z.enum(['LEVE', 'MEDIA', 'ALTA']).default('MEDIA'),
  modoNotificacao: z.enum(['AUTOMATICA', 'PERSONALIZADA']).default('AUTOMATICA'),
  notificarEm: z.string().datetime().nullable().optional(),
}).strict()

async function autenticar(request: NextRequest, escrita = false) {
  const auth = await requireLembreteAuth(request, escrita)
  if (auth.error || !auth.session) return { auth, response: NextResponse.json({ erro: auth.error }, { status: auth.status }) }
  if (!perfilPodeUsarLembretes(auth.session.role)) {
    return { auth, response: NextResponse.json({ erro: 'Lembretes pessoais estão disponíveis para gestores e operadores.' }, { status: 403 }) }
  }
  const limited = await applyRateLimit(
    request,
    `personal-reminder:${auth.session.empresaId ?? null}:${auth.session.userId}`,
    escrita ? RATE_LIMITS.TASK_MUTATION.limit : RATE_LIMITS.TASK_READ.limit,
    escrita ? RATE_LIMITS.TASK_MUTATION.windowMs : RATE_LIMITS.TASK_READ.windowMs,
  )
  return { auth, response: limited }
}

export async function GET(request: NextRequest) {
  const { auth, response } = await autenticar(request)
  if (response) return response
  if (!auth.session) return NextResponse.json({ erro: 'Sessão empresarial inválida.' }, { status: 403 })

  await limparLembretesConcluidos({ empresaId: auth.session.empresaId ?? null, usuarioId: auth.session.userId })
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: auth.session.userId }, select: { lembretesRetencaoDias: true } })
  const lembretes = await prisma.lembretePessoal.findMany({
    where: { empresaId: auth.session.empresaId ?? null, usuarioId: auth.session.userId },
    orderBy: [{ concluido: 'asc' }, { ordem: 'asc' }, { dataHora: 'asc' }],
    take: 500,
  })
  return NextResponse.json(lembretes, { headers: { "X-Lembretes-Retencao-Dias": String(usuario.lembretesRetencaoDias ?? "manter"), "Cache-Control": "private, no-store" } })
}

export async function POST(request: NextRequest) {
  const { auth, response } = await autenticar(request, true)
  if (response) return response
  if (!auth.session) return NextResponse.json({ erro: 'Sessão empresarial inválida.' }, { status: 403 })

  const parsed = criarSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados do lembrete inválidos.' }, { status: 400 })

  const dataHora = new Date(parsed.data.dataHora)
  if (anteriorAoMinutoDaReferencia(dataHora)) {
    return NextResponse.json({ erro: 'O lembrete não pode ser agendado antes do momento do cadastro.' }, { status: 400 })
  }

  let notificarEm: Date
  try {
    notificarEm = calcularNotificacaoLembrete(
      dataHora,
      parsed.data.urgencia,
      parsed.data.modoNotificacao,
      parsed.data.notificarEm ? new Date(parsed.data.notificarEm) : null,
    )
  } catch (error) {
    return NextResponse.json({ erro: error instanceof Error ? error.message : 'Notificação inválida.' }, { status: 400 })
  }

  const ultimaOrdem = await prisma.lembretePessoal.aggregate({
    where: { empresaId: auth.session.empresaId ?? null, usuarioId: auth.session.userId, concluido: false },
    _max: { ordem: true },
  })
  const lembrete = await prisma.lembretePessoal.create({
    data: {
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao || null,
      dataHora,
      urgencia: parsed.data.urgencia,
      modoNotificacao: parsed.data.modoNotificacao,
      notificarEm,
      ordem: Math.min((ultimaOrdem._max.ordem ?? 0) + 1000, 1_000_000_000),
      empresaId: auth.session.empresaId ?? null,
      usuarioId: auth.session.userId,
    },
  })
  return NextResponse.json(lembrete, { status: 201 })
}

const preferenciaSchema = z.object({ dias: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]).nullable() }).strict()

export async function PATCH(request: NextRequest) {
  const { auth, response } = await autenticar(request, true)
  if (response) return response
  if (!auth.session) return NextResponse.json({ erro: 'Sessão inválida.' }, { status: 403 })
  const parsed = preferenciaSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Escolha um prazo válido.' }, { status: 400 })
  await prisma.usuario.update({
    where: { id: auth.session.userId, empresaId: auth.session.empresaId ?? null },
    data: { lembretesRetencaoDias: parsed.data.dias },
  })
  return NextResponse.json({ dias: parsed.data.dias })
}
