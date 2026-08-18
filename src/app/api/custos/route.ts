import { requireEmpresaAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { session, error, status } = await requireEmpresaAuth(request)
  if (error || !session?.empresaId) {
    return NextResponse.json({ error: error || 'Não autenticado' }, { status })
  }

  try {
    const { searchParams } = request.nextUrl
    const ano = Number(searchParams.get('ano'))
    const mesIndex = Number(searchParams.get('mesIndex'))
    const semanaIndex = Number(searchParams.get('semanaIndex'))
    const veiculoId = searchParams.get('veiculoId')
    const empresaId = session.empresaId

    if (![ano, mesIndex, semanaIndex].every(Number.isInteger)) {
      return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })
    }

    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { plano: true } })
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

    const limiteAnos = empresa.plano === 'ENTERPRISE' ? 3 : 1
    const anoMinimoPermitido = new Date().getFullYear() - (limiteAnos - 1)
    if (ano < anoMinimoPermitido) {
      return NextResponse.json({ error: `Seu plano permite ${limiteAnos} ano(s) de histórico.` }, { status: 403 })
    }

    if (veiculoId) {
      const veiculoValido = await prisma.veiculo.findFirst({ where: { id: veiculoId, empresaId }, select: { id: true } })
      if (!veiculoValido) return NextResponse.json({ error: 'Veículo inválido.' }, { status: 400 })
    }

    const custos = await prisma.custo.findMany({
      where: { empresaId, ano, mesIndex, semanaIndex, ...(veiculoId ? { veiculoId } : {}) },
      include: { veiculo: true, motorista: true },
      orderBy: { data: 'desc' }
    })
    return NextResponse.json(custos)
  } catch (cause) {
    console.error('Erro ao carregar despesas:', cause)
    return NextResponse.json({ error: 'Erro ao carregar despesas.' }, { status: 500 })
  }
}
