import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminRole, requireAuth } from '@/lib/auth'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { textoOperacional } from '@/lib/domainValidation'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { inicioCompetencia } from '@/lib/suporte'
import { obterPoliticaSuporte } from '@/lib/suporteConfig'
import { notificarAdmins, notificarUsuariosDaEmpresa } from '@/lib/notificacoes'
import { executarComAuditoria } from '@/lib/auditoria'
import { montarRespostaTriagemBot } from '@/lib/suporteBot'

export const dynamic = 'force-dynamic'

const mensagemSchema = z.object({
  mensagem: textoOperacional(1, 2000),
  ticketId: z.string().uuid(),
  empresaId: z.string().uuid().optional(),
}).strict()

const editarMensagemSchema = z.object({
  mensagemId: z.string().uuid(),
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
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, nome: true, plano: true },
    })
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
    empresa: {
      id: empresaAuth.empresa.id,
      nome: empresaAuth.empresa.nome,
      plano: empresaAuth.empresa.plano,
    },
    admin: false,
  } as const
}

function filtroNaoLidas(admin: boolean) {
  if (admin) {
    return {
      lida_em: null,
      tipo: 'USUARIO' as const,
      autor: { role: { not: 'ADMIN_RPM' as const } },
    }
  }
  return {
    lida_em: null,
    visibilidade: 'TODOS' as const,
    OR: [
      { tipo: 'SISTEMA' as const },
      { tipo: 'USUARIO' as const, autor: { role: 'ADMIN_RPM' as const } },
    ],
  }
}

