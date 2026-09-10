import type { ModuloCodigo } from '@/utils/planos'

export interface EmpresaNavigationPreferenceItem {
  path: string
  label: string
  modulo: ModuloCodigo | null
  somenteGestor?: boolean
  visaoGeral?: boolean
}

export const EMPRESA_NAVIGATION_ITEMS: EmpresaNavigationPreferenceItem[] = [
  { path: '/dashboard/empresa', label: 'Painel operacional', modulo: null, visaoGeral: true },
  { path: '/dashboard/empresa/frota', label: 'Frota / veículos', modulo: 'FROTA' },
  { path: '/dashboard/empresa/motoristas', label: 'Motoristas', modulo: 'FROTA', somenteGestor: true },
  { path: '/dashboard/empresa/containers', label: 'Containers', modulo: 'FROTA' },
  { path: '/dashboard/empresa/custos', label: 'Custos / despesas', modulo: 'GESTAO' },
  { path: '/dashboard/empresa/contas-pagar', label: 'Contas a pagar', modulo: 'CONTAS_PAGAR', somenteGestor: true },
  { path: '/dashboard/empresa/tarefas', label: 'Tarefas', modulo: 'TAREFAS' },
  { path: '/dashboard/empresa/arquivos', label: 'Arquivo operacional', modulo: null, somenteGestor: true },
  { path: '/dashboard/empresa/relatorios', label: 'Relatórios', modulo: 'RELATORIOS', somenteGestor: true },
  { path: '/dashboard/empresa/usuarios', label: 'Operadores', modulo: null, somenteGestor: true },
]

export const EMPRESA_SIDEBAR_PREFERENCES_EVENT = 'rpmtruck:empresa-sidebar-preferences'
export const EMPRESA_BACKGROUND_PREFERENCES_EVENT = 'rpmtruck:empresa-background-preferences'

const SIDEBAR_HIDDEN_MODULES_KEY = '@rpmtruck:sidebar-hidden-modules'
const ANIMATED_BACKGROUND_KEY = '@rpmtruck:dashboard-animated-background'
const BACKGROUND_STYLE_KEY = '@rpmtruck:dashboard-background-style'

export const ESTILOS_FUNDO_EMPRESA = [
  'DESLIGADO',
  'DIGITAL',
  'TOPOGRAFICO',
  'VIDRO_FLUIDO',
  'VIDRO_CAMADAS',
  'ORGANICO',
] as const

export type EstiloFundoEmpresa = (typeof ESTILOS_FUNDO_EMPRESA)[number]

export function estiloFundoEmpresaValido(valor: unknown): valor is EstiloFundoEmpresa {
  return typeof valor === 'string' && (ESTILOS_FUNDO_EMPRESA as readonly string[]).includes(valor)
}

function obterIdentidadeLocal() {
  try {
    const usuario = JSON.parse(localStorage.getItem('@rpmtruck:user') || '{}')
    return encodeURIComponent(String(usuario.id || usuario.email || 'local'))
  } catch {
    return 'local'
  }
}

function chavePorUsuario(base: string) {
  return `${base}:${obterIdentidadeLocal()}`
}

export function lerModulosOcultosEmpresa() {
  if (typeof window === 'undefined') return []
  try {
    const salvos: unknown = JSON.parse(localStorage.getItem(chavePorUsuario(SIDEBAR_HIDDEN_MODULES_KEY)) || '[]')
    if (!Array.isArray(salvos)) return []
    const rotasValidas = new Set(EMPRESA_NAVIGATION_ITEMS.map((item) => item.path))
    return salvos.filter((path): path is string => typeof path === 'string' && rotasValidas.has(path))
  } catch {
    localStorage.removeItem(chavePorUsuario(SIDEBAR_HIDDEN_MODULES_KEY))
    return []
  }
}

export function salvarModulosOcultosEmpresa(paths: string[]) {
  const rotasValidas = new Set(EMPRESA_NAVIGATION_ITEMS.map((item) => item.path))
  const pathsValidos = Array.from(new Set(paths.filter((path) => rotasValidas.has(path))))
  try {
    localStorage.setItem(chavePorUsuario(SIDEBAR_HIDDEN_MODULES_KEY), JSON.stringify(pathsValidos))
  } catch {
    // A preferência continua na sessão atual quando o storage está indisponível.
  }
  window.dispatchEvent(new CustomEvent<string[]>(EMPRESA_SIDEBAR_PREFERENCES_EVENT, { detail: pathsValidos }))
  return pathsValidos
}

export function lerEstiloFundoEmpresa(): EstiloFundoEmpresa {
  if (typeof window === 'undefined') return 'DESLIGADO'
  try {
    const estilo = localStorage.getItem(chavePorUsuario(BACKGROUND_STYLE_KEY))
    if (estiloFundoEmpresaValido(estilo)) return estilo
    return localStorage.getItem(chavePorUsuario(ANIMATED_BACKGROUND_KEY)) === 'true' ? 'DIGITAL' : 'DESLIGADO'
  } catch {
    return 'DESLIGADO'
  }
}

export function salvarEstiloFundoEmpresa(estilo: EstiloFundoEmpresa) {
  try {
    localStorage.setItem(chavePorUsuario(BACKGROUND_STYLE_KEY), estilo)
    localStorage.setItem(chavePorUsuario(ANIMATED_BACKGROUND_KEY), String(estilo !== 'DESLIGADO'))
  } catch {
    // A preferência continua na sessão atual quando o storage está indisponível.
  }
  window.dispatchEvent(new CustomEvent<EstiloFundoEmpresa>(EMPRESA_BACKGROUND_PREFERENCES_EVENT, { detail: estilo }))
}
