import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { nomeOperacional } from '@/lib/domainValidation'

const schema = z.object({ nome: nomeOperacional(2, 100), cidadeUF: nomeOperacional(2, 100), capacidade: z.coerce.number().int().min(0).max(100000) }).strict()

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  return NextResponse.json(await prisma.localizacao.findMany({ where: { empresaId: auth.session.empresaId }, orderBy: { nome: 'asc' } }))
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da localização inválidos.' }, { status: 400 })
  return NextResponse.json(await prisma.localizacao.create({ data: { ...parsed.data, empresaId: auth.session.empresaId } }), { status: 201 })
}
