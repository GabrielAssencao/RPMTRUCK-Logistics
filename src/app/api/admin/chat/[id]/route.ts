import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { PRIORIDADE_TICKET_LABEL, STATUS_TICKET_LABEL } from '@/lib/suporteConfig'

const atualizarTicketSchema = z.object({
  status: z.enum(['ABERTO', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'RESOLVIDO', 'FECHADO']).optional(),
  prioridade: z.enum(['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']).optional(),
}).strict().refine((valor) => valor.status || valor.prioridade, 'Nenhuma alteração informada.')

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
    select: { id: true, status: true, prioridade: true },
  })
  if (!atual) return NextResponse.json({ erro: 'Ticket não encontrado.' }, { status: 404 })

  const mudancas: string[] = []
  if (parsed.data.status && parsed.data.status !== atual.status) {
    mudancas.push(`Status alterado para ${STATUS_TICKET_LABEL[parsed.data.status].toLocaleLowerCase('pt-BR')}.`)
  }
  if (parsed.data.prioridade && parsed.data.prioridade !== atual.prioridade) {
    mudancas.push(`Prioridade alterada para ${PRIORIDADE_TICKET_LABEL[parsed.data.prioridade].toLocaleLowerCase('pt-BR')}.`)
  }

  const encerrado = parsed.data.status === 'RESOLVIDO' || parsed.data.status === 'FECHADO'
  const reaberto = parsed.data.status && !encerrado
  const ticket = await prisma.$transaction(async (tx) => {
    const atualizado = await tx.conversaSuporte.update({
      where: { id: atual.id },
      data: {
        status: parsed.data.status,
        prioridade: parsed.data.prioridade,
        encerradoEm: encerrado ? new Date() : reaberto ? null : undefined,
      },
    })
    if (mudancas.length > 0) {
      await tx.mensagemSuporte.create({
        data: {
          conversaId: atual.id,
          tipo: 'SISTEMA',
          automatica: true,
          conteudo: mudancas.join(' '),
          lida_em: new Date(),
        },
      })
    }
    return atualizado
  })

  return NextResponse.json({ ticket }, { headers: { 'Cache-Control': 'no-store' } })
}
