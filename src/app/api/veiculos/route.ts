import { requireEmpresaAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

const LIMITES_BASE = {
  PREVIEW: 1,
  ESSENCIAL: 10,
  AVANCADO: 25,
  ENTERPRISE: 80,
} as const

export async function POST(request: NextRequest) {
  const { session, error, status } = await requireEmpresaAuth(request)
  if (error || !session?.empresaId) {
    return NextResponse.json({ erro: error || 'Não autenticado' }, { status })
  }

  try {
    const { modelo, tipo, placa, ano } = await request.json()
    if (!modelo || !tipo || !placa) {
      return NextResponse.json({ erro: 'Modelo, tipo e placa são obrigatórios.' }, { status: 400 })
    }

    const empresaId = session.empresaId
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { plano: true, status: true, veiculos_adicionais: true }
    })

    if (!empresa) return NextResponse.json({ erro: 'Empresa não localizada.' }, { status: 404 })
    if (empresa.status !== 'ATIVO') {
      return NextResponse.json({ erro: 'Empresa sem permissão para adicionar veículos.' }, { status: 403 })
    }

    const limiteVeiculos = LIMITES_BASE[empresa.plano] + empresa.veiculos_adicionais
    const totalVeiculos = await prisma.veiculo.count({ where: { empresaId } })
    if (totalVeiculos >= limiteVeiculos) {
      return NextResponse.json({ erro: `Limite do plano atingido (${limiteVeiculos} veículos).` }, { status: 400 })
    }

    const novoVeiculo = await prisma.veiculo.create({
      data: {
        modelo: String(modelo).trim(),
        tipo: String(tipo).trim(),
        placa: String(placa).trim().toUpperCase(),
        ano: ano ? Number(ano) : null,
        empresaId,
      }
    })
    return NextResponse.json(novoVeiculo, { status: 201 })
  } catch (cause) {
    console.error('Erro ao criar veículo:', cause)
    return NextResponse.json({ erro: 'Erro interno ao criar veículo.' }, { status: 500 })
  }
}
