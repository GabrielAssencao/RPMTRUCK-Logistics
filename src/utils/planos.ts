export const PLANOS = ['PREVIEW', 'ESSENCIAL', 'AVANCADO', 'ENTERPRISE'] as const

export type PlanoTipo = (typeof PLANOS)[number]

export const MODULOS = ['FROTA', 'GESTAO', 'CONTAS_PAGAR', 'NOTIFICACOES', 'TAREFAS', 'RELATORIOS'] as const

export type ModuloCodigo = (typeof MODULOS)[number]

export const STATUS_EMPRESA = ['ATIVO', 'INADIMPLENTE', 'INATIVO'] as const

export type StatusEmpresa = (typeof STATUS_EMPRESA)[number]

export type ModoNotificacoes = 'RESUMIDA_SIDEBAR' | 'SIDEBAR' | 'CENTRAL_HEADER'

export interface PlanoConfig {
  nome: string
  descricao: string
  beneficios: readonly string[]
  usuariosBase: number
  veiculosBase: number
  historicoAnos: number
  notificacoes: ModoNotificacoes
  delegacaoTarefas: boolean
  telaTarefas: boolean
  relatoriosPersonalizados: boolean
  modulosPadrao: readonly ModuloCodigo[]
}

export const MODULOS_CONFIG: Record<ModuloCodigo, { nome: string; descricao: string }> = {
  FROTA: {
    nome: 'Frota',
    descricao: 'Veículos, motoristas, manutenção, localizações e containers.',
  },
  GESTAO: {
    nome: 'Controle e gestão',
    descricao: 'Custos, despesas e indicadores operacionais.',
  },
  CONTAS_PAGAR: {
    nome: 'Contas a pagar / boletos',
    descricao: 'Vencimentos, boletos, comprovantes e integração opcional com a frota.',
  },
  NOTIFICACOES: {
    nome: 'Notificações',
    descricao: 'Alertas direcionados aos usuários da empresa.',
  },
  TAREFAS: {
    nome: 'Tarefas',
    descricao: 'Delegação, responsáveis, prazos, prioridades e status.',
  },
  RELATORIOS: {
    nome: 'Relatórios',
    descricao: 'Relatórios personalizados e arquivos privados.',
  },
}

const MODULOS_OPERACIONAIS: readonly ModuloCodigo[] = ['FROTA', 'GESTAO', 'CONTAS_PAGAR', 'NOTIFICACOES']
const MODULOS_COM_TAREFAS: readonly ModuloCodigo[] = [...MODULOS_OPERACIONAIS, 'TAREFAS']
const TODOS_OS_MODULOS: readonly ModuloCodigo[] = [...MODULOS_COM_TAREFAS, 'RELATORIOS']

/**
 * Fonte única das permissões e capacidades técnicas de cada plano.
 * Os valores comerciais são persistidos em `PlanoComercial`.
 * `Empresa.modulos` guarda a seleção efetiva e pode ser personalizada pelo SuperAdmin.
 */
