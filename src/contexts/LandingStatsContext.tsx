'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export interface LandingStats {
  empresas: number
  veiculos: number
  motoristas: number
  manutencoes: number
}

const LandingStatsContext = createContext<LandingStats | null | undefined>(undefined)

export function LandingStatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<LandingStats | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function carregarEstatisticas() {
      try {
        const response = await fetch('/api/stats', { signal: controller.signal })
        if (!response.ok) throw new Error('Falha ao carregar estatísticas públicas.')
        const dados = await response.json() as Partial<LandingStats>
        setStats({
          empresas: Number(dados.empresas ?? 0),
          veiculos: Number(dados.veiculos ?? 0),
          motoristas: Number(dados.motoristas ?? 0),
          manutencoes: Number(dados.manutencoes ?? 0),
        })
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Não foi possível carregar as estatísticas da landing:', error)
        }
      }
    }

    void carregarEstatisticas()
    return () => controller.abort()
  }, [])

  return (
    <LandingStatsContext.Provider value={stats}>
      {children}
    </LandingStatsContext.Provider>
  )
}

export function useLandingStats() {
  const contexto = useContext(LandingStatsContext)
  if (contexto === undefined) {
    throw new Error('useLandingStats deve ser usado dentro de LandingStatsProvider.')
  }
  return contexto
}