export async function GET(request: NextRequest) {
  const escopo = await resolverEscopo(request, request.nextUrl.searchParams.get('empresaId'))
  if ('error' in escopo) return NextResponse.json({ erro: escopo.error }, { status: escopo.status })

  const limited = await applyRateLimit(request, `chat-read:${escopo.auth.session!.userId}`, RATE_LIMITS.CHAT_READ.limit, RATE_LIMITS.CHAT_READ.windowMs)
  if (limited) return limited

  const ticketId = request.nextUrl.searchParams.get('ticketId')
  if (ticketId && !z.string().uuid().safeParse(ticketId).success) {
    return NextResponse.json({ erro: 'Ticket inválido.' }, { status: 400 })
  }

  const tickets = await prisma.conversaSuporte.findMany({
    where: { empresaId: escopo.empresaId },
    orderBy: { atualizado_em: 'desc' },
    take: 100,
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
      classificadoEm: true,
      criado_em: true,
      atualizado_em: true,
      primeiraRespostaEm: true,
      mensagens: {
        where: escopo.admin ? undefined : { visibilidade: 'TODOS' },
        orderBy: { criado_em: 'desc' },
        take: 1,
        select: { conteudo: true, criado_em: true, automatica: true, autor: { select: { role: true } } },
      },
      _count: { select: { mensagens: { where: filtroNaoLidas(escopo.admin) } } },
    },
  })

  const ticketSelecionado = ticketId ? tickets.find((ticket) => ticket.id === ticketId) : null
  if (ticketId && !ticketSelecionado) {
    return NextResponse.json({ erro: 'Ticket não encontrado para esta empresa.' }, { status: 404 })
  }

  let mensagens: Array<{
    id: string
    conteudo: string
    tipo: 'USUARIO' | 'SISTEMA'
    automatica: boolean
    visibilidade: 'TODOS' | 'ADMIN'
    criado_em: Date
    lida_em: Date | null
    editado_em: Date | null
    autor: { id: string; nome: string; role: string } | null
  }> = []

  if (ticketSelecionado) {
    await prisma.$transaction([
      prisma.mensagemSuporte.updateMany({
        where: { conversaId: ticketSelecionado.id, ...filtroNaoLidas(escopo.admin) },
        data: { lida_em: new Date() },
      }),
      prisma.notificacao.updateMany({
        where: { usuarioId: escopo.auth.session!.userId, ticketSuporteId: ticketSelecionado.id, lida: false },
        data: { lida: true },
      }),
    ])
    mensagens = await prisma.mensagemSuporte.findMany({
      where: {
        conversaId: ticketSelecionado.id,
        visibilidade: escopo.admin ? undefined : 'TODOS',
      },
      orderBy: { criado_em: 'desc' },
      take: 200,
      select: {
        id: true,
        conteudo: true,
        tipo: true,
        automatica: true,
        visibilidade: true,
        criado_em: true,
        lida_em: true,
        editado_em: true,
        autor: { select: { id: true, nome: true, role: true } },
      },
    }).then((itens) => itens.reverse())
  }

  const competenciaAtual = inicioCompetencia()
  const [usadosNoMes, extrasNoMes] = await Promise.all([
    prisma.conversaSuporte.count({
      where: { empresaId: escopo.empresaId, competencia: competenciaAtual, classificacaoCobranca: 'ATENDIMENTO' },
    }),
    prisma.conversaSuporte.count({ where: { empresaId: escopo.empresaId, competencia: competenciaAtual, cobravelExtra: true } }),
  ])
  const politica = obterPoliticaSuporte(escopo.empresa.plano)

  return NextResponse.json({
    empresa: escopo.empresa,
    tickets: tickets.map(({ _count, mensagens: ultimas, ...ticket }) => ({
      ...ticket,
      ultimaMensagem: ultimas[0] || null,
      naoLidas: ticketSelecionado?.id === ticket.id ? 0 : _count.mensagens,
    })),
    ticket: ticketSelecionado ? { ...ticketSelecionado, mensagens: undefined, _count: undefined } : null,
    mensagens,
    franquia: { usados: usadosNoMes, extras: extrasNoMes, limite: politica.limiteMensal, prazoRespostaHoras: politica.prazoRespostaHoras },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  const preAuth = await requireAuth(request)
  if (preAuth.error || !preAuth.session) return NextResponse.json({ erro: preAuth.error }, { status: preAuth.status })

  const parsed = mensagemSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Mensagem ou ticket inválido.' }, { status: 400 })

  const escopo = await resolverEscopo(request, parsed.data.empresaId)
  if ('error' in escopo) return NextResponse.json({ erro: escopo.error }, { status: escopo.status })

  const limited = await applyRateLimit(request, `chat-send:${escopo.auth.session!.userId}`, RATE_LIMITS.CHAT_SEND.limit, RATE_LIMITS.CHAT_SEND.windowMs)
  if (limited) return limited

  const ticket = await prisma.conversaSuporte.findFirst({
    where: { id: parsed.data.ticketId, empresaId: escopo.empresaId },
    select: {
      id: true,
      protocolo: true,
      assunto: true,
      categoria: true,
      status: true,
      primeiraRespostaEm: true,
      etapaTriagem: true,
      triagemConcluidaEm: true,
      mensagens: {
        where: {
          automatica: false,
          tipo: 'USUARIO',
          autor: { role: { not: 'ADMIN_RPM' } },
        },
        orderBy: { criado_em: 'asc' },
        take: 10,
        select: { conteudo: true },
      },
    },
  })
  if (!ticket) return NextResponse.json({ erro: 'Ticket não encontrado.' }, { status: 404 })
  if (ticket.status === 'FECHADO' || ticket.status === 'RESOLVIDO') {
    return NextResponse.json({ erro: 'Este ticket está encerrado. Abra um novo chamado se precisar de ajuda.' }, { status: 409 })
  }

  const agora = new Date()
  const resultadoTriagemPlanejado = !escopo.admin && ticket.status === 'ABERTO' && !ticket.triagemConcluidaEm
    ? montarRespostaTriagemBot({
        assunto: ticket.assunto,
        categoria: ticket.categoria,
        mensagensUsuario: [...ticket.mensagens.map((mensagem) => mensagem.conteudo), parsed.data.mensagem],
        interacoesAutomaticas: ticket.etapaTriagem,
      })
    : null
  const resultado = await prisma.$transaction(async (tx) => {
    const criada = await tx.mensagemSuporte.create({
      data: { conversaId: ticket.id, autorId: escopo.auth.session!.userId, conteudo: parsed.data.mensagem },
      select: {
        id: true,
        conteudo: true,
        tipo: true,
        automatica: true,
        visibilidade: true,
        criado_em: true,
        lida_em: true,
        editado_em: true,
        autor: { select: { id: true, nome: true, role: true } },
      },
    })
    const reivindicacaoTriagem = resultadoTriagemPlanejado
      ? await tx.conversaSuporte.updateMany({
          where: {
            id: ticket.id,
            status: 'ABERTO',
            etapaTriagem: ticket.etapaTriagem,
            triagemConcluidaEm: null,
          },
          data: {
            etapaTriagem: { increment: 1 },
            triagemConcluidaEm: resultadoTriagemPlanejado.acao === 'CONTINUAR' ? undefined : agora,
            categoria: resultadoTriagemPlanejado.categoriaDetectada,
            status: resultadoTriagemPlanejado.acao === 'RESOLVER'
              ? 'RESOLVIDO'
              : resultadoTriagemPlanejado.acao === 'ESCALAR'
                ? 'EM_ATENDIMENTO'
                : undefined,
            encerradoEm: resultadoTriagemPlanejado.acao === 'RESOLVER' ? agora : undefined,
          },
        })
      : null
    const resultadoTriagem = reivindicacaoTriagem?.count === 1 ? resultadoTriagemPlanejado : null
    const respostaAutomatica = resultadoTriagem
      ? await tx.mensagemSuporte.create({
          data: {
            conversaId: ticket.id,
            tipo: 'SISTEMA',
            automatica: true,
            conteudo: resultadoTriagem.resposta,
            lida_em: agora,
            criado_em: new Date(agora.getTime() + 1),
          },
          select: {
            id: true,
            conteudo: true,
            tipo: true,
            automatica: true,
            visibilidade: true,
            criado_em: true,
            lida_em: true,
            editado_em: true,
            autor: { select: { id: true, nome: true, role: true } },
          },
        })
      : null
    if (resultadoTriagem?.acao === 'ESCALAR' && resultadoTriagem.resumoAdmin) {
      await tx.mensagemSuporte.create({
        data: {
          conversaId: ticket.id,
          tipo: 'SISTEMA',
          automatica: true,
          visibilidade: 'ADMIN',
          conteudo: resultadoTriagem.resumoAdmin,
          criado_em: new Date(agora.getTime() + 2),
        },
      })
    }
    await tx.conversaSuporte.update({
      where: { id: ticket.id },
      data: escopo.admin
        ? {
            status: ticket.status === 'ABERTO' || ticket.status === 'AGUARDANDO_CLIENTE' ? 'EM_ATENDIMENTO' : undefined,
            primeiraRespostaEm: ticket.primeiraRespostaEm ?? agora,
            atualizado_em: agora,
          }
        : {
            status: !resultadoTriagem && ticket.status === 'AGUARDANDO_CLIENTE' ? 'ABERTO' : undefined,
            atualizado_em: agora,
          },
    })
    const aviso = {
      modulo: 'CHAT',
      titulo: `Nova mensagem em ${ticket.protocolo}`,
      mensagem: ticket.assunto,
      ticketSuporteId: ticket.id,
    }
    if (escopo.admin) {
      await notificarUsuariosDaEmpresa(escopo.empresaId, aviso, ['GESTOR_EMPRESA'], tx)
    } else if (resultadoTriagem?.acao === 'ESCALAR') {
      await notificarAdmins({
        ...aviso,
        titulo: `Triagem concluída · ${ticket.protocolo}`,
        mensagem: `${escopo.empresa.nome}: ${ticket.assunto}. Atendimento humano necessário.`,
      }, tx)
    } else if (!resultadoTriagemPlanejado) {
      await notificarAdmins(aviso, tx)
    }
    return { mensagem: criada, respostaAutomatica }
  })

  return NextResponse.json(resultado, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest) {
  const preAuth = await requireAuth(request)
  if (preAuth.error || !preAuth.session) return NextResponse.json({ erro: preAuth.error }, { status: preAuth.status })

  const parsed = editarMensagemSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Mensagem ou identificador inválido.' }, { status: 400 })

  const escopo = await resolverEscopo(request, parsed.data.empresaId)
  if ('error' in escopo) return NextResponse.json({ erro: escopo.error }, { status: escopo.status })

  const limited = await applyRateLimit(request, `chat-edit:${escopo.auth.session!.userId}`, RATE_LIMITS.CHAT_EDIT.limit, RATE_LIMITS.CHAT_EDIT.windowMs)
  if (limited) return limited

  const atual = await prisma.mensagemSuporte.findFirst({
    where: {
      id: parsed.data.mensagemId,
      conversa: { empresaId: escopo.empresaId },
    },
    select: {
      id: true,
      autorId: true,
      conteudo: true,
      conteudoOriginal: true,
      tipo: true,
      automatica: true,
    },
  })
  if (!atual) return NextResponse.json({ erro: 'Mensagem não encontrada.' }, { status: 404 })
  if (atual.autorId !== escopo.auth.session!.userId) {
    return NextResponse.json({ erro: 'Você só pode editar mensagens enviadas pela sua própria conta.' }, { status: 403 })
  }
  if (atual.tipo !== 'USUARIO' || atual.automatica) {
    return NextResponse.json({ erro: 'Mensagens automáticas do sistema não podem ser editadas.' }, { status: 409 })
  }

  const editadoEm = new Date()
  const mensagem = await executarComAuditoria(
    { usuarioId: escopo.auth.session!.userId, origem: escopo.admin ? 'SUPERADMIN' : 'API' },
    (tx) => tx.mensagemSuporte.update({
      where: { id: atual.id },
      data: {
        conteudo: parsed.data.mensagem,
        conteudoOriginal: atual.conteudoOriginal ?? atual.conteudo,
        editado_em: editadoEm,
      },
      select: {
        id: true,
        conteudo: true,
        tipo: true,
        automatica: true,
        visibilidade: true,
        criado_em: true,
        lida_em: true,
        editado_em: true,
        autor: { select: { id: true, nome: true, role: true } },
      },
    }),
  )

  return NextResponse.json({ mensagem }, { headers: { 'Cache-Control': 'private, no-store' } })
}
