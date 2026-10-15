import { NextRequest, NextResponse } from 'next/server'
import { applyRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit'
import { listarPlanosComerciais } from '@/lib/financeiro/planosComerciais'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, `public-plans:${getClientIp(request)}`, RATE_LIMITS.PUBLIC_STATS.limit, RATE_LIMITS.PUBLIC_STATS.windowMs)
  if (limited) return limited
  try {
    const planos = (await listarPlanosComerciais({ somentePublicos: true }))
      .filter((plano) => plano.id !== 'PREVIEW')
    const agora = new Date()
    const promocoes = await prisma.promocaoComercial.findMany({ where: { ativa: true, visivelSolicitacao: true, escopo: 'NOVAS_EMPRESAS', OR: [{ inicio: null }, { inicio: { lte: agora } }], AND: [{ OR: [{ fim: null }, { fim: { gte: agora } }] }] }, select: { nome: true, grupo: true, plano: true, precoBaseInicial: true, taxaImplantacao: true, mesesPrecoInicial: true, limiteAdesoes: true, adesoesConfirmadas: true } })
    const adesoesPorGrupo = new Map<string, number>()
    for (const promocao of promocoes) {
      if (!promocao.grupo) continue
      adesoesPorGrupo.set(promocao.grupo, (adesoesPorGrupo.get(promocao.grupo) ?? 0) + promocao.adesoesConfirmadas)
    }
    const publicos = planos.map(plano => {
      const promocao = promocoes.find(item => {
        const adesoes = item.grupo ? (adesoesPorGrupo.get(item.grupo) ?? 0) : item.adesoesConfirmadas
        return item.plano === plano.id && (item.limiteAdesoes === null || adesoes < item.limiteAdesoes)
      })
      if (!promocao) return plano
      const adesoes = promocao.grupo ? (adesoesPorGrupo.get(promocao.grupo) ?? 0) : promocao.adesoesConfirmadas
      const vagasRestantes = promocao.limiteAdesoes === null ? null : Math.max(0, promocao.limiteAdesoes - adesoes)
      return { ...plano, precoBase: Number(promocao.precoBaseInicial), taxaImplantacao: Number(promocao.taxaImplantacao), promocao: { nome: promocao.nome, meses: promocao.mesesPrecoInicial, vagasRestantes } }
    })
    return NextResponse.json(
      { planos: publicos },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        },
      },
    )
  } catch (error) {
    console.error('Falha ao carregar catálogo público de planos:', error)
    return NextResponse.json(
      { erro: 'O catálogo de planos está temporariamente indisponível.' },
      { status: 503, headers: { 'Retry-After': '30' } },
    )
  }
}
