import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLANOS_CONFIG } from '@/utils/planos'
import { executarComAuditoria } from '@/lib/auditoria'

const schema = z.object({ modelo: z.string().trim().min(2).max(100), placa: z.string().trim().min(5).max(12).transform(v => v.toUpperCase()), tipo: z.string().trim().min(2).max(80) })

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(request);if (auth.error || !auth.session) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  return NextResponse.json(await prisma.veiculo.findMany({ where: { empresaId: params.id }, orderBy: { criado_em: 'desc' } }))
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAdminAuth(request);if (auth.error) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const parsed = schema.safeParse(await request.json());if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
  const empresa = await prisma.empresa.findUnique({ where: { id: params.id }, include: { _count: { select: { veiculos_frota: true } } } })
  if (!empresa) return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })
  const limite = PLANOS_CONFIG[empresa.plano].veiculosBase + empresa.veiculos_adicionais
  if (empresa._count.veiculos_frota >= limite) return NextResponse.json({ erro: `Limite de ${limite} veículos atingido.` }, { status: 400 })
  try { return NextResponse.json(await executarComAuditoria({ usuarioId: auth.session!.userId, origem: 'SUPERADMIN' }, (tx) => tx.veiculo.create({ data: { ...parsed.data, empresaId: empresa.id } })), { status: 201 }) } catch { return NextResponse.json({ erro: 'Placa já cadastrada.' }, { status: 409 }) }
}
