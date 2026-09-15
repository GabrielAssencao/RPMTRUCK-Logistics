export type PrioridadeNotificacaoTarefa = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'
export type ModoNotificacaoTarefa = 'AUTOMATICA' | 'PERSONALIZADA'

export const DIAS_ANTECEDENCIA_TAREFA: Record<PrioridadeNotificacaoTarefa, number> = {
  BAIXA: 3,
  MEDIA: 4,
  ALTA: 5,
  // Mantém tarefas antigas compatíveis; novas tarefas não oferecem esta opção.
  URGENTE: 5,
}

export function calcularNotificacaoTarefa({
  inicio,
  prazo,
  prioridade,
  modo,
  personalizada,
  agora = new Date(),
}: {
  inicio?: Date | null
  prazo?: Date | null
  prioridade: PrioridadeNotificacaoTarefa
  modo: ModoNotificacaoTarefa
  personalizada?: Date | null
  agora?: Date
}) {
  const referencia = prazo ?? inicio ?? null

  if (modo === 'PERSONALIZADA') {
    if (!personalizada) throw new Error('Informe quando deseja receber a notificação.')
    if (!referencia) throw new Error('Informe o início ou o prazo da tarefa antes de configurar a notificação.')
    if (personalizada > referencia) throw new Error('A notificação deve acontecer antes do prazo ou início da tarefa.')
    if (personalizada < agora) throw new Error('A notificação não pode ser configurada para uma data passada.')
    return personalizada
  }

  if (!referencia) return null
  const automatica = new Date(referencia)
  automatica.setDate(automatica.getDate() - DIAS_ANTECEDENCIA_TAREFA[prioridade])
  return automatica < agora ? agora : automatica
}
