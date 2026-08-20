import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularMensalidade, normalizarModulos } from '@/utils/planos'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  if (auth.error || !auth.session) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  try {
    const empresas = await prisma.empresa.findMany({
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
    })

    return NextResponse.json(
      empresas.map((empresa) => ({
        ...empresa,
        modulos: normalizarModulos(empresa.modulos),
        mensalidade: calcularMensalidade(
          empresa.plano,
          empresa.usuarios_adicionais,
          empresa.veiculos_adicionais,
        ),
      })),
    )
  } catch (error) {
    console.error('Erro ao listar empresas no Admin:', error)
    return NextResponse.json({ erro: 'Falha ao buscar empresas cadastradas.' }, { status: 500 })
  }
}
