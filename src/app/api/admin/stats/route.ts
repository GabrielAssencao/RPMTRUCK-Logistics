import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'
import { avaliarSituacaoFinanceira } from '@/lib/financeiro/situacaoFinanceira'
import { faturasPendentesFinanceiras } from '@/lib/financeiro/acessoFinanceiro'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { error, status, session } = await requireAdminAuth(request)

  if (error) {
    return NextResponse.json({ erro: error }, { status })
  }
  const limited = await applyRateLimit(request, `admin-read:${session!.userId}`, RATE_LIMITS.ADMIN_READ.limit, RATE_LIMITS.ADMIN_READ.windowMs)
  if (limited) return limited

  try {
    const [
      statusDistribuicao,
      usuariosTotal,
      solicitacoesPendentes,
      resetsPendentes,
      receitaAgregada,
      planosDistribuicao,
      ultimasSolicitacoes,
      empresasFinanceiras,
    ] = await Promise.all([
      prisma.empresa.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.usuario.count(),
      prisma.solicitacaoAcesso.count({ where: { status: 'PENDENTE' } }),
      prisma.resetSenha.count({ where: { status: 'PENDENTE' } }),
      prisma.fatura.aggregate({ where: { status: 'PAGO' }, _sum: { valor: true } }),
      prisma.empresa.groupBy({ by: ['plano'], _count: { id: true } }),
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
    ])

    const totalEmpresas = statusDistribuicao.reduce((total, item) => total + item._count.id, 0)
    const financeiro = empresasFinanceiras.map(empresa => avaliarSituacaoFinanceira(empresa))
    const empresasAtivas = financeiro.filter(empresa => !empresa.bloqueado).length
    const empresasBloqueadas = financeiro.filter(empresa => empresa.bloqueado).length
    const receitaTotal = receitaAgregada._sum.valor ?? 0

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
