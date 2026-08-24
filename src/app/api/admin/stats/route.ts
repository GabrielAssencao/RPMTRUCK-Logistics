import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

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
    ])

    const totalEmpresas = statusDistribuicao.reduce((total, item) => total + item._count.id, 0)
    const empresasAtivas = statusDistribuicao.find(item => item.status === 'ATIVO')?._count.id ?? 0
    const empresasBloqueadas = statusDistribuicao.find(item => item.status === 'INADIMPLENTE')?._count.id ?? 0
    const receitaTotal = receitaAgregada._sum.valor ?? 0

    return NextResponse.json(
      {
        resumo: {
          totalEmpresas,
          empresasAtivas,
          empresasBloqueadas,
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
