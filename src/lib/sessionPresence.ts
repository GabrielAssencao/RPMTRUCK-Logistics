export const SESSION_HEARTBEAT_INTERVAL_MS = 60 * 1000
export const SESSION_ONLINE_WINDOW_MS = 2.5 * 60 * 1000

export function sessaoEstaOnline(ultimaAtividade: Date | string | number, agora = Date.now()) {
  const ultimaAtividadeMs = new Date(ultimaAtividade).getTime()
  return Number.isFinite(ultimaAtividadeMs)
    && agora - ultimaAtividadeMs <= SESSION_ONLINE_WINDOW_MS
}

export function formatarDuracaoSessao(duracaoMs: number) {
  const segundosTotais = Math.max(0, Math.floor(duracaoMs / 1000))
  const horas = Math.floor(segundosTotais / 3600)
  const minutos = Math.floor((segundosTotais % 3600) / 60)
  const segundos = segundosTotais % 60
  if (horas > 0) return `${horas}h ${String(minutos).padStart(2, '0')}min ${String(segundos).padStart(2, '0')}s`
  if (minutos > 0) return `${minutos}min ${String(segundos).padStart(2, '0')}s`
  return `${segundos}s`
}
