// src/hooks/useNotificacoes.ts
// Hook para gerenciar notificações com polling em tempo real

import { useEffect, useState, useCallback } from 'react'

export interface Notificacao {
  id: string
  modulo: string
  titulo: string
  mensagem: string
  lida: boolean
  veiculoId?: string
  veiculo?: {
    id: string
    modelo: string
    placa: string
  }
  criado_em: string
}

export interface UseNotificacoesReturn {
  notificacoes: Notificacao[]
  naoLidas: number
  loading: boolean
  error: string | null
  marcarComoLida: (id: string) => Promise<void>
  deletarNotificacao: (id: string) => Promise<void>
  recarregar: () => Promise<void>
}

export function useNotificacoes(pollingInterval = 10000): UseNotificacoesReturn {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/notificacoes')

      if (res.ok) {
        const data = await res.json()
        setNotificacoes(data.notificacoes)
        setNaoLidas(data.naoLidas)
      } else if (res.status === 401) {
        // Não autenticado
        window.location.href = '/auth/login'
      } else {
        setError('Erro ao carregar notificações')
      }
    } catch (err) {
      setError('Erro ao conectar com servidor')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const marcarComoLida = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/notificacoes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lida: true })
        })

        if (res.ok) {
          setNotificacoes(prev =>
            prev.map(n =>
              n.id === id ? { ...n, lida: true } : n
            )
          )
          setNaoLidas(prev => Math.max(0, prev - 1))
        }
      } catch (err) {
        console.error('Erro ao marcar como lida:', err)
      }
    },
    []
  )

  const deletarNotificacao = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notificacoes/${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setNotificacoes(prev => prev.filter(n => n.id !== id))
      }
    } catch (err) {
      console.error('Erro ao deletar notificação:', err)
    }
  }, [])

  // Polling inicial
  useEffect(() => {
    recarregar()
  }, [recarregar])

  // Polling periódico
  useEffect(() => {
    const interval = setInterval(() => {
      recarregar()
    }, pollingInterval)

    return () => clearInterval(interval)
  }, [pollingInterval, recarregar])

  return {
    notificacoes,
    naoLidas,
    loading,
    error,
    marcarComoLida,
    deletarNotificacao,
    recarregar
  }
}
