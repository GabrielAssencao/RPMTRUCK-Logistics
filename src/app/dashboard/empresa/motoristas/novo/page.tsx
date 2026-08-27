'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { formatarCPF, formatarRG, somenteNumeros } from '@/utils/documentos'
import { ArrowLeft, Upload, CheckCircle2, User, X } from 'lucide-react'
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
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null)
  const [fotoInfo, setFotoInfo] = useState<{ largura: number; altura: number } | null>(null)
  const [fotoErro, setFotoErro] = useState('')
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const abreviarNome = (nome: string) => {
    if (!nome.trim()) return 'NOME DO CONDUTOR'
    const partes = nome.trim().split(' ')
    if (partes.length === 1) return partes[0].toUpperCase()
    return `${partes[0]} ${partes[partes.length - 1]}`.toUpperCase()
  }

  useEffect(() => {
    return () => {
      if (fotoUrl) URL.revokeObjectURL(fotoUrl)
    }
  }, [fotoUrl])

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFotoErro('')
    const formatosPermitidos = ['image/jpeg', 'image/png', 'image/webp']
    if (!formatosPermitidos.includes(file.type)) {
      setFotoErro('Formato permitido: JPG, PNG ou WebP.')
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setFotoErro('A foto deve ter no máximo 5 MB.')
      e.target.value = ''
      return
    }

    try {
      const dimensoes = await new Promise<{ largura: number; altura: number }>((resolve, reject) => {
        const urlTemporaria = URL.createObjectURL(file)
        const imagem = new Image()
        imagem.onload = () => {
          resolve({ largura: imagem.naturalWidth, altura: imagem.naturalHeight })
          URL.revokeObjectURL(urlTemporaria)
        }
        imagem.onerror = () => {
          reject(new Error('Imagem inválida'))
          URL.revokeObjectURL(urlTemporaria)
        }
        imagem.src = urlTemporaria
      })

      if (dimensoes.largura < 300 || dimensoes.altura < 400) {
        setFotoErro('Use uma foto vertical com pelo menos 300 × 400 pixels.')
        e.target.value = ''
        return
      }

      setFotoArquivo(file)
      setFotoInfo(dimensoes)
      setFotoUrl(URL.createObjectURL(file))
    } catch {
      setFotoErro('Não foi possível ler a imagem selecionada.')
      e.target.value = ''
    }
  }

  const removerFotoSelecionada = () => {
    setFotoArquivo(null)
    setFotoInfo(null)
    setFotoUrl(null)
    setFotoErro('')
    if (fotoInputRef.current) fotoInputRef.current.value = ''
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    const formData = new FormData()
    formData.set('nome', nomeCompleto)
    formData.set('cpf', somenteNumeros(cpf, 11))
    formData.set('rg', somenteNumeros(rg, 9))
    formData.set('cnh', cnh)
    formData.set('categoria', categoriaCNH)
    formData.set('validade', validadeCNH)
    formData.set('status', 'DISPONIVEL')
    if (fotoArquivo) formData.set('foto', fotoArquivo)

    const response = await fetch('/api/motoristas', { method: 'POST', body: formData })
    const data = await response.json()
    setSalvando(false)
    if (!response.ok) return setErro(data.erro || 'Não foi possível cadastrar o motorista.')
    router.push('/dashboard/empresa/motoristas')
    router.refresh()
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
          {erro && <div role="alert" className="border border-red-500/30 p-3 text-xs text-red-500">{erro}</div>}
          <h3 className="text-xs font-bold uppercase tracking-widest pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            Dados Cadastrais do Motorista
          </h3>

          <div>
            <label className="block text-[10px] uppercase font-bold mb-1">Nome Completo *</label>
            <input 
              type="text" 
              required
              maxLength={120}
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
                inputMode="numeric"
                pattern="[0-9]{3}[.][0-9]{3}[.][0-9]{3}-[0-9]{2}"
                maxLength={14}
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatarCPF(e.target.value))}
                aria-describedby="ajuda-cpf"
                className="w-full p-2.5 border bg-transparent outline-none text-xs"
                style={{ borderColor: 'var(--border)' }}
              />
              <p id="ajuda-cpf" className="mt-1 text-[9px] text-foreground-muted">11 números • pontos e traço são adicionados automaticamente</p>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold mb-1">RG (Opcional)</label>
              <input 
                type="text"
                inputMode="numeric"
                pattern="[0-9]{2}[.][0-9]{3}[.][0-9]{3}-[0-9]"
                maxLength={12}
                placeholder="00.000.000-0"
                value={rg}
                onChange={(e) => setRg(formatarRG(e.target.value))}
                aria-describedby="ajuda-rg"
                className="w-full p-2.5 border bg-transparent outline-none text-xs"
                style={{ borderColor: 'var(--border)' }}
              />
              <p id="ajuda-rg" className="mt-1 text-[9px] text-foreground-muted">9 números • formatação automática</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-[10px] uppercase font-bold mb-1">Nº CNH *</label>
              <input 
                type="text" 
                required
                inputMode="numeric"
                pattern="[0-9]{11}"
                maxLength={11}
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
            <div className="space-y-3 border p-3" style={{ borderColor: fotoErro ? '#ef4444' : 'var(--border)' }}>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={handleFotoUpload}
                  className="hidden"
                  id="foto-upload"
                  aria-describedby="orientacoes-foto"
                />
                <label htmlFor="foto-upload" className="px-3 py-1.5 border text-[10px] uppercase font-bold cursor-pointer hover:bg-white/5 flex items-center gap-1.5" style={{ borderColor: primary, color: primary }}>
                  <Upload size={12} /> {fotoArquivo ? 'Trocar foto' : 'Selecionar foto'}
                </label>
                {fotoArquivo && (
                  <button type="button" onClick={removerFotoSelecionada} className="px-3 py-1.5 border border-red-500/30 text-[10px] uppercase font-bold text-red-500 hover:bg-red-500/10 flex items-center gap-1.5">
                    <X size={12} /> Remover
                  </button>
                )}
                <span className="text-[10px] text-foreground-muted">
                  {fotoArquivo
                    ? `${fotoArquivo.name} • ${(fotoArquivo.size / 1024 / 1024).toFixed(2)} MB${fotoInfo ? ` • ${fotoInfo.largura}×${fotoInfo.altura}px` : ''}`
                    : 'Nenhuma imagem selecionada'}
                </span>
              </div>

              <div id="orientacoes-foto" className="text-[10px] leading-relaxed text-foreground-muted">
                <p className="font-bold text-foreground mb-1">Antes de enviar:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Use foto recente, vertical, bem iluminada e com fundo neutro.</li>
                  <li>Mantenha rosto e ombros visíveis, sem capacete ou óculos escuros.</li>
                  <li>Não envie CNH, CPF ou outros documentos fotografados.</li>
                  <li>JPG, PNG ou WebP, mínimo 300×400 px e máximo 5 MB.</li>
                </ul>
                <p className="mt-1">A imagem será recortada em 3:4, convertida para WebP e terá os metadados removidos.</p>
              </div>

              {fotoErro && <p role="alert" className="text-[10px] text-red-500">{fotoErro}</p>}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button type="submit" disabled={salvando} className="px-6 py-3 text-xs uppercase font-bold text-black flex items-center gap-2 disabled:opacity-50" style={{ backgroundColor: primary }}>
              <CheckCircle2 size={16} /> {salvando ? 'Salvando...' : 'Finalizar Cadastro'}
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
