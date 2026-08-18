'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import { ArrowLeft, Upload, CheckCircle2, User } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function NovoMotoristaPage() {
  const { primary } = useTheme()
  const router = useRouter()

  const [nomeCompleto, setNomeCompleto] = useState('')
  const [cpf, setCpf] = useState('')
  const [rg, setRg] = useState('')
  const [cnh, setCnh] = useState('')
  const [categoriaCNH, setCategoriaCNH] = useState('D')
  const [validadeCNH, setValidadeCNH] = useState('')
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)

  const abreviarNome = (nome: string) => {
    if (!nome.trim()) return 'NOME DO CONDUTOR'
    const partes = nome.trim().split(' ')
    if (partes.length === 1) return partes[0].toUpperCase()
    return `${partes[0]} ${partes[partes.length - 1]}`.toUpperCase()
  }

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setFotoUrl(url)
    }
  }

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault()
    alert('Motorista cadastrado com sucesso!')
    router.push('/dashboard/empresa/motoristas')
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto font-mono">
      
      {/* ─── CABEÇALHO ─── */}
      <div>
        <Link href="/dashboard/empresa/motoristas" className="inline-flex items-center gap-2 text-xs text-foreground-muted hover:text-foreground mb-2">
          <ArrowLeft size={14} /> Voltar para o Centro de Motoristas
        </Link>
        <h1 className="text-3xl font-black uppercase tracking-tight font-rajdhani" style={{ color: 'var(--foreground)' }}>
          Cadastrar <span style={{ color: primary }}>Novo Condutor</span>
        </h1>
        <p className="text-sm mt-1 text-foreground-muted">
          Preencha os dados abaixo. O documento digital do motorista é gerado em tempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ─── FORMULÁRIO DE CADASTRO ─── */}
        <form onSubmit={handleSalvar} className="lg:col-span-7 border p-6 space-y-4" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
          <h3 className="text-xs font-bold uppercase tracking-widest pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            Dados Cadastrais do Motorista
          </h3>

          <div>
            <label className="block text-[10px] uppercase font-bold mb-1">Nome Completo *</label>
            <input 
              type="text" 
              required
              placeholder="Ex: Carlos Eduardo Silva Santos"
              value={nomeCompleto}
              onChange={(e) => setNomeCompleto(e.target.value)}
              className="w-full p-2.5 border bg-transparent outline-none text-xs"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold mb-1">CPF *</label>
              <input 
                type="text" 
                required
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                className="w-full p-2.5 border bg-transparent outline-none text-xs"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold mb-1">RG (Opcional)</label>
              <input 
                type="text" 
                placeholder="00.000.000-0"
                value={rg}
                onChange={(e) => setRg(e.target.value)}
                className="w-full p-2.5 border bg-transparent outline-none text-xs"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-[10px] uppercase font-bold mb-1">Nº CNH *</label>
              <input 
                type="text" 
                required
                placeholder="12345678900"
                value={cnh}
                onChange={(e) => setCnh(e.target.value)}
                className="w-full p-2.5 border bg-transparent outline-none text-xs"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold mb-1">Categoria *</label>
              <select 
                value={categoriaCNH}
                onChange={(e) => setCategoriaCNH(e.target.value)}
                className="w-full p-2.5 border bg-transparent outline-none text-xs cursor-pointer"
                style={{ borderColor: 'var(--border)' }}
              >
                <option value="C" style={{ backgroundColor: 'var(--background)' }}>Cat. C</option>
                <option value="D" style={{ backgroundColor: 'var(--background)' }}>Cat. D</option>
                <option value="E" style={{ backgroundColor: 'var(--background)' }}>Cat. E</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold mb-1">Validade CNH *</label>
              <input 
                type="date" 
                required
                value={validadeCNH}
                onChange={(e) => setValidadeCNH(e.target.value)}
                className="w-full p-2.5 border bg-transparent outline-none text-xs"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold mb-1">Foto de Perfil (Padronizado 3x4 / Opcional)</label>
            <div className="flex items-center gap-3 border p-3" style={{ borderColor: 'var(--border)' }}>
              <input type="file" accept="image/*" onChange={handleFotoUpload} className="hidden" id="foto-upload" />
              <label htmlFor="foto-upload" className="px-3 py-1.5 border text-[10px] uppercase font-bold cursor-pointer hover:bg-white/5 flex items-center gap-1.5" style={{ borderColor: primary, color: primary }}>
                <Upload size={12} /> Selecionar Foto
              </label>
              <span className="text-[10px] text-foreground-muted">{fotoUrl ? 'Foto anexada' : 'Nenhuma imagem selecionada'}</span>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button type="submit" className="px-6 py-3 text-xs uppercase font-bold text-black flex items-center gap-2" style={{ backgroundColor: primary }}>
              <CheckCircle2 size={16} /> Finalizar Cadastro
            </button>
          </div>
        </form>

        {/* ─── CREDENCIAL COM DIMENSÃO PADRÃO 3x4 ─── */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-bold uppercase text-foreground-muted">Pré-visualização da Credencial Digital</div>
          
          <div 
            className="border p-5 relative overflow-hidden space-y-4 shadow-xl"
            style={{ 
              backgroundColor: 'var(--background)', 
              borderColor: primary,
              clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))'
            }}
          >
            <div className="flex justify-between items-start border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-foreground-muted">Carteira Nacional de Habilitação</div>
                <div className="text-sm font-black font-rajdhani uppercase text-foreground">{abreviarNome(nomeCompleto)}</div>
              </div>
              <span className="px-2 py-1 text-[10px] font-bold border" style={{ borderColor: primary, color: primary }}>
                CAT. {categoriaCNH}
              </span>
            </div>

            <div className="flex gap-4 items-center">
              {/* 📸 Moldura Trava 3x4 (w-24 h-32 = 96px x 128px) */}
              <div className="w-24 h-32 border flex items-center justify-center shrink-0 overflow-hidden relative" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
                {fotoUrl ? (
                  <img src={fotoUrl} alt="Motorista" className="w-full h-full object-cover" />
                ) : (
                  <User size={36} className="text-foreground-muted" />
                )}
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div>
                  <span className="text-foreground-muted text-[9px] uppercase block">CPF</span>
                  <span className="font-bold">{cpf || '---.---.---'}</span>
                </div>
                <div>
                  <span className="text-foreground-muted text-[9px] uppercase block">Nº CNH</span>
                  <span className="font-bold">{cnh || '------------'}</span>
                </div>
                <div>
                  <span className="text-foreground-muted text-[9px] uppercase block">Validade CNH</span>
                  <span className="font-bold">{validadeCNH || 'AAAA-MM-DD'}</span>
                </div>
              </div>
            </div>

            <div className="text-[8px] uppercase text-foreground-muted border-t pt-2 flex justify-between" style={{ borderColor: 'var(--border)' }}>
              <span>RPM TRUCK SYSTEM</span>
              <span>DOCUMENTO VERIFICADO</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}