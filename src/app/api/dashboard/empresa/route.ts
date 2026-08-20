import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'

const CATEGORIAS_GRAFICO = ['COMBUSTIVEL', 'MANUTENCAO', 'PEDAGIO'] as const

function inicioDoDia(data: Date) {
  const inicio = new Date(data)
  inicio.setHours(0, 0, 0, 0)
  return inicio
}

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request)
  if (auth.error || !auth.session?.empresaId || !auth.empresa) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }

  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const inicio30Dias = inicioDoDia(new Date(agora.getTime() - 29 * 86_400_000))
  const limiteCnh = new Date(agora.getTime() + 30 * 86_400_000)

  const [usuario, veiculos, custosMes, custos30Dias, manutencoes, motoristas, operadores, tarefasPendentes] = await prisma.$transaction([
    prisma.usuario.findUnique({ where: { id: auth.session.userId }, select: { nome: true } }),
    prisma.veiculo.findMany({ where: { empresaId: auth.session.empresaId }, select: { id: true, status: true, quilometragem: true } }),
    prisma.custo.findMany({ where: { empresaId: auth.session.empresaId, data: { gte: inicioMes } }, select: { valor: true, categoria: true } }),
    prisma.custo.findMany({ where: { empresaId: auth.session.empresaId, data: { gte: inicio30Dias } }, select: { data: true, valor: true, categoria: true } }),
    prisma.historicoVeiculo.findMany({
      where: { empresaId: auth.session.empresaId, status: 'PENDENTE' },
      include: { veiculo: { select: { modelo: true, placa: true } } }, orderBy: { data_agendada: 'asc' }, take: 20,
    }),
    prisma.motorista.findMany({
      where: { empresaId: auth.session.empresaId, validade: { lte: limiteCnh } },
      select: { id: true, nome: true, validade: true }, orderBy: { validade: 'asc' }, take: 20,
    }),
    prisma.usuario.findMany({
      where: { empresaId: auth.session.empresaId, role: { in: ['GESTOR_EMPRESA', 'OPERADOR'] } },
      select: { id: true, nome: true, role: true }, orderBy: { nome: 'asc' },
    }),
    prisma.tarefa.count({ where: { empresaId: auth.session.empresaId, status: { in: ['PENDENTE', 'EM_ANDAMENTO'] } } }),
  ])

  const custoMes = custosMes.reduce((total, custo) => total + custo.valor, 0)
  const kmTotal = veiculos.reduce((total, veiculo) => total + veiculo.quilometragem, 0)
  const totalAtivos = veiculos.filter(veiculo => veiculo.status !== 'INATIVO').length
  const totalOperacionais = veiculos.filter(veiculo => veiculo.status === 'OPERACIONAL').length

  const montarSerie = (dias: number) => Array.from({ length: dias }, (_, indice) => {
    const data = inicioDoDia(new Date(agora.getTime() - (dias - 1 - indice) * 86_400_000))
    const proximoDia = new Date(data.getTime() + 86_400_000)
    const custos = custos30Dias.filter(custo => custo.data >= data && custo.data < proximoDia)
    const total = (categoria: typeof CATEGORIAS_GRAFICO[number]) => custos.filter(custo => custo.categoria === categoria).reduce((soma, custo) => soma + custo.valor, 0)
    return {
      dia: dias <= 7 ? data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') : data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      combustivel: total('COMBUSTIVEL'), manutencao: total('MANUTENCAO'), pedagio: total('PEDAGIO'),
    }
  })

  const totalDistribuicao = custosMes.reduce((total, custo) => total + custo.valor, 0)
  const distribuicao = ['COMBUSTIVEL', 'MANUTENCAO', 'PEDAGIO', 'OUTROS'].map(categoria => {
    const valor = categoria === 'OUTROS'
      ? custosMes.filter(custo => !CATEGORIAS_GRAFICO.includes(custo.categoria as typeof CATEGORIAS_GRAFICO[number])).reduce((soma, custo) => soma + custo.valor, 0)
      : custosMes.filter(custo => custo.categoria === categoria).reduce((soma, custo) => soma + custo.valor, 0)
    return { name: categoria === 'COMBUSTIVEL' ? 'Combustível' : categoria === 'MANUTENCAO' ? 'Manutenção' : categoria === 'PEDAGIO' ? 'Pedágios' : 'Outros', value: totalDistribuicao ? Math.round((valor / totalDistribuicao) * 100) : 0 }
  })

  const alertas = [
    ...manutencoes.map(manutencao => ({
      id: manutencao.id, categoria: 'VEICULO', subtipo: manutencao.data_agendada < agora ? 'NAO_REALIZADA' : 'PENDENTE',
      foco: `${manutencao.veiculo.modelo} (${manutencao.veiculo.placa})`,
      descricao: `${manutencao.tipo}: ${manutencao.descricao || manutencao.pecas_substituidas || 'manutenção programada'} — ${manutencao.data_agendada.toLocaleDateString('pt-BR')}`,
    })),
    ...motoristas.map(motorista => ({
      id: motorista.id, categoria: 'MOTORISTA', subtipo: 'DOCUMENTO', foco: motorista.nome,
      descricao: `CNH com validade em ${motorista.validade.toLocaleDateString('pt-BR')}.`,
    })),
  ]

  return NextResponse.json({
    usuario: { nome: usuario?.nome || auth.session.email },
    empresa: { nome: auth.empresa.nome, plano: auth.empresa.plano, modulos: auth.empresa.modulos },
    metricas: { totalVeiculos: veiculos.length, totalAtivos, totalOperacionais, custoMes, custoKm: kmTotal ? custoMes / kmTotal : 0, tarefasPendentes },
    graficos: { '7_DIAS': montarSerie(7), '15_DIAS': montarSerie(15), '30_DIAS': montarSerie(30), distribuicao },
    alertas,
    operadores: operadores.map(operador => ({ id: operador.id, nome: operador.nome, cargo: operador.role.replace('_', ' ') })),
  })
}
