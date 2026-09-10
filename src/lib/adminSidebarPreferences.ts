import { estiloFundoEmpresaValido, type EstiloFundoEmpresa } from '@/lib/empresaPreferences'

export const ADMIN_BACKGROUND_PREFERENCES_EVENT = 'rpmtruck:admin-background-preferences'

const ADMIN_BACKGROUND_STYLE_KEY = '@rpmtruck:admin-background-style'
const ADMIN_LOG_SECTIONS_KEY = '@rpmtruck:admin-log-sections'

export type SecaoLogAdmin = 'SESSOES' | 'EVENTOS' | 'AUDITORIA' | 'EXCLUSOES'

export const SECOES_LOG_ADMIN: SecaoLogAdmin[] = ['SESSOES', 'EVENTOS', 'AUDITORIA', 'EXCLUSOES']

function obterIdentidadeAdmin() {
  try {
    const usuario = JSON.parse(localStorage.getItem('@rpmtruck:user') || '{}')
    return encodeURIComponent(String(usuario.id || usuario.email || 'local'))
  } catch {
    return 'local'
  }
}

function chavePorAdmin(base: string) {
  return `${base}:${obterIdentidadeAdmin()}`
}

export function lerEstiloFundoAdmin(): EstiloFundoEmpresa {
  if (typeof window === 'undefined') return 'DESLIGADO'
  try {
    const estilo = localStorage.getItem(chavePorAdmin(ADMIN_BACKGROUND_STYLE_KEY))
    return estiloFundoEmpresaValido(estilo) ? estilo : 'DESLIGADO'
  } catch {
    return 'DESLIGADO'
  }
}

export function salvarEstiloFundoAdmin(estilo: EstiloFundoEmpresa) {
  try {
    localStorage.setItem(chavePorAdmin(ADMIN_BACKGROUND_STYLE_KEY), estilo)
  } catch {
    // A preferência permanece apenas na sessão quando o storage está indisponível.
  }
  window.dispatchEvent(new CustomEvent<EstiloFundoEmpresa>(ADMIN_BACKGROUND_PREFERENCES_EVENT, { detail: estilo }))
}

export function lerSecoesLogsAdmin(): Record<SecaoLogAdmin, boolean> {
  const padrao = Object.fromEntries(SECOES_LOG_ADMIN.map((secao) => [secao, true])) as Record<SecaoLogAdmin, boolean>
  if (typeof window === 'undefined') return padrao
  try {
    const salvo: unknown = JSON.parse(localStorage.getItem(chavePorAdmin(ADMIN_LOG_SECTIONS_KEY)) || '{}')
    if (!salvo || typeof salvo !== 'object') return padrao
    return Object.fromEntries(SECOES_LOG_ADMIN.map((secao) => [secao, (salvo as Record<string, unknown>)[secao] !== false])) as Record<SecaoLogAdmin, boolean>
  } catch {
    return padrao
  }
}

export function salvarSecoesLogsAdmin(secoes: Record<SecaoLogAdmin, boolean>) {
  try {
    localStorage.setItem(chavePorAdmin(ADMIN_LOG_SECTIONS_KEY), JSON.stringify(secoes))
  } catch {
    // A preferência permanece apenas na sessão quando o storage está indisponível.
  }
  return secoes
}
