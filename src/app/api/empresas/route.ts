import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizarModulos } from '@/utils/planos'
import { calcularMensalidadePorCatalogo, listarPlanosComerciais } from '@/lib/planosComerciais'
import { exposeEmpresa } from '@/lib/fieldEncryption'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  try {
    const [empresas, catalogo] = await Promise.all([
      prisma.empresa.findMany({
        include: {
          _count: {
            select: {
              usuarios: true,
              veiculos_frota: true,
              motoristas: true,
            },
          },
        },
        orderBy: { criado_em: 'desc' },
      }),
      listarPlanosComerciais(),
    ])
    const catalogoPorPlano = new Map(catalogo.map((plano) => [plano.id, plano]))

    return NextResponse.json(
      empresas.map((empresa) => {
        const planoComercial = catalogoPorPlano.get(empresa.plano)
        return {
          ...exposeEmpresa(empresa),
          modulos: normalizarModulos(empresa.modulos),
          mensalidade: planoComercial
            ? calcularMensalidadePorCatalogo(
                planoComercial,
                empresa.usuarios_adicionais,
                empresa.veiculos_adicionais,
              )
            : null,
        }
      }),
    )
  } catch (error) {
    console.error('Erro ao listar empresas no Admin:', error)
    return NextResponse.json({ erro: 'Falha ao buscar empresas cadastradas.' }, { status: 500 })
  }
}
