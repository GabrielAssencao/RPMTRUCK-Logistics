// src/data/temasELogos.ts
// ─────────────────────────────────────────────────────────────────────────
// Se você adicionar uma nova cor de tema em Configurações que ainda não
// tenha uma logo correspondente aqui, ela cai no fallback (verde) — é só
// adicionar a entrada correspondente nesta lista.
// ─────────────────────────────────────────────────────────────────────────

export interface TemaCor {
  value: string
  label: string
  logoName: string
}

export const CORES_E_LOGOS: TemaCor[] = [
  { value: '#22c55e', label: 'Verde',    logoName: 'logoRPMTRUCK_verde.png'    },
  { value: '#ef4444', label: 'Vermelho', logoName: 'logoRPMTRUCK_vermelho.png' },
  { value: '#3b82f6', label: 'Azul',     logoName: 'logoRPMTRUCK_azul.png'     },
  { value: '#f59e0b', label: 'Âmbar',    logoName: 'logoRPMTRUCK_amarelo.png'  },
  { value: '#5e17eb', label: 'Roxo',     logoName: 'logoRPMTRUCK_roxo.png'     },
]

export const COR_TEMA_PADRAO = CORES_E_LOGOS[0].value
export const LOGO_PADRAO = CORES_E_LOGOS[0].logoName

const CORES_LEGADAS: Record<string, string> = {
  '#10b981': '#22c55e',
  '#8b5cf6': '#5e17eb',
  '#7c3aed': '#5e17eb',
  '#eab308': '#f59e0b',
  '#ff0000': '#ef4444',
}

export function normalizarCorTema(cor: string | null | undefined): string {
  const normalizada = cor?.trim().toLowerCase()
  if (!normalizada) return COR_TEMA_PADRAO

  const migrada = CORES_LEGADAS[normalizada] ?? normalizada
  return CORES_E_LOGOS.some((tema) => tema.value === migrada)
    ? migrada
    : COR_TEMA_PADRAO
}

export function obterLogoPorTema(primary: string): string {
  const cor = normalizarCorTema(primary)
  return CORES_E_LOGOS.find(c => c.value === cor)?.logoName || LOGO_PADRAO
}

/** Retorna preto ou branco conforme o maior contraste WCAG com a cor de fundo. */
export function obterCorDeContraste(cor: string): '#000000' | '#ffffff' {
  const hexadecimal = normalizarCorTema(cor).slice(1)
  const canais = [0, 2, 4].map((inicio) => Number.parseInt(hexadecimal.slice(inicio, inicio + 2), 16) / 255)
  const [vermelho, verde, azul] = canais.map((canal) => canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4)
  const luminancia = 0.2126 * vermelho + 0.7152 * verde + 0.0722 * azul
  const contrastePreto = (luminancia + 0.05) / 0.05
  const contrasteBranco = 1.05 / (luminancia + 0.05)
  return contrastePreto >= contrasteBranco ? '#000000' : '#ffffff'
}
