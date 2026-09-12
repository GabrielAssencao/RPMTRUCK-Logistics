import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CadastroVeiculoError, criarVeiculoEmpresaComLimite } from '@/lib/veiculosEmpresa'
import { placaSchema } from '@/lib/domainValidation'

const schema = z.object({ modelo: z.string().trim().min(2).max(100), placa: placaSchema, tipo: z.string().trim().min(2).max(80) }).strict()

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(request);if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  return NextResponse.json(await prisma.veiculo.findMany({ where: { empresaId: params.id }, orderBy: { criado_em: 'desc' } }))
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(request);if (auth.error) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const parsed = schema.safeParse(await request.json().catch(() => null));if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
  try {
    return NextResponse.json(await criarVeiculoEmpresaComLimite({ usuarioId: auth.session!.userId, origem: 'SUPERADMIN', empresaId: params.id, dados: parsed.data }), { status: 201 })
  } catch (error) {
    if (error instanceof CadastroVeiculoError) return NextResponse.json({ erro: error.message }, { status: error.status })
    return NextResponse.json({ erro: 'Não foi possível cadastrar. Verifique a placa ou tente novamente após um cadastro concorrente.' }, { status: 409 })
  }
}
