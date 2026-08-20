import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'

const schema = z.object({ data: z.string().min(10).optional(), codigo: z.string().trim().min(4).max(30).transform(v => v.toUpperCase()).optional(), tipo: z.string().trim().min(2).max(30).optional(), terminalInicio: z.string().trim().min(2).max(160).optional(), terminalFim: z.string().trim().min(2).max(160).optional(), veiculoId: z.string().uuid().optional(), motoristaId: z.string().uuid().nullable().optional(), frete: z.coerce.number().min(0).optional(), comissao: z.coerce.number().min(0).optional(), status: z.enum(['AGENDADO', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADO']).optional(), observacoes: z.string().trim().max(2000).nullable().optional(), itensConteudo: z.array(z.object({ nome: z.string().trim().min(1).max(100), porcentagem: z.coerce.number().min(0).max(100) })).max(50).optional() })
const serializar = (c: any) => ({ id: c.id, data: c.data.toISOString().slice(0, 10), codigo: c.codigo, tipo: c.tipo, terminalInicio: c.terminal_inicio, terminalFim: c.terminal_fim, duplaId: c.veiculoId, veiculoId: c.veiculoId, motoristaId: c.motoristaId, frete: c.frete, comissao: c.comissao, status: c.status, observacoes: c.observacoes || undefined, itensConteudo: c.itens_conteudo || [] })

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const atual = await prisma.container.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId } })
  if (!atual) return NextResponse.json({ erro: 'Container não encontrado.' }, { status: 404 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Alteração inválida.' }, { status: 400 })
  const d = parsed.data
  const container = await prisma.container.update({ where: { id: atual.id }, data: { data: d.data ? new Date(`${d.data}T12:00:00`) : undefined, codigo: d.codigo, tipo: d.tipo, terminal_inicio: d.terminalInicio, terminal_fim: d.terminalFim, frete: d.frete, comissao: d.comissao, status: d.status, observacoes: d.observacoes, itens_conteudo: d.itensConteudo, veiculoId: d.veiculoId, motoristaId: d.motoristaId } })
  return NextResponse.json(serializar(container))
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEmpresaAuth(request, { modulo: 'FROTA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const atual = await prisma.container.findFirst({ where: { id: params.id, empresaId: auth.session.empresaId }, select: { id: true } })
  if (!atual) return NextResponse.json({ erro: 'Container não encontrado.' }, { status: 404 })
  await prisma.container.delete({ where: { id: atual.id } })
  return NextResponse.json({ sucesso: true })
}
