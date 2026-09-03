'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import { 
  Truck, 
  Search, 
  Plus, 
  MoreVertical, 
  CheckCircle2, 
  Wrench, 
  AlertCircle,
  Pencil,
  Trash2,
  Bell,
  MapPin,
  Zap,
  X,
  Check,
  Filter
} from 'lucide-react'
import GenericDrawer, { FieldConfig } from '@/components/dashboard/GenericDrawer'
import { ActionFeedback } from '@/components/motion/DashboardMotion'
import { sinalizarAtualizacaoDashboardEmpresa } from '@/lib/dashboardEvents'

type StatusVeiculo = 'OPERACIONAL' | 'OFICINA' | 'INATIVO'

interface VeiculoCompleto {
  id: string
  modelo: string
  placa: string
  tipo: string
  ano: number
  localizacao?: string
  quilometragem: number
  status: StatusVeiculo
  motoristaAtual?: string
  localizacaoId?: string
}

interface VeiculoApi extends Omit<VeiculoCompleto, 'localizacao' | 'motoristaAtual' | 'localizacaoId'> {
  localizacao?: { id: string; nome: string } | null
  motoristas?: Array<{ nome: string }>
}

export default function FrotaPage() {
  const { primary, isLight } = useTheme()
  const [montado, setMontado] = useState(false)
  
  // Estado do Drawer e Edição
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [veiculoParaEditar, setVeiculoParaEditar] = useState<VeiculoCompleto | null>(null)
  
  // Seleção Múltipla e Ações em Lote
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [modalAcoesAbertoId, setModalAcoesAbertoId] = useState<string | null>(null)
  const [novoStatusEmLote, setNovoStatusEmLote] = useState<StatusVeiculo | null>(null)
  const [confirmandoExclusaoEmLote, setConfirmandoExclusaoEmLote] = useState(false)
  
  const [menuAcoesAberto, setMenuAcoesAberto] = useState<string | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('TODOS')
  const [filtroLocalizacao, setFiltroLocalizacao] = useState('TODAS')

  // Pátios/Bases Cadastrados
  const [listaLocalizacoes, setListaLocalizacoes] = useState<Array<{ id: string; nome: string }>>([])
  const [veiculos, setVeiculos] = useState<VeiculoCompleto[]>([])
  const [feedback, setFeedback] = useState('')
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error' | 'warning' | 'info'>('info')

  const mostrarFeedback = (mensagem: string, tone: typeof feedbackTone) => {
    setFeedbackTone(tone)
    setFeedback(mensagem)
  }

  const normalizarVeiculo = (veiculo: VeiculoApi): VeiculoCompleto => ({
    id: veiculo.id, modelo: veiculo.modelo, placa: veiculo.placa, tipo: veiculo.tipo,
    ano: veiculo.ano ?? new Date().getFullYear(), quilometragem: veiculo.quilometragem,
    status: veiculo.status, localizacao: veiculo.localizacao?.nome ?? 'Sem localização',
    localizacaoId: veiculo.localizacao?.id, motoristaAtual: veiculo.motoristas?.[0]?.nome ?? 'Sem atribuição',
  })

  useEffect(() => {
    queueMicrotask(() => setMontado(true))
    Promise.all([
      fetch('/api/veiculos', { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.erro); return data }),
      fetch('/api/localizacoes', { cache: 'no-store' }).then(async response => response.ok ? response.json() : []),
    ]).then(([dadosVeiculos, localizacoes]) => {
      setVeiculos(dadosVeiculos.map(normalizarVeiculo))
      setListaLocalizacoes(localizacoes)
    }).catch(error => {
      setFeedbackTone('error')
      setFeedback(error instanceof Error ? error.message : 'Falha ao carregar a frota.')
    })
  }, [])

  if (!montado) return null

  // Configuração Dinâmica dos Campos do Drawer com as Localizações do Sistema
  const camposFrotaDinamicos: FieldConfig[] = [
    { name: 'modelo', label: 'Modelo do Caminhão / Veículo', type: 'text', placeholder: 'Ex: VOLVO FH 540', required: true, maxLength: 100 },
    { name: 'placa', label: 'Placa / Matrícula', type: 'text', placeholder: 'Ex: ABC-1234', required: true, maxLength: 8, pattern: '[A-Za-z]{3}-?[0-9][A-Za-z0-9][0-9]{2}', title: 'Informe uma placa brasileira antiga ou Mercosul.' },
    { name: 'ano', label: 'Ano do Veículo', type: 'number', placeholder: 'Ex: 2023', required: true, min: 1950, max: new Date().getFullYear() + 1, step: 1 },
    { 
      name: 'tipo', 
      label: 'Tipo de Carroçaria / Chassi', 
      type: 'select', 
      required: true,
      options: [
        { label: 'Cavalo Mecânico', value: 'Cavalo Mecânico' },
        { label: 'Bitrem', value: 'Bitrem' },
        { label: 'Sider', value: 'Sider' },
        { label: 'Baú', value: 'Baú' },
        { label: 'Refrigerado', value: 'Refrigerado' }
      ]
    },
    { name: 'quilometragem', label: 'Quilometragem Atual (KM)', type: 'number', placeholder: 'Ex: 125430', required: true, min: 0, max: 100000000, step: 1 },
    { 
      name: 'localizacao', 
      label: 'Base / Pátio de Origem', 
      type: 'select', 
      required: true,
      options: listaLocalizacoes.map(loc => ({ label: loc.nome, value: loc.id }))
    },
    { 
      name: 'status', 
      label: 'Estado Operacional', 
      type: 'select', 
      required: true,
      options: [
        { label: 'OPERACIONAL', value: 'OPERACIONAL' },
        { label: 'OFICINA', value: 'OFICINA' },
        { label: 'INATIVO', value: 'INATIVO' }
      ]
    }
  ]

  // Filtragem
  const veiculosFiltrados = veiculos.filter(v => {
    const matchBusca = v.modelo.toLowerCase().includes(busca.toLowerCase()) || 
                       v.placa.toLowerCase().includes(busca.toLowerCase())
    const matchStatus = filtroStatus === 'TODOS' || v.status === filtroStatus
    const matchLoc = filtroLocalizacao === 'TODAS' || v.localizacao === filtroLocalizacao
    return matchBusca && matchStatus && matchLoc
  })

  // 🔄 TROCA RÁPIDA DE STATUS NA TABELA
  const handleAlterarStatusRapido = async (id: string, novoStatus: StatusVeiculo) => {
    const response = await fetch(`/api/veiculos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: novoStatus }) })
    const data = await response.json()
    if (!response.ok) return mostrarFeedback(data.erro || 'Falha ao alterar status.', 'error')
    setVeiculos(prev => prev.map(v => v.id === id ? normalizarVeiculo(data) : v))
    sinalizarAtualizacaoDashboardEmpresa()
    mostrarFeedback('Status do veículo atualizado.', 'success')
  }

  // ✅ SELEÇÃO MÚLTIPLA
  const handleToggleSelecionado = (id: string) => {
    const novo = new Set(selecionados)
    if (novo.has(id)) {
      novo.delete(id)
    } else {
      novo.add(id)
    }
    setSelecionados(novo)
  }

  // ✅ SELECIONAR TODOS VISÍVEIS
  const handleSelecionarTodos = () => {
    if (selecionados.size === veiculosFiltrados.length) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(veiculosFiltrados.map(v => v.id)))
    }
  }

  // 🎯 ALTERAR STATUS EM LOTE
  const handleAlterarStatusEmLote = async (novoStatus: StatusVeiculo) => {
    const ids = Array.from(selecionados)
    const response = await fetch('/api/veiculos/lote', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status: novoStatus }),
    })
    const data = await response.json()
    if (!response.ok) return mostrarFeedback(data.erro || 'A atualização em lote não pôde ser concluída.', 'error')
    setVeiculos(prev => prev.map(v => selecionados.has(v.id) ? { ...v, status: novoStatus } : v))
    sinalizarAtualizacaoDashboardEmpresa()
    setSelecionados(new Set())
    setNovoStatusEmLote(null)
    mostrarFeedback(`Status de ${ids.length} veículo(s) atualizado.`, 'success')
  }

  // 🗑️ EXCLUIR EM LOTE
  const handleExcluirEmLote = async () => {
    const ids = Array.from(selecionados)
    const response = await fetch('/api/veiculos/lote', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    const data = await response.json()
    if (!response.ok) {
      mostrarFeedback(data.erro || 'A exclusão em lote não pôde ser concluída.', 'error')
      return
    }
    const removidos = Array.isArray(data.removidos) ? data.removidos as string[] : []
    setVeiculos(prev => prev.filter(v => !removidos.includes(v.id)))
    if (removidos.length > 0) sinalizarAtualizacaoDashboardEmpresa()
    if (data.falhas?.length) mostrarFeedback('Alguns veículos possuem histórico e não puderam ser removidos.', 'warning')
    else mostrarFeedback(`${removidos.length} veículo(s) removido(s).`, 'success')
    setSelecionados(new Set())
    setConfirmandoExclusaoEmLote(false)
  }

  // ✏️ ABRIR EDITAR PREENCHENDO OS DADOS
  const handleAbrirEditar = (veiculo: VeiculoCompleto) => {
    setFeedback('')
    setVeiculoParaEditar(veiculo)
    setDrawerOpen(true)
    setMenuAcoesAberto(null)
  }

  // ➕ ABRIR NOVO LIMPO
  const handleAbrirNovo = () => {
    setFeedback('')
    setVeiculoParaEditar(null)
    setDrawerOpen(true)
  }

  // 💾 SALVAR
  const handleSalvarVeiculo = async (formData: Record<string, unknown>) => {
    setFeedback('')
    const payload = {
      modelo: formData.modelo,
      placa: formData.placa,
      ano: Number(formData.ano),
      tipo: formData.tipo,
      quilometragem: Number(formData.quilometragem),
      localizacaoId: typeof formData.localizacao === 'string' && formData.localizacao ? formData.localizacao : null,
      status: formData.status,
    }
    const response = await fetch(veiculoParaEditar ? `/api/veiculos/${veiculoParaEditar.id}` : '/api/veiculos', {
      method: veiculoParaEditar ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) {
      mostrarFeedback(data.erro || 'Não foi possível salvar o veículo.', 'error')
      return false
    }
    const salvo = normalizarVeiculo(data)
    setVeiculos(prev => veiculoParaEditar ? prev.map(v => v.id === salvo.id ? salvo : v) : [salvo, ...prev])
    sinalizarAtualizacaoDashboardEmpresa()
    mostrarFeedback(veiculoParaEditar ? 'Veículo atualizado com sucesso.' : 'Veículo adicionado à frota.', 'success')

    return true
  }

  // 🗑️ EXCLUSÃO
  const handleConfirmarExclusao = async (id: string) => {
    const response = await fetch(`/api/veiculos/${id}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) return mostrarFeedback(data.erro || 'Não foi possível remover o veículo.', 'error')
    setVeiculos(prev => prev.filter(v => v.id !== id))
    sinalizarAtualizacaoDashboardEmpresa()
    setExcluindoId(null)
    setMenuAcoesAberto(null)
    mostrarFeedback('Veículo removido da frota.', 'success')
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-mono">
      {feedback && <ActionFeedback message={feedback} tone={feedbackTone} />}
      
      {/* ─── CABEÇALHO COM AÇÕES HOMOGENEIZADAS ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight font-rajdhani" style={{ color: 'var(--foreground)' }}>
            Catálogo <span style={{ color: primary }}>da Frota</span>
          </h1>
          <p className="text-sm font-mono mt-1" style={{ color: 'var(--foreground-muted)' }}>
            {selecionados.size > 0 
              ? `${selecionados.size} veículo(s) selecionado(s) • Clique em uma ação para alterar em lote`
              : 'Gestão integral de veículos, manutenções, pátios e alteração rápida de status.'
            }
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <BotaoSecundarioFrota href="/dashboard/empresa/frota/localizacoes" icone={<MapPin size={16} />} label="Bases & Pátios" primary={primary} />
          <BotaoSecundarioFrota href="/dashboard/empresa/frota/manutencao" icone={<Wrench size={16} />} label="Manutenções" primary={primary} />

          <motion.button 
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleAbrirNovo}
            className="flex items-center gap-2 px-6 py-3 text-xs font-mono font-bold uppercase tracking-widest transition-all text-black font-extrabold"
            style={{ 
              backgroundColor: primary,
              clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
            }}
          >
            <Plus size={16} /> Cadastrar Veículo
          </motion.button>
        </div>
      </div>

      {/* ─── BARRA DE PESQUISA E FILTROS ─── */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" style={{ color: 'var(--foreground-muted)' }}>
            <Search size={16} />
          </div>
          <input 
            type="text" 
            placeholder="Procurar por placa ou modelo..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-11 pr-4 py-3 text-sm outline-none border transition-colors font-mono"
            style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        <div className="flex items-center gap-2 font-mono text-xs border px-3" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
          <MapPin size={14} style={{ color: primary }} />
          <select 
            value={filtroLocalizacao} 
            onChange={(e) => setFiltroLocalizacao(e.target.value)}
            className="bg-transparent outline-none py-3 text-xs uppercase font-bold cursor-pointer"
            style={{ color: 'var(--foreground)' }}
          >
            <option value="TODAS" style={{ backgroundColor: 'var(--background)' }}>Todas Localizações</option>
            {listaLocalizacoes.map(loc => (
              <option key={loc.id} value={loc.nome} style={{ backgroundColor: 'var(--background)' }}>{loc.nome}</option>
            ))}
          </select>
        </div>

        <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2 lg:pb-0 font-mono">
          {['TODOS', 'OPERACIONAL', 'OFICINA', 'INATIVO'].map((st) => (
            <button
              key={st}
              onClick={() => setFiltroStatus(st)}
              className="px-4 py-3 text-xs font-bold uppercase tracking-widest border whitespace-nowrap transition-all"
              style={{
                backgroundColor: filtroStatus === st ? `${primary}15` : 'var(--background-secondary)',
                borderColor: filtroStatus === st ? primary : 'var(--border)',
                color: filtroStatus === st ? primary : 'var(--foreground-muted)',
                clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))'
              }}
            >
              {st === 'OPERACIONAL' ? 'ATIVO' : st}
            </button>
          ))}
        </div>
      </div>

      {/* ─── BARRA DE AÇÕES EM LOTE (quando houver selecionados) ─── */}
      <AnimatePresence>
        {selecionados.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border p-4 flex items-center justify-between gap-4 relative"
            style={{ backgroundColor: `${primary}15`, borderColor: primary }}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelecionarTodos}
                  className="p-2 border rounded transition-all hover:bg-white/10"
                  style={{ borderColor: primary }}
                >
                  {selecionados.size === veiculosFiltrados.length ? (
                    <Check size={18} style={{ color: primary }} />
                  ) : (
                    <span className="text-xs font-bold" style={{ color: primary }}>✓</span>
                  )}
                </button>
                <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                  {selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}
                </span>
              </div>
              <span className="text-xs text-foreground-muted">—</span>
              <span className="text-xs font-bold text-foreground-muted">AÇÕES EM LOTE:</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <motion.div className="relative">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setModalAcoesAbertoId(modalAcoesAbertoId ? null : 'status')}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase border rounded transition-all"
                  style={{ borderColor: primary, color: primary, backgroundColor: 'transparent' }}
                >
                  <Zap size={14} /> Alterar Status
                </motion.button>

                <AnimatePresence>
                  {modalAcoesAbertoId === 'status' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute top-full right-0 mt-2 border z-50 font-mono text-xs"
                      style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}
                    >
                      {['OPERACIONAL', 'OFICINA', 'INATIVO'].map((st) => (
                        <button
                          key={st}
                          onClick={() => {
                            handleAlterarStatusEmLote(st as StatusVeiculo)
                            setModalAcoesAbertoId(null)
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-white/10 border-b last:border-b-0 font-bold uppercase"
                          style={{ borderColor: 'var(--border)', color: st === 'OPERACIONAL' ? '#22c55e' : st === 'OFICINA' ? '#eab308' : '#a1a1aa' }}
                        >
                          {st === 'OPERACIONAL' ? '● OPERACIONAL' : st === 'OFICINA' ? '● OFICINA' : '● INATIVO'}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setConfirmandoExclusaoEmLote(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase border rounded transition-all text-red-400"
                style={{ borderColor: 'currentColor' }}
              >
                <Trash2 size={14} /> Excluir Selecionados
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelecionados(new Set())}
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase border rounded transition-all text-foreground-muted hover:text-foreground"
                style={{ borderColor: 'var(--border)' }}
              >
                <X size={14} /> Limpar Seleção
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── CONFIRMAÇÃO DE EXCLUSÃO EM LOTE ─── */}
      <AnimatePresence>
        {confirmandoExclusaoEmLote && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              className="border p-6 max-w-sm w-full space-y-4"
              style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
            >
              <h3 className="text-sm font-bold uppercase flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                <AlertCircle size={18} style={{ color: '#ef4444' }} /> Confirmar Exclusão em Lote
              </h3>
              <p className="text-xs text-foreground-muted">
                Você está prestes a excluir <span className="font-bold text-foreground">{selecionados.size} veículo(s)</span> da frota. Esta ação é irreversível.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmandoExclusaoEmLote(false)}
                  className="px-4 py-2 text-xs font-bold uppercase border transition-all hover:bg-white/5"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExcluirEmLote}
                  className="px-4 py-2 text-xs font-bold uppercase text-black transition-all hover:opacity-80"
                  style={{ backgroundColor: '#ef4444' }}
                >
                  Sim, Excluir Todos
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── GRID DE CARDS GAMIFICADOS ─── */}
      {veiculosFiltrados.length === 0 ? (
        <div className="text-center py-12 border rounded-sm" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
          <Truck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-bold text-foreground-muted">Nenhum veículo encontrado com os filtros aplicados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {veiculosFiltrados.map((v, idx) => {
              const isSelected = selecionados.has(v.id)
              const statusColor = v.status === 'OPERACIONAL' ? '#22c55e' : v.status === 'OFICINA' ? '#eab308' : '#a1a1aa'
              const statusIcon = v.status === 'OPERACIONAL' ? '●' : v.status === 'OFICINA' ? '⚠' : '○'

              return (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleToggleSelecionado(v.id)}
                  className="border p-4 cursor-pointer relative transition-all group"
                  style={{
                    backgroundColor: isSelected ? `${primary}20` : 'var(--background-secondary)',
                    borderColor: isSelected ? primary : 'var(--border)',
                    boxShadow: isSelected ? `0 0 20px ${primary}30` : 'none',
                    clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))'
                  }}
                >
                  {/* Checkbox no canto superior esquerdo */}
                  <div className="absolute top-2 left-2 w-5 h-5 border rounded-sm flex items-center justify-center transition-all" 
                    style={{ 
                      backgroundColor: isSelected ? primary : 'transparent',
                      borderColor: isSelected ? primary : 'var(--border)',
                      color: isSelected ? '#000' : 'transparent'
                    }}
                  >
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </div>

                  {/* Menu de ações no canto superior direito */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuAcoesAberto(menuAcoesAberto === v.id ? null : v.id)
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    <MoreVertical size={16} />
                  </button>

                  {/* Menu Dropdown */}
                  <AnimatePresence>
                    {menuAcoesAberto === v.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute top-8 right-0 w-48 border shadow-lg z-30 font-mono text-xs"
                        style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            handleAbrirEditar(v)
                            setMenuAcoesAberto(null)
                          }}
                          className="w-full px-3 py-2 hover:bg-white/5 flex items-center gap-2 text-foreground border-b"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <Pencil size={14} /> Editar
                        </button>
                        <Link
                          href={`/dashboard/empresa/frota/manutencao?placa=${v.placa}`}
                          onClick={() => setMenuAcoesAberto(null)}
                          className="w-full px-3 py-2 hover:bg-white/5 flex items-center gap-2 text-foreground border-b block"
                          style={{ borderColor: 'var(--border)', color: primary }}
                        >
                          <Bell size={14} /> Manutenção
                        </Link>
                        <button
                          onClick={() => {
                            setExcluindoId(v.id)
                            setMenuAcoesAberto(null)
                          }}
                          className="w-full px-3 py-2 hover:bg-red-500/10 text-red-400 flex items-center gap-2"
                        >
                          <Trash2 size={14} /> Apagar
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Conteúdo do Card */}
                  <div className="pt-2 space-y-3">
                    {/* Cabeçalho: Modelo + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <div className="w-8 h-8 rounded-full border flex items-center justify-center shrink-0 mt-0.5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: primary }}>
                          <Truck size={16} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm uppercase truncate" style={{ color: 'var(--foreground)' }}>
                            {v.modelo}
                          </h4>
                          <p className="text-[10px] text-foreground-muted">{v.tipo} • {v.ano}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-bold px-2 py-1 border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
                          {v.placa}
                        </div>
                      </div>
                    </div>

                    {/* Status Operacional com Selector */}
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-foreground-muted">Estado:</label>
                      <select
                        value={v.status}
                        onChange={(e) => {
                          handleAlterarStatusRapido(v.id, e.target.value as StatusVeiculo)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-1.5 text-[11px] font-bold uppercase border bg-transparent outline-none cursor-pointer"
                        style={{
                          borderColor: statusColor,
                          color: statusColor
                        }}
                      >
                        <option value="OPERACIONAL">● OPERACIONAL</option>
                        <option value="OFICINA">⚠ OFICINA</option>
                        <option value="INATIVO">○ INATIVO</option>
                      </select>
                    </div>

                    {/* Informações do Veículo */}
                    <div className="space-y-1.5 text-[10px] border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex justify-between items-center">
                        <span className="text-foreground-muted">Quilometragem:</span>
                        <span className="font-bold">{v.quilometragem.toLocaleString('pt-BR')} km</span>
                      </div>
                      {v.localizacao && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-foreground-muted">Base:</span>
                          <span className="font-bold text-right truncate" style={{ color: primary }}>{v.localizacao}</span>
                        </div>
                      )}
                      {v.motoristaAtual && v.motoristaAtual !== 'Sem Atribuição' && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-foreground-muted">Motorista:</span>
                          <span className="font-bold text-right truncate">{v.motoristaAtual}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ─── CONFIRMAÇÃO DE EXCLUSÃO INDIVIDUAL ─── */}
      <AnimatePresence>
        {excluindoId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              className="border p-6 max-w-sm w-full space-y-4"
              style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
            >
              <h3 className="text-sm font-bold uppercase flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                <AlertCircle size={18} style={{ color: '#ef4444' }} /> Confirmar Exclusão
              </h3>
              <p className="text-xs text-foreground-muted">
                Tem certeza que deseja remover este veículo da frota? Esta ação é irreversível.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setExcluindoId(null)}
                  className="px-4 py-2 text-xs font-bold uppercase border transition-all hover:bg-white/5"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleConfirmarExclusao(excluindoId)}
                  className="px-4 py-2 text-xs font-bold uppercase text-black transition-all hover:opacity-80"
                  style={{ backgroundColor: '#ef4444' }}
                >
                  Sim, Apagar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── DRAWER LATERAL (KEY FORÇA RE-RENDER COM OS DADOS CARREGADOS) ─── */}
      <GenericDrawer
        key={veiculoParaEditar ? veiculoParaEditar.id : 'novo-veiculo'}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setVeiculoParaEditar(null)
        }}
        titulo={veiculoParaEditar ? `EDITAR VEÍCULO (${veiculoParaEditar.placa})` : "CADASTRAR VEÍCULO NA FROTA"}
        subtitulo={veiculoParaEditar ? "Modifique os dados operacionais e o pátio do caminhão." : "Adicione um novo caminhão ao catálogo."}
        errorMessage={feedback}
        campos={camposFrotaDinamicos}
        initialValues={veiculoParaEditar ? {
          modelo: veiculoParaEditar.modelo,
          placa: veiculoParaEditar.placa,
          ano: veiculoParaEditar.ano,
          tipo: veiculoParaEditar.tipo,
          quilometragem: veiculoParaEditar.quilometragem,
          localizacao: veiculoParaEditar.localizacaoId || listaLocalizacoes[0]?.id || '',
          status: veiculoParaEditar.status
        } : undefined}
        onSubmit={handleSalvarVeiculo}
      />

    </div>
  )
}

// ─── COMPONENTE AUXILIAR: BOTÃO SECUNDÁRIO DO CABEÇALHO ─────────────────────
// Mesmo corte de canto (clipPath) e ritmo vertical do botão primário
// "Cadastrar Veículo", só que em versão outline — mantém a mesma família
// visual entre ação principal e ações de apoio (Bases & Pátios, Manutenções).
function BotaoSecundarioFrota({ href, icone, label, primary }: { href: string, icone: React.ReactNode, label: string, primary: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-5 py-3 text-xs font-mono font-bold uppercase tracking-widest border transition-all hover:scale-[1.02] active:scale-[0.98] hover:bg-white/5 cursor-pointer"
      style={{
        borderColor: 'var(--border)',
        color: 'var(--foreground)',
        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
      }}
    >
      <span style={{ color: primary }}>{icone}</span> {label}
    </Link>
  )
}
