'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, Check, Loader2, MessageSquare, Pencil, RefreshCw, Send, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { StatusTicketSuporte } from '@prisma/client'
import { useTheme } from '@/contexts/ThemeContext'
import { STATUS_TICKET_LABEL } from '@/lib/suporteConfig'
import { ChatBotOrb } from '@/components/dashboard/ChatBotOrb'

type ChatMessage = {
  id: string
  conteudo: string
  tipo: 'USUARIO' | 'SISTEMA'
  automatica: boolean
  visibilidade: 'TODOS' | 'ADMIN'
  criado_em: string
  lida_em: string | null
  editado_em: string | null
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
  const reduzirMovimento = useReducedMotion()
  const [mensagens, setMensagens] = useState<ChatMessage[]>([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [textoEdicao, setTextoEdicao] = useState('')
  const [usuarioAtualId, setUsuarioAtualId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [estaNoFinal, setEstaNoFinal] = useState(true)
  const [novasMensagens, setNovasMensagens] = useState(0)
  const mensagensRef = useRef<HTMLDivElement>(null)
  const assinaturaMensagensRef = useRef('')
  const ultimaMensagemIdRef = useRef<string | null>(null)
  const carregouMensagensRef = useRef(false)
  const rolarAoFinalRef = useRef(false)
  const frameRolagemRef = useRef<number | null>(null)
  const encerrado = status === 'FECHADO' || status === 'RESOLVIDO'

  useEffect(() => {
    try {
      const usuario = JSON.parse(localStorage.getItem('@rpmtruck:user') || '{}') as { id?: string }
      queueMicrotask(() => setUsuarioAtualId(typeof usuario.id === 'string' ? usuario.id : null))
    } catch {
      queueMicrotask(() => setUsuarioAtualId(null))
    }
  }, [])

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    try {
      const query = new URLSearchParams({ ticketId })
      if (empresaId) query.set('empresaId', empresaId)
      const response = await fetch(`/api/chat?${query}`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível carregar o ticket.')

      const lista = Array.isArray(body.mensagens) ? body.mensagens as ChatMessage[] : []
      const assinatura = lista.map((item) => `${item.id}:${item.editado_em ?? ''}:${item.conteudo}`).join('|')
      const ultimoId = lista.at(-1)?.id ?? null
      const caixa = mensagensRef.current
      const estavaProximoDoFim = !caixa || caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 96
      const primeiraCarga = !carregouMensagensRef.current
      const recebeuMensagem = !primeiraCarga && ultimoId !== ultimaMensagemIdRef.current
      const indiceUltimaConhecida = ultimaMensagemIdRef.current
        ? lista.findIndex((item) => item.id === ultimaMensagemIdRef.current)
        : -1
      const quantidadeNovas = recebeuMensagem
        ? indiceUltimaConhecida >= 0 ? lista.length - indiceUltimaConhecida - 1 : 1
        : 0

      if (assinatura !== assinaturaMensagensRef.current) {
        assinaturaMensagensRef.current = assinatura
        setMensagens(lista)
      }
      if (!silencioso || (recebeuMensagem && estavaProximoDoFim)) {
        rolarAoFinalRef.current = true
      } else if (quantidadeNovas > 0) {
        setNovasMensagens((quantidade) => quantidade + quantidadeNovas)
      }
      ultimaMensagemIdRef.current = ultimoId
      carregouMensagensRef.current = true
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
    if (!rolarAoFinalRef.current) return
    rolarAoFinalRef.current = false
    frameRolagemRef.current = window.requestAnimationFrame(() => {
      frameRolagemRef.current = null
      const caixa = mensagensRef.current
      if (caixa) {
        caixa.scrollTo({ top: caixa.scrollHeight, behavior: 'auto' })
        setEstaNoFinal(true)
        setNovasMensagens(0)
      }
    })
    return () => {
      if (frameRolagemRef.current !== null) window.cancelAnimationFrame(frameRolagemRef.current)
      frameRolagemRef.current = null
    }
  }, [loading, mensagens])

  const interromperRolagemAutomatica = () => {
    rolarAoFinalRef.current = false
    if (frameRolagemRef.current !== null) window.cancelAnimationFrame(frameRolagemRef.current)
    frameRolagemRef.current = null
  }

  const atualizarPosicaoRolagem = () => {
    const caixa = mensagensRef.current
    if (!caixa) return
    const proximoDoFim = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 64
    setEstaNoFinal(proximoDoFim)
    if (proximoDoFim) setNovasMensagens(0)
  }

  const irParaMensagensRecentes = () => {
    interromperRolagemAutomatica()
    const caixa = mensagensRef.current
    if (!caixa) return
    caixa.scrollTo({ top: caixa.scrollHeight, behavior: reduzirMovimento ? 'auto' : 'smooth' })
    setEstaNoFinal(true)
    setNovasMensagens(0)
  }

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
      rolarAoFinalRef.current = true
      assinaturaMensagensRef.current = ''
      setMensagens((atuais) => [...atuais, body.mensagem, ...(body.respostaAutomatica ? [body.respostaAutomatica] : [])])
      setTexto('')
      onMessageSent?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar a mensagem.')
    } finally {
      setSending(false)
    }
  }

  const iniciarEdicao = (mensagem: ChatMessage) => {
    setEditandoId(mensagem.id)
    setTextoEdicao(mensagem.conteudo)
    setError('')
  }

  const cancelarEdicao = () => {
    setEditandoId(null)
    setTextoEdicao('')
  }

  const salvarEdicao = async (event: FormEvent) => {
    event.preventDefault()
    const mensagem = textoEdicao.trim()
    if (!editandoId || !mensagem || savingEdit) return
    setSavingEdit(true)
    setError('')
    try {
      const response = await fetch('/api/chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagemId: editandoId, mensagem, ...(empresaId ? { empresaId } : {}) }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível editar a mensagem.')
      assinaturaMensagensRef.current = ''
      setMensagens((atuais) => atuais.map((item) => item.id === editandoId ? body.mensagem : item))
      cancelarEdicao()
      onMessageSent?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível editar a mensagem.')
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <section className="flex h-[clamp(32rem,72dvh,45rem)] min-h-0 flex-col overflow-hidden border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
        <div className="flex min-w-0 items-center gap-3">
          <ChatBotOrb active={loading || sending} label={loading || sending ? 'Assistente processando a conversa' : 'Assistente do suporte ativo'} />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black uppercase">{title}</h2>
            <p className="text-[10px] text-foreground-muted">{protocolo} · {STATUS_TICKET_LABEL[status]}</p>
          </div>
        </div>
        <button type="button" onClick={() => void carregar()} disabled={loading} aria-label="Atualizar ticket" className="min-h-10 min-w-10 border p-2 disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={mensagensRef}
          className="h-full space-y-3 overflow-y-auto p-4 custom-scrollbar"
          aria-live="polite"
          onScroll={atualizarPosicaoRolagem}
          onWheelCapture={interromperRolagemAutomatica}
          onTouchStart={interromperRolagemAutomatica}
          style={{ scrollbarGutter: 'stable', overflowAnchor: 'none', overscrollBehaviorY: 'contain' }}
        >
        {loading ? <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-xs text-foreground-muted"><ChatBotOrb active label="Assistente carregando o ticket" /><span>Carregando ticket...</span></div> : mensagens.length === 0 ? (
          <div className="py-16 text-center"><MessageSquare className="mx-auto mb-3 opacity-30" /><p className="text-sm font-bold">Nenhuma mensagem</p></div>
        ) : mensagens.map((mensagem) => {
          if (mensagem.tipo === 'SISTEMA') {
            const resumoInterno = mensagem.visibilidade === 'ADMIN'
            return <article key={mensagem.id} className="mx-auto flex max-w-2xl items-start gap-3 border px-3 py-3 text-xs text-foreground-muted" style={{ borderColor: resumoInterno ? primary : 'var(--border)', backgroundColor: resumoInterno ? `${primary}0A` : 'var(--background)' }}><ChatBotOrb compact active={!resumoInterno && mensagem.id === mensagens.at(-1)?.id} label={resumoInterno ? 'Resumo interno da triagem' : 'Mensagem automática do assistente'} /><div><strong className="text-foreground">{resumoInterno ? 'Resumo interno · somente administradores' : 'Assistente RPM'}</strong><p className="mt-1 whitespace-pre-wrap leading-relaxed">{mensagem.conteudo}</p></div></article>
          }
          const propria = usuarioAtualId
            ? mensagem.autor?.id === usuarioAtualId
            : empresaId ? mensagem.autor?.role === 'ADMIN_RPM' : mensagem.autor?.role !== 'ADMIN_RPM'
          const podeEditar = mensagem.autor?.id === usuarioAtualId && !mensagem.automatica
          return <article key={mensagem.id} className={`flex ${propria ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] border px-3 py-2 sm:max-w-[70%]" style={{ borderColor: propria ? primary : 'var(--border)', backgroundColor: propria ? `${primary}12` : 'var(--background)' }}>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-foreground-muted">
                <span>{mensagem.autor?.nome || 'Usuário removido'}</span>
                <time>{new Date(mensagem.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time>
                {mensagem.editado_em && <span aria-label={`Editada em ${new Date(mensagem.editado_em).toLocaleString('pt-BR')}`}>(editada)</span>}
                {podeEditar && editandoId !== mensagem.id && (
                  <button type="button" onClick={() => iniciarEdicao(mensagem)} className="ml-auto inline-flex min-h-8 min-w-8 items-center justify-center border transition-colors hover:text-foreground" style={{ borderColor: 'var(--border)' }} aria-label="Editar esta mensagem" title="Editar mensagem">
                    <Pencil size={12} />
                  </button>
                )}
              </div>
              {editandoId === mensagem.id ? (
                <form onSubmit={salvarEdicao} className="space-y-2">
                  <label className="sr-only" htmlFor={`edit-message-${mensagem.id}`}>Editar mensagem</label>
                  <textarea id={`edit-message-${mensagem.id}`} autoFocus value={textoEdicao} onChange={(event) => setTextoEdicao(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') cancelarEdicao(); if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} maxLength={2000} rows={3} disabled={savingEdit} className="w-full resize-y border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 disabled:opacity-60" style={{ borderColor: primary, '--tw-ring-color': primary } as React.CSSProperties} />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] text-foreground-muted">{textoEdicao.length}/2.000</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={cancelarEdicao} disabled={savingEdit} className="inline-flex min-h-9 items-center gap-1 border px-3 text-[9px] font-black uppercase disabled:opacity-50" style={{ borderColor: 'var(--border)' }}><X size={12} />Cancelar</button>
                      <button type="submit" disabled={savingEdit || !textoEdicao.trim() || textoEdicao.trim() === mensagem.conteudo} className="inline-flex min-h-9 items-center gap-1 px-3 text-[9px] font-black uppercase text-black disabled:opacity-50" style={{ backgroundColor: primary }}>{savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}{savingEdit ? 'Salvando...' : 'Salvar'}</button>
                    </div>
                  </div>
                </form>
              ) : <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{mensagem.conteudo}</p>}
            </div>
          </article>
        })}
        </div>

        <AnimatePresence>
          {!estaNoFinal && (
            <motion.button
              type="button"
              onClick={irParaMensagensRecentes}
              initial={reduzirMovimento ? false : { opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduzirMovimento ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: reduzirMovimento ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
              className="absolute bottom-3 left-1/2 flex min-h-10 items-center gap-2 border px-3 text-[10px] font-black uppercase shadow-xl"
              style={{ x: '-50%', borderColor: primary, backgroundColor: 'var(--background-secondary)', color: primary }}
              aria-label={novasMensagens > 0 ? `${novasMensagens} nova(s) mensagem(ns). Ir para o final.` : 'Ir para as mensagens mais recentes'}
            >
              <ArrowDown size={14} /> {novasMensagens > 0 ? `${novasMensagens} nova${novasMensagens > 1 ? 's' : ''}` : 'Mensagens recentes'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <form onSubmit={enviar} className="border-t p-3" style={{ borderColor: 'var(--border)' }}>
        {error && <p role="alert" className="mb-2 text-xs text-red-500">{error}</p>}
        {encerrado ? <p className="p-3 text-center text-xs font-bold text-foreground-muted">Ticket encerrado. Abra um novo chamado para continuar o atendimento.</p> : <>
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor={`ticket-message-${ticketId}`}>Mensagem</label>
            <textarea id={`ticket-message-${ticketId}`} value={texto} onChange={(event) => setTexto(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} maxLength={2000} rows={2} disabled={sending} placeholder="Acrescente informações ao ticket..." className="min-h-12 flex-1 resize-y border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 disabled:opacity-60" style={{ borderColor: 'var(--border)', '--tw-ring-color': primary } as React.CSSProperties} />
            <button type="submit" disabled={sending || !texto.trim()} className="flex min-h-12 items-center gap-2 px-4 text-xs font-black uppercase text-black disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: primary }}>{sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}<span className="hidden sm:inline">{sending ? 'Enviando...' : 'Enviar'}</span></button>
          </div>
          <p className="mt-1 flex justify-between gap-3 text-[9px] text-foreground-muted"><span>Enter envia · Shift + Enter quebra a linha</span><span>{texto.length}/2.000</span></p>
        </>}
      </form>
    </section>
  )
}