export const PLANOS_CONFIG: Record<PlanoTipo, PlanoConfig> = {
  ESSENCIAL: {
    nome: 'Essencial',
    descricao: 'Gestão completa e controle operacional para frotas em crescimento.',
    beneficios: [
      'Gestão do catálogo de veículos e motoristas',
      '1 ano de histórico e auditoria operacional',
      'Dashboard de custos, combustível e manutenção',
      'Até 4 usuários e 10 veículos na franquia base',
    ],
    usuariosBase: 4,
    veiculosBase: 10,
    historicoAnos: 1,
    notificacoes: 'CENTRAL_HEADER',
    delegacaoTarefas: false,
    telaTarefas: false,
    relatoriosPersonalizados: false,
    modulosPadrao: MODULOS_OPERACIONAIS,
  },
  AVANCADO: {
    nome: 'Avançado',
    descricao: 'Precisão operacional, delegação de tarefas e gestão multi-bases.',
    beneficios: [
      'Tudo do plano Essencial',
      '2 anos de histórico analítico',
      'Delegação direta de tarefas e alertas',
      'Até 10 usuários e 25 veículos na franquia base',
    ],
    usuariosBase: 10,
    veiculosBase: 25,
    historicoAnos: 2,
    notificacoes: 'CENTRAL_HEADER',
    delegacaoTarefas: true,
    telaTarefas: true,
    relatoriosPersonalizados: false,
    modulosPadrao: MODULOS_COM_TAREFAS,
  },
  ENTERPRISE: {
    nome: 'Enterprise',
    descricao: 'Inteligência de frota em escala, relatórios personalizados e prioridade.',
    beneficios: [
      'Tudo do plano Avançado',
      '3 anos de histórico operacional',
      'Relatórios e filtros personalizados',
      'Até 25 usuários e 80 veículos na franquia base',
    ],
    usuariosBase: 25,
    veiculosBase: 80,
    historicoAnos: 3,
    notificacoes: 'CENTRAL_HEADER',
    delegacaoTarefas: true,
    telaTarefas: true,
    relatoriosPersonalizados: true,
    modulosPadrao: TODOS_OS_MODULOS,
  },
  PREVIEW: {
    nome: 'Preview',
    descricao: 'Ambiente sandbox completo, liberado exclusivamente pelo SuperAdmin.',
    beneficios: [
      'Todos os módulos disponíveis para homologação',
      'Acesso antecipado a recursos beta',
      'Liberação e remoção de módulos pelo SuperAdmin',
    ],
    usuariosBase: 999,
    veiculosBase: 999,
    historicoAnos: 3,
    notificacoes: 'CENTRAL_HEADER',
    delegacaoTarefas: true,
    telaTarefas: true,
    relatoriosPersonalizados: true,
    modulosPadrao: TODOS_OS_MODULOS,
  },
}

const MODULOS_LEGADOS: Record<string, ModuloCodigo> = {
  frota: 'FROTA',
  'módulo frota': 'FROTA',
  'modulo frota': 'FROTA',
  gestao: 'GESTAO',
  'controle & gestão': 'GESTAO',
  'controle & gestao': 'GESTAO',
  controle_gestao: 'GESTAO',
  contas_pagar: 'CONTAS_PAGAR',
  boletos: 'CONTAS_PAGAR',
  'contas a pagar': 'CONTAS_PAGAR',
  notificacoes: 'NOTIFICACOES',
  notificações: 'NOTIFICACOES',
  tarefas: 'TAREFAS',
  relatorios: 'RELATORIOS',
  relatórios: 'RELATORIOS',
  'relatórios & dashboards': 'RELATORIOS',
  'relatorios & dashboards': 'RELATORIOS',
}

export function isPlanoTipo(value: unknown): value is PlanoTipo {
  return typeof value === 'string' && (PLANOS as readonly string[]).includes(value)
}

export function isStatusEmpresa(value: unknown): value is StatusEmpresa {
  return typeof value === 'string' && (STATUS_EMPRESA as readonly string[]).includes(value)
}

export function isModuloCodigo(value: unknown): value is ModuloCodigo {
  return typeof value === 'string' && (MODULOS as readonly string[]).includes(value)
}

export function normalizarModulos(values: readonly string[] | null | undefined): ModuloCodigo[] {
  const normalizados = (values ?? [])
    .map((value) => {
      const codigo = value.trim().toUpperCase()
      if (isModuloCodigo(codigo)) return codigo
      return MODULOS_LEGADOS[value.trim().toLowerCase()]
    })
    .filter((value): value is ModuloCodigo => Boolean(value))

  return Array.from(new Set(normalizados))
}

export function obterModulosPadrao(plano: PlanoTipo): ModuloCodigo[] {
  return [...PLANOS_CONFIG[plano].modulosPadrao]
}

export function possuiModulo(modulos: readonly string[], modulo: ModuloCodigo): boolean {
  return normalizarModulos(modulos).includes(modulo)
}
