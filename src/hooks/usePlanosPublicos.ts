'use client'

import { useCallback, useEffect, useState } from 'react'

export interface PlanoPublico {
  id: 'ESSENCIAL' | 'AVANCADO' | 'ENTERPRISE'
  name: string
  desc: string
  price: number
  setup: number
  users: number
  vehicles: number
  modules: readonly string[]
  userExtraPrice: number
  vehicleExtraPrice: number
  historyYears: number
  restricted: boolean
  featured: boolean
  version: number
}

interface PlanoApi {
  id: PlanoPublico['id']
  nome: string
  descricao: string
  beneficios: readonly string[]
  precoBase: number
  taxaImplantacao: number
  precoUsuarioAdicional: number
  precoVeiculoAdicional: number
  usuariosBase: number
  veiculosBase: number
  historicoAnos: number
  restrito: boolean
  destaque: boolean
  versao: number
}

export function usePlanosPublicos() {
  const [planos, setPlanos] = useState<PlanoPublico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setCarregando(true)
    setErro('')
    try {
      const response = await fetch('/api/planos', { signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar os planos.')
      const recebidos: PlanoApi[] = Array.isArray(data.planos) ? data.planos : []
      setPlanos(recebidos.map((plano) => ({
        id: plano.id,
        name: plano.nome.toUpperCase(),
        desc: plano.descricao,
        price: plano.precoBase,
        setup: plano.taxaImplantacao,
        users: plano.usuariosBase,
        vehicles: plano.veiculosBase,
        modules: plano.beneficios,
        userExtraPrice: plano.precoUsuarioAdicional,
        vehicleExtraPrice: plano.precoVeiculoAdicional,
        historyYears: plano.historicoAnos,
        restricted: plano.restrito,
        featured: plano.destaque,
        version: plano.versao,
      })))
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setErro(cause instanceof Error ? cause.message : 'Não foi possível carregar os planos.')
    } finally {
      if (!signal?.aborted) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) void carregar(controller.signal)
    })
    return () => controller.abort()
  }, [carregar])

  return { planos, carregando, erro, recarregar: () => carregar() }
}
