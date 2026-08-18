// src/app/api/notificacoes/route.ts
// CRUD de notificações com autenticação

import { requireEmpresaAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

// GET - Listar notificações da empresa
export async function GET(request: NextRequest) {
  const { session, error, status } = await requireEmpresaAuth(request)

  if (error || !session) {
    return NextResponse.json({ erro: error }, { status })
  }

  try {
    const empresaId = session.empresaId!
    const url = new URL(request.url)
    const lidas = url.searchParams.get('lidas') // 'true', 'false', ou null (todas)

    const whereClause: Prisma.NotificacaoWhereInput = { empresaId }

    if (lidas !== null) {
      whereClause.lida = lidas === 'true'
    }

    const notificacoes = await prisma.notificacao.findMany({
      where: whereClause,
      include: {
        veiculo: {
          select: { id: true, modelo: true, placa: true }
        }
      },
      orderBy: { criado_em: 'desc' },
      take: 50 // Últimas 50
    })

    const naoLidas = notificacoes.filter(n => !n.lida).length

    return NextResponse.json({
      notificacoes,
      naoLidas,
      total: notificacoes.length
    })
  } catch (error) {
    console.error('Erro ao buscar notificações:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar notificações' },
      { status: 500 }
    )
  }
}

// POST - Criar notificação (Admin criando manualmente para empresa)
export async function POST(request: NextRequest) {
  const { session, error, status } = await requireEmpresaAuth(request)

  if (error || !session) {
    return NextResponse.json({ erro: error }, { status })
  }

  try {
    const empresaId = session.empresaId!
    const { titulo, mensagem, modulo, veiculoId } = await request.json()

    if (!titulo || !mensagem || !modulo) {
      return NextResponse.json(
        { erro: 'Título, mensagem e módulo são obrigatórios' },
        { status: 400 }
      )
    }

    if (veiculoId) {
      const veiculo = await prisma.veiculo.findFirst({
        where: { id: veiculoId, empresaId },
        select: { id: true }
      })
      if (!veiculo) return NextResponse.json({ erro: 'Veículo inválido' }, { status: 400 })
    }

    const notificacao = await prisma.notificacao.create({
      data: {
        titulo,
        mensagem,
        modulo,
        veiculoId: veiculoId || null,
        empresaId,
        lida: false
      },
      include: {
        veiculo: {
          select: { id: true, modelo: true, placa: true }
        }
      }
    })

    return NextResponse.json(notificacao, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar notificação:', error)
    return NextResponse.json(
      { erro: 'Erro ao criar notificação' },
      { status: 500 }
    )
  }
}
