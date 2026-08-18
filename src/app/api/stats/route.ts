import { applyRateLimit, getClientIp } from '@/lib/rateLimit'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const limited = applyRateLimit(request, `public-stats:${getClientIp(request)}`, 60, 60_000)
  if (limited) return limited

  try {
    // Apenas agregados globais de empresas ativas são públicos. Nenhum dado de tenant
    // ou identificador é retornado para a landing page.
    const [empresas, veiculos, motoristas, manutencoes] = await prisma.$transaction([
      prisma.empresa.count({ where: { status: 'ATIVO' } }),
      prisma.veiculo.count({ where: { empresa: { status: 'ATIVO' } } }),
      prisma.motorista.count({ where: { empresa: { status: 'ATIVO' } } }),
      prisma.historicoVeiculo.count({ where: { empresa: { status: 'ATIVO' } } }),
    ])

    return NextResponse.json(
      { empresas, veiculos, motoristas, manutencoes },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (cause) {
    console.error('Erro ao calcular estatísticas públicas:', cause)
    return NextResponse.json({ erro: 'Estatísticas temporariamente indisponíveis.' }, { status: 503 })
  }
}
