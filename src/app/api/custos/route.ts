import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { criarNotificacao } from '@/lib/notificacoes'
import { prisma } from '@/lib/prisma'
import { dataIsoSchema, nomeOperacional, textoOperacional, valorMonetarioSchema } from '@/lib/domainValidation'
import { executarComAuditoria } from '@/lib/auditoria'
import type { Custo } from '@prisma/client'

const schema = z.object({
  veiculoId: z.string().uuid(), motoristaId: z.string().uuid().optional().nullable(), data: dataIsoSchema,
  categoria: z.enum(['COMBUSTIVEL', 'MANUTENCAO', 'PEDAGIO', 'ALIMENTACAO', 'DIARIA_MOTORISTA', 'SEGURO', 'OUTROS']),
  descricao: textoOperacional(3, 500), valor: valorMonetarioSchema.positive(), formaPagamento: nomeOperacional(2, 80), status: z.enum(['PAGO', 'PENDENTE']),
}).strict()

const serializar = (c: Custo) => ({ id: c.id, duplaId: c.veiculoId, veiculoId: c.veiculoId, motoristaId: c.motoristaId, data: c.data.toISOString().slice(0, 10), ano: c.ano, mesIndex: c.mesIndex, semanaIndex: c.semanaIndex, categoria: c.categoria, descricao: c.descricao, valor: c.valor, formaPagamento: c.formaPagamento, status: c.status })

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId || !auth.empresa) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const ano = request.nextUrl.searchParams.get('ano')
  const anoMinimo = new Date().getFullYear() - (auth.empresa.permissoes.historicoAnos - 1)
  if (ano && Number(ano) < anoMinimo) return NextResponse.json({ erro: `Seu plano permite ${auth.empresa.permissoes.historicoAnos} ano(s) de histórico.` }, { status: 403 })
  const custos = await prisma.custo.findMany({ where: { empresaId: auth.session.empresaId, ano: { gte: anoMinimo }, ...(ano ? { ano: Number(ano) } : {}) }, orderBy: { data: 'desc' }, take: 5000 })
  return NextResponse.json(custos.map(serializar))
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'GESTAO', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ erro: 'Dados do custo inválidos.' }, { status: 400 })
  const veiculo = await prisma.veiculo.findFirst({ where: { id: parsed.data.veiculoId, empresaId: auth.session.empresaId }, select: { id: true, placa: true } })
  if (!veiculo) return NextResponse.json({ erro: 'Veículo inválido.' }, { status: 400 })
  if (parsed.data.motoristaId && !await prisma.motorista.findFirst({ where: { id: parsed.data.motoristaId, empresaId: auth.session.empresaId }, select: { id: true } })) return NextResponse.json({ erro: 'Motorista inválido.' }, { status: 400 })
  const data = new Date(`${parsed.data.data}T12:00:00`)
  const custo = await executarComAuditoria({ usuarioId: auth.session.userId }, (tx) => tx.custo.create({ data: { ...parsed.data, data, ano: data.getFullYear(), mesIndex: data.getMonth(), semanaIndex: Math.min(4, Math.floor((data.getDate() - 1) / 7) + 1), empresaId: auth.session!.empresaId! } }))
  await criarNotificacao({ titulo: 'Custo registrado', mensagem: `${veiculo.placa}: ${custo.descricao} — ${custo.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`, modulo: 'CUSTOS', empresaId: auth.session.empresaId, usuarioId: auth.session.userId, veiculoId: veiculo.id })
  return NextResponse.json(serializar(custo), { status: 201 })
}
