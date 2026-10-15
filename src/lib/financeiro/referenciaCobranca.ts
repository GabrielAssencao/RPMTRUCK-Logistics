const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

export function montarReferenciaCobranca(ids: string[]) {
  if (ids.length === 1) return ids[0]
  if (ids.length !== 2 || ids[0] === ids[1] || !ids.every(id => uuid.test(id))) throw new Error('FATURAS_INVALIDAS')
  return `bundle:${[...ids].sort().join(':')}`
}

export function extrairIdsCobrancaConjunta(referencia: string | null | undefined) {
  if (!referencia?.startsWith('bundle:')) return null
  const partes = referencia.split(':')
  if (partes.length !== 3 || partes[1] === partes[2] || !partes.slice(1).every(id => uuid.test(id))) return null
  return partes.slice(1)
}

export function somarCentavos(valores: number[]) {
  return valores.reduce((total, valor) => total + Math.round(valor * 100), 0)
}

export function distribuirLiquidoCentavos(liquido: number | null, valores: number[]) {
  if (liquido == null) return valores.map(() => null)
  const total = somarCentavos(valores)
  if (total <= 0) throw new Error('VALOR_INVALIDO')
  let distribuido = 0
  return valores.map((valor, index) => {
    const parcela = index === valores.length - 1 ? liquido - distribuido : Math.round(liquido * Math.round(valor * 100) / total)
    distribuido += parcela
    return parcela
  })
}
