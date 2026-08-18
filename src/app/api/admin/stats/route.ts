// src/app/api/admin/stats/route.ts
// Endpoint de estatísticas do painel admin (Admin only)

import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { session, error, status } = await requireAdminAuth(request)

  if (error) {
    return NextResponse.json({ erro: error }, { status })
  }

  try {
    // Total de empresas
    const totalEmpresas = await prisma.empresa.count()

    // Empresas ativas
    const empresasAtivas = await prisma.empresa.count({
      where: { status: 'ATIVO' }
    })

    // Empresas bloqueadas
    const empresasBloqueadas = await prisma.empresa.count({
      where: { status: 'INADIMPLENTE' }
    })

    // Total de usuários
    const usuariosTotal = await prisma.usuario.count()

    // Solicitações pendentes
    const solicitacoesPendentes = await prisma.solicitacaoAcesso.count({
      where: { status: 'PENDENTE' }
    })

    // Resets de senha pendentes
    const resetsPendentes = await prisma.resetSenha.count({
      where: { status: 'PENDENTE' }
    })

    // Receita total (soma de faturas pagas)
    const faturasPagas = await prisma.fatura.findMany({
      where: { status: 'PAGO' }
    })

    const receitaTotal = faturasPagas.reduce((sum, f) => sum + f.valor, 0)

    // Distribuição de planos
    const planosDistribuicao = await prisma.empresa.groupBy({
      by: ['plano'],
      _count: {
        id: true
      }
    })

    // Empresas por status
    const statusDistribuicao = await prisma.empresa.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    })

    // Últimas solicitações
    const ultimasSolicitacoes = await prisma.solicitacaoAcesso.findMany({
      orderBy: { criado_em: 'desc' },
      take: 5,
      select: {
        id: true,
        empresa: true,
        email: true,
        status: true,
        criado_em: true
      }
    })

    return NextResponse.json({
      resumo: {
        totalEmpresas,
        empresasAtivas,
        empresasBloqueadas,
        usuariosTotal,
        solicitacoesPendentes,
        resetsPendentes,
        receitaTotal: receitaTotal.toFixed(2)
      },
      distribuicao: {
        planos: planosDistribuicao,
        status: statusDistribuicao
      },
      atividades: {
        ultimasSolicitacoes
      }
    })
  } catch (error) {
    console.error('Erro ao buscar stats:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar estatísticas' },
      { status: 500 }
    )
  }
}
