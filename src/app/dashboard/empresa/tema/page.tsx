'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Save, ShieldCheck } from 'lucide-react'
import { CORES_E_LOGOS } from '@/data/temasELogos'
import { useTheme } from '@/contexts/ThemeContext'
import { ActionFeedback } from '@/components/motion/DashboardMotion'
import DashboardEnvironmentBackground from '@/components/dashboard/DashboardEnvironmentBackground'
import { OPCOES_FUNDO_EMPRESA, salvarEstiloFundoEmpresa, type EstiloFundoEmpresa } from '@/lib/empresaPreferences'

interface PreferenciasVisuais {
  corTema: string
  temaClaro: boolean
  rotuloEquipe: string | null
  podePersonalizarTema: boolean
  estiloFundo: EstiloFundoEmpresa
}

export default function MeuTemaPage() {
  const { primary, setPrimary, isLight, setIsLight } = useTheme()
  const [preferencias, setPreferencias] = useState<PreferenciasVisuais | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<{ mensagem: string; tom: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch('/api/empresa/preferencias-visuais', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar o tema.')
        setPreferencias(data)
        setPrimary(data.corTema)
        setIsLight(Boolean(data.temaClaro))
        salvarEstiloFundoEmpresa(data.estiloFundo)
      })
      .catch((error) => setFeedback({ mensagem: error instanceof Error ? error.message : 'Falha ao carregar o tema.', tom: 'error' }))
      .finally(() => setCarregando(false))
  }, [setIsLight, setPrimary])

  const salvar = async () => {
    if (!preferencias?.podePersonalizarTema || salvando) return
    setSalvando(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/empresa/preferencias-visuais', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corTema: primary, temaClaro: isLight, estiloFundo: preferencias.estiloFundo }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível salvar o tema.')
      setFeedback({ mensagem: 'Seu tema foi atualizado.', tom: 'success' })
    } catch (error) {
      setFeedback({ mensagem: error instanceof Error ? error.message : 'Falha ao salvar o tema.', tom: 'error' })
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin" style={{ color: primary }} /></div>

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {feedback && <ActionFeedback message={feedback.mensagem} tone={feedback.tom} />}
      <header><h1 className="text-3xl font-black uppercase">Meu <span style={{ color: primary }}>tema</span></h1><p className="mt-1 text-xs text-foreground-muted">Personalize sua área de trabalho dentro da identidade permitida pelo gestor.</p></header>

      <section className="border p-5 sm:p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        {preferencias?.rotuloEquipe && <div className="mb-5 flex items-center gap-2 border-b pb-4 text-xs font-black uppercase" style={{ borderColor: 'var(--border)', color: primary }}><ShieldCheck size={16} /> {preferencias.rotuloEquipe}</div>}
        {!preferencias?.podePersonalizarTema ? (
          <div className="flex items-start gap-3 text-sm"><ShieldCheck size={18} style={{ color: primary }} /><div><strong>Tema administrado pelo gestor</strong><p className="mt-1 text-xs text-foreground-muted">Solicite ao gestor da empresa para liberar a personalização individual.</p></div></div>
        ) : (
          <div className="space-y-6">
            <div><h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest">Modo de exibição</h2><div className="grid grid-cols-2 gap-3">{[{ label: 'Escuro', value: false }, { label: 'Claro', value: true }].map((opcao) => <button key={opcao.label} type="button" onClick={() => setIsLight(opcao.value)} className="min-h-12 border text-xs font-bold uppercase" style={{ borderColor: isLight === opcao.value ? primary : 'var(--border)', backgroundColor: isLight === opcao.value ? `${primary}12` : 'var(--background)' }}>{opcao.label}</button>)}</div></div>
            <div><h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest">Cor de destaque</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{CORES_E_LOGOS.map((cor) => <button key={cor.value} type="button" onClick={() => setPrimary(cor.value)} className="flex min-h-12 items-center justify-between border px-3 text-[10px] font-bold uppercase" style={{ borderColor: primary === cor.value ? cor.value : 'var(--border)', backgroundColor: primary === cor.value ? `${cor.value}12` : 'var(--background)' }}><span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full" style={{ backgroundColor: cor.value }} />{cor.label}</span>{primary === cor.value && <Check size={14} />}</button>)}</div></div>
            <div><h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest">Plano de fundo</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{OPCOES_FUNDO_EMPRESA.map((opcao) => <button key={opcao.value} type="button" onClick={() => { setPreferencias({ ...preferencias, estiloFundo: opcao.value }); salvarEstiloFundoEmpresa(opcao.value) }} className="border p-3 text-left" style={{ borderColor: preferencias.estiloFundo === opcao.value ? primary : 'var(--border)', backgroundColor: preferencias.estiloFundo === opcao.value ? `${primary}12` : 'var(--background)' }}><span className="flex items-center justify-between text-[10px] font-black uppercase">{opcao.label}{preferencias.estiloFundo === opcao.value && <Check size={14} />}</span><span className="mt-1 block text-[9px] text-foreground-muted">{opcao.description}</span></button>)}</div><div className={`dashboard-ambient-preview relative mt-4 h-32 overflow-hidden border ${preferencias.estiloFundo !== 'DESLIGADO' ? 'dashboard-environment-active' : ''}`} style={{ borderColor: preferencias.estiloFundo !== 'DESLIGADO' ? primary : 'var(--border)' }}><DashboardEnvironmentBackground estilo={preferencias.estiloFundo} preview /></div></div>
            <button type="button" disabled={salvando} onClick={salvar} className="ml-auto flex min-h-12 items-center gap-2 px-6 text-xs font-black uppercase text-black disabled:opacity-50" style={{ backgroundColor: primary }}>{salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar meu tema</button>
          </div>
        )}
      </section>
    </div>
  )
}
