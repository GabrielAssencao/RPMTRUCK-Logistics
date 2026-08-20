import { useCallback, useEffect, useRef, useState } from 'react'

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
  marcarTodasComoLidas: () => Promise<void>
  pendenciasPorModulo: Record<string, number>
  recarregar: () => Promise<void>
  recarregarResumo: () => Promise<void>
}

interface ResumoNotificacoes {
  naoLidas: number
  pendenciasPorModulo: Record<string, number>
}

interface ListaNotificacoes extends ResumoNotificacoes {
  notificacoes: Notificacao[]
}

export function useNotificacoes(pollingInterval = 60000): UseNotificacoesReturn {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [pendenciasPorModulo, setPendenciasPorModulo] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resumoEmAndamento = useRef<Promise<void> | null>(null)
  const listaEmAndamento = useRef<Promise<void> | null>(null)

  const recarregarResumo = useCallback(() => {
    if (resumoEmAndamento.current) return resumoEmAndamento.current

    const requisicao: Promise<void> = (async () => {
      try {
        const res = await fetch('/api/notificacoes?resumo=true', { cache: 'no-store' })

        if (res.ok) {
          const data = await res.json() as ResumoNotificacoes
          setNaoLidas(data.naoLidas)
          setPendenciasPorModulo(data.pendenciasPorModulo)
        } else if (res.status === 401) {
          window.location.href = '/auth/login'
        }
      } catch (err) {
        console.error('Erro ao carregar resumo de notificações:', err)
      }
    })().finally(() => {
      if (resumoEmAndamento.current === requisicao) resumoEmAndamento.current = null
    })

    resumoEmAndamento.current = requisicao
    return requisicao
  }, [])

  const recarregar = useCallback(() => {
    if (listaEmAndamento.current) return listaEmAndamento.current

    setLoading(true)
    setError(null)

    const requisicao: Promise<void> = (async () => {
      try {
        const res = await fetch('/api/notificacoes', { cache: 'no-store' })

        if (res.ok) {
          const data = await res.json() as ListaNotificacoes
          setNotificacoes(data.notificacoes)
          setNaoLidas(data.naoLidas)
          setPendenciasPorModulo(data.pendenciasPorModulo)
        } else if (res.status === 401) {
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
    })().finally(() => {
      if (listaEmAndamento.current === requisicao) listaEmAndamento.current = null
    })

    listaEmAndamento.current = requisicao
    return requisicao
  }, [])

  const marcarComoLida = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notificacoes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lida: true }),
      })

      if (res.ok) {
        setNotificacoes(prev => prev.map(notificacao => (
          notificacao.id === id ? { ...notificacao, lida: true } : notificacao
        )))
        setNaoLidas(prev => Math.max(0, prev - 1))
        void recarregarResumo()
      }
    } catch (err) {
      console.error('Erro ao marcar como lida:', err)
    }
  }, [recarregarResumo])

  const deletarNotificacao = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notificacoes/${id}`, { method: 'DELETE' })

      if (res.ok) {
        setNotificacoes(prev => {
          const removida = prev.find(notificacao => notificacao.id === id)
          if (removida && !removida.lida) setNaoLidas(total => Math.max(0, total - 1))
          return prev.filter(notificacao => notificacao.id !== id)
        })
        void recarregarResumo()
      }
    } catch (err) {
      console.error('Erro ao deletar notificação:', err)
    }
  }, [recarregarResumo])

  const marcarTodasComoLidas = useCallback(async () => {
    const res = await fetch('/api/notificacoes', { method: 'PATCH' })
    if (!res.ok) return
    setNotificacoes(prev => prev.map(notificacao => ({ ...notificacao, lida: true })))
    setNaoLidas(0)
    setPendenciasPorModulo({})
  }, [])

  useEffect(() => {
    const atualizarSeVisivel = () => {
      if (!document.hidden) void recarregarResumo()
    }

    atualizarSeVisivel()

    const interval = window.setInterval(atualizarSeVisivel, pollingInterval)
    document.addEventListener('visibilitychange', atualizarSeVisivel)
    window.addEventListener('focus', atualizarSeVisivel)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', atualizarSeVisivel)
      window.removeEventListener('focus', atualizarSeVisivel)
    }
  }, [pollingInterval, recarregarResumo])

  return {
    notificacoes,
    naoLidas,
    loading,
    error,
    marcarComoLida,
    deletarNotificacao,
    marcarTodasComoLidas,
    pendenciasPorModulo,
    recarregar,
    recarregarResumo,
  }
}
