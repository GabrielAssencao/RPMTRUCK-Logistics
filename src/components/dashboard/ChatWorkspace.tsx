'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Bot, MessageSquare, RefreshCw, Send } from 'lucide-react'
import type { StatusTicketSuporte } from '@prisma/client'
import { useTheme } from '@/contexts/ThemeContext'
import { STATUS_TICKET_LABEL } from '@/lib/suporteConfig'

type ChatMessage = {
  id: string
  conteudo: string
  tipo: 'USUARIO' | 'SISTEMA'
  automatica: boolean
  criado_em: string
  lida_em: string | null
  autor: { id: string; nome: string; role: string } | null
}

interface ChatWorkspaceProps {
  ticketId: string
  empresaId?: string
  title: string
  protocolo: string
  status: StatusTicketSuporte
  onMessageSent?: () => void
}

export default function ChatWorkspace({ ticketId, empresaId, title, protocolo, status, onMessageSent }: ChatWorkspaceProps) {
  const { primary } = useTheme()
  const [mensagens, setMensagens] = useState<ChatMessage[]>([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const fimRef = useRef<HTMLDivElement>(null)
  const encerrado = status === 'FECHADO' || status === 'RESOLVIDO'

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    try {
      const query = new URLSearchParams({ ticketId })
      if (empresaId) query.set('empresaId', empresaId)
      const response = await fetch(`/api/chat?${query}`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível carregar o ticket.')
      setMensagens(body.mensagens)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o ticket.')
    } finally {
      if (!silencioso) setLoading(false)
    }
  }, [empresaId, ticketId])

  useEffect(() => {
    const initial = window.setTimeout(() => void carregar(), 0)
    const interval = window.setInterval(() => { if (!document.hidden) void carregar(true) }, 10_000)
    return () => { window.clearTimeout(initial); window.clearInterval(interval) }
  }, [carregar])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth', block: 'end' })
  }, [loading, mensagens])

  const enviar = async (event: FormEvent) => {
    event.preventDefault()
    const mensagem = texto.trim()
    if (!mensagem || sending || encerrado) return
    setSending(true)
    setError('')
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem, ticketId, ...(empresaId ? { empresaId } : {}) }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível enviar a mensagem.')
      setMensagens((atuais) => [...atuais, body.mensagem])
      setTexto('')
      onMessageSent?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar a mensagem.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="flex min-h-[560px] flex-col border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
        <div className="flex min-w-0 items-center gap-3">
          <MessageSquare size={18} className="shrink-0" style={{ color: primary }} />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black uppercase">{title}</h2>
            <p className="text-[10px] text-foreground-muted">{protocolo} · {STATUS_TICKET_LABEL[status]}</p>
          </div>
        </div>
        <button type="button" onClick={() => void carregar()} disabled={loading} aria-label="Atualizar ticket" className="min-h-10 min-w-10 border p-2 disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 custom-scrollbar" aria-live="polite">
        {loading ? <p className="py-16 text-center text-xs text-foreground-muted">Carregando ticket...</p> : mensagens.length === 0 ? (
          <div className="py-16 text-center"><MessageSquare className="mx-auto mb-3 opacity-30" /><p className="text-sm font-bold">Nenhuma mensagem</p></div>
        ) : mensagens.map((mensagem) => {
          if (mensagem.tipo === 'SISTEMA') {
            return <article key={mensagem.id} className="mx-auto flex max-w-2xl items-start gap-2 border px-3 py-2 text-xs text-foreground-muted" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}><Bot size={14} className="mt-0.5 shrink-0" style={{ color: primary }} /><div><strong className="text-foreground">Automação de suporte</strong><p className="mt-1 whitespace-pre-wrap leading-relaxed">{mensagem.conteudo}</p></div></article>
          }
          const propria = empresaId ? mensagem.autor?.role === 'ADMIN_RPM' : mensagem.autor?.role !== 'ADMIN_RPM'
          return <article key={mensagem.id} className={`flex ${propria ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] border px-3 py-2 sm:max-w-[70%]" style={{ borderColor: propria ? primary : 'var(--border)', backgroundColor: propria ? `${primary}12` : 'var(--background)' }}>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-foreground-muted"><span>{mensagem.autor?.nome || 'Usuário removido'}</span><time>{new Date(mensagem.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time></div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{mensagem.conteudo}</p>
            </div>
          </article>
        })}
        <div ref={fimRef} />
      </div>

      <form onSubmit={enviar} className="border-t p-3" style={{ borderColor: 'var(--border)' }}>
        {error && <p role="alert" className="mb-2 text-xs text-red-500">{error}</p>}
        {encerrado ? <p className="p-3 text-center text-xs font-bold text-foreground-muted">Ticket encerrado. Abra um novo chamado para continuar o atendimento.</p> : <>
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor={`ticket-message-${ticketId}`}>Mensagem</label>
            <textarea id={`ticket-message-${ticketId}`} value={texto} onChange={(event) => setTexto(event.target.value)} maxLength={2000} rows={2} disabled={sending} placeholder="Acrescente informações ao ticket..." className="min-h-12 flex-1 resize-y border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 disabled:opacity-60" style={{ borderColor: 'var(--border)', '--tw-ring-color': primary } as React.CSSProperties} />
            <button type="submit" disabled={sending || !texto.trim()} className="flex min-h-12 items-center gap-2 px-4 text-xs font-black uppercase text-black disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: primary }}><Send size={15} /><span className="hidden sm:inline">Enviar</span></button>
          </div>
          <p className="mt-1 text-right text-[9px] text-foreground-muted">{texto.length}/2.000</p>
        </>}
      </form>
    </section>
  )
}
