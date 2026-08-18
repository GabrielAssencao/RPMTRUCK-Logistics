'use client'

// src/contexts/ContainersContext.tsx

import { createContext, useContext, useState, useMemo, ReactNode } from 'react'

export type StatusContainer = 'AGENDADO' | 'EM_TRANSITO' | 'ENTREGUE' | 'CANCELADO'
export type TipoContainer = '20 PÉS' | '40 PÉS' | '40 HC' | 'REEFER' | 'TANQUE' | 'OUTRO'

export interface RegistroContainer {
  id: string
  data: string // YYYY-MM-DD
  codigo: string // ex: MSCU 734521-0
  tipo: TipoContainer
  terminalInicio: string
  terminalFim: string
  duplaId: string
  frete: number
  comissao: number
  status: StatusContainer
  observacoes?: string
}

interface ContainersContextType {
  containers: RegistroContainer[]
  adicionarContainer: (registro: Omit<RegistroContainer, 'id'>) => void
  atualizarContainer: (id: string, dados: Partial<RegistroContainer>) => void
  removerContainer: (id: string) => void
  // Agregados prontos para qualquer módulo consumir sem recalcular tudo de novo
  totalEmTransito: number
  totalContainersMes: number
  totalFreteMes: number
  totalComissaoMes: number
}

const ContainersContext = createContext<ContainersContextType | undefined>(undefined)

// Mock inicial — substituir por fetch ao Supabase quando o backend estiver pronto
const CONTAINERS_INICIAIS: RegistroContainer[] = [
  { id: 'ct1', data: '2026-08-05', codigo: 'MSCU 734521-0', tipo: '40 HC', terminalInicio: 'Porto de Santos', terminalFim: 'CD Guarulhos', duplaId: 'd1', frete: 4200, comissao: 420, status: 'EM_TRANSITO' },
  { id: 'ct2', data: '2026-08-04', codigo: 'TCLU 112938-4', tipo: '20 PÉS', terminalInicio: 'Terminal Embraport', terminalFim: 'Porto de Santos', duplaId: 'd2', frete: 1800, comissao: 180, status: 'ENTREGUE' },
  { id: 'ct3', data: '2026-08-08', codigo: 'HLXU 998217-1', tipo: 'REEFER', terminalInicio: 'CD Cubatão', terminalFim: 'Porto de Santos', duplaId: 'd3', frete: 3100, comissao: 310, status: 'AGENDADO' },
  { id: 'ct4', data: '2026-07-28', codigo: 'CMAU 553012-7', tipo: '40 PÉS', terminalInicio: 'Porto de Santos', terminalFim: 'CD Cajamar', duplaId: 'd1', frete: 3900, comissao: 390, status: 'ENTREGUE' },
]

export function ContainersProvider({ children }: { children: ReactNode }) {
  const [containers, setContainers] = useState<RegistroContainer[]>(CONTAINERS_INICIAIS)

  const adicionarContainer = (registro: Omit<RegistroContainer, 'id'>) => {
    setContainers(prev => [{ ...registro, id: String(Date.now()) }, ...prev])
  }

  const atualizarContainer = (id: string, dados: Partial<RegistroContainer>) => {
    setContainers(prev => prev.map(c => (c.id === id ? { ...c, ...dados } : c)))
  }

  const removerContainer = (id: string) => {
    setContainers(prev => prev.filter(c => c.id !== id))
  }

  const hoje = new Date()
  const pertenceAoMesAtual = (data: string) => {
    const d = new Date(data)
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()
  }

  const totalEmTransito = useMemo(
    () => containers.filter(c => c.status === 'EM_TRANSITO').length,
    [containers]
  )

  const containersDoMes = useMemo(
    () => containers.filter(c => pertenceAoMesAtual(c.data)),
    [containers]
  )

  const totalContainersMes = containersDoMes.length
  const totalFreteMes = useMemo(() => containersDoMes.reduce((acc, c) => acc + c.frete, 0), [containersDoMes])
  const totalComissaoMes = useMemo(() => containersDoMes.reduce((acc, c) => acc + c.comissao, 0), [containersDoMes])

  return (
    <ContainersContext.Provider
      value={{
        containers,
        adicionarContainer,
        atualizarContainer,
        removerContainer,
        totalEmTransito,
        totalContainersMes,
        totalFreteMes,
        totalComissaoMes
      }}
    >
      {children}
    </ContainersContext.Provider>
  )
}

export function useContainers() {
  const ctx = useContext(ContainersContext)
  if (!ctx) {
    throw new Error('useContainers precisa ser usado dentro de um <ContainersProvider>')
  }
  return ctx
}
