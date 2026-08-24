import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaAuth } from '@/lib/empresaAuth'
import { prisma } from '@/lib/prisma'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit'

interface LeituraIntervalo {
  quilometragem: number
  registradaEm: Date
}

function parseDataParametro(valor: string | null, finalDoDia: boolean) {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const data = new Date(`${valor}T${finalDoDia ? '23:59:59.999' : '00:00:00'}`)
  return Number.isNaN(data.getTime()) ? null : data
}

function indiceUltimaLeituraAte(leituras: LeituraIntervalo[], limite: Date) {
  let inicio = 0
  let fim = leituras.length - 1
  let resultado = -1

  while (inicio <= fim) {
    const meio = Math.floor((inicio + fim) / 2)
    if (leituras[meio].registradaEm <= limite) {
      resultado = meio
      inicio = meio + 1
    } else {
      fim = meio - 1
    }
  }

  return resultado
}

function indicePrimeiraLeituraDesde(leituras: LeituraIntervalo[], limite: Date) {
  let inicio = 0
  let fim = leituras.length - 1
  let resultado = -1

  while (inicio <= fim) {
    const meio = Math.floor((inicio + fim) / 2)
    if (leituras[meio].registradaEm >= limite) {
      resultado = meio
      fim = meio - 1
    } else {
      inicio = meio + 1
    }
  }

  return resultado
}

