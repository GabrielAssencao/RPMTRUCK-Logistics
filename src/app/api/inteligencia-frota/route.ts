import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { montarInteligenciaFrota, type CategoriaCustoInteligencia } from '@/lib/inteligenciaFrota'
import { prisma } from '@/lib/prisma'

const periodoSchema = z.coerce.number().int().refine((valor) => [3, 6, 12, 24, 36].includes(valor))
const LIMITES = { custos: 20_000, leituras: 20_000, operacoes: 10_000, manutencoes: 10_000 } as const

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'INTELIGENCIA', acao: 'GESTAO' })
  if (auth.error || !auth.session?.empresaId || !auth.empresa) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  if (!auth.empresa.modulos.includes('FROTA') || !auth.empresa.modulos.includes('GESTAO')) {
    return NextResponse.json({ erro: 'A Central de Inteligência requer os módulos Frota e Gestão.' }, { status: 403 })
  }

  const periodo = periodoSchema.safeParse(request.nextUrl.searchParams.get('meses') ?? '6')
  if (!periodo.success) {
    return NextResponse.json({ erro: 'Período de análise inválido.' }, { status: 400 })
  }

  const recursos = auth.empresa.permissoes.inteligencia
  if (periodo.data > recursos.mesesMaximos) {
    return NextResponse.json({ erro: `O plano ${auth.empresa.permissoes.nome} permite análises de até ${recursos.mesesMaximos} meses.` }, { status: 403 })
  }
  const meses = periodo.data
  const fim = new Date()
  const inicio = new Date(fim.getFullYear(), fim.getMonth() - meses + 1, 1)
  const inicioHistoricoManutencao = new Date(fim.getFullYear() - 3, fim.getMonth(), 1)
  const limiteManutencao = new Date(fim.getTime() + 180 * 86_400_000)
  const empresaId = auth.session.empresaId

  const [veiculos, custos, leituras, operacoes, manutencoes] = await prisma.$transaction([
    prisma.veiculo.findMany({
      where: { empresaId },
      select: { id: true, placa: true, modelo: true, status: true, quilometragem: true },
      orderBy: { placa: 'asc' },
    }),
    prisma.custo.findMany({
      where: { empresaId, data: { gte: inicio, lte: fim } },
      select: { id: true, data: true, categoria: true, descricao: true, valor: true, veiculoId: true, containerId: true },
      orderBy: { data: 'asc' },
      take: LIMITES.custos + 1,
    }),
    prisma.leituraQuilometragem.findMany({
      where: { empresaId, registrada_em: { gte: inicio, lte: fim } },
      select: { veiculoId: true, quilometragem: true, registrada_em: true },
      orderBy: { registrada_em: 'asc' },
      take: LIMITES.leituras + 1,
    }),
    prisma.container.findMany({
      where: { empresaId, data: { gte: inicio, lte: fim } },
      select: { id: true, codigo: true, data: true, terminal_inicio: true, terminal_fim: true, frete: true, comissao: true, status: true, veiculoId: true },
      orderBy: { data: 'desc' },
      take: LIMITES.operacoes + 1,
    }),
    prisma.historicoVeiculo.findMany({
      where: {
        empresaId,
        OR: [
          { status: 'CONCLUIDA', data_agendada: { gte: inicioHistoricoManutencao, lte: fim } },
          { status: 'PENDENTE', data_agendada: { lte: limiteManutencao } },
        ],
      },
      select: { id: true, veiculoId: true, data_agendada: true, data_conclusao: true, tipo: true, status: true },
      orderBy: { data_agendada: 'asc' },
      take: LIMITES.manutencoes + 1,
    }),
  ])

  if (
    custos.length > LIMITES.custos
    || leituras.length > LIMITES.leituras
    || operacoes.length > LIMITES.operacoes
    || manutencoes.length > LIMITES.manutencoes
  ) {
    return NextResponse.json({ erro: 'Há dados demais para este período. Selecione um intervalo menor para manter a análise completa.' }, { status: 422 })
  }

  const inteligencia = montarInteligenciaFrota({
    veiculos,
    custos: custos.map((custo) => ({
      ...custo,
      categoria: custo.categoria as CategoriaCustoInteligencia,
    })),
    leituras: leituras.map((leitura) => ({
      veiculoId: leitura.veiculoId,
      quilometragem: leitura.quilometragem,
      registradaEm: leitura.registrada_em,
    })),
    operacoes: operacoes.map((operacao) => ({
      id: operacao.id,
      codigo: operacao.codigo,
      data: operacao.data,
      origem: operacao.terminal_inicio,
      destino: operacao.terminal_fim,
      frete: operacao.frete,
      comissao: operacao.comissao,
      status: operacao.status,
      veiculoId: operacao.veiculoId,
    })),
    manutencoes: manutencoes.map((manutencao) => ({
      id: manutencao.id,
      veiculoId: manutencao.veiculoId,
      dataAgendada: manutencao.data_agendada,
      dataConclusao: manutencao.data_conclusao,
      tipo: manutencao.tipo,
      status: manutencao.status,
    })),
  }, inicio, fim)

  const recomendacoesPermitidas = inteligencia.recomendacoes.filter((item) => {
    if (!recursos.previsaoManutencao && item.id === 'manutencoes-atrasadas') return false
    if (!recursos.despesasForaPadrao && item.id === 'despesas-fora-padrao') return false
    if (!recursos.rentabilidadeOperacao && item.id.startsWith('saldo-')) return false
    return true
  })

  return NextResponse.json({
    periodo: { meses, inicio: inicio.toISOString(), fim: fim.toISOString() },
    ...inteligencia,
    resumo: {
      ...inteligencia.resumo,
      saldoOperacoesConhecido: recursos.rentabilidadeOperacao ? inteligencia.resumo.saldoOperacoesConhecido : null,
      despesasForaPadrao: recursos.despesasForaPadrao ? inteligencia.resumo.despesasForaPadrao : null,
      manutencoesAtrasadas: recursos.previsaoManutencao ? inteligencia.resumo.manutencoesAtrasadas : null,
    },
    desempenhoVeiculos: inteligencia.desempenhoVeiculos.map((veiculo) => recursos.rentabilidadeOperacao
      ? veiculo
      : { ...veiculo, receitaConhecida: null, saldoConhecido: null }),
    previsoesManutencao: recursos.previsaoManutencao ? inteligencia.previsoesManutencao : [],
    despesasForaPadrao: recursos.despesasForaPadrao ? inteligencia.despesasForaPadrao : [],
    rentabilidadeOperacoes: recursos.rentabilidadeOperacao ? inteligencia.rentabilidadeOperacoes : [],
    recomendacoes: recomendacoesPermitidas,
    recursos,
  })
}
