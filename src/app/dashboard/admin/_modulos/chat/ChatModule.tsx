'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PrioridadeTicketSuporte, StatusTicketSuporte } from '@prisma/client'
import { Headset, RefreshCw } from 'lucide-react'
import ChatWorkspace from '@/components/dashboard/ChatWorkspace'
import type { SupportTicket } from '@/components/dashboard/supportTypes'
import { useTheme } from '@/contexts/ThemeContext'
import { CATEGORIA_TICKET_LABEL, PRIORIDADE_TICKET_LABEL, STATUS_TICKET_LABEL } from '@/lib/suporteConfig'

const STATUS = ['ABERTO', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'RESOLVIDO', 'FECHADO'] as const
const PRIORIDADES = ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE'] as const

export default function ChatModule() {
  const { primary } = useTheme()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selecionado, setSelecionado] = useState<SupportTicket | null>(null)
  const [filtro, setFiltro] = useState<'ATIVOS' | 'TODOS' | 'EXTRAS'>('ATIVOS')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    try {
      const response = await fetch('/api/admin/chat', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível carregar os tickets.')
      const lista = Array.isArray(body.tickets) ? body.tickets as SupportTicket[] : []
      setTickets(lista)
      setSelecionado((atual) => atual ? lista.find((item) => item.id === atual.id) ?? null : null)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os tickets.')
    } finally {
      if (!silencioso) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initial = window.setTimeout(() => void carregar(), 0)
    const interval = window.setInterval(() => { if (!document.hidden) void carregar(true) }, 15_000)
    return () => { window.clearTimeout(initial); window.clearInterval(interval) }
  }, [carregar])

  const atualizar = async (alteracao: { status?: StatusTicketSuporte; prioridade?: PrioridadeTicketSuporte }) => {
    if (!selecionado || saving) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/chat/${selecionado.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(alteracao),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível atualizar o ticket.')
      await carregar(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o ticket.')
    } finally {
      setSaving(false)
    }
  }

  const exibidos = useMemo(() => tickets.filter((ticket) => {
    if (filtro === 'EXTRAS') return ticket.cobravelExtra
    if (filtro === 'ATIVOS') return ticket.status !== 'RESOLVIDO' && ticket.status !== 'FECHADO'
    return true
  }), [filtro, tickets])

  const naoLidos = tickets.reduce((total, ticket) => total + ticket.naoLidas, 0)
  const extras = tickets.filter((ticket) => ticket.cobravelExtra).length

  return <div className="space-y-5">
    <header className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end" style={{ borderColor: 'var(--border)' }}><div><p className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: primary }}>Central de atendimento</p><h1 className="mt-1 text-2xl font-black font-rajdhani sm:text-3xl">TICKETS DAS EMPRESAS</h1><p className="mt-1 text-sm text-foreground-muted">Triagem, respostas, prioridade e controle de atendimentos adicionais.</p></div><button type="button" onClick={() => void carregar()} disabled={loading} aria-label="Atualizar tickets" className="min-h-11 min-w-11 border p-3 disabled:opacity-50" style={{ borderColor: 'var(--border)' }}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button></header>
    <div className="grid gap-3 sm:grid-cols-3"><Resumo label="Tickets ativos" value={String(tickets.filter((ticket) => ticket.status !== 'RESOLVIDO' && ticket.status !== 'FECHADO').length)} /><Resumo label="Mensagens não lidas" value={String(naoLidos)} /><Resumo label="Atendimentos extras" value={String(extras)} /></div>
    {error && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
    <div className="flex flex-wrap gap-2">{(['ATIVOS', 'TODOS', 'EXTRAS'] as const).map((item) => <button key={item} type="button" onClick={() => setFiltro(item)} className="border px-3 py-2 text-[10px] font-black uppercase" style={{ borderColor: filtro === item ? primary : 'var(--border)', color: filtro === item ? primary : 'var(--foreground-muted)' }}>{item}</button>)}</div>
    <div className="grid min-h-[600px] gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><div className="border-b px-4 py-3 text-[10px] font-black uppercase tracking-widest text-foreground-muted" style={{ borderColor: 'var(--border)' }}>Fila ({exibidos.length})</div><div className="max-h-[680px] overflow-y-auto custom-scrollbar">{loading && tickets.length === 0 ? <p className="p-6 text-center text-xs text-foreground-muted">Carregando...</p> : exibidos.length === 0 ? <div className="p-8 text-center"><Headset className="mx-auto mb-2 opacity-30"/><p className="text-xs text-foreground-muted">Nenhum ticket neste filtro.</p></div> : exibidos.map((ticket) => <button key={ticket.id} type="button" onClick={() => setSelecionado(ticket)} className="w-full border-b p-4 text-left transition-colors hover:bg-black/5" style={{ borderColor: 'var(--border)', backgroundColor: selecionado?.id === ticket.id ? `${primary}12` : undefined }}><div className="flex items-start justify-between gap-2"><span className="truncate text-sm font-black uppercase">{ticket.empresa?.nome}</span>{ticket.naoLidas > 0 && <span className="min-w-5 rounded-full px-1.5 py-0.5 text-center text-[9px] font-black text-black" style={{ backgroundColor: primary }}>{ticket.naoLidas}</span>}</div><p className="mt-1 truncate text-xs font-bold">{ticket.assunto}</p><p className="mt-1 text-[9px] uppercase text-foreground-muted">{ticket.protocolo} · {STATUS_TICKET_LABEL[ticket.status]}</p><div className="mt-2 flex flex-wrap gap-1"><span className="border px-1.5 py-0.5 text-[8px] uppercase" style={{ borderColor: 'var(--border)' }}>{CATEGORIA_TICKET_LABEL[ticket.categoria]}</span>{ticket.cobravelExtra && <span className="border border-amber-500/30 px-1.5 py-0.5 text-[8px] font-black uppercase text-amber-500">Extra #{ticket.ordemNaCompetencia}</span>}</div></button>)}</div></aside>
      {selecionado && selecionado.empresa ? <div className="space-y-3"><div className="grid gap-3 border p-4 sm:grid-cols-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><label><span className="mb-1 block text-[9px] font-bold uppercase text-foreground-muted">Status</span><select disabled={saving} value={selecionado.status} onChange={(event) => void atualizar({ status: event.target.value as StatusTicketSuporte })} className="w-full border bg-background p-2 text-xs" style={{ borderColor: 'var(--border)' }}>{STATUS.map((status) => <option key={status} value={status}>{STATUS_TICKET_LABEL[status]}</option>)}</select></label><label><span className="mb-1 block text-[9px] font-bold uppercase text-foreground-muted">Prioridade</span><select disabled={saving} value={selecionado.prioridade} onChange={(event) => void atualizar({ prioridade: event.target.value as PrioridadeTicketSuporte })} className="w-full border bg-background p-2 text-xs" style={{ borderColor: 'var(--border)' }}>{PRIORIDADES.map((prioridade) => <option key={prioridade} value={prioridade}>{PRIORIDADE_TICKET_LABEL[prioridade]}</option>)}</select></label><div><span className="mb-1 block text-[9px] font-bold uppercase text-foreground-muted">Cobertura</span><p className={`border p-2 text-xs font-bold ${selecionado.cobravelExtra ? 'border-amber-500/30 text-amber-500' : 'text-green-500'}`} style={!selecionado.cobravelExtra ? { borderColor: 'var(--border)' } : undefined}>{selecionado.cobravelExtra ? `Extra · ticket ${selecionado.ordemNaCompetencia}/${selecionado.franquiaNoMomento}` : `Incluso · ticket ${selecionado.ordemNaCompetencia}/${selecionado.franquiaNoMomento}`}</p></div></div><ChatWorkspace key={`${selecionado.id}:${selecionado.status}`} ticketId={selecionado.id} empresaId={selecionado.empresa.id} title={`${selecionado.empresa.nome} · ${selecionado.assunto}`} protocolo={selecionado.protocolo} status={selecionado.status} onMessageSent={() => void carregar(true)} /></div> : <div className="flex min-h-[400px] items-center justify-center border p-8 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><div><Headset className="mx-auto mb-3 opacity-30"/><p className="text-sm font-bold">Selecione um ticket</p><p className="mt-1 text-xs text-foreground-muted">A fila prioriza os atendimentos atualizados recentemente.</p></div></div>}
    </div>
  </div>
}

function Resumo({ label, value }: { label: string; value: string }) {
  return <div className="border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><p className="text-[9px] font-bold uppercase tracking-widest text-foreground-muted">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>
}
