// src/components/dashboard/admin/AdminEmpresas.tsx
// Gerenciador de empresas refatorado
'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Eye, Trash2, CheckCircle, XCircle } from 'lucide-react'

interface Empresa {
  id: string
  nome: string
  cnpj: string
  plano: string
  status: 'ATIVO' | 'BLOQUEADO' | 'AGUARDANDO_APROVACAO'
  usuariosCount?: number
}

export default function AdminEmpresas() {
  const { primary } = useTheme()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    const fetchEmpresas = async () => {
      try {
        const res = await fetch('/api/empresas')
        if (res.ok) {
          const data = await res.json()
          setEmpresas(data.empresas || [])
        }
      } catch (error) {
        console.error('Erro ao carregar empresas:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEmpresas()
  }, [])

  const empresasFiltradas = empresas.filter(e =>
    e.nome.toLowerCase().includes(busca.toLowerCase()) ||
    e.cnpj.includes(busca)
  )

  const statusColor = (status: string) => {
    switch (status) {
      case 'ATIVO':
        return '#10b981'
      case 'BLOQUEADO':
        return '#ef4444'
      case 'AGUARDANDO_APROVACAO':
        return '#f59e0b'
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
      <div className="flex items-center justify-between">
        <div>
          <p
            className="text-xs font-bold tracking-widest uppercase mb-2"
            style={{ color: primary }}
          >
            Gestão
          </p>
          <h2
            className="text-3xl font-black"
            style={{ fontFamily: 'Rajdhani, sans-serif' }}
          >
            Empresas Cadastradas
          </h2>
        </div>
        <button
          className="flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-widest border transition-all hover:opacity-70"
          style={{
            borderColor: primary,
            color: primary,
            backgroundColor: `${primary}15`,
          }}
        >
          <Plus size={16} />
          Nova Empresa
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40"
          size={16}
        />
        <input
          type="text"
          placeholder="Buscar por nome ou CNPJ..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full pl-12 pr-4 py-3 text-sm outline-none border"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--background-secondary)',
          }}
        />
      </div>

      {/* Tabela */}
      <div
        className="border overflow-hidden rounded-lg"
        style={{ borderColor: 'var(--border)' }}
      >
        <table className="w-full text-left">
          <thead
            className="border-b"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}
          >
            <tr>
              {['EMPRESA', 'CNPJ', 'PLANO', 'STATUS', 'AÇÕES'].map(h => (
                <th
                  key={h}
                  className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-foreground-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {empresasFiltradas.map((empresa, idx) => (
                <motion.tr
                  key={empresa.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border-b last:border-b-0 hover:bg-black/5 transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="px-6 py-4 font-bold">{empresa.nome}</td>
                  <td className="px-6 py-4 text-sm font-mono text-foreground-muted">
                    {empresa.cnpj}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="text-xs font-bold px-2 py-1 border rounded"
                      style={{
                        color: primary,
                        borderColor: `${primary}40`,
                        backgroundColor: `${primary}10`,
                      }}
                    >
                      {empresa.plano}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: statusColor(empresa.status) }}
                      />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {empresa.status === 'ATIVO' ? '✓ ATIVA' : '✗ ' + empresa.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 flex items-center gap-2">
                    <button className="p-1.5 hover:opacity-70 transition-opacity" title="Ver">
                      <Eye size={16} style={{ color: primary }} />
                    </button>
                    <button className="p-1.5 hover:opacity-70 transition-opacity text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  )
}
