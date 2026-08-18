// src/components/dashboard/admin/AdminSolicitacoes.tsx
// Gerenciador de solicitações e resets de acesso
'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, CheckCircle, XCircle } from 'lucide-react'

interface Solicitacao {
  id: string
  email: string
  tipo: 'NOVO_ACESSO' | 'RESET_SENHA'
  empresa?: string
  data: string
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA'
}

export default function AdminSolicitacoes() {
  const { primary } = useTheme()
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'TODAS' | 'PENDENTE' | 'APROVADA' | 'REJEITADA'>('PENDENTE')

  useEffect(() => {
    const fetchSolicitacoes = async () => {
      try {
        const res = await fetch('/api/solicitacoes')
        if (res.ok) {
          const data = await res.json()
          setSolicitacoes(data.solicitacoes || [])
        }
      } catch (error) {
        console.error('Erro ao carregar solicitações:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSolicitacoes()
  }, [])

  const solicitacoesFiltradas =
    filtro === 'TODAS'
      ? solicitacoes
      : solicitacoes.filter(s => s.status === filtro)

  const statusIcon = (status: string) => {
    switch (status) {
      case 'PENDENTE':
        return Clock
      case 'APROVADA':
        return CheckCircle
      case 'REJEITADA':
        return XCircle
      default:
        return Clock
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'PENDENTE':
        return '#f59e0b'
      case 'APROVADA':
        return '#10b981'
      case 'REJEITADA':
        return '#ef4444'
      default:
        return '#888888'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2"
          style={{ borderColor: primary }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p
          className="text-xs font-bold tracking-widest uppercase mb-2"
          style={{ color: primary }}
        >
          Operações
        </p>
        <h2
          className="text-3xl font-black"
          style={{ fontFamily: 'Rajdhani, sans-serif' }}
        >
          Solicitações de Acesso
        </h2>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(['TODAS', 'PENDENTE', 'APROVADA', 'REJEITADA'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFiltro(status)}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest border rounded transition-all"
            style={{
              borderColor: filtro === status ? primary : 'var(--border)',
              backgroundColor: filtro === status ? `${primary}20` : 'transparent',
              color: filtro === status ? primary : 'var(--foreground-muted)',
            }}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        <AnimatePresence>
          {solicitacoesFiltradas.map((sol, idx) => {
            const Icon = statusIcon(sol.status)
            return (
              <motion.div
                key={sol.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-4 border rounded-lg"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--background-secondary)',
                }}
              >
                <div className="flex items-center gap-4 flex-1">
                  <Icon size={20} style={{ color: statusColor(sol.status) }} />
                  <div className="flex-1">
                    <p className="font-bold text-sm">{sol.email}</p>
                    <p className="text-xs text-foreground-muted">
                      {sol.tipo === 'NOVO_ACESSO' ? 'Novo Acesso' : 'Reset de Senha'}{' '}
                      {sol.empresa && `- ${sol.empresa}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-foreground-muted">
                    {new Date(sol.data).toLocaleDateString('pt-BR')}
                  </span>
                  {sol.status === 'PENDENTE' && (
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1.5 text-xs font-bold uppercase border rounded transition-all hover:opacity-70"
                        style={{
                          borderColor: primary,
                          color: primary,
                          backgroundColor: `${primary}10`,
                        }}
                      >
                        Aprovar
                      </button>
                      <button className="px-3 py-1.5 text-xs font-bold uppercase border rounded transition-all hover:opacity-70 text-red-500 border-red-500/40">
                        Rejeitar
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