export async function GET(request: NextRequest) {
  const auth = await requireEmpresaAuth(request, { modulo: 'RELATORIOS' })
  if (auth.error || !auth.session?.empresaId || !auth.empresa) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status })
  }
  const limited = await applyRateLimit(
    request,
    `report-read:${auth.session.empresaId}:${auth.session.userId}`,
    RATE_LIMITS.REPORT_READ.limit,
    RATE_LIMITS.REPORT_READ.windowMs,
  )
  if (limited) return limited

  const agora = new Date()
  const inicioParam = request.nextUrl.searchParams.get('inicio')
  const fimParam = request.nextUrl.searchParams.get('fim')
  const inicio = inicioParam
    ? parseDataParametro(inicioParam, false)
    : new Date(agora.getFullYear(), agora.getMonth() - 5, 1)
  const fim = fimParam ? parseDataParametro(fimParam, true) : agora

  if (!inicio || !fim) {
    return NextResponse.json({ erro: 'Informe um período válido no formato AAAA-MM-DD.' }, { status: 400 })
  }

  const limite = new Date()
  limite.setFullYear(limite.getFullYear() - auth.empresa.permissoes.historicoAnos)
  if (inicio < limite || fim < inicio) {
    return NextResponse.json({ erro: 'Período fora da retenção permitida pelo plano.' }, { status: 403 })
  }

  const empresaId = auth.session.empresaId
  const [custos, veiculos, manutencoes, leiturasAnteriores, leiturasPeriodo] = await Promise.all([
    prisma.custo.findMany({
      where: { empresaId, data: { gte: inicio, lte: fim } },
      select: { data: true, valor: true, categoria: true, veiculoId: true },
      orderBy: { data: 'asc' },
    }),
    prisma.veiculo.findMany({
      where: { empresaId },
      select: { id: true, placa: true },
    }),
    prisma.historicoVeiculo.findMany({
      where: { empresaId, data_agendada: { gte: inicio, lte: fim } },
      select: { custo: true, veiculo: { select: { placa: true } } },
    }),
    prisma.leituraQuilometragem.findMany({
      where: { empresaId, registrada_em: { lt: inicio } },
      select: { veiculoId: true, quilometragem: true, registrada_em: true },
      orderBy: { registrada_em: 'desc' },
      distinct: ['veiculoId'],
    }),
    prisma.leituraQuilometragem.findMany({
      where: { empresaId, registrada_em: { gte: inicio, lte: fim } },
      select: { veiculoId: true, quilometragem: true, registrada_em: true },
      orderBy: { registrada_em: 'asc' },
    }),
  ])

  const meses = new Map<string, { mes: string; custo: number; ano: number; mesIndex: number }>()
  const custosPorVeiculo = new Map<string, { combustivel: number; manutencao: number }>()
  let totalCustos = 0

  for (const custo of custos) {
    totalCustos += custo.valor

    const chaveMes = `${custo.data.getFullYear()}-${custo.data.getMonth()}`
    const mesAtual = meses.get(chaveMes) ?? {
      mes: custo.data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      custo: 0,
      ano: custo.data.getFullYear(),
      mesIndex: custo.data.getMonth(),
    }
    mesAtual.custo += custo.valor
    meses.set(chaveMes, mesAtual)

    if (custo.categoria === 'COMBUSTIVEL' || custo.categoria === 'MANUTENCAO') {
      const totais = custosPorVeiculo.get(custo.veiculoId) ?? { combustivel: 0, manutencao: 0 }
      if (custo.categoria === 'COMBUSTIVEL') totais.combustivel += custo.valor
      if (custo.categoria === 'MANUTENCAO') totais.manutencao += custo.valor
      custosPorVeiculo.set(custo.veiculoId, totais)
    }
  }

  const leiturasPorVeiculo = new Map<string, LeituraIntervalo[]>()
  for (const leitura of leiturasAnteriores) {
    leiturasPorVeiculo.set(leitura.veiculoId, [{
      quilometragem: leitura.quilometragem,
      registradaEm: leitura.registrada_em,
    }])
  }
  for (const leitura of leiturasPeriodo) {
    const valores = leiturasPorVeiculo.get(leitura.veiculoId) ?? []
    valores.push({ quilometragem: leitura.quilometragem, registradaEm: leitura.registrada_em })
    leiturasPorVeiculo.set(leitura.veiculoId, valores)
  }
  for (const leituras of leiturasPorVeiculo.values()) {
    leituras.sort((a, b) => a.registradaEm.getTime() - b.registradaEm.getTime())
  }

  const calcularKmNoIntervalo = (inicioIntervalo: Date, fimIntervalo: Date) => {
    let total = 0

    for (const leituras of leiturasPorVeiculo.values()) {
      const indiceInicialAnterior = indiceUltimaLeituraAte(leituras, inicioIntervalo)
      const indiceInicial = indiceInicialAnterior >= 0
        ? indiceInicialAnterior
        : indicePrimeiraLeituraDesde(leituras, inicioIntervalo)
      const indiceFinal = indiceUltimaLeituraAte(leituras, fimIntervalo)

      if (indiceInicial < 0 || indiceFinal < 0 || indiceFinal <= indiceInicial) continue
      total += Math.max(0, leituras[indiceFinal].quilometragem - leituras[indiceInicial].quilometragem)
    }

    return total
  }

  const kmTotal = calcularKmNoIntervalo(inicio, fim)
  const eficiencia = Array.from(meses.values()).map(item => {
    const inicioMes = new Date(item.ano, item.mesIndex, 1)
    const fimMes = new Date(item.ano, item.mesIndex + 1, 0, 23, 59, 59, 999)
    const kmMes = calcularKmNoIntervalo(
      inicioMes < inicio ? inicio : inicioMes,
      fimMes > fim ? fim : fimMes,
    )
    return {
      mes: item.mes,
      custo: item.custo,
      kmTotal: kmMes,
      custoKm: kmMes ? item.custo / kmMes : 0,
    }
  })

  const porVeiculo = veiculos.map(veiculo => {
    const totais = custosPorVeiculo.get(veiculo.id) ?? { combustivel: 0, manutencao: 0 }
    return { veiculo: veiculo.placa, ...totais }
  })
  const custosOrdenados = porVeiculo
    .map(item => ({ placa: item.veiculo, valor: item.combustivel + item.manutencao }))
    .filter(item => item.valor > 0)
    .sort((a, b) => a.valor - b.valor)

  const manutencaoPorVeiculo = new Map<string, number>()
  for (const item of manutencoes) {
    manutencaoPorVeiculo.set(
      item.veiculo.placa,
      (manutencaoPorVeiculo.get(item.veiculo.placa) ?? 0) + item.custo,
    )
  }
  const maiorManutencao = Array.from(
    manutencaoPorVeiculo,
    ([placa, valor]) => ({ placa, valor }),
  ).sort((a, b) => b.valor - a.valor)[0] ?? null

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
