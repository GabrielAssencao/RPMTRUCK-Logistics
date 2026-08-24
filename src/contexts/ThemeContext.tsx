'use client'

// src/contexts/ThemeContext.tsx

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface ThemeContextType {
  primary:    string
  setPrimary: (c: string) => void
  isLight:    boolean
  setIsLight: (v: boolean) => void
}

export const ThemeContext = createContext<ThemeContextType>({
  primary:    '#22c55e',
  setPrimary: () => {},
  isLight:    false,
  setIsLight: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  
  const [primary, setPrimaryState] = useState('#22c55e')
  const [isLight, setIsLightState] = useState(false)
  const [ready, setReady]          = useState(false)

  // Lê as preferências salvas APÓS o mount (client-only)
  useEffect(() => {
    const savedColor = localStorage.getItem('rpm-primary')
    const savedTheme = localStorage.getItem('rpm-light')
    queueMicrotask(() => {
      if (savedColor) setPrimaryState(savedColor)
      if (savedTheme) setIsLightState(savedTheme === 'true')
      setReady(true)
    })
  }, [])

  // Aplica as variáveis CSS globais sempre que mudar
  useEffect(() => {
    if (!ready) return
    document.documentElement.style.setProperty('--primary', primary)
    document.documentElement.classList.toggle('light', isLight)
  }, [primary, isLight, ready])

  const setPrimary = (c: string) => {
    setPrimaryState(c)
    localStorage.setItem('rpm-primary', c)
  }

  const setIsLight = (v: boolean) => {
    setIsLightState(v)
    localStorage.setItem('rpm-light', String(v))
  }

  return (
    <ThemeContext.Provider value={{ primary, setPrimary, isLight, setIsLight }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

// Cores disponíveis (usadas na Navbar, Admin e Dashboard)
export const THEME_COLORS: Record<string, string> = {
  Verde:    '#22c55e',
  Vermelho: '#ef4444',
  Azul:     '#3b82f6',
  Âmbar:    '#f59e0b',
  Roxo:     '#5e17eb',
}
