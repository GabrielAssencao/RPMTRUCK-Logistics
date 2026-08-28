import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { diasAteVencimento, nivelVencimento } from '@/lib/financeiro/contasPagar'

const CATEGORIAS_GRAFICO = ['COMBUSTIVEL', 'MANUTENCAO', 'PEDAGIO'] as const
type CategoriaGrafico = typeof CATEGORIAS_GRAFICO[number]
type TotaisCategoria = Record<CategoriaGrafico, number>

function inicioDoDia(data: Date) {
  const inicio = new Date(data)
  inicio.setHours(0, 0, 0, 0)
  return inicio
}

function criarTotaisCategoria(): TotaisCategoria {
  return { COMBUSTIVEL: 0, MANUTENCAO: 0, PEDAGIO: 0 }
}

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session?.empresaId || !auth.empresa) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const usuario = auth.usuario
  if (!usuario) {
    return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 403 })
  }

  const gestor = usuario.role === 'GESTOR_EMPRESA'
  if (!gestor && !usuario.acessoDashboardGeral) {
    return NextResponse.json({ erro: 'A visão geral não foi liberada pelo gestor.' }, { status: 403 })
  }

  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const inicio30Dias = inicioDoDia(new Date(agora.getTime() - 29 * 86_400_000))
  const inicioCustos = inicioMes < inicio30Dias ? inicioMes : inicio30Dias
  const limiteCnh = new Date(agora.getTime() + 30 * 86_400_000)
  const empresaId = auth.session.empresaId

  const operadoresPromise = gestor
    ? prisma.usuario.findMany({
        where: { empresaId, role: { in: ['GESTOR_EMPRESA', 'OPERADOR'] } },
        select: { id: true, nome: true, role: true },
        orderBy: { nome: 'asc' as const },
      })
    : Promise.resolve([])
  const contasPendentesPromise = gestor && auth.empresa.modulos.includes('CONTAS_PAGAR')
    ? prisma.contaPagar.findMany({
        where: { empresaId, status: 'PENDENTE' },
        select: { id: true, descricao: true, fornecedor: true, vencimento: true, valor: true },
        orderBy: { vencimento: 'asc' },
        take: 20,
      })
    : Promise.resolve([])

  const [
    veiculosPorStatus,
    custosPeriodo,
    manutencoes,
    motoristas,
    operadores,
    tarefasPendentes,
    contasPendentes,
  ] = await Promise.all([
    prisma.veiculo.groupBy({
      by: ['status'],
      where: { empresaId },
      _count: { _all: true },
      _sum: { quilometragem: true },
    }),
    prisma.custo.findMany({
      where: { empresaId, data: { gte: inicioCustos } },
      select: { data: true, valor: true, categoria: true },
    }),
    prisma.historicoVeiculo.findMany({
      where: { empresaId, status: 'PENDENTE' },
      include: { veiculo: { select: { modelo: true, placa: true } } },
      orderBy: { data_agendada: 'asc' },
      take: 20,
    }),
    prisma.motorista.findMany({
      where: { empresaId, validade: { lte: limiteCnh } },
      select: { id: true, nome: true, validade: true },
      orderBy: { validade: 'asc' },
      take: 20,
    }),
    operadoresPromise,
    prisma.tarefa.count({
      where: {
        empresaId,
        status: { in: ['PENDENTE', 'EM_ANDAMENTO'] },
        ...(gestor ? {} : { responsavelId: auth.session.userId }),
      },
    }),
    contasPendentesPromise,
  ])

  const totalVeiculos = veiculosPorStatus.reduce((total, grupo) => total + grupo._count._all, 0)
  const kmTotal = veiculosPorStatus.reduce(
    (total, grupo) => total + (grupo._sum.quilometragem ?? 0),
    0,
  )
  const totalAtivos = veiculosPorStatus.reduce(
    (total, grupo) => total + (grupo.status === 'INATIVO' ? 0 : grupo._count._all),
    0,
  )
  const totalOperacionais = veiculosPorStatus.find(
    grupo => grupo.status === 'OPERACIONAL',
  )?._count._all ?? 0

  const custosPorDia = new Map<number, TotaisCategoria>()
  const distribuicaoValores = new Map<string, number>()
  let custoMes = 0

  for (const custo of custosPeriodo) {
    const categoriaGrafico = CATEGORIAS_GRAFICO.includes(custo.categoria as CategoriaGrafico)
      ? custo.categoria as CategoriaGrafico
      : null

    if (custo.data >= inicio30Dias && categoriaGrafico) {
      const chaveDia = inicioDoDia(custo.data).getTime()
      const totais = custosPorDia.get(chaveDia) ?? criarTotaisCategoria()
      totais[categoriaGrafico] += custo.valor
      custosPorDia.set(chaveDia, totais)
    }

    if (custo.data >= inicioMes) {
      custoMes += custo.valor
      const categoriaDistribuicao = categoriaGrafico ?? 'OUTROS'
      distribuicaoValores.set(
        categoriaDistribuicao,
        (distribuicaoValores.get(categoriaDistribuicao) ?? 0) + custo.valor,
      )
    }
  }

  const montarSerie = (dias: number) => Array.from({ length: dias }, (_, indice) => {
    const data = inicioDoDia(new Date(agora.getTime() - (dias - 1 - indice) * 86_400_000))
    const totais = custosPorDia.get(data.getTime()) ?? criarTotaisCategoria()
    return {
      dia: dias <= 7
        ? data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
        : data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      combustivel: totais.COMBUSTIVEL,
      manutencao: totais.MANUTENCAO,
      pedagio: totais.PEDAGIO,
    }
  })

  const distribuicao = ['COMBUSTIVEL', 'MANUTENCAO', 'PEDAGIO', 'OUTROS'].map(categoria => {
    const valor = distribuicaoValores.get(categoria) ?? 0
    const name = categoria === 'COMBUSTIVEL'
      ? 'Combustível'
      : categoria === 'MANUTENCAO'
        ? 'Manutenção'
        : categoria === 'PEDAGIO'
          ? 'Pedágios'
          : 'Outros'
    return { name, value: custoMes ? Math.round((valor / custoMes) * 100) : 0 }
  })

  const alertas = [
    ...manutencoes.map(manutencao => ({
      id: manutencao.id,
      categoria: 'VEICULO',
      subtipo: manutencao.data_agendada < agora ? 'NAO_REALIZADA' : 'PENDENTE',
      foco: `${manutencao.veiculo.modelo} (${manutencao.veiculo.placa})`,
      descricao: `${manutencao.tipo}: ${manutencao.descricao || manutencao.pecas_substituidas || 'manutenção programada'} — ${manutencao.data_agendada.toLocaleDateString('pt-BR')}`,
    })),
    ...motoristas.map(motorista => ({
      id: motorista.id,
      categoria: 'MOTORISTA',
      subtipo: 'DOCUMENTO',
      foco: motorista.nome,
      descricao: `CNH com validade em ${motorista.validade.toLocaleDateString('pt-BR')}.`,
    })),
  ]

  return NextResponse.json({
    usuario: {
      nome: usuario.nome,
      role: usuario.role,
      acessoDashboardGeral: usuario.acessoDashboardGeral,
      podeDelegar: gestor,
    },
    empresa: {
      nome: auth.empresa.nome,
      plano: auth.empresa.plano,
      modulos: auth.empresa.modulos,
    },
    metricas: {
      totalVeiculos,
      totalAtivos,
      totalOperacionais,
      custoMes,
      custoKm: kmTotal ? custoMes / kmTotal : 0,
      tarefasPendentes,
    },
    graficos: {
      '7_DIAS': montarSerie(7),
      '15_DIAS': montarSerie(15),
      '30_DIAS': montarSerie(30),
      distribuicao,
    },
    alertas,
    contasPagar: {
      visivel: gestor,
      total: contasPendentes.reduce((soma, conta) => soma + Number(conta.valor), 0),
      urgentes: contasPendentes.filter((conta) => nivelVencimento(conta.vencimento, agora) === 'VERMELHO').length,
      proximas: contasPendentes.filter((conta) => nivelVencimento(conta.vencimento, agora) === 'AMARELO').length,
      contas: contasPendentes.slice(0, 5).map((conta) => ({
        ...conta,
        valor: Number(conta.valor),
        vencimento: conta.vencimento.toISOString().slice(0, 10),
        diasParaVencer: diasAteVencimento(conta.vencimento, agora),
        nivel: nivelVencimento(conta.vencimento, agora),
      })),
    },
    operadores: operadores.map(operador => ({
      id: operador.id,
      nome: operador.nome,
      cargo: operador.role.replace('_', ' '),
    })),
  })
}
