'use client'

// src/contexts/ThemeContext.tsx

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  CORES_E_LOGOS,
  COR_TEMA_PADRAO,
  normalizarCorTema,
  obterCorDeContraste,
  obterCoresSemanticas,
  temaPrimarioEhVermelho,
  type CoresSemanticas,
} from '@/data/temasELogos'

interface ThemeContextType {
  primary:    string
  setPrimary: (c: string) => void
  isLight:    boolean
  setIsLight: (v: boolean) => void
  themeReady: boolean
  primaryIsRed: boolean
  semanticColors: CoresSemanticas
}

export const ThemeContext = createContext<ThemeContextType>({
  primary:    COR_TEMA_PADRAO,
  setPrimary: () => {},
  isLight:    false,
  setIsLight: () => {},
  themeReady: false,
  primaryIsRed: false,
  semanticColors: obterCoresSemanticas(COR_TEMA_PADRAO),
})

function lerPreferencia(chave: string) {
  try {
    return localStorage.getItem(chave)
  } catch {
    return null
  }
}

function salvarPreferencia(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor)
  } catch {
    // O tema continua funcionando na sessão quando o navegador bloqueia o storage.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  
  const [primary, setPrimaryState] = useState(COR_TEMA_PADRAO)
  const [isLight, setIsLightState] = useState(false)
  const [ready, setReady]          = useState(false)

  // Lê as preferências salvas APÓS o mount (client-only)
  useEffect(() => {
    const aplicarPreferenciasSalvas = () => {
      const savedColor = lerPreferencia('rpm-primary')
      const savedTheme = lerPreferencia('rpm-light')
      const corNormalizada = normalizarCorTema(savedColor)

      setPrimaryState(corNormalizada)
      setIsLightState(savedTheme === 'true')
      if (savedColor !== corNormalizada) salvarPreferencia('rpm-primary', corNormalizada)
      setReady(true)
    }

    const sincronizarAbas = (event: StorageEvent) => {
      if (event.key === 'rpm-primary') setPrimaryState(normalizarCorTema(event.newValue))
      if (event.key === 'rpm-light') setIsLightState(event.newValue === 'true')
    }

    queueMicrotask(aplicarPreferenciasSalvas)
    window.addEventListener('storage', sincronizarAbas)
    return () => window.removeEventListener('storage', sincronizarAbas)
  }, [])

  // Aplica as variáveis CSS globais sempre que mudar
  useEffect(() => {
    if (!ready) return
    document.documentElement.style.setProperty('--primary', primary)
    document.documentElement.style.setProperty('--primary-contrast', obterCorDeContraste(primary))
    const semanticColors = obterCoresSemanticas(primary)
    document.documentElement.style.setProperty('--status-danger', semanticColors.danger)
    document.documentElement.style.setProperty('--status-warning', semanticColors.warning)
    document.documentElement.style.setProperty('--status-success', semanticColors.success)
    document.documentElement.style.setProperty('--status-info', semanticColors.info)
    document.documentElement.dataset.primaryFamily = temaPrimarioEhVermelho(primary) ? 'red' : 'default'
    document.documentElement.classList.toggle('light', isLight)
  }, [primary, isLight, ready])

  const setPrimary = (c: string) => {
    const corNormalizada = normalizarCorTema(c)
    setPrimaryState(corNormalizada)
    salvarPreferencia('rpm-primary', corNormalizada)
  }

  const setIsLight = (v: boolean) => {
    setIsLightState(v)
    salvarPreferencia('rpm-light', String(v))
  }

  return (
    <ThemeContext.Provider value={{
      primary,
      setPrimary,
      isLight,
      setIsLight,
      themeReady: ready,
      primaryIsRed: temaPrimarioEhVermelho(primary),
      semanticColors: obterCoresSemanticas(primary),
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

// Cores disponíveis (usadas na Navbar, Admin e Dashboard)
export const THEME_COLORS: Record<string, string> = {
  ...Object.fromEntries(CORES_E_LOGOS.map((tema) => [tema.label, tema.value])),
}
