import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({ mes: z.string().trim().min(3).max(20), ano: z.coerce.number().int().min(2020).max(2100), tipo: z.string().trim().min(2).max(50), valor: z.coerce.number().min(0) })
export async function GET(request: NextRequest, { params }: { params: { id: string } }) { const auth = await requireAdminAuth(request); if (auth.error) return NextResponse.json({ erro: auth.error }, { status: auth.status }); return NextResponse.json(await prisma.fatura.findMany({ where: { empresaId: params.id }, orderBy: [{ ano: 'desc' }, { criado_em: 'desc' }] })) }
export async function POST(request: NextRequest, { params }: { params: { id: string } }) { const auth = await requireAdminAuth(request); if (auth.error) return NextResponse.json({ erro: auth.error }, { status: auth.status }); const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ erro: 'Dados da fatura inválidos.' }, { status: 400 }); return NextResponse.json(await prisma.fatura.create({ data: { ...parsed.data, empresaId: params.id } }), { status: 201 }) }
