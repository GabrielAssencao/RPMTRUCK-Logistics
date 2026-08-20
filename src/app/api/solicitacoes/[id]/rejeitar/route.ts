import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(request); if (auth.error) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const solicitacao = await prisma.solicitacaoAcesso.findUnique({ where: { id: params.id } })
  if (!solicitacao) return NextResponse.json({ erro: 'Solicitação não encontrada.' }, { status: 404 })
  if (solicitacao.status !== 'PENDENTE') return NextResponse.json({ erro: 'Solicitação já processada.' }, { status: 400 })
  await prisma.solicitacaoAcesso.update({ where: { id: solicitacao.id }, data: { status: 'REJEITADO' } })
  return NextResponse.json({ sucesso: true })
}
