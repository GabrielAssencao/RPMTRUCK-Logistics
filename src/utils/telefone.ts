export const TELEFONE_BR_MAX_DIGITOS = 11

export function somenteDigitosTelefoneBR(valor: string | null | undefined) {
  let digitos = (valor ?? '').replace(/\D/g, '')
  if (digitos.length > TELEFONE_BR_MAX_DIGITOS && digitos.startsWith('55')) digitos = digitos.slice(2)
  return digitos.slice(0, TELEFONE_BR_MAX_DIGITOS)
}

export function telefoneBRValido(valor: string | null | undefined) {
  const digitos = somenteDigitosTelefoneBR(valor)
  return /^[1-9]{2}(?:[2-8]\d{7}|9\d{8})$/.test(digitos)
}

export function formatarTelefoneBR(valor: string | null | undefined) {
  const digitos = somenteDigitosTelefoneBR(valor)
  if (!digitos) return ''
  if (digitos.length <= 2) return `(${digitos}`

  const ddd = digitos.slice(0, 2)
  const numero = digitos.slice(2)
  if (numero.length <= 4) return `(${ddd}) ${numero}`

  const separador = numero.length > 8 ? 5 : 4
  return `(${ddd}) ${numero.slice(0, separador)}-${numero.slice(separador)}`
}
