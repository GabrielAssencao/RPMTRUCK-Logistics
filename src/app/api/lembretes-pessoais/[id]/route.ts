import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireLembreteAuth } from '@/lib/lembreteAuth'
import { textoOperacional } from '@/lib/domainValidation'
import { calcularNotificacaoLembrete, perfilPodeUsarLembretes, type ModoNotificacaoLembrete, type UrgenciaLembrete } from '@/lib/lembretePessoal'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { anteriorAoDiaDaReferencia, anteriorAoMinutoDaReferencia, inicioDoMinuto } from '@/lib/dataHoraOperacional'

const atualizarSchema = z.object({
  titulo: textoOperacional(3, 120).optional(),
  descricao: textoOperacional(1, 1000).nullable().optional(),
  dataHora: z.string().datetime().optional(),
  diaInteiro: z.boolean().optional(),
  urgencia: z.enum(['LEVE', 'MEDIA', 'ALTA']).optional(),
  modoNotificacao: z.enum(['AUTOMATICA', 'PERSONALIZADA']).optional(),
  notificarEm: z.string().datetime().nullable().optional(),
  concluido: z.boolean().optional(),
  ordem: z.number().int().min(0).max(1_000_000_000).optional(),
}).strict().refine((dados) => Object.keys(dados).length > 0, { message: 'Informe uma alteração.' })

async function autenticar(request: NextRequest) {
  const auth = await requireLembreteAuth(request, true)
  if (auth.error || !auth.session) return { auth, response: NextResponse.json({ erro: auth.error }, { status: auth.status }) }
  if (!perfilPodeUsarLembretes(auth.session.role)) {
    return { auth, response: NextResponse.json({ erro: 'Lembretes pessoais estão disponíveis para gestores e operadores.' }, { status: 403 }) }
  }
  const limited = await applyRateLimit(
    request,
    `personal-reminder:${auth.session.empresaId ?? null}:${auth.session.userId}`,
    RATE_LIMITS.TASK_MUTATION.limit,
    RATE_LIMITS.TASK_MUTATION.windowMs,
  )
  return { auth, response: limited }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { auth, response } = await autenticar(request)
  if (response) return response
  if (!auth.session) return NextResponse.json({ erro: 'Sessão empresarial inválida.' }, { status: 403 })
  const parsed = atualizarSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Alteração do lembrete inválida.' }, { status: 400 })

  const atual = await prisma.lembretePessoal.findFirst({
    where: { id, empresaId: auth.session.empresaId ?? null, usuarioId: auth.session.userId },
  })
  if (!atual) return NextResponse.json({ erro: 'Lembrete não encontrado.' }, { status: 404 })

  const dataHora = parsed.data.dataHora ? new Date(parsed.data.dataHora) : atual.dataHora
  const diaInteiro = parsed.data.diaInteiro ?? atual.diaInteiro
  if (
    parsed.data.dataHora
    && inicioDoMinuto(dataHora).getTime() !== inicioDoMinuto(atual.dataHora).getTime()
    && (diaInteiro ? anteriorAoDiaDaReferencia(dataHora) : anteriorAoMinutoDaReferencia(dataHora))
  ) {
    return NextResponse.json({ erro: 'O lembrete não pode ser alterado para uma data passada.' }, { status: 400 })
  }
  const urgencia = (parsed.data.urgencia ?? atual.urgencia) as UrgenciaLembrete
  const modo = (parsed.data.modoNotificacao ?? atual.modoNotificacao) as ModoNotificacaoLembrete
  const configuracaoInformada = parsed.data.dataHora !== undefined
    || parsed.data.urgencia !== undefined
    || parsed.data.modoNotificacao !== undefined
    || parsed.data.notificarEm !== undefined

  let notificarEm = atual.notificarEm
  if (configuracaoInformada) {
    try {
      notificarEm = calcularNotificacaoLembrete(
        dataHora,
        urgencia,
        modo,
        parsed.data.notificarEm === undefined ? atual.notificarEm : parsed.data.notificarEm ? new Date(parsed.data.notificarEm) : null,
      )
    } catch (error) {
      return NextResponse.json({ erro: error instanceof Error ? error.message : 'Notificação inválida.' }, { status: 400 })
    }
  }
  const deveReagendar = configuracaoInformada && (
    dataHora.getTime() !== atual.dataHora.getTime()
    || urgencia !== atual.urgencia
    || modo !== atual.modoNotificacao
    || notificarEm.getTime() !== atual.notificarEm.getTime()
  )

  const lembrete = await prisma.lembretePessoal.update({
    where: { id: atual.id },
    data: {
      ...parsed.data,
      concluidoEm: parsed.data.concluido === undefined ? undefined : parsed.data.concluido ? (atual.concluidoEm ?? new Date()) : null,
      dataHora: parsed.data.dataHora ? dataHora : undefined,
      notificarEm: configuracaoInformada ? notificarEm : undefined,
      notificacaoEm: deveReagendar ? null : undefined,
    },
  })
  return NextResponse.json(lembrete)
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { auth, response } = await autenticar(request)
  if (response) return response
  if (!auth.session) return NextResponse.json({ erro: 'Sessão empresarial inválida.' }, { status: 403 })

  const removido = await prisma.lembretePessoal.deleteMany({
    where: { id, empresaId: auth.session.empresaId ?? null, usuarioId: auth.session.userId },
  })
  if (removido.count !== 1) return NextResponse.json({ erro: 'Lembrete não encontrado.' }, { status: 404 })
  return NextResponse.json({ sucesso: true })
}
