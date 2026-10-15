type Entrada = { mes: string; recebido: number; taxasAsaas: number; taxasPendentes: number }
type Despesa = { mes: string; despesas: number }

export function montarResumoOperacional(ano: number, entradas: Entrada[], despesasPagas: Despesa[]) {
  const centavos = (valor: number) => Math.round(valor * 100)
  const reais = (valor: number) => valor / 100
  const entradasPorMes = new Map(entradas.map(item => [item.mes, item]))
  const despesasPorMes = new Map(despesasPagas.map(item => [item.mes, item]))
  const meses = Array.from({ length: 12 }, (_, index) => {
    const mes = `${ano}-${String(index + 1).padStart(2, '0')}`
    const recebido = entradasPorMes.get(mes)?.recebido ?? 0
    const taxasAsaas = entradasPorMes.get(mes)?.taxasAsaas ?? 0
    const despesas = despesasPorMes.get(mes)?.despesas ?? 0
    return {
      mes, recebido, taxasAsaas, despesas,
      saldo: reais(centavos(recebido) - centavos(taxasAsaas) - centavos(despesas)),
      taxasPendentes: entradasPorMes.get(mes)?.taxasPendentes ?? 0,
    }
  })
  return {
    ano, meses,
    recebido: reais(meses.reduce((total, item) => total + centavos(item.recebido), 0)),
    taxasAsaas: reais(meses.reduce((total, item) => total + centavos(item.taxasAsaas), 0)),
    despesas: reais(meses.reduce((total, item) => total + centavos(item.despesas), 0)),
    saldo: reais(meses.reduce((total, item) => total + centavos(item.saldo), 0)),
    taxasPendentes: meses.reduce((total, item) => total + item.taxasPendentes, 0),
  }
}
