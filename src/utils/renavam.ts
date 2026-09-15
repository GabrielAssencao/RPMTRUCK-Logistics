export function normalizarRenavam(valor: string | null | undefined) {
  const digitos = String(valor ?? '').replace(/\D/g, '')
  if (!digitos) return null
  return digitos.padStart(11, '0')
}

export function renavamValido(valor: string | null | undefined) {
  const renavam = normalizarRenavam(valor)
  if (!renavam || !/^\d{11}$/.test(renavam) || /^(\d)\1{10}$/.test(renavam)) return false
  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const soma = pesos.reduce((total, peso, indice) => total + Number(renavam[indice]) * peso, 0)
  const resto = soma % 11
  const digito = resto === 0 || resto === 1 ? 0 : 11 - resto
  return digito === Number(renavam[10])
}
