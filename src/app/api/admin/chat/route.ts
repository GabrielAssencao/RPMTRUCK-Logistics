import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { textoOperacional } from '@/lib/domainValidation'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { gerarProtocoloRelacionamento, inicioCompetencia } from '@/lib/suporte'
import { prioridadeInicialTicket } from '@/lib/suporteConfig'
import { notificarUsuariosDaEmpresa } from '@/lib/notificacoes'
import { executarComAuditoria } from '@/lib/auditoria'

export const dynamic = 'force-dynamic'

const novaConversaSchema = z.object({
  empresaId: z.string().uuid(),
  assunto: textoOperacional(3, 160),
  categoria: z.enum(['SUPORTE_TECNICO', 'REPORTAR_ERRO', 'DUVIDA_OPERACIONAL', 'SOLICITACAO', 'FINANCEIRO']),
  mensagem: textoOperacional(3, 2000),
  respostasEmpresaHabilitadas: z.boolean().default(true),
}).strict()

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(request, `admin-chat:${auth.session.userId}`, RATE_LIMITS.CHAT_READ.limit, RATE_LIMITS.CHAT_READ.windowMs)
  if (limited) return limited

  if (request.nextUrl.searchParams.get('resumo') === 'true') {
    const mensagensNaoLidas = await prisma.mensagemSuporte.count({
      where: { lida_em: null, tipo: 'USUARIO', autor: { role: { not: 'ADMIN_RPM' } } },
    })
    return NextResponse.json({ resumo: { mensagensNaoLidas } }, { headers: { 'Cache-Control': 'private, no-store' } })
  }

  const competenciaAtual = inicioCompetencia()
  const [tickets, ticketsAtivos, mensagensNaoLidas, extrasNoMes, bugsConfirmadosNoMes] = await Promise.all([
    prisma.conversaSuporte.findMany({
      orderBy: { atualizado_em: 'desc' },
      take: 200,
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
      classificacaoCobranca: true,
      origem: true,
      respostasEmpresaHabilitadas: true,
      classificadoEm: true,
      criado_em: true,
      atualizado_em: true,
      primeiraRespostaEm: true,
      encerradoEm: true,
      empresa: { select: { id: true, nome: true, email: true, status: true, plano: true } },
      mensagens: {
        orderBy: { criado_em: 'desc' },
        take: 1,
        select: { conteudo: true, criado_em: true, automatica: true, autor: { select: { role: true } } },
      },
      _count: {
        select: {
          mensagens: {
            where: { lida_em: null, tipo: 'USUARIO', autor: { role: { not: 'ADMIN_RPM' } } },
          },
        },
      },
      },
    }),
    prisma.conversaSuporte.count({
      where: { status: { notIn: ['RESOLVIDO', 'FECHADO'] } },
    }),
    prisma.mensagemSuporte.count({
      where: {
        lida_em: null,
        tipo: 'USUARIO',
        autor: { role: { not: 'ADMIN_RPM' } },
      },
    }),
    prisma.conversaSuporte.count({
      where: { competencia: competenciaAtual, cobravelExtra: true },
    }),
    prisma.conversaSuporte.count({
      where: { competencia: competenciaAtual, classificacaoCobranca: 'BUG_SISTEMA_CONFIRMADO' },
    }),
  ])

  const empresas = request.nextUrl.searchParams.get('empresas') === 'true'
    ? await prisma.empresa.findMany({
        where: { excluidoEm: null },
        orderBy: { nome: 'asc' },
        take: 500,
        select: { id: true, nome: true, status: true, plano: true },
      })
    : undefined

  return NextResponse.json({
    tickets: tickets.map(({ _count, mensagens, ...ticket }) => ({
      ...ticket,
      ultimaMensagem: mensagens[0] || null,
      naoLidas: _count.mensagens,
    })),
    resumo: { ticketsAtivos, mensagensNaoLidas, extrasNoMes, bugsConfirmadosNoMes },
    ...(empresas ? { empresas } : {}),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(request, `admin-chat-create:${auth.session.userId}`, RATE_LIMITS.ADMIN_MUTATION.limit, RATE_LIMITS.ADMIN_MUTATION.windowMs)
  if (limited) return limited

  const parsed = novaConversaSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Selecione a empresa e informe assunto e mensagem válidos.' }, { status: 400 })
  }

  const empresa = await prisma.empresa.findFirst({
    where: { id: parsed.data.empresaId, excluidoEm: null },
    select: { id: true, nome: true },
  })
  if (!empresa) return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })

  const agora = new Date()
  const conversa = await executarComAuditoria(
    { usuarioId: auth.session.userId, origem: 'SUPERADMIN' },
    async (tx) => {
      const criada = await tx.conversaSuporte.create({
        data: {
          protocolo: gerarProtocoloRelacionamento(agora),
          assunto: parsed.data.assunto,
          categoria: parsed.data.categoria,
          prioridade: prioridadeInicialTicket(parsed.data.categoria),
          status: parsed.data.respostasEmpresaHabilitadas ? 'AGUARDANDO_CLIENTE' : 'EM_ATENDIMENTO',
          origem: 'SUPERADMIN',
          respostasEmpresaHabilitadas: parsed.data.respostasEmpresaHabilitadas,
          cobravelExtra: false,
          franquiaNoMomento: 0,
          ordemNaCompetencia: 1,
          competencia: inicioCompetencia(agora),
          primeiraRespostaEm: agora,
          empresaId: empresa.id,
          mensagens: {
            create: {
              autorId: auth.session!.userId,
              conteudo: parsed.data.mensagem,
              criado_em: agora,
            },
          },
        },
        select: {
          id: true,
          protocolo: true,
          assunto: true,
          categoria: true,
          status: true,
          prioridade: true,
          origem: true,
          respostasEmpresaHabilitadas: true,
          cobravelExtra: true,
          franquiaNoMomento: true,
          ordemNaCompetencia: true,
          classificacaoCobranca: true,
          criado_em: true,
          atualizado_em: true,
          primeiraRespostaEm: true,
          encerradoEm: true,
          empresa: { select: { id: true, nome: true, email: true, status: true, plano: true } },
        },
      })
      await notificarUsuariosDaEmpresa(empresa.id, {
        modulo: 'CHAT',
        titulo: `Nova conversa · ${criada.protocolo}`,
        mensagem: parsed.data.assunto,
        ticketSuporteId: criada.id,
      }, ['GESTOR_EMPRESA'], tx)
      return criada
    },
  )

  return NextResponse.json({ conversa }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
