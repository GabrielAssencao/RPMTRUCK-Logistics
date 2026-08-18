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

export const LOGO_PADRAO = 'logoRPMTRUCK_verde.png'

export function obterLogoPorTema(primary: string): string {
  return CORES_E_LOGOS.find(c => c.value === primary)?.logoName || LOGO_PADRAO
}