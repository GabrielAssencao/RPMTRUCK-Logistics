'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import { useContainers } from '@/contexts/ContainersContext'
import { 
  Users, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Truck, 
  GripVertical,
  Unlink,
  Trash2,
  User,
  Percent
} from 'lucide-react'
import Link from 'next/link'

interface VeiculoCompleto {
  id: string
  modelo: string
  placa: string
  tipo: string
  kmAtual: number
  motoristaVinculadoId?: string
}

interface MotoristaCard {
  id: string
  nomeAbreviado: string
  cpf: string
  cnh: string
  categoria: string
  validadeCNH: string
  fotoUrl?: string
  veiculoIdVinculado?: string
}

export default function MotoristasPage() {
  const { primary } = useTheme()
  const { containers } = useContainers()
  const [montado, setMontado] = useState(false)

  // Lista de Veículos
  const [veiculos, setVeiculos] = useState<VeiculoCompleto[]>([])
  const [motoristas, setMotoristas] = useState<MotoristaCard[]>([])
  const [feedback, setFeedback] = useState('')

  // Carrossel e Drag/Drop
  const [indexCarrossel, setIndexCarrossel] = useState(0)
  const [draggedMotoristaId, setDraggedMotoristaId] = useState<string | null>(null)
  const [hoveredVeiculoId, setHoveredVeiculoId] = useState<string | null>(null)

  // Estado para confirmação de exclusão rápida
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  useEffect(() => {
    setMontado(true)
    fetch('/api/motoristas', { cache: 'no-store' }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.erro)
      setMotoristas(data.motoristas.map((m: any) => ({ id: m.id, nomeAbreviado: m.nome, cpf: m.cpf || 'Não informado', cnh: m.cnh, categoria: m.categoria, validadeCNH: String(m.validade).slice(0, 10), fotoUrl: m.foto_url || undefined, veiculoIdVinculado: m.veiculoId || undefined })))
      setVeiculos(data.veiculos.map((v: any) => ({ id: v.id, modelo: v.modelo, placa: v.placa, tipo: v.tipo, kmAtual: v.quilometragem, motoristaVinculadoId: v.motoristas?.[0]?.id })))
    }).catch(error => setFeedback(error instanceof Error ? error.message : 'Falha ao carregar motoristas.'))
  }, [])

  if (!montado) return null

  // Comissão calculada pelos vínculos relacionais persistidos no banco.
  const obterComissaoDoMotorista = (motoristaId: string) => {
    const containersDoMotorista = containers.filter(c => c.motoristaId === motoristaId && c.status !== 'CANCELADO')

    const recebida = containersDoMotorista
      .filter(c => c.status === 'ENTREGUE')
      .reduce((acc, c) => acc + c.comissao, 0)

    const aReceber = containersDoMotorista
      .filter(c => c.status !== 'ENTREGUE')
      .reduce((acc, c) => acc + c.comissao, 0)

    return { recebida, aReceber, temVinculo: containersDoMotorista.length > 0 }
  }

  // Motoristas sem veículo para o deck de cartas
  const motoristasSemVeiculo = motoristas.filter(m => !m.veiculoIdVinculado)

  // Controles do Carrossel
  const handleAnterior = () => setIndexCarrossel(p => (p === 0 ? veiculos.length - 1 : p - 1))
  const handleProximo = () => setIndexCarrossel(p => (p === veiculos.length - 1 ? 0 : p + 1))

  // Drag and Drop
  const handleDropNoVeiculo = async (veiculoId: string) => {
    if (!draggedMotoristaId) return

    const response = await fetch(`/api/motoristas/${draggedMotoristaId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ veiculoId }) })
    const data = await response.json()
    if (!response.ok) return setFeedback(data.erro || 'Não foi possível vincular o motorista.')

    setMotoristas(prev => prev.map(m => {
      if (m.id === draggedMotoristaId) return { ...m, veiculoIdVinculado: veiculoId }
      if (m.veiculoIdVinculado === veiculoId) return { ...m, veiculoIdVinculado: undefined }
      return m
    }))

    setVeiculos(prev => prev.map(v => {
      if (v.id === veiculoId) return { ...v, motoristaVinculadoId: draggedMotoristaId }
      if (v.motoristaVinculadoId === draggedMotoristaId) return { ...v, motoristaVinculadoId: undefined }
      return v
    }))

    setDraggedMotoristaId(null)
    setHoveredVeiculoId(null)
  }

  const handleDesvincular = async (motoristaId: string) => {
    const response = await fetch(`/api/motoristas/${motoristaId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ veiculoId: null }) })
    if (!response.ok) return setFeedback('Não foi possível desvincular o motorista.')
    setMotoristas(prev => prev.map(m => m.id === motoristaId ? { ...m, veiculoIdVinculado: undefined } : m))
    setVeiculos(prev => prev.map(v => v.motoristaVinculadoId === motoristaId ? { ...v, motoristaVinculadoId: undefined } : v))
  }

  // Exclusão definitiva de condutor
  const handleConfirmarExclusao = async (motoristaId: string) => {
    const response = await fetch(`/api/motoristas/${motoristaId}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) return setFeedback(data.erro || 'Não foi possível excluir o motorista.')
    setMotoristas(prev => prev.filter(m => m.id !== motoristaId))
    setExcluindoId(null)
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-mono">
      {feedback && <div role="status" className="border p-3 text-sm" style={{ borderColor: primary, color: primary }}>{feedback}</div>}
      
      {/* ─── CABEÇALHO ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight font-rajdhani" style={{ color: 'var(--foreground)' }}>
            Centro de <span style={{ color: primary }}>Motoristas & Validação</span>
          </h1>
          <p className="text-sm mt-1 text-foreground-muted">
            Arraste a carta do condutor para vincular diretamente ao veículo desejado.
          </p>
        </div>

        <Link
          href="/dashboard/empresa/motoristas/novo"
          className="flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all text-black shrink-0"
          style={{ 
            backgroundColor: primary,
            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
          }}
        >
          <Plus size={16} /> Cadastrar Condutor
        </Link>
      </div>

      {/* ─── 1. CARROSSEL SUPERIOR DE VEÍCULOS (DROP ZONES) ─── */}
      <div className="border p-4 relative" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
        <div className="flex justify-between items-center mb-3 text-[10px] uppercase font-bold text-foreground-muted tracking-widest">
          <span>Estações de Atribuição (Solte o Motorista no Caminhão Escolhido):</span>
          <span>{veiculos.length} Ativos na Frota</span>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleAnterior} className="p-2 border rounded-sm hover:bg-white/10 shrink-0" style={{ borderColor: 'var(--border)' }}>
            <ChevronLeft size={20} />
          </button>

          <div className="flex-1 overflow-x-auto hide-scrollbar flex gap-4 py-2">
            {veiculos.map((v) => {
              const motoristaVinculado = motoristas.find(m => m.id === v.motoristaVinculadoId)
              const isHovered = hoveredVeiculoId === v.id

              return (
                <div
                  key={v.id}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setHoveredVeiculoId(v.id)
                  }}
                  onDragLeave={() => setHoveredVeiculoId(null)}
                  onDrop={() => handleDropNoVeiculo(v.id)}
                  className="min-w-[320px] max-w-[320px] border p-4 transition-all relative flex flex-col justify-between"
                  style={{
                    backgroundColor: isHovered ? `${primary}20` : 'var(--background)',
                    borderColor: isHovered ? primary : 'var(--border)',
                    boxShadow: isHovered ? `0 0 15px ${primary}40` : 'none',
                    clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
                  }}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-sm uppercase flex items-center gap-1.5 font-rajdhani" style={{ color: primary }}>
                        <Truck size={16} /> {v.modelo}
                      </div>
                      <span className="text-[10px] px-2 py-0.5 border font-bold" style={{ borderColor: 'var(--border)' }}>
                        {v.placa}
                      </span>
                    </div>

                    <div className="text-[10px] text-foreground-muted space-y-1 mb-4">
                      <div>Tipo: <span className="text-foreground font-bold">{v.tipo}</span></div>
                      <div>Odômetro: <span className="text-foreground font-bold">{v.kmAtual.toLocaleString('pt-BR')} KM</span></div>
                    </div>
                  </div>

                  {/* Slot do Motorista no Veículo */}
                  <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-[9px] uppercase font-bold text-foreground-muted mb-1">Condutor Designado:</div>
                    
                    {motoristaVinculado ? (
                      <div className="flex justify-between items-center p-2 border bg-white/5" style={{ borderColor: primary }}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 border rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-black/20" style={{ borderColor: 'var(--border)' }}>
                            {motoristaVinculado.fotoUrl ? (
                              <img src={motoristaVinculado.fotoUrl} alt={motoristaVinculado.nomeAbreviado} className="w-full h-full object-cover" />
                            ) : (
                              <User size={14} className="text-foreground-muted" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-xs" style={{ color: primary }}>{motoristaVinculado.nomeAbreviado}</div>
                            <div className="text-[9px] text-foreground-muted">Cat. {motoristaVinculado.categoria}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDesvincular(motoristaVinculado.id)}
                          className="p-1 text-red-400 hover:text-red-500" 
                          title="Remover Vínculo"
                        >
                          <Unlink size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="border border-dashed p-2 text-center text-[10px] text-foreground-muted italic">
                        Arrastar motorista até aqui...
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <button onClick={handleProximo} className="p-2 border rounded-sm hover:bg-white/10 shrink-0" style={{ borderColor: 'var(--border)' }}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* ─── 2. DECK DE CARTAS DE MOTORISTAS DISPONÍVEIS (COM FOTO) ─── */}
      <div className="border p-4 space-y-3" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
        <div className="text-[10px] uppercase font-bold text-foreground-muted tracking-widest flex items-center gap-2">
          <GripVertical size={14} style={{ color: primary }} /> Motoristas Livres / Disponíveis (Arraste a Carta):
        </div>

        <div className="flex overflow-x-auto hide-scrollbar gap-4 py-2">
          {motoristasSemVeiculo.length === 0 ? (
            <div className="text-xs text-foreground-muted italic py-4">Todos os motoristas cadastrados já estão vinculados a um caminhão.</div>
          ) : (
            motoristasSemVeiculo.map((m) => (
              <motion.div
                key={m.id}
                draggable
                onDragStart={() => setDraggedMotoristaId(m.id)}
                onDragEnd={() => setDraggedMotoristaId(null)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="min-w-[240px] max-w-[240px] border p-3 cursor-grab active:cursor-grabbing relative transition-all"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
                }}
              >
                {/* Cabeçalho da Carta com Foto / Avatar */}
                <div className="flex items-center gap-3 mb-3 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                  {/* Moldura 3x4 Pequena da Foto */}
                  <div className="w-10 h-12 border overflow-hidden shrink-0 flex items-center justify-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
                    {m.fotoUrl ? (
                      <img src={m.fotoUrl} alt={m.nomeAbreviado} className="w-full h-full object-cover" />
                    ) : (
                      <User size={20} className="text-foreground-muted" />
                    )}
                  </div>

                  <div className="overflow-hidden">
                    <div className="font-bold text-xs uppercase text-foreground truncate">{m.nomeAbreviado}</div>
                    <span className="text-[9px] px-1.5 py-0.5 border font-bold inline-block mt-0.5" style={{ borderColor: primary, color: primary }}>
                      CAT. {m.categoria}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] space-y-1 text-foreground-muted mb-3">
                  <div>CPF: <span className="text-foreground">{m.cpf}</span></div>
                  <div>CNH: <span className="text-foreground">{m.cnh}</span></div>
                  <div>Validade: <span className="text-foreground font-bold">{m.validadeCNH}</span></div>
                </div>

                <div className="text-[9px] uppercase font-bold text-center border-t pt-2 text-foreground-muted flex items-center justify-center gap-1" style={{ borderColor: 'var(--border)' }}>
                  <GripVertical size={12} /> ARRASTE PARA VINCULAR
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* ─── 3. TABELA GERAL COM COMISSÃO DE CONTAINERS ─── */}
      <div className="border overflow-hidden relative" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="p-4 border-b font-bold text-xs uppercase flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
          <span>Tabela Geral de Condutores</span>
          <span className="text-[10px] text-foreground-muted">{motoristas.length} Registrado(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead style={{ backgroundColor: 'var(--background)', color: 'var(--foreground-muted)' }}>
              <tr className="text-[10px] uppercase tracking-widest border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="px-6 py-4">Condutor</th>
                <th className="px-6 py-4">CPF / CNH</th>
                <th className="px-6 py-4">Categoria CNH</th>
                <th className="px-6 py-4">Validade CNH</th>
                <th className="px-6 py-4">Veículo Vinculado</th>
                <th className="px-6 py-4">Comissão Recebida</th>
                <th className="px-6 py-4 text-right">Ação / Gerenciamento</th>
              </tr>
            </thead>
            <tbody className="divide-y [&>tr]:border-[var(--border)]" style={{ color: 'var(--foreground)' }}>
              {motoristas.map((m) => {
                const veiculoAfeito = veiculos.find(v => v.id === m.veiculoIdVinculado)
                const estaExcluindo = excluindoId === m.id
                const comissao = obterComissaoDoMotorista(m.id)

                return (
                  <tr key={m.id} className="hover:bg-white/5 transition-colors font-mono">
                    
                    {/* Condutor + Mini Foto */}
                    <td className="px-6 py-4 font-bold text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 border rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-black/20" style={{ borderColor: 'var(--border)' }}>
                          {m.fotoUrl ? (
                            <img src={m.fotoUrl} alt={m.nomeAbreviado} className="w-full h-full object-cover" />
                          ) : (
                            <User size={14} className="text-foreground-muted" />
                          )}
                        </div>
                        <span>{m.nomeAbreviado}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs">
                      <div>CPF: {m.cpf}</div>
                      <div className="text-[10px] text-foreground-muted">CNH: {m.cnh}</div>
                    </td>

                    <td className="px-6 py-4 text-xs font-bold">Cat. {m.categoria}</td>
                    <td className="px-6 py-4 text-xs font-bold">{m.validadeCNH}</td>

                    <td className="px-6 py-4 text-xs">
                      {veiculoAfeito ? (
                        <span className="font-bold text-green-500">{veiculoAfeito.modelo} ({veiculoAfeito.placa})</span>
                      ) : (
                        <span className="italic text-foreground-muted opacity-60">Nenhum veículo</span>
                      )}
                    </td>

                    {/* COMISSÃO — RECEBIDA (containers ENTREGUE) + A RECEBER (previsto) */}
                    <td className="px-6 py-4 text-xs">
                      {comissao.temVinculo ? (
                        <div>
                          <div className="font-bold text-green-500 flex items-center gap-1">
                            <Percent size={11} style={{ color: primary }} />
                            {comissao.recebida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                          {comissao.aReceber > 0 && (
                            <div className="text-[9px] text-foreground-muted mt-0.5">
                              +{comissao.aReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} a receber
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="italic text-foreground-muted opacity-60 text-[10px]">Sem containers vinculados</span>
                      )}
                    </td>

                    {/* COLUNA DE AÇÃO COM CONFIRMAÇÃO DE EXCLUSÃO INLINE */}
                    <td className="px-6 py-4 text-right">
                      {estaExcluindo ? (
                        /* Pop-up Inline de Confirmação */
                        <div className="inline-flex items-center gap-2 p-1.5 border bg-red-500/10 text-red-400 border-red-500/30 font-bold text-[10px]">
                          <span>Tem certeza que deseja excluir?</span>
                          <button 
                            onClick={() => handleConfirmarExclusao(m.id)}
                            className="px-2 py-0.5 bg-red-500 text-black font-extrabold uppercase hover:bg-red-600 transition-colors"
                          >
                            Sim
                          </button>
                          <button 
                            onClick={() => setExcluindoId(null)}
                            className="px-2 py-0.5 border border-white/20 text-white hover:bg-white/10 transition-colors"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        /* Botão Normal com Lixeira */
                        <div className="flex justify-end items-center gap-3">
                          {m.veiculoIdVinculado && (
                            <button 
                              onClick={() => handleDesvincular(m.id)}
                              className="text-[10px] font-bold uppercase text-foreground-muted hover:text-foreground"
                            >
                              Desvincular
                            </button>
                          )}
                          <button 
                            onClick={() => setExcluindoId(m.id)}
                            className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors rounded-sm"
                            title="Excluir Motorista"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
