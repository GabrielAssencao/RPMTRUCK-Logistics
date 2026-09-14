export type UrgenciaLembrete = 'LEVE' | 'MEDIA' | 'ALTA'
export type ModoNotificacaoLembrete = 'AUTOMATICA' | 'PERSONALIZADA'

export const DIAS_ANTECEDENCIA_LEMBRETE: Record<UrgenciaLembrete, number> = {
  LEVE: 3,
  MEDIA: 3,
  ALTA: 5,
}

export function calcularNotificacaoLembrete(
  dataHora: Date,
  urgencia: UrgenciaLembrete,
  modo: ModoNotificacaoLembrete,
  personalizada?: Date | null,
) {
  if (modo === 'PERSONALIZADA') {
    if (!personalizada) throw new Error('Informe quando deseja receber a notificação.')
    if (personalizada > dataHora) throw new Error('A notificação deve acontecer antes do lembrete.')
    return personalizada
  }

  const automatica = new Date(dataHora)
  automatica.setDate(automatica.getDate() - DIAS_ANTECEDENCIA_LEMBRETE[urgencia])
  const agora = new Date()
  return automatica < agora ? agora : automatica
}

export function perfilPodeUsarLembretes(role: string) {
  return ['ADMIN_RPM', 'ADMIN', 'GESTOR_EMPRESA', 'GESTOR', 'OPERADOR'].includes(role)
}
