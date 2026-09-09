import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { PRIORIDADE_TICKET_LABEL, STATUS_TICKET_LABEL } from '@/lib/suporteConfig'
import { recalcularCoberturaCompetencia } from '@/lib/suporte'
import { notificarUsuariosDaEmpresa } from '@/lib/notificacoes'

const atualizarTicketSchema = z.object({
  status: z.enum(['ABERTO', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'RESOLVIDO', 'FECHADO']).optional(),
  prioridade: z.enum(['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']).optional(),
  classificacaoCobranca: z.enum(['ATENDIMENTO', 'BUG_SISTEMA_CONFIRMADO']).optional(),
}).strict().refine((valor) => valor.status || valor.prioridade || valor.classificacaoCobranca, 'Nenhuma alteração informada.')

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(request, `admin-chat-update:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited

  const { id } = await params
  const parsed = atualizarTicketSchema.safeParse(await request.json().catch(() => null))
  if (!z.string().uuid().safeParse(id).success || !parsed.success) {
    return NextResponse.json({ erro: 'Alteração de ticket inválida.' }, { status: 400 })
  }

  const atual = await prisma.conversaSuporte.findUnique({
    where: { id },
    select: {
      id: true,
      protocolo: true,
      assunto: true,
      empresaId: true,
      status: true,
      prioridade: true,
      competencia: true,
      classificacaoCobranca: true,
    },
  })
  if (!atual) return NextResponse.json({ erro: 'Ticket não encontrado.' }, { status: 404 })

  const mudancas: string[] = []
  if (parsed.data.status && parsed.data.status !== atual.status) {
    mudancas.push(`Status alterado para ${STATUS_TICKET_LABEL[parsed.data.status].toLocaleLowerCase('pt-BR')}.`)
  }
  if (parsed.data.prioridade && parsed.data.prioridade !== atual.prioridade) {
    mudancas.push(`Prioridade alterada para ${PRIORIDADE_TICKET_LABEL[parsed.data.prioridade].toLocaleLowerCase('pt-BR')}.`)
  }
  const classificacaoMudou = parsed.data.classificacaoCobranca
    && parsed.data.classificacaoCobranca !== atual.classificacaoCobranca
  if (classificacaoMudou) {
    mudancas.push(parsed.data.classificacaoCobranca === 'BUG_SISTEMA_CONFIRMADO'
      ? 'Bug do sistema confirmado pelo Superadmin. Este chamado não consumirá a franquia mensal.'
      : 'Classificação alterada para atendimento contabilizado. Este chamado voltou a consumir a franquia mensal.')
  }

  const encerrado = parsed.data.status === 'RESOLVIDO' || parsed.data.status === 'FECHADO'
  const reaberto = parsed.data.status && !encerrado
  const ticket = await prisma.$transaction(async (tx) => {
    const atualizado = await tx.conversaSuporte.update({
      where: { id: atual.id },
      data: {
        status: parsed.data.status,
        prioridade: parsed.data.prioridade,
        classificacaoCobranca: parsed.data.classificacaoCobranca,
        classificadoEm: classificacaoMudou
          ? parsed.data.classificacaoCobranca === 'BUG_SISTEMA_CONFIRMADO' ? new Date() : null
          : undefined,
        classificadoPorId: classificacaoMudou
          ? parsed.data.classificacaoCobranca === 'BUG_SISTEMA_CONFIRMADO' ? auth.session!.userId : null
          : undefined,
        encerradoEm: encerrado ? new Date() : reaberto ? null : undefined,
      },
    })
    if (classificacaoMudou) {
      await recalcularCoberturaCompetencia(tx, atual.empresaId, atual.competencia)
    }
    if (mudancas.length > 0) {
      await tx.mensagemSuporte.create({
        data: {
          conversaId: atual.id,
          tipo: 'SISTEMA',
          automatica: true,
          conteudo: mudancas.join(' '),
        },
      })
      await notificarUsuariosDaEmpresa(atual.empresaId, {
        modulo: 'CHAT',
        titulo: `Atualização em ${atual.protocolo}`,
        mensagem: mudancas.join(' '),
        ticketSuporteId: atual.id,
      }, ['GESTOR_EMPRESA'], tx)
    }
    return classificacaoMudou
      ? tx.conversaSuporte.findUniqueOrThrow({ where: { id: atualizado.id } })
      : atualizado
  })

  return NextResponse.json({ ticket }, { headers: { 'Cache-Control': 'no-store' } })
}
