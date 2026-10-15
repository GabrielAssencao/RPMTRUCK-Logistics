const BRASILIA_TIME_ZONE = 'America/Sao_Paulo'

function partesBrasilia(data: Date) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRASILIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(data)
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => Number(partes.find(parte => parte.type === tipo)?.value)
  return { ano: valor('year'), mes: valor('month'), dia: valor('day'), hora: valor('hour'), minuto: valor('minute'), segundo: valor('second') }
}

/** Converte uma data civil de Brasília em instante UTC sem depender do fuso do servidor. */
export function dataBrasilia(ano: number, mes: number, dia: number, hora = 0, minuto = 0, segundo = 0) {
  const desejado = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo)
  let instante = desejado
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    const atual = partesBrasilia(new Date(instante))
    const civilAtual = Date.UTC(atual.ano, atual.mes - 1, atual.dia, atual.hora, atual.minuto, atual.segundo)
    instante += desejado - civilAtual
  }
  return new Date(instante)
}

export function adicionarDiasBrasilia(data: Date, dias: number) {
  const partes = partesBrasilia(data)
  const proximaData = new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia + dias))
  return dataBrasilia(proximaData.getUTCFullYear(), proximaData.getUTCMonth() + 1, proximaData.getUTCDate())
}

export function proximaMeiaNoiteBrasilia(agora = new Date()) {
  const partes = partesBrasilia(agora)
  const amanha = new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia + 1))
  return dataBrasilia(amanha.getUTCFullYear(), amanha.getUTCMonth() + 1, amanha.getUTCDate())
}

export function inicioDiaBrasilia(agora = new Date()) {
  const partes = partesBrasilia(agora)
  return dataBrasilia(partes.ano, partes.mes, partes.dia)
}
