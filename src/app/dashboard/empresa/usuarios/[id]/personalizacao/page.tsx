'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, Loader2, Palette, Save, ShieldCheck, Users } from 'lucide-react'
import { ActionFeedback } from '@/components/motion/DashboardMotion'
import { CORES_E_LOGOS } from '@/data/temasELogos'
import { useTheme } from '@/contexts/ThemeContext'

interface UsuarioPersonalizacao {
  id: string
  nome: string
  email: string
  role: 'OPERADOR' | 'VISUALIZADOR'
  ativo: boolean
  corTema: string
  temaClaro: boolean
  rotuloEquipe: string | null
  podePersonalizarTema: boolean
}

export default function PersonalizacaoOperadorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { primary } = useTheme()
  const [usuario, setUsuario] = useState<UsuarioPersonalizacao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<{ mensagem: string; tom: 'success' | 'error' } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/empresa/usuarios/${id}/personalizacao`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar a personalização.')
        setUsuario(data)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setFeedback({ mensagem: error instanceof Error ? error.message : 'Falha ao carregar a personalização.', tom: 'error' })
      })
      .finally(() => setCarregando(false))
    return () => controller.abort()
  }, [id])

  const salvar = async () => {
    if (!usuario || salvando) return
    setSalvando(true)
    setFeedback(null)
    try {
      const response = await fetch(`/api/empresa/usuarios/${id}/personalizacao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corTema: usuario.corTema,
          temaClaro: usuario.temaClaro,
          rotuloEquipe: usuario.rotuloEquipe?.trim() || null,
          podePersonalizarTema: usuario.podePersonalizarTema,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível salvar a personalização.')
      setUsuario((atual) => atual ? { ...atual, ...data } : atual)
      setFeedback({ mensagem: 'Identidade visual do operador atualizada.', tom: 'success' })
    } catch (error) {
      setFeedback({ mensagem: error instanceof Error ? error.message : 'Falha ao salvar a personalização.', tom: 'error' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {feedback && <ActionFeedback message={feedback.mensagem} tone={feedback.tom} />}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/empresa/usuarios" className="mb-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-foreground-muted hover:text-foreground">
            <ArrowLeft size={14} /> Voltar para operadores
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-tight">Personalização <span style={{ color: primary }}>da equipe</span></h1>
          <p className="mt-1 text-xs text-foreground-muted">Defina uma identidade visual sem alterar funções, módulos ou limites do plano.</p>
        </div>
      </header>

      {carregando ? (
        <div className="grid min-h-64 place-items-center border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
          <span className="flex items-center gap-2 text-xs text-foreground-muted"><Loader2 size={16} className="animate-spin" /> Carregando identidade visual...</span>
        </div>
      ) : usuario ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <section className="border p-5 sm:p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
            <div className="flex items-center gap-4 border-b pb-5" style={{ borderColor: 'var(--border)' }}>
              <div className="grid h-12 w-12 place-items-center border" style={{ borderColor: usuario.corTema, color: usuario.corTema }}><Users size={20} /></div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-black uppercase">{usuario.nome}</h2>
                <p className="truncate text-[10px] text-foreground-muted">{usuario.email} · {usuario.role}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest">Rótulo da equipe</span>
                <input
                  value={usuario.rotuloEquipe ?? ''}
                  maxLength={48}
                  onChange={(event) => setUsuario({ ...usuario, rotuloEquipe: event.target.value })}
                  placeholder="Ex.: Equipe financeira"
                  className="min-h-12 w-full border bg-transparent px-4 text-sm outline-none focus:ring-1"
                  style={{ borderColor: 'var(--border)', '--tw-ring-color': usuario.corTema } as React.CSSProperties}
                />
                <span className="mt-1 block text-[9px] text-foreground-muted">O rótulo aparece na lista de operadores e ajuda a identificar o grupo.</span>
              </label>

              <div>
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest">Modo de exibição</span>
                <div className="grid grid-cols-2 gap-2">
                  {[{ label: 'Escuro', value: false }, { label: 'Claro', value: true }].map((opcao) => (
                    <button key={opcao.label} type="button" onClick={() => setUsuario({ ...usuario, temaClaro: opcao.value })} className="min-h-12 border px-3 text-[10px] font-bold uppercase" style={{ borderColor: usuario.temaClaro === opcao.value ? usuario.corTema : 'var(--border)', backgroundColor: usuario.temaClaro === opcao.value ? `${usuario.corTema}12` : 'var(--background)' }}>
                      {opcao.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <span className="mb-3 block text-[10px] font-bold uppercase tracking-widest">Cor da equipe</span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {CORES_E_LOGOS.map((cor) => (
                  <button key={cor.value} type="button" aria-pressed={usuario.corTema === cor.value} onClick={() => setUsuario({ ...usuario, corTema: cor.value })} className="flex min-h-12 items-center justify-between border px-3 text-[10px] font-bold uppercase" style={{ borderColor: usuario.corTema === cor.value ? cor.value : 'var(--border)', backgroundColor: usuario.corTema === cor.value ? `${cor.value}12` : 'var(--background)' }}>
                    <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full" style={{ backgroundColor: cor.value }} />{cor.label}</span>
                    {usuario.corTema === cor.value && <Check size={14} style={{ color: cor.value }} />}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 border p-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: usuario.podePersonalizarTema ? usuario.corTema : 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0" style={{ color: usuario.corTema }} />
              <div><h2 className="text-xs font-black uppercase tracking-wider">Liberdade de personalização</h2><p className="mt-1 text-[10px] text-foreground-muted">Quando desligado, o operador usa somente a identidade definida pelo gestor.</p></div>
            </div>
            <button type="button" role="switch" aria-checked={usuario.podePersonalizarTema} onClick={() => setUsuario({ ...usuario, podePersonalizarTema: !usuario.podePersonalizarTema })} className="flex min-h-12 min-w-[168px] shrink-0 items-center justify-start gap-3 border px-4 text-[10px] font-black uppercase" style={{ borderColor: usuario.podePersonalizarTema ? usuario.corTema : 'var(--border)', color: usuario.podePersonalizarTema ? usuario.corTema : 'var(--foreground-muted)' }}>
              <span className="relative flex h-6 w-11 shrink-0 items-center overflow-hidden rounded-full border p-1" style={{ borderColor: 'currentColor', backgroundColor: usuario.podePersonalizarTema ? `${usuario.corTema}20` : 'var(--background)' }} aria-hidden="true">
                <motion.span
                  className="block h-4 w-4 shrink-0 rounded-full"
                  style={{ backgroundColor: 'currentColor' }}
                  animate={{ x: usuario.podePersonalizarTema ? 18 : 0 }}
                  transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
                />
              </span>
              <span className="min-w-0 flex-1 text-left">{usuario.podePersonalizarTema ? 'Permitido' : 'Bloqueado'}</span>
            </button>
          </section>

          <div className="flex justify-end">
            <button type="button" disabled={salvando} onClick={salvar} className="flex min-h-12 items-center gap-2 px-6 text-xs font-black uppercase disabled:opacity-50" style={{ backgroundColor: usuario.corTema, color: '#000' }}>
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar personalização
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="border p-6 text-sm text-foreground-muted" style={{ borderColor: 'var(--border)' }}><Palette size={20} className="mb-3" />Não foi possível abrir este operador.</div>
      )}
    </div>
  )
}
