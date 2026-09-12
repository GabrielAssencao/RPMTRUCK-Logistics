import { NextRequest, NextResponse } from 'next/server'
import { applyRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit'
import { listarPlanosComerciais } from '@/lib/financeiro/planosComerciais'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, `public-plans:${getClientIp(request)}`, RATE_LIMITS.PUBLIC_STATS.limit, RATE_LIMITS.PUBLIC_STATS.windowMs)
  if (limited) return limited
  try {
    const planos = (await listarPlanosComerciais({ somentePublicos: true }))
      .filter((plano) => plano.id !== 'PREVIEW')
    return NextResponse.json(
      { planos },
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
