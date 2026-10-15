export type CategoriaCustoInteligencia =
  | 'COMBUSTIVEL'
  | 'MANUTENCAO'
  | 'PEDAGIO'
  | 'ALIMENTACAO'
  | 'DIARIA_MOTORISTA'
  | 'SEGURO'
  | 'SALARIO'
  | 'COMISSAO_TRANSPORTE'
  | 'OUTROS'

export interface VeiculoInteligencia {
  id: string
  placa: string
  modelo: string
  status: string
  quilometragem: number
}

export interface CustoInteligencia {
  id: string
  data: Date
  categoria: CategoriaCustoInteligencia
  descricao: string
  valor: number
  veiculoId: string | null
  containerId: string | null
}

export interface LeituraInteligencia {
  veiculoId: string
  quilometragem: number
  registradaEm: Date
}

export interface OperacaoInteligencia {
  id: string
  codigo: string
  data: Date
  origem: string
  destino: string
  frete: number
  comissao: number
  status: string
  veiculoId: string
}

export interface ManutencaoInteligencia {
  id: string
  veiculoId: string
  dataAgendada: Date
  dataConclusao: Date | null
  tipo: string
  status: 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA' | 'NAO_REALIZADA'
}

export interface DadosInteligenciaFrota {
  veiculos: VeiculoInteligencia[]
  custos: CustoInteligencia[]
  leituras: LeituraInteligencia[]
  operacoes: OperacaoInteligencia[]
  manutencoes: ManutencaoInteligencia[]
}

const DIA_MS = 86_400_000

function arredondar(valor: number, casas = 2) {
  const fator = 10 ** casas
  return Math.round((valor + Number.EPSILON) * fator) / fator
}

function chaveMes(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

function rotuloMes(chave: string) {
  const [ano, mes] = chave.split('-').map(Number)
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
}

function diferencaDias(inicio: Date, fim: Date) {
  return Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / DIA_MS))
}

function mediana(valores: number[]) {
  if (!valores.length) return 0
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2
}

