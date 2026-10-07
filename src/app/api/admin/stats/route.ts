import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { avaliarSituacaoFinanceira, competenciaBrasil } from '@/lib/financeiro/situacaoFinanceira'
import { faturasPendentesFinanceiras } from '@/lib/financeiro/acessoFinanceiro'
import { Prisma } from '@prisma/client'
import { montarResumoOperacional } from '@/lib/financeiro/resumoOperacional'

type EntradaMensal = { mes: string; recebido: Prisma.Decimal; taxas_asaas: Prisma.Decimal; taxas_pendentes: bigint }
type DespesaMensal = { mes: string; despesas: Prisma.Decimal }

const faturasRecebidas: Prisma.FaturaWhereInput = {
  status: 'PAGO',
  OR: [
    { provedorPagamento: 'MANUAL' },
    { provedorPagamento: 'ASAAS', gatewayRecebidoEm: { not: null } },
  ],
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { error, status, session } = await requireAdminAuth(request)

  if (error) {
    return NextResponse.json({ erro: error }, { status })
  }
  const limited = await applyRateLimit(request, `admin-read:${session!.userId}`, RATE_LIMITS.ADMIN_READ.limit, RATE_LIMITS.ADMIN_READ.windowMs)
  if (limited) return limited

  const ano = Number(request.nextUrl.searchParams.get('ano') || competenciaBrasil(new Date()).ano)
  if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) {
    return NextResponse.json({ erro: 'Ano invÃ¡lido.' }, { status: 400 })
  }

  try {
    const [
      statusDistribuicao,
      usuariosTotal,
      solicitacoesPendentes,
      resetsPendentes,
      receitaAgregada,
      faturasPagasSemData,
      planosDistribuicao,
      ultimasSolicitacoes,
      empresasFinanceiras,
      entradasMensais,
      despesasMensais,
    ] = await Promise.all([
      prisma.empresa.groupBy({ by: ['status'], where: { excluidoEm: null }, _count: { id: true } }),
      prisma.usuario.count(),
      prisma.solicitacaoAcesso.count({ where: { status: 'PENDENTE' } }),
      prisma.resetSenha.count({ where: { status: 'PENDENTE' } }),
      prisma.fatura.aggregate({ where: faturasRecebidas, _sum: { valor: true } }),
      prisma.fatura.count({ where: { status: 'PAGO', pago_em: null } }),
      prisma.empresa.groupBy({ by: ['plano'], where: { excluidoEm: null }, _count: { id: true } }),
      prisma.solicitacaoAcesso.findMany({
        orderBy: { criado_em: 'desc' },
        take: 5,
        select: {
          id: true,
          empresa: true,
          email: true,
          status: true,
          criado_em: true,
        },
      }),
      prisma.empresa.findMany({ where: { excluidoEm: null }, select: { plano: true, status: true, pagamentoInicialVenceEm: true, primeiraMensalidadePagaEm: true, faturas: faturasPendentesFinanceiras } }),
      prisma.$queryRaw<EntradaMensal[]>(Prisma.sql`
        WITH recebidas AS (
          SELECT "valor", "provedor_pagamento", "gateway_net_value",
            CASE WHEN "provedor_pagamento" = 'ASAAS' THEN "gateway_recebido_em" ELSE "pago_em" END AS "recebido_em"
          FROM "faturas"
          WHERE "status" = 'PAGO'
        )
        SELECT to_char(("recebido_em" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS mes,
          COALESCE(SUM("valor"), 0)::numeric AS recebido,
          COALESCE(SUM(CASE WHEN "provedor_pagamento" = 'ASAAS' AND "gateway_net_value" IS NOT NULL
            THEN GREATEST("valor"::numeric - "gateway_net_value", 0) ELSE 0 END), 0)::numeric AS taxas_asaas,
          COUNT(*) FILTER (WHERE "provedor_pagamento" = 'ASAAS' AND "gateway_net_value" IS NULL) AS taxas_pendentes
        FROM recebidas
        WHERE "recebido_em" IS NOT NULL
          AND "recebido_em" >= CAST(${`${ano}-01-01 03:00:00`} AS timestamp)
          AND "recebido_em" < CAST(${`${ano + 1}-01-01 03:00:00`} AS timestamp)
        GROUP BY 1
      `),
      prisma.$queryRaw<DespesaMensal[]>(Prisma.sql`
        SELECT to_char("data_pagamento", 'YYYY-MM') AS mes, COALESCE(SUM("valor"), 0)::numeric AS despesas
        FROM "despesas_plataforma"
        WHERE "excluida_em" IS NULL AND "data_pagamento" >= CAST(${`${ano}-01-01`} AS date)
          AND "data_pagamento" < CAST(${`${ano + 1}-01-01`} AS date)
        GROUP BY 1
      `),
    ])

    const totalEmpresas = statusDistribuicao.reduce((total, item) => total + item._count.id, 0)
    const financeiro = empresasFinanceiras.map(empresa => avaliarSituacaoFinanceira(empresa))
    const empresasAtivas = financeiro.filter(empresa => !empresa.bloqueado).length
    const empresasBloqueadas = financeiro.filter(empresa => empresa.bloqueado).length
    const receitaTotal = receitaAgregada._sum.valor ?? 0
    const financeiroOperacional = montarResumoOperacional(
      ano,
      entradasMensais.map(item => ({ mes: item.mes, recebido: Number(item.recebido), taxasAsaas: Number(item.taxas_asaas), taxasPendentes: Number(item.taxas_pendentes) })),
      despesasMensais.map(item => ({ mes: item.mes, despesas: Number(item.despesas) })),
    )

    return NextResponse.json(
      {
        resumo: {
          totalEmpresas,
          empresasAtivas,
          empresasBloqueadas,
          empresasInadimplentes: financeiro.filter(empresa => empresa.situacao === 'INADIMPLENTE').length,
          primeiroPagamentoVencido: financeiro.filter(empresa => empresa.situacao === 'PAGAMENTO_INICIAL_VENCIDO').length,
          aguardandoPrimeiroPagamento: financeiro.filter(empresa => empresa.situacao === 'AGUARDANDO_PAGAMENTO_INICIAL').length,
          usuariosTotal,
          solicitacoesPendentes,
          resetsPendentes,
          receitaTotal: receitaTotal.toFixed(2),
        },
        distribuicao: {
          planos: planosDistribuicao,
          status: statusDistribuicao,
        },
        atividades: {
          ultimasSolicitacoes,
        },
        financeiro: { ...financeiroOperacional, faturasPagasSemData },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=15, stale-while-revalidate=30',
        },
      },
    )
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar estatísticas' },
      { status: 500 },
    )
  }
}
