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
  return somenteNumeros(valor, 9)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}
