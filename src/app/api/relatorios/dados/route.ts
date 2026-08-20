import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'RELATORIOS' })
  if (auth.error || !auth.session?.empresaId || !auth.empresa) return NextResponse.json({ erro: auth.error }, { status: auth.status })
  const agora = new Date()
  const inicioParam = request.nextUrl.searchParams.get('inicio')
  const fimParam = request.nextUrl.searchParams.get('fim')
  const inicio = inicioParam ? new Date(`${inicioParam}T00:00:00`) : new Date(agora.getFullYear(), agora.getMonth() - 5, 1)
  const fim = fimParam ? new Date(`${fimParam}T23:59:59.999`) : agora
  const limite = new Date(); limite.setFullYear(limite.getFullYear() - auth.empresa.permissoes.historicoAnos)
  if (inicio < limite || fim < inicio) return NextResponse.json({ erro: 'Período fora da retenção permitida pelo plano.' }, { status: 403 })

  const [custos, veiculos, manutencoes, leiturasAnteriores, leiturasPeriodo] = await prisma.$transaction([
    prisma.custo.findMany({ where: { empresaId: auth.session.empresaId, data: { gte: inicio, lte: fim } }, include: { veiculo: { select: { placa: true, quilometragem: true } } }, orderBy: { data: 'asc' } }),
    prisma.veiculo.findMany({ where: { empresaId: auth.session.empresaId }, select: { id: true, placa: true, quilometragem: true } }),
    prisma.historicoVeiculo.findMany({
      where: { empresaId: auth.session.empresaId, data_agendada: { gte: inicio, lte: fim } },
      select: { custo: true, veiculo: { select: { placa: true } } },
    }),
    prisma.leituraQuilometragem.findMany({
      where: { empresaId: auth.session.empresaId, registrada_em: { lt: inicio } },
      select: { veiculoId: true, quilometragem: true, registrada_em: true },
      orderBy: { registrada_em: 'desc' },
      distinct: ['veiculoId'],
    }),
    prisma.leituraQuilometragem.findMany({
      where: { empresaId: auth.session.empresaId, registrada_em: { gte: inicio, lte: fim } },
      select: { veiculoId: true, quilometragem: true, registrada_em: true },
      orderBy: { registrada_em: 'asc' },
    }),
  ])
  const meses = new Map<string, { mes: string; custo: number; ano: number; mesIndex: number }>()
  custos.forEach(custo => { const chave = `${custo.data.getFullYear()}-${custo.data.getMonth()}`; const atual = meses.get(chave) || { mes: custo.data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), custo: 0, ano: custo.data.getFullYear(), mesIndex: custo.data.getMonth() }; atual.custo += custo.valor; meses.set(chave, atual) })
  const leiturasPorVeiculo = new Map<string, Array<{ quilometragem: number; registradaEm: Date }>>()
  leiturasAnteriores.forEach((leitura) => leiturasPorVeiculo.set(leitura.veiculoId, [{ quilometragem: leitura.quilometragem, registradaEm: leitura.registrada_em }]))
  leiturasPeriodo.forEach((leitura) => {
    const valores = leiturasPorVeiculo.get(leitura.veiculoId) ?? []
    valores.push({ quilometragem: leitura.quilometragem, registradaEm: leitura.registrada_em })
    leiturasPorVeiculo.set(leitura.veiculoId, valores)
  })
  const calcularKmNoIntervalo = (inicioIntervalo: Date, fimIntervalo: Date) => Array.from(leiturasPorVeiculo.values()).reduce((total, leituras) => {
    const leituraInicial = [...leituras].reverse().find((leitura) => leitura.registradaEm <= inicioIntervalo)
      ?? leituras.find((leitura) => leitura.registradaEm >= inicioIntervalo && leitura.registradaEm <= fimIntervalo)
    const leituraFinal = [...leituras].reverse().find((leitura) => leitura.registradaEm <= fimIntervalo)
    if (!leituraInicial || !leituraFinal || leituraFinal.registradaEm <= leituraInicial.registradaEm) return total
    return total + Math.max(0, leituraFinal.quilometragem - leituraInicial.quilometragem)
  }, 0)
  const kmTotal = calcularKmNoIntervalo(inicio, fim)
  const eficiencia = Array.from(meses.values()).map(item => {
    const inicioMes = new Date(item.ano, item.mesIndex, 1)
    const fimMes = new Date(item.ano, item.mesIndex + 1, 0, 23, 59, 59, 999)
    const kmMes = calcularKmNoIntervalo(inicioMes < inicio ? inicio : inicioMes, fimMes > fim ? fim : fimMes)
    return { mes: item.mes, custo: item.custo, kmTotal: kmMes, custoKm: kmMes ? item.custo / kmMes : 0 }
  })
  const porVeiculo = veiculos.map(veiculo => ({
    veiculo: veiculo.placa,
    combustivel: custos.filter(c => c.veiculoId === veiculo.id && c.categoria === 'COMBUSTIVEL').reduce((s, c) => s + c.valor, 0),
    manutencao: custos.filter(c => c.veiculoId === veiculo.id && c.categoria === 'MANUTENCAO').reduce((s, c) => s + c.valor, 0),
  }))
  const totalCustos = custos.reduce((soma, custo) => soma + custo.valor, 0)
  const custosOrdenados = porVeiculo
    .map(item => ({ placa: item.veiculo, valor: item.combustivel + item.manutencao }))
    .filter(item => item.valor > 0)
    .sort((a, b) => a.valor - b.valor)
  const manutencaoPorVeiculo = new Map<string, number>()
  manutencoes.forEach((item) => manutencaoPorVeiculo.set(item.veiculo.placa, (manutencaoPorVeiculo.get(item.veiculo.placa) ?? 0) + item.custo))
  const maiorManutencao = Array.from(manutencaoPorVeiculo, ([placa, valor]) => ({ placa, valor })).sort((a, b) => b.valor - a.valor)[0] ?? null

  return NextResponse.json({
    eficiencia,
    porVeiculo,
    metricas: {
      totalCustos,
      kmAcumulado: kmTotal,
      custoPorKmAcumulado: kmTotal ? totalCustos / kmTotal : 0,
      veiculoMenorCusto: custosOrdenados[0] ?? null,
      veiculoMaiorManutencao: maiorManutencao,
    },
  })
}
