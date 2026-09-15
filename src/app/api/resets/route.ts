import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { session, error, status } = await requireAdminAuth(request)
  if (error || !session) return NextResponse.json({ erro: error }, { status })

  try {
    const resets = await prisma.resetSenha.findMany({
      select: {
        id: true,
        email: true,
        status: true,
        token_expira_em: true,
        token_usado_em: true,
        criado_em: true,
        atualizado_em: true,
      },
      orderBy: { criado_em: 'desc' },
    })
    const usuarios = resets.length > 0
      ? await prisma.usuario.findMany({
          where: { email: { in: [...new Set(resets.map((reset) => reset.email))] }, excluidoEm: null },
          select: { id: true, nome: true, email: true, role: true, ativo: true, empresa: { select: { id: true, nome: true, excluidoEm: true } } },
        })
      : []
    const usuarioPorEmail = new Map(usuarios.map((usuario) => [usuario.email, usuario]))
    return NextResponse.json(resets.map((reset) => {
      const usuario = usuarioPorEmail.get(reset.email)
      return {
        ...reset,
        usuario: usuario ? {
          id: usuario.id,
          nome: usuario.nome,
          role: usuario.role,
          ativo: usuario.ativo,
          empresa: usuario.empresa && !usuario.empresa.excluidoEm
            ? { id: usuario.empresa.id, nome: usuario.empresa.nome }
            : null,
        } : null,
      }
    }))
  } catch (cause) {
    console.error('Erro ao listar redefinições:', cause)
    return NextResponse.json({ erro: 'Erro ao listar redefinições.' }, { status: 500 })
  }
}
