export function somenteNumeros(valor: string, limite?: number) {
  const numeros = valor.replace(/\D/g, '')
  return typeof limite === 'number' ? numeros.slice(0, limite) : numeros
}

export function formatarCPF(valor: string) {
  return somenteNumeros(valor, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

export function formatarRG(valor: string) {
  return normalizarDocumentoIdentidade(valor)
}

/** RG antigo varia por órgão emissor; CIN usa o CPF. Persistimos só letras e números. */
export function normalizarDocumentoIdentidade(valor: string) {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14)
}

export function normalizarRegistroCNH(valor: string) {
  return somenteNumeros(valor, 11)
}

export function cpfValido(valor: string) {
  const cpf = somenteNumeros(valor)
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false

  const calcularDigito = (base: string, pesoInicial: number) => {
    const soma = [...base].reduce((total, digito, indice) => total + Number(digito) * (pesoInicial - indice), 0)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  const primeiro = calcularDigito(cpf.slice(0, 9), 10)
  const segundo = calcularDigito(`${cpf.slice(0, 9)}${primeiro}`, 11)
  return cpf.endsWith(`${primeiro}${segundo}`)
}

export function erroCPF(valor: string) {
  const cpf = somenteNumeros(valor)
  if (!cpf) return 'Informe o CPF do motorista.'
  if (cpf.length < 11) return `CPF incompleto: faltam ${11 - cpf.length} dígito${cpf.length === 10 ? '' : 's'}.`
  if (cpf.length > 11) return 'O CPF deve ter exatamente 11 dígitos.'
  if (!cpfValido(cpf)) return 'Os dígitos verificadores do CPF não conferem.'
  return null
}
