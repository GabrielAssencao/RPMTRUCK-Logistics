'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import { MapPin, Plus, ArrowLeft, Pencil, Trash2, CheckCircle2 } from 'lucide-react'

export interface LocalizacaoBase {
  id: string
  nome: string
  cidadeUF: string
  capacidade: number
}

export default function LocalizacoesPage() {
  const { primary } = useTheme()
  const [montado, setMontado] = useState(false)

  const [localizacoes, setLocalizacoes] = useState<LocalizacaoBase[]>([])
  const [feedback, setFeedback] = useState('')

  // Modal para Criar/Editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  const [form, setForm] = useState({ nome: '', cidadeUF: '', capacidade: '' })

  useEffect(() => {
    setMontado(true)
    fetch('/api/localizacoes', { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.erro); setLocalizacoes(data) }).catch(error => setFeedback(error instanceof Error ? error.message : 'Falha ao carregar bases.'))
  }, [])

  if (!montado) return null

  const handleAbrirNovo = () => {
    setEditandoId(null)
    setForm({ nome: '', cidadeUF: '', capacidade: '10' })
    setModalOpen(true)
  }

  const handleAbrirEditar = (loc: LocalizacaoBase) => {
    setEditandoId(loc.id)
    setForm({ nome: loc.nome, cidadeUF: loc.cidadeUF, capacidade: String(loc.capacidade) })
    setModalOpen(true)
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()

    const response = await fetch(editandoId ? `/api/localizacoes/${editandoId}` : '/api/localizacoes', { method: editandoId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, capacidade: Number(form.capacidade) }) })
    const data = await response.json()
    if (!response.ok) return setFeedback(data.erro || 'Não foi possível salvar a base.')
    setLocalizacoes(prev => editandoId ? prev.map(item => item.id === editandoId ? data : item) : [data, ...prev])
    setModalOpen(false)
  }

  const handleExcluir = async (id: string) => {
    const response = await fetch(`/api/localizacoes/${id}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) return setFeedback(data.erro || 'Não foi possível excluir a base.')
    setLocalizacoes(prev => prev.filter(l => l.id !== id))
    setExcluindoId(null)
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto font-mono">
      {feedback && <div role="status" className="border p-3 text-sm" style={{ borderColor: primary, color: primary }}>{feedback}</div>}
      
      {/* ─── CABEÇALHO ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Link href="/dashboard/empresa/frota" className="inline-flex items-center gap-2 text-xs text-foreground-muted hover:text-foreground mb-2">
            <ArrowLeft size={14} /> Voltar para o Catálogo da Frota
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-tight font-rajdhani" style={{ color: 'var(--foreground)' }}>
            Cadastro de <span style={{ color: primary }}>Bases & Localizações</span>
          </h1>
          <p className="text-sm mt-1 text-foreground-muted">
            Cadastre os pátios e garagens que servirão de opção no cadastro e edição da frota.
          </p>
        </div>

        <motion.button 
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handleAbrirNovo}
          className="flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all text-black font-extrabold"
          style={{ 
            backgroundColor: primary,
            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
          }}
        >
          <Plus size={16} /> Cadastrar Nova Base
        </motion.button>
      </div>

      {/* ─── TABELA DE LOCALIZAÇÕES ─── */}
      <div className="border overflow-hidden relative" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="p-4 border-b font-bold text-xs uppercase flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
          <span>Pátios e Garantias Registrados</span>
          <span className="text-[10px] text-foreground-muted">{localizacoes.length} Base(s)</span>
        </div>

        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead style={{ backgroundColor: 'var(--background)', color: 'var(--foreground-muted)' }}>
            <tr className="text-[10px] uppercase tracking-widest border-b" style={{ borderColor: 'var(--border)' }}>
              <th className="px-6 py-4">Nome da Base / Pátio</th>
              <th className="px-6 py-4">Cidade / UF</th>
              <th className="px-6 py-4">Capacidade de Vagas</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y [&>tr]:border-[var(--border)]" style={{ color: 'var(--foreground)' }}>
            <AnimatePresence>
              {localizacoes.map((loc) => (
                <tr key={loc.id} className="hover:bg-white/5 transition-colors font-mono">
                  <td className="px-6 py-4 font-bold text-xs flex items-center gap-2">
                    <MapPin size={14} style={{ color: primary }} />
                    {loc.nome}
                  </td>
                  <td className="px-6 py-4 text-xs">{loc.cidadeUF}</td>
                  <td className="px-6 py-4 text-xs font-bold">{loc.capacidade} Vagas</td>

                  <td className="px-6 py-4 text-right">
                    {excluindoId === loc.id ? (
                      <div className="inline-flex items-center gap-2 p-1 border bg-red-500/10 text-red-400 border-red-500/30 font-bold text-[10px]">
                        <span>Excluir?</span>
                        <button onClick={() => handleExcluir(loc.id)} className="px-2 py-0.5 bg-red-500 text-black font-extrabold uppercase hover:bg-red-600">Sim</button>
                        <button onClick={() => setExcluindoId(null)} className="px-2 py-0.5 border border-white/20 text-white hover:bg-white/10">Não</button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleAbrirEditar(loc)} className="p-1.5 text-foreground-muted hover:text-foreground">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setExcluindoId(loc.id)} className="p-1.5 text-red-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* ─── MODAL DE CADASTRO/EDIÇÃO DE LOCALIZAÇÃO ─── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="w-full max-w-md border p-6 font-mono space-y-4" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-bold uppercase">{editandoId ? 'Editar Base' : 'Cadastrar Nova Base'}</h3>
              <button onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSalvar} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">Nome Identificador *</label>
                <input type="text" required placeholder="Ex: Santos - SP ou Garagem Central" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full p-2.5 border bg-transparent outline-none" style={{ borderColor: 'var(--border)' }} />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">Cidade / UF *</label>
                <input type="text" required placeholder="Ex: Santos / SP" value={form.cidadeUF} onChange={e => setForm({...form, cidadeUF: e.target.value})} className="w-full p-2.5 border bg-transparent outline-none" style={{ borderColor: 'var(--border)' }} />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">Capacidade de Vagas</label>
                <input type="number" required placeholder="Ex: 20" value={form.capacidade} onChange={e => setForm({...form, capacidade: e.target.value})} className="w-full p-2.5 border bg-transparent outline-none" style={{ borderColor: 'var(--border)' }} />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border uppercase">Cancelar</button>
                <button type="submit" className="px-5 py-2 uppercase font-bold text-black" style={{ backgroundColor: primary }}>Salvar Base</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  )
}
