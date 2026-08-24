import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Custo } from '@prisma/client'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { criarNotificacao } from '@/lib/notificacoes'
import { prisma } from '@/lib/prisma'
import { dataIsoSchema, nomeOperacional, textoOperacional, valorMonetarioSchema } from '@/lib/domainValidation'
import { executarComAuditoria } from '@/lib/auditoria'

const schema = z.object({
  veiculoId: z.string().uuid(),
  motoristaId: z.string().uuid().optional().nullable(),
  data: dataIsoSchema,
  categoria: z.enum(['COMBUSTIVEL', 'MANUTENCAO', 'PEDAGIO', 'ALIMENTACAO', 'DIARIA_MOTORISTA', 'SEGURO', 'OUTROS']),
  descricao: textoOperacional(3, 500),
  valor: valorMonetarioSchema.positive(),
  formaPagamento: nomeOperacional(2, 80),
  status: z.enum(['PAGO', 'PENDENTE']),
}).strict()

type CustoSerializavel = Pick<Custo, 'id' | 'veiculoId' | 'motoristaId' | 'data' | 'ano' | 'mesIndex' | 'semanaIndex' | 'categoria' | 'descricao' | 'valor' | 'formaPagamento' | 'status'>

const serializar = (custo: CustoSerializavel) => ({
  id: custo.id,
  duplaId: custo.veiculoId,
  veiculoId: custo.veiculoId,
  motoristaId: custo.motoristaId,
  data: custo.data.toISOString().slice(0, 10),
  ano: custo.ano,
  mesIndex: custo.mesIndex,
  semanaIndex: custo.semanaIndex,
  categoria: custo.categoria,
  descricao: custo.descricao,
  valor: custo.valor,
  formaPagamento: custo.formaPagamento,
  status: custo.status,
})

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId || !auth.empresa) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const anoParam = request.nextUrl.searchParams.get('ano')
  const ano = anoParam ? Number(anoParam) : null
  const anoMinimo = new Date().getFullYear() - (auth.empresa.permissoes.historicoAnos - 1)
  if (ano !== null && (!Number.isInteger(ano) || ano < 2000 || ano > 2100)) {
    return NextResponse.json({ erro: 'Ano de consulta inválido.' }, { status: 400 })
  }
  if (ano !== null && ano < anoMinimo) {
    return NextResponse.json({ erro: `Seu plano permite ${auth.empresa.permissoes.historicoAnos} ano(s) de histórico.` }, { status: 403 })
  }

  const custos = await prisma.custo.findMany({
    where: { empresaId: auth.session.empresaId, ano: ano ?? { gte: anoMinimo } },
    select: {
      id: true,
      veiculoId: true,
      motoristaId: true,
      data: true,
      ano: true,
      mesIndex: true,
      semanaIndex: true,
      categoria: true,
      descricao: true,
      valor: true,
      formaPagamento: true,
      status: true,
    },
    orderBy: { data: 'desc' },
    take: 5000,
  })
  return NextResponse.json(custos.map(serializar))
}

export async function POST(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'GESTAO', acao: 'ESCRITA' })
  if (auth.error || !auth.session?.empresaId) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Dados do custo inválidos.' }, { status: 400 })
  }

  const empresaId = auth.session.empresaId
  const veiculo = await prisma.veiculo.findFirst({
    where: { id: parsed.data.veiculoId, empresaId },
    select: { id: true, placa: true },
  })
  if (!veiculo) return NextResponse.json({ erro: 'Veículo inválido.' }, { status: 400 })

  if (parsed.data.motoristaId) {
    const motorista = await prisma.motorista.findFirst({
      where: { id: parsed.data.motoristaId, empresaId },
      select: { id: true },
    })
    if (!motorista) return NextResponse.json({ erro: 'Motorista inválido.' }, { status: 400 })
  }

  const data = new Date(`${parsed.data.data}T12:00:00`)
  const custo = await executarComAuditoria(
    { usuarioId: auth.session.userId },
    tx => tx.custo.create({
      data: {
        ...parsed.data,
        data,
        ano: data.getFullYear(),
        mesIndex: data.getMonth(),
        semanaIndex: Math.min(4, Math.floor((data.getDate() - 1) / 7) + 1),
        empresaId,
      },
    }),
  )
  await criarNotificacao({
    titulo: 'Custo registrado',
    mensagem: `${veiculo.placa}: ${custo.descricao} — ${custo.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    modulo: 'CUSTOS',
    empresaId,
    usuarioId: auth.session.userId,
    veiculoId: veiculo.id,
  })
  return NextResponse.json(serializar(custo), { status: 201 })
}
