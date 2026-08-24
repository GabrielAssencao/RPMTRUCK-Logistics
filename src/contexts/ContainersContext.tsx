'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type StatusContainer = 'AGENDADO' | 'EM_TRANSITO' | 'ENTREGUE' | 'CANCELADO'
export type TipoContainer = '20 PÉS' | '40 PÉS' | '40 HC' | 'REEFER' | 'TANQUE' | 'OUTRO'

export interface DuplaAlocada {
  id: string
  veiculoId: string
  veiculoPlaca: string
  veiculoModelo: string
  motoristaId?: string | null
  motoristaNome: string
}

export interface RegistroContainer {
  id: string
  data: string
  codigo: string
  tipo: TipoContainer
  terminalInicio: string
  terminalFim: string
  duplaId: string
  veiculoId: string
  motoristaId?: string | null
  frete: number
  comissao: number
  percentualComissao: number
  status: StatusContainer
  observacoes?: string
  itensConteudo?: Array<{ nome: string; porcentagem: number }>
}

interface ContainersContextType {
  containers: RegistroContainer[]
  duplas: DuplaAlocada[]
  loading: boolean
  erro: string
  adicionarContainer: (registro: Omit<RegistroContainer, 'id' | 'veiculoId' | 'motoristaId' | 'comissao'>) => Promise<boolean>
  atualizarContainer: (id: string, dados: Partial<Omit<RegistroContainer, 'comissao'>>) => Promise<boolean>
  removerContainer: (id: string) => Promise<boolean>
  totalEmTransito: number
  totalContainersMes: number
  totalFreteMes: number
  totalComissaoMes: number
}

const ContainersContext = createContext<ContainersContextType | undefined>(undefined)

export function ContainersProvider({ children }: { children: ReactNode }) {
  const [containers, setContainers] = useState<RegistroContainer[]>([])
  const [duplas, setDuplas] = useState<DuplaAlocada[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/containers', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar containers.')
        setContainers(data.containers)
        setDuplas(data.duplas)
      })
      .catch(cause => {
        if (cause instanceof Error && cause.name !== 'AbortError') setErro(cause.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const adicionarContainer = useCallback(async (registro: Omit<RegistroContainer, 'id' | 'veiculoId' | 'motoristaId' | 'comissao'>) => {
    const { duplaId, ...dados } = registro
    const dupla = duplas.find(item => item.id === duplaId)
    if (!dupla) {
      setErro('Selecione um veículo válido.')
      return false
    }

    const response = await fetch('/api/containers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...dados, veiculoId: dupla.veiculoId, motoristaId: dupla.motoristaId }),
    })
    const data = await response.json()
    if (!response.ok) {
      setErro(data.erro || 'Não foi possível salvar o container.')
      return false
    }
    setErro('')
    setContainers(prev => [data, ...prev])
    return true
  }, [duplas])

  const atualizarContainer = useCallback(async (id: string, dados: Partial<Omit<RegistroContainer, 'comissao'>>) => {
    const { duplaId, ...alteracoes } = dados
    const dupla = duplaId ? duplas.find(item => item.id === duplaId) : undefined
    const response = await fetch(`/api/containers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...alteracoes,
        ...(dupla ? { veiculoId: dupla.veiculoId, motoristaId: dupla.motoristaId } : {}),
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      setErro(data.erro || 'Não foi possível atualizar o container.')
      return false
    }
    setErro('')
    setContainers(prev => prev.map(container => container.id === id ? data : container))
    return true
  }, [duplas])

  const removerContainer = useCallback(async (id: string) => {
    const response = await fetch(`/api/containers/${id}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) {
      setErro(data.erro || 'Não foi possível remover o container.')
      return false
    }
    setErro('')
    setContainers(prev => prev.filter(container => container.id !== id))
    return true
  }, [])

  const containersDoMes = useMemo(() => {
    const hoje = new Date()
    return containers.filter(container => {
      const data = new Date(`${container.data}T12:00:00`)
      return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear()
    })
  }, [containers])

  const value = useMemo(() => ({
    containers,
    duplas,
    loading,
    erro,
    adicionarContainer,
    atualizarContainer,
    removerContainer,
    totalEmTransito: containers.filter(container => container.status === 'EM_TRANSITO').length,
    totalContainersMes: containersDoMes.length,
    totalFreteMes: containersDoMes.reduce((total, container) => total + container.frete, 0),
    totalComissaoMes: containersDoMes.reduce((total, container) => total + container.comissao, 0),
  }), [adicionarContainer, atualizarContainer, containers, containersDoMes, duplas, erro, loading, removerContainer])

  return <ContainersContext.Provider value={value}>{children}</ContainersContext.Provider>
}

export function useContainers() {
  const context = useContext(ContainersContext)
  if (!context) throw new Error('useContainers precisa ser usado dentro de um ContainersProvider')
  return context
}
