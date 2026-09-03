'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageSquare, RefreshCw } from 'lucide-react'
import ChatWorkspace from '@/components/dashboard/ChatWorkspace'
import { useTheme } from '@/contexts/ThemeContext'

type Conversation = {
  id: string
  atualizado_em: string
  empresa: { id: string; nome: string; email: string; status: string }
  ultimaMensagem: { conteudo: string; criado_em: string; autor: { role: string } } | null
  naoLidas: number
}

export default function ChatModule() {
  const { primary } = useTheme()
  const [conversas, setConversas] = useState<Conversation[]>([])
  const [selecionada, setSelecionada] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const carregar = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/chat', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível carregar as conversas.')
      setConversas(body.conversas)
      setSelecionada((atual) => atual ? body.conversas.find((item: Conversation) => item.id === atual.id) || atual : null)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as conversas.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const initial = window.setTimeout(() => void carregar(), 0)
    const interval = window.setInterval(() => { if (!document.hidden) void carregar() }, 10000)
    return () => { window.clearTimeout(initial); window.clearInterval(interval) }
  }, [carregar])

  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: primary }}>Atendimento direto</p><h1 className="mt-1 text-2xl font-black font-rajdhani sm:text-3xl">CHAT DAS EMPRESAS</h1><p className="mt-1 text-sm text-foreground-muted">Conversas privadas iniciadas pelos gestores.</p></div><button type="button" onClick={() => void carregar()} disabled={loading} aria-label="Atualizar conversas" className="min-h-11 min-w-11 border p-3 disabled:opacity-50" style={{ borderColor: 'var(--border)' }}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button></div>
    {error && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
    <div className="grid min-h-[560px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="border-b px-4 py-3 text-[10px] font-black uppercase tracking-widest text-foreground-muted" style={{ borderColor: 'var(--border)' }}>Conversas ({conversas.length})</div>
        <div className="max-h-[620px] overflow-y-auto custom-scrollbar">{loading && conversas.length === 0 ? <p className="p-6 text-center text-xs text-foreground-muted">Carregando...</p> : conversas.length === 0 ? <div className="p-8 text-center"><MessageSquare className="mx-auto mb-2 opacity-30"/><p className="text-xs text-foreground-muted">Nenhum gestor iniciou uma conversa.</p></div> : conversas.map((conversa) => <button key={conversa.id} type="button" onClick={() => setSelecionada(conversa)} className="w-full border-b p-4 text-left transition-colors hover:bg-black/5" style={{ borderColor: 'var(--border)', backgroundColor: selecionada?.id === conversa.id ? `${primary}12` : undefined }}><div className="flex items-start justify-between gap-2"><span className="truncate text-sm font-black uppercase">{conversa.empresa.nome}</span>{conversa.naoLidas > 0 && <span className="min-w-5 rounded-full px-1.5 py-0.5 text-center text-[9px] font-black text-black" style={{ backgroundColor: primary }}>{conversa.naoLidas}</span>}</div><p className="mt-1 truncate text-xs text-foreground-muted">{conversa.ultimaMensagem?.conteudo || 'Sem mensagens'}</p><time className="mt-2 block text-[9px] text-foreground-muted">{new Date(conversa.atualizado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time></button>)}</div>
      </aside>
      {selecionada ? <ChatWorkspace key={selecionada.empresa.id} empresaId={selecionada.empresa.id} title={selecionada.empresa.nome} onMessageSent={() => void carregar()} /> : <div className="flex min-h-[400px] items-center justify-center border p-8 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><div><MessageSquare className="mx-auto mb-3 opacity-30"/><p className="text-sm font-bold">Selecione uma conversa</p><p className="mt-1 text-xs text-foreground-muted">As mensagens do gestor aparecerão aqui.</p></div></div>}
    </div>
  </div>
}
