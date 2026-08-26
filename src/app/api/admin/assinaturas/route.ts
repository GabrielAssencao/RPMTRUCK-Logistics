import { NextRequest, NextResponse } from 'next/server'
import { calcularPropostaAssinatura } from '@/lib/assinaturas'
import { requireAdminAuth } from '@/lib/auth'
import { listarPlanosComerciais } from '@/lib/planosComerciais'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })

  const limited = await applyRateLimit(
    request,
    `admin-read:${auth.session.userId}:assinaturas`,
    RATE_LIMITS.ADMIN_READ.limit,
    RATE_LIMITS.ADMIN_READ.windowMs,
  )
  if (limited) return limited

  const [catalogo, solicitacoes] = await Promise.all([
    listarPlanosComerciais(),
    prisma.solicitacaoAssinatura.findMany({
      orderBy: { criado_em: 'desc' },
      take: 100,
      include: {
        empresa: {
          select: {
            id: true,
            nome: true,
            plano: true,
            modulos: true,
            usuarios_adicionais: true,
            veiculos_adicionais: true,
            _count: { select: { usuarios: true, veiculos_frota: true } },
          },
        },
        fatura: { select: { id: true, mes: true, ano: true, tipo: true, valor: true, status: true } },
      },
    }),
  ])
  const planosPorId = new Map(catalogo.map((plano) => [plano.id, plano]))

  const resultado = solicitacoes.map((solicitacao) => {
    const planoAtual = planosPorId.get(solicitacao.empresa.plano)
    const planoDestinoId = solicitacao.planoSolicitado ?? solicitacao.empresa.plano
    const planoDestino = planosPorId.get(planoDestinoId)
    const estadoAlterado = solicitacao.tipo !== 'NEGOCIAR_PAGAMENTO' && (
      solicitacao.empresa.plano !== solicitacao.planoAtual
      || solicitacao.empresa.usuarios_adicionais !== solicitacao.usuariosAdicionaisAtuais
      || solicitacao.empresa.veiculos_adicionais !== solicitacao.veiculosAdicionaisAtuais
    )
    const faturaNegociavel = solicitacao.tipo !== 'NEGOCIAR_PAGAMENTO'
      || solicitacao.fatura?.status === 'PENDENTE'

    const proposta = planoAtual && planoDestino
      ? calcularPropostaAssinatura(
          {
            plano: solicitacao.empresa.plano,
            modulos: solicitacao.empresa.modulos,
            usuariosAdicionais: solicitacao.empresa.usuarios_adicionais,
            veiculosAdicionais: solicitacao.empresa.veiculos_adicionais,
            totalUsuarios: solicitacao.empresa._count.usuarios,
            totalVeiculos: solicitacao.empresa._count.veiculos_frota,
          },
          {
            plano: planoDestinoId,
            usuariosAdicionais: solicitacao.tipo === 'NEGOCIAR_PAGAMENTO'
              ? solicitacao.empresa.usuarios_adicionais
              : solicitacao.usuariosAdicionaisSolicitados,
            veiculosAdicionais: solicitacao.tipo === 'NEGOCIAR_PAGAMENTO'
              ? solicitacao.empresa.veiculos_adicionais
              : solicitacao.veiculosAdicionaisSolicitados,
          },
          planoAtual,
          planoDestino,
        )
      : null

    return {
      id: solicitacao.id,
      tipo: solicitacao.tipo,
      status: solicitacao.status,
      empresa: { id: solicitacao.empresa.id, nome: solicitacao.empresa.nome },
      planoAtual: solicitacao.planoAtual,
      planoSolicitado: solicitacao.planoSolicitado,
      usuariosAdicionaisSolicitados: solicitacao.usuariosAdicionaisSolicitados,
      veiculosAdicionaisSolicitados: solicitacao.veiculosAdicionaisSolicitados,
      mensalidadeAtual: Number(solicitacao.mensalidadeAtual),
      mensalidadeProposta: Number(solicitacao.mensalidadeProposta),
      mensalidadeVigente: proposta?.mensalidadeProposta ?? Number(solicitacao.mensalidadeProposta),
      impacto: proposta?.impacto ?? solicitacao.impacto,
      aprovavel: !estadoAlterado && faturaNegociavel && (proposta?.bloqueios.length ?? 0) === 0,
      estadoAlterado,
      mensagem: solicitacao.mensagem,
      respostaAdmin: solicitacao.respostaAdmin,
      criadoPorNome: solicitacao.criadoPorNome,
      decididoPorNome: solicitacao.decididoPorNome,
      criado_em: solicitacao.criado_em,
      decidido_em: solicitacao.decidido_em,
      fatura: solicitacao.fatura,
    }
  })

  return NextResponse.json(
    { solicitacoes: resultado },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
