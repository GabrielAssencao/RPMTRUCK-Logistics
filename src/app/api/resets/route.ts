import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { session, error, status } = await requireAdminAuth(request)
  if (error || !session) return NextResponse.json({ erro: error }, { status })

  try {
    const resets = await prisma.resetSenha.findMany({ orderBy: { criado_em: 'desc' } })
    return NextResponse.json(resets)
  } catch (cause) {
    console.error('Erro ao listar redefinições:', cause)
    return NextResponse.json({ erro: 'Erro ao listar redefinições.' }, { status: 500 })
  }
}
