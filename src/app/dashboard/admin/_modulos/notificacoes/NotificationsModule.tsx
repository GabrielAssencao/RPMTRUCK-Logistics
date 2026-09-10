'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { Bell, Check, CheckCheck, ChevronLeft, ChevronRight, Inbox, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { ActionFeedback } from '@/components/motion/DashboardMotion'
import { NOTIFICACOES_ATUALIZADAS_EVENT, type Notificacao } from '@/hooks/useNotificacoes'
import { useTheme } from '@/contexts/ThemeContext'

type FiltroLeitura = 'TODAS' | 'NAO_LIDAS' | 'LIDAS'

interface RespostaNotificacoes {
  notificacoes: Notificacao[]
  naoLidas: number
  pagina: number
  total: number
  totalPaginas: number
  erro?: string
}

export default function NotificationsModule() {
  const { primary, semanticColors } = useTheme()
  const [dados, setDados] = useState<RespostaNotificacoes>({ notificacoes: [], naoLidas: 0, pagina: 1, total: 0, totalPaginas: 1 })
  const [filtro, setFiltro] = useState<FiltroLeitura>('TODAS')
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ mensagem: string; erro: boolean } | null>(null)

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    const params = new URLSearchParams({ pagina: String(pagina), limite: '20' })
    if (filtro !== 'TODAS') params.set('lidas', String(filtro === 'LIDAS'))
    try {
      const response = await fetch(`/api/notificacoes?${params}`, { cache: 'no-store', signal })
      const body = await response.json() as RespostaNotificacoes
      if (!response.ok) throw new Error(body.erro || 'Não foi possível carregar as notificações.')
      setDados(body)
      setFeedback(null)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setFeedback({ mensagem: cause instanceof Error ? cause.message : 'Não foi possível carregar as notificações.', erro: true })
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [filtro, pagina])

  useEffect(() => {
    const controller = new AbortController()
    const initial = window.setTimeout(() => void carregar(controller.signal), 0)
    return () => {
      window.clearTimeout(initial)
      controller.abort()
    }
  }, [carregar])

  const avisarAtualizacao = () => window.dispatchEvent(new Event(NOTIFICACOES_ATUALIZADAS_EVENT))

  const executar = async (chave: string, request: () => Promise<Response>, sucesso: string) => {
    if (processando) return
    setProcessando(chave)
    setFeedback(null)
    try {
      const response = await request()
      const body = await response.json().catch(() => ({})) as { erro?: string }
      if (!response.ok) throw new Error(body.erro || 'Não foi possível atualizar as notificações.')
      setFeedback({ mensagem: sucesso, erro: false })
      avisarAtualizacao()
      await carregar()
    } catch (cause) {
      setFeedback({ mensagem: cause instanceof Error ? cause.message : 'Falha ao atualizar as notificações.', erro: true })
    } finally {
      setProcessando(null)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-[1200px] space-y-6 font-mono">
        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: 'var(--border)' }}>
          <div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: primary }}><Bell size={14} /> Comunicação administrativa</p><h1 className="mt-1 font-rajdhani text-2xl font-black uppercase sm:text-3xl">Central de notificações</h1><p className="mt-1 text-sm text-foreground-muted">Histórico de alertas, solicitações, tickets e eventos destinados ao Superadmin.</p></div>
          <button type="button" onClick={() => void carregar()} disabled={loading} className="flex min-h-11 items-center gap-2 border px-4 text-[10px] font-black uppercase disabled:opacity-50" style={{ borderColor: 'var(--border)' }}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar</button>
        </header>

        <div className="grid gap-3 sm:grid-cols-3"><Resumo label="Não lidas" valor={dados.naoLidas} cor={semanticColors.warning} /><Resumo label="Neste filtro" valor={dados.total} /><Resumo label="Página" valor={`${dados.pagina} / ${dados.totalPaginas}`} /></div>
        {feedback && <ActionFeedback message={feedback.mensagem} tone={feedback.erro ? 'error' : 'success'} />}

        <section className="overflow-hidden border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border)' }}>
            <div className="flex border" style={{ borderColor: 'var(--border)' }} aria-label="Filtrar notificações">
              {(['TODAS', 'NAO_LIDAS', 'LIDAS'] as const).map((item) => <button key={item} type="button" aria-pressed={filtro === item} onClick={() => { setFiltro(item); setPagina(1) }} className="min-h-10 px-3 text-[9px] font-black uppercase" style={{ backgroundColor: filtro === item ? primary : 'transparent', color: filtro === item ? '#000' : 'var(--foreground-muted)' }}>{item.replace('_', ' ')}</button>)}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!dados.naoLidas || Boolean(processando)} onClick={() => void executar('todas', () => fetch('/api/notificacoes', { method: 'PATCH' }), 'Todas as notificações foram marcadas como lidas.')} className="flex min-h-10 items-center gap-2 border px-3 text-[9px] font-black uppercase disabled:opacity-40" style={{ borderColor: primary, color: primary }}><CheckCheck size={13} /> Marcar lidas</button>
              <button type="button" disabled={Boolean(processando)} onClick={() => void executar('limpar', () => fetch('/api/notificacoes', { method: 'DELETE' }), 'Notificações lidas removidas.')} className="flex min-h-10 items-center gap-2 border px-3 text-[9px] font-black uppercase disabled:opacity-40" style={{ borderColor: semanticColors.danger, color: semanticColors.danger }}><Trash2 size={13} /> Limpar lidas</button>
            </div>
          </div>

          <div aria-live="polite" aria-busy={loading}>
            {loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin" style={{ color: primary }} aria-label="Carregando notificações" /></div> : dados.notificacoes.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><Inbox size={30} className="mb-3 opacity-30" /><p className="text-sm font-bold">Nenhuma notificação neste filtro</p></div> : (
              <AnimatePresence initial={false}>{dados.notificacoes.map((notificacao) => <motion.article key={notificacao.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 12 }} className="grid gap-3 border-b p-4 last:border-b-0 sm:grid-cols-[1fr_auto]" style={{ borderColor: 'var(--border)', backgroundColor: notificacao.lida ? 'transparent' : `${primary}08` }}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="border px-2 py-0.5 text-[8px] font-black uppercase" style={{ borderColor: primary, color: primary }}>{notificacao.modulo}</span><span className="text-[8px] font-black uppercase text-foreground-muted">{notificacao.lida ? 'Lida' : 'Não lida'}</span></div><h2 className="mt-2 break-words text-sm font-bold">{notificacao.titulo}</h2><p className="mt-1 break-words text-xs leading-relaxed text-foreground-muted">{notificacao.mensagem}</p>{notificacao.ticketSuporteId && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('rpmtruck:abrir-ticket-suporte', { detail: { ticketId: notificacao.ticketSuporteId } }))} className="mt-2 text-[9px] font-black uppercase hover:underline" style={{ color: primary }}>Abrir ticket {notificacao.ticketSuporte?.protocolo ? `· ${notificacao.ticketSuporte.protocolo}` : ''}</button>}<time className="mt-2 block text-[9px] text-foreground-muted">{new Date(notificacao.criado_em).toLocaleString('pt-BR')}</time></div><div className="flex items-start gap-1">{!notificacao.lida && <button type="button" disabled={Boolean(processando)} aria-label={`Marcar ${notificacao.titulo} como lida`} onClick={() => void executar(notificacao.id, () => fetch(`/api/notificacoes/${notificacao.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lida: true }) }), 'Notificação marcada como lida.')} className="p-2"><Check size={15} /></button>}<button type="button" disabled={Boolean(processando)} aria-label={`Excluir ${notificacao.titulo}`} onClick={() => void executar(notificacao.id, () => fetch(`/api/notificacoes/${notificacao.id}`, { method: 'DELETE' }), 'Notificação excluída.')} className="p-2" style={{ color: semanticColors.danger }}><Trash2 size={15} /></button></div></motion.article>)}</AnimatePresence>
            )}
          </div>

          {dados.totalPaginas > 1 && <div className="flex items-center justify-between border-t p-4" style={{ borderColor: 'var(--border)' }}><button type="button" disabled={pagina <= 1 || loading} onClick={() => setPagina((atual) => atual - 1)} className="flex min-h-10 items-center gap-1 border px-3 text-[9px] font-black uppercase disabled:opacity-30" style={{ borderColor: 'var(--border)' }}><ChevronLeft size={13} /> Anterior</button><span className="text-[9px] uppercase text-foreground-muted">{pagina} de {dados.totalPaginas}</span><button type="button" disabled={pagina >= dados.totalPaginas || loading} onClick={() => setPagina((atual) => atual + 1)} className="flex min-h-10 items-center gap-1 border px-3 text-[9px] font-black uppercase disabled:opacity-30" style={{ borderColor: 'var(--border)' }}>Próxima <ChevronRight size={13} /></button></div>}
        </section>
      </div>
    </MotionConfig>
  )
}

function Resumo({ label, valor, cor }: { label: string; valor: string | number; cor?: string }) {
  return <div className="border p-4" style={{ borderColor: cor || 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><p className="text-[9px] font-bold uppercase tracking-widest text-foreground-muted">{label}</p><p className="mt-1 text-2xl font-black" style={{ color: cor }}>{valor}</p></div>
}
