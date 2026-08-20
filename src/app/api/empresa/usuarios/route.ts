import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { criarNotificacao } from '@/lib/notificacoes'

const criarOperadorSchema = z.object({
  nome: z.string().trim().min(3).max(100),
  email: z.string().trim().email().toLowerCase(),
  senha: z.string().min(8).max(128),
  role: z.enum(['OPERADOR', 'VISUALIZADOR']),
})

function gestorAutorizado(role?: string) {
  return role === 'GESTOR_EMPRESA' || role === 'GESTOR'
}

export async function GET(request: NextRequest) {
  const { session, error, status } = await requireEmpresaAuth(request)
  if (error || !session?.empresaId) {
    return NextResponse.json({ error: error || 'Não autenticado' }, { status })
  }
  if (!gestorAutorizado(session.role)) {
    return NextResponse.json({ error: 'Apenas o gestor pode consultar usuários.' }, { status: 403 })
  }

  try {
    const usuarios = await prisma.usuario.findMany({
      where: { empresaId: session.empresaId },
      select: { id: true, nome: true, email: true, role: true, criado_em: true },
      orderBy: { criado_em: 'desc' }
    })
    return NextResponse.json(usuarios)
  } catch (cause) {
    console.error('Erro ao buscar usuários:', cause)
    return NextResponse.json({ error: 'Erro ao buscar usuários.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { session, error, status } = await requireEmpresaAuth(request)
  if (error || !session?.empresaId) {
    return NextResponse.json({ error: error || 'Não autenticado' }, { status })
  }
  if (!gestorAutorizado(session.role)) {
    return NextResponse.json({ error: 'Apenas o gestor pode criar usuários.' }, { status: 403 })
  }

  try {
    const parsed = criarOperadorSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados de usuário inválidos.' }, { status: 400 })
    }

    const { nome, email, senha, role } = parsed.data
    const usuarioExiste = await prisma.usuario.findUnique({ where: { email }, select: { id: true } })
    if (usuarioExiste) {
      return NextResponse.json({ error: 'E-mail já cadastrado no sistema.' }, { status: 409 })
    }

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha_hash: await bcrypt.hash(senha, 10),
        role,
        empresaId: session.empresaId,
      },
      select: { id: true, nome: true, email: true, role: true, criado_em: true }
    })
    await criarNotificacao({ titulo: 'Acesso criado', mensagem: 'Seu usuário foi adicionado à empresa. Revise suas tarefas e notificações no painel.', modulo: 'USUARIOS', empresaId: session.empresaId, usuarioId: usuario.id })
    return NextResponse.json(usuario, { status: 201 })
  } catch (cause) {
    console.error('Erro ao criar usuário:', cause)
    return NextResponse.json({ error: 'Erro interno ao criar usuário.' }, { status: 500 })
  }
}
