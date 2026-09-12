export function inicioDoMinuto(data = new Date()) {
  const resultado = new Date(data)
  resultado.setSeconds(0, 0)
  return resultado
}

export function formatarDataHoraBrasil(data = new Date()) {
  const valor = inicioDoMinuto(data)
  const dia = String(valor.getDate()).padStart(2, '0')
  const mes = String(valor.getMonth() + 1).padStart(2, '0')
  const ano = valor.getFullYear()
  const hora = String(valor.getHours()).padStart(2, '0')
  const minuto = String(valor.getMinutes()).padStart(2, '0')
  return `${dia}/${mes}/${ano} ${hora}:${minuto}`
}

export function anteriorAoMinutoDaReferencia(data: Date, referencia = new Date()) {
  return data < inicioDoMinuto(referencia)
}
