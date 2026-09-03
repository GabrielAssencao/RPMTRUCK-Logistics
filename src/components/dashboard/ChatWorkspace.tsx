'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { MessageSquare, RefreshCw, Send } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

type ChatMessage = {
  id: string
  conteudo: string
  criado_em: string
  lida_em: string | null
  autor: { id: string; nome: string; role: string }
}

interface ChatWorkspaceProps {
  empresaId?: string
  title?: string
  onMessageSent?: () => void
}

export default function ChatWorkspace({ empresaId, title = 'Atendimento RPMTruck', onMessageSent }: ChatWorkspaceProps) {
  const { primary } = useTheme()
  const [mensagens, setMensagens] = useState<ChatMessage[]>([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const fimRef = useRef<HTMLDivElement>(null)

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    try {
      const query = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : ''
      const response = await fetch(`/api/chat${query}`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível carregar a conversa.')
      setMensagens(body.mensagens)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a conversa.')
    } finally {
      if (!silencioso) setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    const initial = window.setTimeout(() => void carregar(), 0)
    const interval = window.setInterval(() => {
      if (!document.hidden) void carregar(true)
    }, 8000)
    return () => { window.clearTimeout(initial); window.clearInterval(interval) }
  }, [carregar])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth', block: 'end' })
  }, [loading, mensagens])

  const enviar = async (event: FormEvent) => {
    event.preventDefault()
    const mensagem = texto.trim()
    if (!mensagem || sending) return
    setSending(true)
    setError('')
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem, ...(empresaId ? { empresaId } : {}) }),
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
          <MessageSquare size={18} style={{ color: primary }} />
          <div className="min-w-0"><h2 className="truncate text-sm font-black uppercase">{title}</h2><p className="text-[10px] text-foreground-muted">Mensagens privadas da sua empresa</p></div>
        </div>
        <button type="button" onClick={() => void carregar()} disabled={loading} aria-label="Atualizar conversa" className="min-h-10 min-w-10 border p-2 disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 custom-scrollbar" aria-live="polite">
        {loading ? <p className="py-16 text-center text-xs text-foreground-muted">Carregando conversa...</p> : mensagens.length === 0 ? (
          <div className="py-16 text-center"><MessageSquare className="mx-auto mb-3 opacity-30" /><p className="text-sm font-bold">Nenhuma mensagem ainda</p><p className="mt-1 text-xs text-foreground-muted">Envie uma mensagem para iniciar o atendimento.</p></div>
        ) : mensagens.map((mensagem) => {
          const propria = empresaId ? mensagem.autor.role === 'ADMIN_RPM' : mensagem.autor.role !== 'ADMIN_RPM'
          return <article key={mensagem.id} className={`flex ${propria ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] border px-3 py-2 sm:max-w-[70%]" style={{ borderColor: propria ? primary : 'var(--border)', backgroundColor: propria ? `${primary}12` : 'var(--background)' }}>
              <div className="mb-1 flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-foreground-muted"><span>{mensagem.autor.nome}</span><time>{new Date(mensagem.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time></div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{mensagem.conteudo}</p>
            </div>
          </article>
        })}
        <div ref={fimRef} />
      </div>

      <form onSubmit={enviar} className="border-t p-3" style={{ borderColor: 'var(--border)' }}>
        {error && <p role="alert" className="mb-2 text-xs text-red-500">{error}</p>}
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor={`chat-message-${empresaId || 'empresa'}`}>Mensagem</label>
          <textarea id={`chat-message-${empresaId || 'empresa'}`} value={texto} onChange={(event) => setTexto(event.target.value)} maxLength={2000} rows={2} disabled={sending} placeholder="Digite sua mensagem..." className="min-h-12 flex-1 resize-y border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 disabled:opacity-60" style={{ borderColor: 'var(--border)', '--tw-ring-color': primary } as React.CSSProperties} />
          <button type="submit" disabled={sending || !texto.trim()} className="flex min-h-12 items-center gap-2 px-4 text-xs font-black uppercase text-black disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: primary }}><Send size={15} /><span className="hidden sm:inline">Enviar</span></button>
        </div>
        <p className="mt-1 text-right text-[9px] text-foreground-muted">{texto.length}/2.000</p>
      </form>
    </section>
  )
}
