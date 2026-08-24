// src/components/dashboard/admin/AdminDashboard.tsx
// Admin dashboard stats display with cards e gráficos
'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp,
  Building2,
  Users,
  AlertCircle,
  Clock,
  type LucideIcon,
} from 'lucide-react'

interface DashboardStats {
  resumo: {
    totalEmpresas: number
    empresasAtivas: number
    empresasBloqueadas: number
    usuariosTotal: number
    solicitacoesPendentes: number
    resetsPendentes: number
    receitaTotal: string
  }
  distribuicao: {
    planos: Array<{ plano: string; _count: { id: number } }>
    status: Array<{ status: string; _count: { id: number } }>
  }
  atividades: {
    ultimasSolicitacoes: Array<{
      id: string
      empresa: string
      email: string
      status: string
      criado_em: string
    }>
  }
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  trend,
}: {
  title: string
  value: string | number
  icon: LucideIcon
  color: string
  trend?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 border rounded-lg"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--background-secondary)',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-foreground-muted mb-1">
            {title}
          </p>
          <p
            className="text-3xl font-black"
            style={{ color, fontFamily: 'Rajdhani, sans-serif' }}
          >
            {value}
          </p>
          {trend && <p className="text-xs text-foreground-muted mt-1">{trend}</p>}
        </div>
        <div className="p-3 rounded-lg" style={{ backgroundColor: `${color}15` }}>
          <Icon size={24} style={{ color }} />
        </div>
      </div>
    </motion.div>
  )
}

export default function AdminDashboard() {
  const { primary } = useTheme()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats')
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Erro ao carregar stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

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

  if (!stats) {
    return <div>Erro ao carregar estatísticas</div>
  }

  return (
    <div className="space-y-8">
      {/* Resumo Principal */}
      <div>
        <p
          className="text-xs font-bold tracking-widest uppercase mb-2"
          style={{ color: primary }}
        >
          Overview
        </p>
        <h2
          className="text-3xl font-black"
          style={{ fontFamily: 'Rajdhani, sans-serif' }}
        >
          Sistema em Tempo Real
        </h2>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Empresas Cadastradas"
          value={stats.resumo.totalEmpresas}
          icon={Building2}
          color={primary}
          trend={`${stats.resumo.empresasAtivas} ativas`}
        />
        <StatCard
          title="Usuários Total"
          value={stats.resumo.usuariosTotal}
          icon={Users}
          color="#3b82f6"
          trend="Plataforma"
        />
        <StatCard
          title="Solicitações Pendentes"
          value={stats.resumo.solicitacoesPendentes}
          icon={Clock}
          color="#f59e0b"
          trend="Aguardando ação"
        />
        <StatCard
          title="Receita Total"
          value={`R$ ${stats.resumo.receitaTotal}`}
          icon={TrendingUp}
          color="#10b981"
          trend="Faturas pagas"
        />
      </div>

      {/* Alertas */}
      {(stats.resumo.solicitacoesPendentes > 0 ||
        stats.resumo.resetsPendentes > 0 ||
        stats.resumo.empresasBloqueadas > 0) && (
        <div className="space-y-3">
          <p
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: primary }}
          >
            ⚠️ Atenção
          </p>

          {stats.resumo.solicitacoesPendentes > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 border rounded-lg flex items-start gap-3"
              style={{
                borderColor: '#f59e0b',
                backgroundColor: '#f59e0b15'
              }}
            >
              <Clock size={20} style={{ color: '#f59e0b' }} />
              <div>
                <p className="font-bold text-sm">Solicitações Pendentes</p>
                <p className="text-xs text-foreground-muted">
                  {stats.resumo.solicitacoesPendentes} novas solicitações de
                  acesso aguardando aprovação
                </p>
              </div>
            </motion.div>
          )}

          {stats.resumo.empresasBloqueadas > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 border rounded-lg flex items-start gap-3"
              style={{
                borderColor: '#ef4444',
                backgroundColor: '#ef444415'
              }}
            >
              <AlertCircle size={20} style={{ color: '#ef4444' }} />
              <div>
                <p className="font-bold text-sm">Empresas Bloqueadas</p>
                <p className="text-xs text-foreground-muted">
                  {stats.resumo.empresasBloqueadas} empresas com problemas de
                  pagamento
                </p>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Últimas Solicitações */}
      {stats.atividades.ultimasSolicitacoes.length > 0 && (
        <div>
          <p
            className="text-xs font-bold tracking-widest uppercase mb-4"
            style={{ color: primary }}
          >
            📋 Últimas Solicitações
          </p>

          <div className="space-y-2">
            <AnimatePresence>
              {stats.atividades.ultimasSolicitacoes.map(sol => (
                <motion.div
                  key={sol.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 border rounded-lg"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--background-secondary)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-bold text-sm">{sol.empresa}</p>
                      <p className="text-xs text-foreground-muted">
                        {sol.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold px-2 py-1 rounded border"
                        style={{
                          color:
                            sol.status === 'PENDENTE'
                              ? '#f59e0b'
                              : sol.status === 'APROVADO'
                                ? '#10b981'
                                : '#ef4444',
                          borderColor:
                            sol.status === 'PENDENTE'
                              ? '#f59e0b40'
                              : sol.status === 'APROVADO'
                                ? '#10b98140'
                                : '#ef444440',
                          backgroundColor:
                            sol.status === 'PENDENTE'
                              ? '#f59e0b10'
                              : sol.status === 'APROVADO'
                                ? '#10b98110'
                                : '#ef444410'
                        }}
                      >
                        {sol.status}
                      </span>
                      <span className="text-xs text-foreground-muted">
                        {new Date(sol.criado_em).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  )
}
