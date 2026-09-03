'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { CirclePlus, Headset, RefreshCw, TicketCheck } from 'lucide-react'
import ChatWorkspace from '@/components/dashboard/ChatWorkspace'
import type { SupportAllowance, SupportTicket } from '@/components/dashboard/supportTypes'
import { useTheme } from '@/contexts/ThemeContext'
import { CATEGORIAS_TICKET, CATEGORIA_TICKET_LABEL, STATUS_TICKET_LABEL } from '@/lib/suporteConfig'

const FRANQUIA_INICIAL: SupportAllowance = { usados: 0, extras: 0, limite: 0, prazoRespostaHoras: 0 }

export default function SupportTicketCenter() {
  const { primary } = useTheme()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selecionado, setSelecionado] = useState<SupportTicket | null>(null)
  const [franquia, setFranquia] = useState(FRANQUIA_INICIAL)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [novoAberto, setNovoAberto] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ categoria: 'SUPORTE_TECNICO', assunto: '', mensagem: '' })

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    try {
      const response = await fetch('/api/chat', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível carregar os tickets.')
      const lista = Array.isArray(body.tickets) ? body.tickets as SupportTicket[] : []
      setTickets(lista)
      setFranquia(body.franquia ?? FRANQUIA_INICIAL)
      setSelecionado((atual) => atual ? lista.find((ticket) => ticket.id === atual.id) ?? null : lista[0] ?? null)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os tickets.')
    } finally {
      if (!silencioso) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initial = window.setTimeout(() => void carregar(), 0)
    const interval = window.setInterval(() => { if (!document.hidden) void carregar(true) }, 20_000)
    return () => { window.clearTimeout(initial); window.clearInterval(interval) }
  }, [carregar])

  const criarTicket = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/chat/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível abrir o ticket.')
      setForm({ categoria: 'SUPORTE_TECNICO', assunto: '', mensagem: '' })
      setNovoAberto(false)
      await carregar(true)
      setSelecionado(body.ticket)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o ticket.')
    } finally {
      setSaving(false)
    }
  }

  const excederaFranquia = franquia.limite > 0 && franquia.usados >= franquia.limite

  return <div className="space-y-5">
    <header className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end" style={{ borderColor: 'var(--border)' }}>
      <div><p className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: primary }}>Central do gestor</p><h1 className="mt-1 text-2xl font-black font-rajdhani sm:text-3xl">SUPORTE E TICKETS</h1><p className="mt-1 text-sm text-foreground-muted">Solicite suporte, reporte erros e acompanhe cada atendimento por protocolo.</p></div>
      <button type="button" onClick={() => setNovoAberto((valor) => !valor)} className="flex min-h-11 items-center justify-center gap-2 px-4 text-xs font-black uppercase text-black" style={{ backgroundColor: primary }}><CirclePlus size={16} />Novo ticket</button>
    </header>

    <div className="grid gap-3 sm:grid-cols-3">
      <Resumo label="Franquia mensal" value={`${franquia.usados}/${franquia.limite}`} detail="tickets abertos no mês" />
      <Resumo label="Prazo inicial" value={`${franquia.prazoRespostaHoras}h úteis`} detail="conforme o plano atual" />
      <Resumo label="Atendimentos extras" value={String(franquia.extras)} detail="sinalizados neste mês" />
    </div>

    {error && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}

    {novoAberto && <form onSubmit={criarTicket} className="grid gap-4 border p-5 md:grid-cols-2" style={{ borderColor: primary, backgroundColor: 'var(--background-secondary)' }}>
      <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Tipo do atendimento</span><select value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })} className="w-full border bg-background p-3 text-sm outline-none" style={{ borderColor: 'var(--border)' }}>{CATEGORIAS_TICKET.map((categoria) => <option key={categoria} value={categoria}>{CATEGORIA_TICKET_LABEL[categoria]}</option>)}</select></label>
      <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Assunto</span><input required minLength={3} maxLength={160} value={form.assunto} onChange={(event) => setForm({ ...form, assunto: event.target.value })} placeholder="Resumo objetivo do pedido" className="w-full border bg-transparent p-3 text-sm outline-none" style={{ borderColor: 'var(--border)' }} /></label>
      <label className="block md:col-span-2"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Descrição</span><textarea required minLength={3} maxLength={2000} rows={4} value={form.mensagem} onChange={(event) => setForm({ ...form, mensagem: event.target.value })} placeholder="Informe o que ocorreu, quando começou e o resultado esperado." className="w-full resize-y border bg-transparent p-3 text-sm outline-none" style={{ borderColor: 'var(--border)' }} /></label>
      {excederaFranquia && <p className="border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500 md:col-span-2">A franquia mensal foi utilizada. O ticket será aberto normalmente e marcado como atendimento adicional sujeito à cobrança.</p>}
      <div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={() => setNovoAberto(false)} className="border px-4 py-2 text-xs font-bold uppercase" style={{ borderColor: 'var(--border)' }}>Cancelar</button><button disabled={saving} className="px-4 py-2 text-xs font-black uppercase text-black disabled:opacity-50" style={{ backgroundColor: primary }}>{saving ? 'Abrindo...' : 'Abrir ticket'}</button></div>
    </form>}

    <div className="grid min-h-[580px] gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}><span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">Tickets ({tickets.length})</span><button type="button" onClick={() => void carregar()} aria-label="Atualizar tickets" className="p-2"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button></div>
        <div className="max-h-[650px] overflow-y-auto custom-scrollbar">{loading && tickets.length === 0 ? <p className="p-8 text-center text-xs text-foreground-muted">Carregando...</p> : tickets.length === 0 ? <div className="p-10 text-center"><TicketCheck className="mx-auto mb-2 opacity-30" /><p className="text-xs text-foreground-muted">Nenhum ticket aberto ainda.</p></div> : tickets.map((ticket) => <button key={ticket.id} type="button" onClick={() => setSelecionado(ticket)} className="w-full border-b p-4 text-left transition-colors hover:bg-black/5" style={{ borderColor: 'var(--border)', backgroundColor: selecionado?.id === ticket.id ? `${primary}12` : undefined }}><div className="flex items-start justify-between gap-2"><span className="truncate text-sm font-black">{ticket.assunto}</span>{ticket.naoLidas > 0 && <span className="min-w-5 rounded-full px-1.5 py-0.5 text-center text-[9px] font-black text-black" style={{ backgroundColor: primary }}>{ticket.naoLidas}</span>}</div><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-foreground-muted">{ticket.protocolo} · {STATUS_TICKET_LABEL[ticket.status]}</p><p className="mt-2 truncate text-xs text-foreground-muted">{ticket.ultimaMensagem?.conteudo || 'Sem mensagens'}</p>{ticket.cobravelExtra && <span className="mt-2 inline-block border border-amber-500/30 px-1.5 py-0.5 text-[8px] font-black uppercase text-amber-500">Atendimento extra</span>}</button>)}</div>
      </aside>
      {selecionado ? <ChatWorkspace key={selecionado.id} ticketId={selecionado.id} title={selecionado.assunto} protocolo={selecionado.protocolo} status={selecionado.status} onMessageSent={() => void carregar(true)} /> : <div className="flex min-h-[400px] items-center justify-center border p-8 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><div><Headset className="mx-auto mb-3 opacity-30" /><p className="text-sm font-bold">Selecione ou abra um ticket</p><p className="mt-1 text-xs text-foreground-muted">Cada assunto fica separado por protocolo.</p></div></div>}
    </div>
  </div>
}

function Resumo({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><p className="text-[9px] font-bold uppercase tracking-widest text-foreground-muted">{label}</p><p className="mt-1 text-xl font-black">{value}</p><p className="mt-1 text-[10px] text-foreground-muted">{detail}</p></div>
}
