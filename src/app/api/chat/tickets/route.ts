import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { textoOperacional } from '@/lib/domainValidation'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { calcularCoberturaTicket, gerarProtocoloTicket, inicioCompetencia, montarRespostaAutomatica } from '@/lib/suporte'
import { prioridadeInicialTicket } from '@/lib/suporteConfig'
import { notificarAdmins } from '@/lib/notificacoes'

export const dynamic = 'force-dynamic'

const novoTicketSchema = z.object({
  assunto: textoOperacional(3, 160),
  categoria: z.enum(['SUPORTE_TECNICO', 'REPORTAR_ERRO', 'DUVIDA_OPERACIONAL', 'SOLICITACAO', 'FINANCEIRO']),
  mensagem: textoOperacional(3, 2000),
}).strict()

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId || !auth.empresa) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const limited = await applyRateLimit(request, `chat-ticket:${auth.session.userId}`, RATE_LIMITS.CHAT_TICKET_CREATE.limit, RATE_LIMITS.CHAT_TICKET_CREATE.windowMs)
  if (limited) return limited

  const parsed = novoTicketSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Informe categoria, assunto e descrição válidos.' }, { status: 400 })
  }

  const empresaId = auth.session.empresaId
  const competencia = inicioCompetencia()
  let ultimaFalha: unknown

  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    try {
      const ticket = await prisma.$transaction(async (tx) => {
        const usados = await tx.conversaSuporte.count({ where: { empresaId, competencia } })
        const cobertura = calcularCoberturaTicket(auth.empresa!.plano, usados)
        const mensagemInicialEm = new Date()
        const criado = await tx.conversaSuporte.create({
          data: {
            protocolo: gerarProtocoloTicket(),
            assunto: parsed.data.assunto,
            categoria: parsed.data.categoria,
            prioridade: prioridadeInicialTicket(parsed.data.categoria),
            cobravelExtra: cobertura.cobravelExtra,
            franquiaNoMomento: cobertura.limiteMensal,
            ordemNaCompetencia: cobertura.ordemNaCompetencia,
            competencia,
            empresaId,
            mensagens: {
              create: [
                { autorId: auth.session!.userId, conteudo: parsed.data.mensagem, criado_em: mensagemInicialEm },
                {
                  tipo: 'SISTEMA',
                  automatica: true,
                  conteudo: montarRespostaAutomatica(parsed.data.categoria, auth.empresa!.plano, cobertura.cobravelExtra),
                  lida_em: new Date(),
                  criado_em: new Date(mensagemInicialEm.getTime() + 1),
                },
              ],
            },
          },
          select: {
            id: true,
            protocolo: true,
            assunto: true,
            categoria: true,
            status: true,
            prioridade: true,
            cobravelExtra: true,
            franquiaNoMomento: true,
            ordemNaCompetencia: true,
            criado_em: true,
            atualizado_em: true,
          },
        })
        await notificarAdmins({
          modulo: 'CHAT',
          titulo: `Novo ticket ${criado.protocolo}`,
          mensagem: `${auth.empresa!.nome}: ${criado.assunto}`,
          ticketSuporteId: criado.id,
        }, tx)
        return criado
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

      return NextResponse.json({ ticket }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      ultimaFalha = error
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') break
    }
  }

  console.error('Erro ao abrir ticket de suporte:', ultimaFalha)
  return NextResponse.json({ erro: 'Não foi possível abrir o ticket. Tente novamente.' }, { status: 500 })
}
