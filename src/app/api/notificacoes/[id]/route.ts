// src/app/api/notificacoes/[id]/route.ts
// Atualizar status de leitura da notificação

import { requireEmpresaAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error, status } = await requireEmpresaAuth(request)

  if (error || !session) {
    return NextResponse.json({ erro: error }, { status })
  }

  try {
    const { lida } = await request.json()

    if (typeof lida !== 'boolean') {
      return NextResponse.json(
        { erro: 'Campo lida deve ser booleano' },
        { status: 400 }
      )
    }

    // Verificar se notificação pertence à empresa do usuário (IDOR)
    const notificacao = await prisma.notificacao.findUnique({
      where: { id: params.id }
    })

    if (!notificacao) {
      return NextResponse.json(
        { erro: 'Notificação não encontrada' },
        { status: 404 }
      )
    }

    if (notificacao.empresaId !== session.empresaId) {
      return NextResponse.json(
        { erro: 'Acesso negado' },
        { status: 403 }
      )
    }

    const atualizada = await prisma.notificacao.update({
      where: { id: params.id },
      data: { lida },
      include: {
        veiculo: {
          select: { id: true, modelo: true, placa: true }
        }
      }
    })

    return NextResponse.json(atualizada)
  } catch (error) {
    console.error('Erro ao atualizar notificação:', error)
    return NextResponse.json(
      { erro: 'Erro ao atualizar notificação' },
      { status: 500 }
    )
  }
}

// DELETE - Deletar notificação
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error, status } = await requireEmpresaAuth(request)

  if (error || !session) {
    return NextResponse.json({ erro: error }, { status })
  }

  try {
    const notificacao = await prisma.notificacao.findUnique({
      where: { id: params.id }
    })

    if (!notificacao) {
      return NextResponse.json(
        { erro: 'Notificação não encontrada' },
        { status: 404 }
      )
    }

    if (notificacao.empresaId !== session.empresaId) {
      return NextResponse.json(
        { erro: 'Acesso negado' },
        { status: 403 }
      )
    }

    await prisma.notificacao.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ sucesso: true })
  } catch (error) {
    console.error('Erro ao deletar notificação:', error)
    return NextResponse.json(
      { erro: 'Erro ao deletar notificação' },
      { status: 500 }
    )
  }
}
