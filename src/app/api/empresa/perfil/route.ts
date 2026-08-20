import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session || !auth.empresa) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  return NextResponse.json(
    {
      usuario: {
        id: auth.session.userId,
        email: auth.session.email,
        role: auth.session.role,
      },
      empresa: auth.empresa,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

const atualizarPerfilSchema = z.object({
  nome: z.string().trim().min(2).max(150),
  cnpj: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email(),
  telefone: z.string().trim().max(30).nullable().optional(),
})

export async function PATCH(request: NextRequest) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  if (!['GESTOR_EMPRESA', 'GESTOR'].includes(auth.session.role)) return NextResponse.json({ erro: 'Apenas o gestor pode alterar o perfil da empresa.' }, { status: 403 })
  const parsed = atualizarPerfilSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da empresa inválidos.' }, { status: 400 })
  try {
    const empresa = await prisma.empresa.update({ where: { id: auth.session.empresaId }, data: parsed.data })
    return NextResponse.json({ empresa })
  } catch {
    return NextResponse.json({ erro: 'CNPJ ou e-mail já utilizado por outra empresa.' }, { status: 409 })
  }
}
