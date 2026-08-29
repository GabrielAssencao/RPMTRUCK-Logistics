// src/lib/dataUtils.ts
// ─────────────────────────────────────────────────────────────────────────
// Utilitários de data compartilhados entre Custos e Containers.
//
// obterAnoMesSemana() deriva automaticamente Ano / Mês / Semana a partir de
// uma data real (YYYY-MM-DD). É isso que permite a comissão de um Container
// "cair" na semana certa dentro de Custos sem que ninguém precise marcar
// manualmente em qual semana ela pertence — diferente do fluxo de Custos,
// onde hoje a semana é escolhida pelo usuário no momento do lançamento.
// ─────────────────────────────────────────────────────────────────────────
 
export interface BucketData {
  ano: number
  mesIndex: number // 0 a 11
  semanaIndex: 1 | 2 | 3 | 4 // dias 29/30/31 caem na semana 4
}
 
export function obterAnoMesSemana(data: string): BucketData {
  const d = new Date(`${data}T00:00:00`)
  return {
    ano: d.getFullYear(),
    mesIndex: d.getMonth(),
    semanaIndex: Math.min(4, Math.ceil(d.getDate() / 7)) as 1 | 2 | 3 | 4
  }
}
 
export const MESES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
]
