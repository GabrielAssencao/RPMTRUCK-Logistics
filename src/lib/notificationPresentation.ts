export interface NotificationPresentationInput {
  modulo: string
  titulo: string
  mensagem: string
}

const MODULOS: Record<string, string> = {
  ACESSO: 'Acessos',
  CHAT: 'Suporte',
  CONTAINERS: 'Containers',
  CUSTOS: 'Financeiro',
  EMPRESAS: 'Empresas',
  FROTA: 'Frota',
  GERAL: 'Sistema',
  MOTORISTAS: 'Motoristas',
  RELATORIOS: 'Relatórios',
  SEGURANÇA: 'Segurança',
  TAREFAS: 'Planejamento',
  USUARIOS: 'Equipe e acessos',
}

const URGENCIAS: Record<string, string> = {
  alta: 'Urgência alta',
  media: 'Urgência média',
  média: 'Urgência média',
  baixa: 'Urgência baixa',
  leve: 'Urgência leve',
}

function ajustarDataLegada(texto: string) {
  return texto.replace(/(\d{2}\/\d{2}\/\d{4}),?\s+(\d{2}:\d{2})(?::\d{2})?/, '$1 às $2')
}

export function apresentarNotificacao(notificacao: NotificationPresentationInput) {
  const tituloLegado = /^lembrete\s+(alta|m[eé]dia|baixa|leve)$/i.exec(notificacao.titulo.trim())
  if (tituloLegado) {
    const [assuntoBruto, dataBruta] = notificacao.mensagem.split(/\s+[—–-]\s+/, 2)
    const urgencia = URGENCIAS[tituloLegado[1].toLocaleLowerCase('pt-BR')] ?? 'Lembrete pessoal'
    return {
      modulo: MODULOS[notificacao.modulo] ?? notificacao.modulo.replaceAll('_', ' '),
      titulo: `Lembrete: ${assuntoBruto?.trim() || 'Compromisso pessoal'}`,
      mensagem: dataBruta ? `${urgencia} · Agendado para ${ajustarDataLegada(dataBruta.trim())}` : urgencia,
    }
  }

  return {
    modulo: MODULOS[notificacao.modulo] ?? notificacao.modulo.replaceAll('_', ' '),
    titulo: notificacao.titulo,
    mensagem: notificacao.mensagem,
  }
}