function montarMeses(inicio: Date, fim: Date) {
  const meses: string[] = []
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1)
  const limite = new Date(fim.getFullYear(), fim.getMonth(), 1)
  while (cursor <= limite) {
    meses.push(chaveMes(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return meses
}

export function montarInteligenciaFrota(dados: DadosInteligenciaFrota, inicio: Date, fim: Date) {
  const custosPorVeiculo = new Map<string, number>()
  const receitasPorVeiculo = new Map<string, number>()
  const custosPorOperacao = new Map<string, number>()

  for (const custo of dados.custos) {
    if (custo.veiculoId) custosPorVeiculo.set(custo.veiculoId, (custosPorVeiculo.get(custo.veiculoId) ?? 0) + custo.valor)
    if (custo.containerId) custosPorOperacao.set(custo.containerId, (custosPorOperacao.get(custo.containerId) ?? 0) + custo.valor)
  }
  for (const operacao of dados.operacoes) {
    if (operacao.status !== 'CANCELADO') receitasPorVeiculo.set(operacao.veiculoId, (receitasPorVeiculo.get(operacao.veiculoId) ?? 0) + operacao.frete)
  }

  const desempenhoVeiculos = dados.veiculos.map((veiculo) => {
    const leituras = dados.leituras
      .filter((leitura) => leitura.veiculoId === veiculo.id)
      .sort((a, b) => a.registradaEm.getTime() - b.registradaEm.getTime())
    const primeira = leituras.at(0)
    const ultima = leituras.at(-1)
    const kmRodados = primeira && ultima && ultima.quilometragem >= primeira.quilometragem
      ? ultima.quilometragem - primeira.quilometragem
      : null
    const quilometragemCalculavel = kmRodados !== null && kmRodados > 0
    const custo = custosPorVeiculo.get(veiculo.id) ?? 0
    const receita = receitasPorVeiculo.get(veiculo.id) ?? 0
    return {
      id: veiculo.id,
      placa: veiculo.placa,
      modelo: veiculo.modelo,
      status: veiculo.status,
      custo: arredondar(custo),
      receitaConhecida: arredondar(receita),
      saldoConhecido: arredondar(receita - custo),
      kmRodados: quilometragemCalculavel ? arredondar(kmRodados, 1) : null,
      custoPorKm: quilometragemCalculavel ? arredondar(custo / kmRodados) : null,
      coberturaKm: quilometragemCalculavel ? 'COMPLETA' as const : 'INSUFICIENTE' as const,
    }
  }).sort((a, b) => b.custo - a.custo)

  const operacoes = dados.operacoes
    .filter((operacao) => operacao.status !== 'CANCELADO')
    .map((operacao) => {
      const custoVinculado = custosPorOperacao.get(operacao.id) ?? 0
      const custoConhecido = custoVinculado > 0 ? custoVinculado : operacao.comissao
      const saldoConhecido = operacao.frete - custoConhecido
      return {
        id: operacao.id,
        codigo: operacao.codigo,
        data: operacao.data.toISOString(),
        rota: `${operacao.origem} → ${operacao.destino}`,
        status: operacao.status,
        receita: arredondar(operacao.frete),
        custoConhecido: arredondar(custoConhecido),
        saldoConhecido: arredondar(saldoConhecido),
        margemConhecidaPercentual: operacao.frete > 0 ? arredondar((saldoConhecido / operacao.frete) * 100, 1) : null,
        custosCompletos: custoVinculado > operacao.comissao,
      }
    })
    .sort((a, b) => a.saldoConhecido - b.saldoConhecido)

  const previsoesManutencao = dados.veiculos.map((veiculo) => {
    const manutencoes = dados.manutencoes.filter((item) => item.veiculoId === veiculo.id)
    const pendente = manutencoes
      .filter((item) => item.status === 'PENDENTE')
      .sort((a, b) => a.dataAgendada.getTime() - b.dataAgendada.getTime())[0]
    if (pendente) {
      const vencida = pendente.dataAgendada < fim
      return {
        veiculoId: veiculo.id,
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        tipo: pendente.tipo,
        dataPrevista: pendente.dataAgendada.toISOString(),
        origem: 'AGENDADA' as const,
        confianca: 'ALTA' as const,
        situacao: vencida ? 'ATRASADA' as const : 'PROGRAMADA' as const,
      }
    }
    const concluidas = manutencoes
      .filter((item) => item.status === 'CONCLUIDA')
      .sort((a, b) => (a.dataConclusao ?? a.dataAgendada).getTime() - (b.dataConclusao ?? b.dataAgendada).getTime())
    if (concluidas.length < 2) return null
    const intervalos = concluidas.slice(-6).slice(1).map((item, indice) => {
      const anterior = concluidas.slice(-6)[indice]
      return diferencaDias(anterior.dataConclusao ?? anterior.dataAgendada, item.dataConclusao ?? item.dataAgendada)
    })
    const intervaloMedio = Math.round(intervalos.reduce((total, dias) => total + dias, 0) / intervalos.length)
    const ultima = concluidas.at(-1)!
    const dataPrevista = new Date((ultima.dataConclusao ?? ultima.dataAgendada).getTime() + intervaloMedio * DIA_MS)
    return {
      veiculoId: veiculo.id,
      placa: veiculo.placa,
      modelo: veiculo.modelo,
      tipo: ultima.tipo,
      dataPrevista: dataPrevista.toISOString(),
      origem: 'ESTIMADA' as const,
      confianca: concluidas.length >= 3 ? 'MEDIA' as const : 'BAIXA' as const,
      situacao: dataPrevista < fim ? 'ATENCAO' as const : 'PREVISTA' as const,
    }
  }).filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => new Date(a.dataPrevista).getTime() - new Date(b.dataPrevista).getTime())

  const meses = montarMeses(inicio, fim)
  const combustivelMensal = meses.map((mes) => ({
    mes,
    rotulo: rotuloMes(mes),
    valor: arredondar(dados.custos
      .filter((custo) => custo.categoria === 'COMBUSTIVEL' && chaveMes(custo.data) === mes)
      .reduce((total, custo) => total + custo.valor, 0)),
  })).map((item, indice, serie) => ({
    ...item,
    variacaoPercentual: indice > 0 && serie[indice - 1].valor > 0
      ? arredondar(((item.valor - serie[indice - 1].valor) / serie[indice - 1].valor) * 100, 1)
      : null,
  }))

  const despesasForaPadrao = Object.values(dados.custos.reduce<Record<string, CustoInteligencia[]>>((grupos, custo) => {
    ;(grupos[custo.categoria] ??= []).push(custo)
    return grupos
  }, {})).flatMap((custosCategoria) => {
    if (custosCategoria.length < 4) return []
    const valores = custosCategoria.map((custo) => custo.valor)
    const centro = mediana(valores)
    const desvios = valores.map((valor) => Math.abs(valor - centro))
    const desvioMediano = mediana(desvios)
    const limite = Math.max(centro * 1.75, centro + desvioMediano * 3)
    return custosCategoria.filter((custo) => custo.valor > limite).map((custo) => ({
      id: custo.id,
      data: custo.data.toISOString(),
      categoria: custo.categoria,
      descricao: custo.descricao,
      valor: arredondar(custo.valor),
      referencia: arredondar(centro),
      percentualAcima: centro > 0 ? arredondar(((custo.valor - centro) / centro) * 100, 1) : null,
    }))
  }).sort((a, b) => (b.percentualAcima ?? 0) - (a.percentualAcima ?? 0)).slice(0, 10)

  const custosComKm = desempenhoVeiculos.filter((item) => item.custoPorKm !== null)
  const custoMedioKm = custosComKm.length
    ? arredondar(custosComKm.reduce((total, item) => total + (item.custoPorKm ?? 0), 0) / custosComKm.length)
    : null
  const ultimoCombustivel = combustivelMensal.at(-1)
  const manutencoesAtrasadas = previsoesManutencao.filter((item) => item.situacao === 'ATRASADA').length
  const saldoOperacoes = operacoes.reduce((total, operacao) => total + operacao.saldoConhecido, 0)
  const custoTotal = dados.custos.reduce((total, custo) => total + custo.valor, 0)

  const recomendacoes: Array<{ id: string; prioridade: 'ALTA' | 'MEDIA' | 'BAIXA'; titulo: string; descricao: string; destino: string }> = []
  if (manutencoesAtrasadas > 0) recomendacoes.push({ id: 'manutencoes-atrasadas', prioridade: 'ALTA', titulo: 'Regularize manutenções atrasadas', descricao: `${manutencoesAtrasadas} manutenção(ões) programada(s) já ultrapassaram a data registrada.`, destino: '/dashboard/empresa/frota/manutencao' })
  const veiculoSaldoNegativo = [...desempenhoVeiculos].filter((item) => item.saldoConhecido < 0).sort((a, b) => a.saldoConhecido - b.saldoConhecido)[0]
  if (veiculoSaldoNegativo) recomendacoes.push({ id: `saldo-${veiculoSaldoNegativo.id}`, prioridade: 'ALTA', titulo: `Revise os custos do veículo ${veiculoSaldoNegativo.placa}`, descricao: `O saldo conhecido do período é ${arredondar(veiculoSaldoNegativo.saldoConhecido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Confirme se todas as receitas foram vinculadas.`, destino: '/dashboard/empresa/custos' })
  const custoKmElevado = custoMedioKm === null ? null : custosComKm.sort((a, b) => (b.custoPorKm ?? 0) - (a.custoPorKm ?? 0)).find((item) => (item.custoPorKm ?? 0) > custoMedioKm * 1.25)
  if (custoKmElevado) recomendacoes.push({ id: `km-${custoKmElevado.id}`, prioridade: 'MEDIA', titulo: `Investigue o custo/km de ${custoKmElevado.placa}`, descricao: `O valor está pelo menos 25% acima da média calculável da frota no período.`, destino: '/dashboard/empresa/custos' })
  if ((ultimoCombustivel?.variacaoPercentual ?? 0) > 15) recomendacoes.push({ id: 'combustivel-alta', prioridade: 'MEDIA', titulo: 'Gasto com combustível aumentou', descricao: `O último mês está ${ultimoCombustivel!.variacaoPercentual}% acima do mês anterior. Compare rotas, quilometragem e lançamentos.`, destino: '/dashboard/empresa/custos' })
  if (despesasForaPadrao.length > 0) recomendacoes.push({ id: 'despesas-fora-padrao', prioridade: 'MEDIA', titulo: 'Confira despesas fora do padrão', descricao: `${despesasForaPadrao.length} lançamento(s) ficaram muito acima da mediana da própria categoria.`, destino: '/dashboard/empresa/custos' })
  if (dados.veiculos.length > 0 && custosComKm.length < dados.veiculos.length) recomendacoes.push({ id: 'leituras-km', prioridade: 'BAIXA', titulo: 'Melhore a cobertura de quilometragem', descricao: `${dados.veiculos.length - custosComKm.length} veículo(s) não possuem duas leituras no período; o custo/km não pode ser calculado com segurança.`, destino: '/dashboard/empresa/frota' })
  if (!recomendacoes.length) recomendacoes.push({ id: 'sem-alertas', prioridade: 'BAIXA', titulo: 'Nenhum desvio relevante identificado', descricao: 'Continue registrando custos, operações, quilometragem e manutenções para aumentar a precisão das análises.', destino: '/dashboard/empresa/custos' })

  return {
    resumo: {
      custoTotal: arredondar(custoTotal),
      custoMedioKm,
      saldoOperacoesConhecido: arredondar(saldoOperacoes),
      veiculosAnalisados: dados.veiculos.length,
      veiculosComCustoKm: custosComKm.length,
      despesasForaPadrao: despesasForaPadrao.length,
      manutencoesAtrasadas,
    },
    desempenhoVeiculos,
    previsoesManutencao,
    combustivelMensal,
    despesasForaPadrao,
    rentabilidadeOperacoes: operacoes,
    recomendacoes: recomendacoes.slice(0, 6),
    metodologia: {
      custoPorKm: 'Custos vinculados ao veículo divididos pela diferença entre a primeira e a última leitura do período.',
      saldoConhecido: 'Fretes registrados menos custos diretamente vinculados. Não representa lucro contábil quando houver custos sem vínculo.',
      manutencao: 'Prioriza agenda cadastrada; sem agenda, estima a próxima data pela média dos últimos intervalos concluídos.',
      anomalias: 'Compara cada lançamento com a mediana e a dispersão dos valores da própria categoria.',
    },
  }
}
