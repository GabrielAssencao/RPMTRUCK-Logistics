'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ClassificacaoCobrancaTicket, PrioridadeTicketSuporte, StatusTicketSuporte } from '@prisma/client'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { ArrowLeft, Bug, CirclePlus, Headset, Loader2, RefreshCw, ShieldAlert, Trash2, X } from 'lucide-react'
import ChatWorkspace from '@/components/dashboard/ChatWorkspace'
import type { SupportAdminSummary, SupportTicket } from '@/components/dashboard/supportTypes'
import { useTheme } from '@/contexts/ThemeContext'
import { CATEGORIAS_TICKET, CATEGORIA_TICKET_LABEL, PRIORIDADE_TICKET_LABEL, STATUS_TICKET_LABEL } from '@/lib/suporteConfig'
import { ActionFeedback } from '@/components/motion/DashboardMotion'
import { ActionConfirmDialog } from '@/components/dashboard/ActionConfirmDialog'

const STATUS = ['ABERTO', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'RESOLVIDO', 'FECHADO'] as const
const PRIORIDADES = ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE'] as const
const RESUMO_INICIAL: SupportAdminSummary = {
  ticketsAtivos: 0,
  mensagensNaoLidas: 0,
  extrasNoMes: 0,
  bugsConfirmadosNoMes: 0,
}

type FiltroTicket = 'ATIVOS' | 'TODOS' | 'EXTRAS' | 'BUGS'
type AlteracaoTicket = {
  status?: StatusTicketSuporte
  prioridade?: PrioridadeTicketSuporte
  classificacaoCobranca?: ClassificacaoCobrancaTicket
  respostasEmpresaHabilitadas?: boolean
}

function rotuloPapelSolicitante(role?: string) {
  if (role === 'OPERADOR') return 'Operador'
  if (role === 'VISUALIZADOR') return 'Visualizador'
  if (role === 'GESTOR_EMPRESA' || role === 'GESTOR') return 'Gestor'
  if (role === 'ADMIN_RPM') return 'Superadmin'
  return 'Usuário'
}

type EmpresaRelacionamento = { id: string; nome: string; status: string; plano: string }

export default function ChatModule({ initialTicketId = null }: { initialTicketId?: string | null }) {
  const { primary } = useTheme()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [empresas, setEmpresas] = useState<EmpresaRelacionamento[]>([])
  const [resumo, setResumo] = useState<SupportAdminSummary>(RESUMO_INICIAL)
  const [selecionado, setSelecionado] = useState<SupportTicket | null>(null)
  const [filtro, setFiltro] = useState<FiltroTicket>('ATIVOS')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [novaConversaAberta, setNovaConversaAberta] = useState(false)
  const [criandoConversa, setCriandoConversa] = useState(false)
  const [novaConversa, setNovaConversa] = useState({ empresaId: '', categoria: 'SOLICITACAO', assunto: '', mensagem: '', respostasEmpresaHabilitadas: true })
  const [classificacaoPendente, setClassificacaoPendente] = useState<ClassificacaoCobrancaTicket | null>(null)
  const ticketInicial = useRef<string | null>(initialTicketId)
  const detalheRef = useRef<HTMLDivElement>(null)
  const voltarFilaRef = useRef<HTMLButtonElement>(null)

  const abrirTicket = (ticket: SupportTicket) => {
    setSelecionado(ticket)
    window.requestAnimationFrame(() => {
      detalheRef.current?.scrollIntoView({ block: 'start' })
      voltarFilaRef.current?.focus({ preventScroll: true })
    })
  }

  const voltarParaFila = () => {
    setSelecionado(null)
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-admin-ticket-queue]')?.scrollIntoView({ block: 'start' })
    })
  }

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    try {
      const response = await fetch(silencioso ? '/api/admin/chat' : '/api/admin/chat?empresas=true', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível carregar os tickets.')
      const lista = Array.isArray(body.tickets) ? body.tickets as SupportTicket[] : []
      setTickets(lista)
      if (Array.isArray(body.empresas)) setEmpresas(body.empresas as EmpresaRelacionamento[])
      setResumo(body.resumo ?? RESUMO_INICIAL)
      const alvo = ticketInicial.current
      ticketInicial.current = null
      setSelecionado((atual) => (alvo ? lista.find((item) => item.id === alvo) : null)
        ?? (atual ? lista.find((item) => item.id === atual.id) : null)
        ?? null)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os tickets.')
    } finally {
      if (!silencioso) setLoading(false)
    }
  }, [])

  const criarConversa = async (event: FormEvent) => {
    event.preventDefault()
    if (criandoConversa) return
    setCriandoConversa(true)
    setError('')
    setFeedback('')
    try {
      const response = await fetch('/api/admin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaConversa),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível iniciar a conversa.')
      ticketInicial.current = body.conversa.id
      setNovaConversa({ empresaId: '', categoria: 'SOLICITACAO', assunto: '', mensagem: '', respostasEmpresaHabilitadas: true })
      setNovaConversaAberta(false)
      setFeedback('Conversa iniciada e gestores notificados.')
      await carregar(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar a conversa.')
    } finally {
      setCriandoConversa(false)
    }
  }

  useEffect(() => {
    ticketInicial.current = new URLSearchParams(window.location.search).get('ticket') ?? ticketInicial.current
    const initial = window.setTimeout(() => void carregar(), 0)
    const interval = window.setInterval(() => { if (!document.hidden) void carregar(true) }, 15_000)
    return () => { window.clearTimeout(initial); window.clearInterval(interval) }
  }, [carregar])

  useEffect(() => {
    if (!initialTicketId) return
    ticketInicial.current = initialTicketId
    const atualizar = window.setTimeout(() => void carregar(true), 0)
    return () => window.clearTimeout(atualizar)
  }, [carregar, initialTicketId])

  const atualizar = async (alteracao: AlteracaoTicket) => {
    if (!selecionado || saving) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/chat/${selecionado.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alteracao),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível atualizar o ticket.')
      await carregar(true)
      setFeedback(alteracao.classificacaoCobranca === 'BUG_SISTEMA_CONFIRMADO'
        ? 'Chamado confirmado como bug do sistema e removido da franquia mensal.'
        : alteracao.classificacaoCobranca === 'ATENDIMENTO'
          ? 'Chamado restaurado como atendimento contabilizado.'
          : 'Chamado atualizado com sucesso.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o ticket.')
    } finally {
      setSaving(false)
    }
  }

  const atualizarClassificacao = (classificacaoCobranca: ClassificacaoCobrancaTicket) => {
    if (!selecionado || classificacaoCobranca === selecionado.classificacaoCobranca) return
    setClassificacaoPendente(classificacaoCobranca)
  }

  const excluirTicket = async () => {
    if (!selecionado || excluindo) return
    setExcluindo(true)
    setError('')
    setFeedback('')
    try {
      const response = await fetch(`/api/admin/chat/${selecionado.id}`, { method: 'DELETE' })
      const body = await response.json() as { erro?: string; protocolo?: string; mensagensRemovidas?: number; notificacoesRemovidas?: number }
      if (!response.ok) throw new Error(body.erro || 'Não foi possível excluir o chamado.')
      setConfirmarExclusao(false)
      setSelecionado(null)
      setFeedback(`${body.protocolo || 'Chamado'} excluído: ${body.mensagensRemovidas ?? 0} mensagem(ns) e ${body.notificacoesRemovidas ?? 0} notificação(ões) vinculada(s) removidas.`)
      await carregar(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível excluir o chamado.')
    } finally {
      setExcluindo(false)
    }
  }

  const exibidos = useMemo(() => tickets.filter((ticket) => {
    if (filtro === 'EXTRAS') return ticket.cobravelExtra
    if (filtro === 'BUGS') return ticket.classificacaoCobranca === 'BUG_SISTEMA_CONFIRMADO'
    if (filtro === 'ATIVOS') return ticket.status !== 'RESOLVIDO' && ticket.status !== 'FECHADO'
    return true
  }), [filtro, tickets])

  return (
    <MotionConfig reducedMotion="user">
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end" style={{ borderColor: 'var(--border)' }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: primary }}>Central de relacionamento</p>
          <h1 className="mt-1 font-rajdhani text-2xl font-black sm:text-3xl">CONVERSAS DAS EMPRESAS</h1>
          <p className="mt-1 text-sm text-foreground-muted">Atenda tickets ou inicie contatos de feedback, onboarding e acompanhamento financeiro.</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2 sm:flex"><button type="button" onClick={() => setNovaConversaAberta((aberta) => !aberta)} className="inline-flex min-h-11 items-center justify-center gap-2 border px-4 text-xs font-black uppercase" style={{ borderColor: primary, color: primary }}><CirclePlus size={16} />Iniciar conversa</button><button type="button" onClick={() => void carregar()} disabled={loading} aria-label="Atualizar conversas" className="flex min-h-11 min-w-11 items-center justify-center border p-3 disabled:opacity-50" style={{ borderColor: 'var(--border)' }}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button></div>
      </header>

      {novaConversaAberta && <form onSubmit={criarConversa} className="grid gap-4 border p-5 md:grid-cols-2" style={{ borderColor: primary, backgroundColor: 'var(--background-secondary)' }}>
        <div className="md:col-span-2"><h2 className="text-sm font-black uppercase">Nova conversa administrativa</h2><p className="mt-1 text-xs text-foreground-muted">Somente gestores da empresa receberão a notificação. Este contato não consome a franquia de suporte.</p></div>
        <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Empresa</span><select required value={novaConversa.empresaId} onChange={(event) => setNovaConversa((atual) => ({ ...atual, empresaId: event.target.value }))} className="w-full border bg-background p-3 text-sm" style={{ borderColor: 'var(--border)' }}><option value="">Selecione uma empresa</option>{empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome} · {empresa.plano} · {empresa.status}</option>)}</select></label>
        <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Assunto</span><input required minLength={3} maxLength={160} value={novaConversa.assunto} onChange={(event) => setNovaConversa((atual) => ({ ...atual, assunto: event.target.value }))} placeholder="Ex.: Acompanhamento do primeiro mês" className="w-full border bg-background p-3 text-sm" style={{ borderColor: 'var(--border)' }} /></label>
        <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Tipo de contato</span><select value={novaConversa.categoria} onChange={(event) => setNovaConversa((atual) => ({ ...atual, categoria: event.target.value }))} className="w-full border bg-background p-3 text-sm" style={{ borderColor: 'var(--border)' }}>{CATEGORIAS_TICKET.map((categoria) => <option key={categoria} value={categoria}>{CATEGORIA_TICKET_LABEL[categoria]}</option>)}</select></label>
        <label className="flex items-start gap-3 border p-3" style={{ borderColor: 'var(--border)' }}><input type="checkbox" checked={novaConversa.respostasEmpresaHabilitadas} onChange={(event) => setNovaConversa((atual) => ({ ...atual, respostasEmpresaHabilitadas: event.target.checked }))} className="mt-1" /><span><strong className="block text-xs">Permitir resposta da empresa</strong><small className="mt-1 block text-xs text-foreground-muted">Pode ser pausada ou reativada depois, sem apagar o histórico.</small></span></label>
        <label className="block md:col-span-2"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Mensagem</span><textarea required minLength={3} maxLength={2000} rows={5} value={novaConversa.mensagem} onChange={(event) => setNovaConversa((atual) => ({ ...atual, mensagem: event.target.value }))} placeholder="Escreva uma mensagem objetiva e nunca envie dados bancários ou credenciais pelo chat." className="w-full resize-y border bg-background p-3 text-sm" style={{ borderColor: 'var(--border)' }} /></label>
        <div className="flex justify-end gap-2 md:col-span-2"><button type="button" disabled={criandoConversa} onClick={() => setNovaConversaAberta(false)} className="min-h-11 border px-4 text-xs font-bold uppercase" style={{ borderColor: 'var(--border)' }}>Cancelar</button><button type="submit" disabled={criandoConversa} className="min-h-11 px-4 text-xs font-black uppercase text-black disabled:opacity-50" style={{ backgroundColor: primary }}>{criandoConversa ? 'Iniciando...' : 'Iniciar e notificar'}</button></div>
      </form>}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <Resumo label="Tickets ativos" value={String(resumo.ticketsAtivos)} />
        <Resumo label="Mensagens não lidas" value={String(resumo.mensagensNaoLidas)} />
        <Resumo label="Extras no mês" value={String(resumo.extrasNoMes)} />
        <Resumo label="Bugs isentos no mês" value={String(resumo.bugsConfirmadosNoMes)} />
      </div>

      {error && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
      {feedback && <ActionFeedback message={feedback} tone="success" />}

      <div className="grid grid-cols-4 gap-2" aria-label="Filtros de chamados">
        {(['ATIVOS', 'TODOS', 'EXTRAS', 'BUGS'] as const).map((item) => (
          <button key={item} type="button" onClick={() => setFiltro(item)} className="min-h-11 border px-2 py-2 text-[9px] font-black uppercase sm:px-3 sm:text-[10px]" style={{ borderColor: filtro === item ? primary : 'var(--border)', color: filtro === item ? primary : 'var(--foreground-muted)' }}>
            {item}
          </button>
        ))}
      </div>

      <div className="grid min-h-[600px] gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside data-admin-ticket-queue className={`${selecionado ? 'hidden xl:block' : 'block'} min-w-0 border`} style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }} aria-label="Fila de chamados">
          <div className="border-b px-4 py-3 text-[10px] font-black uppercase tracking-widest text-foreground-muted" style={{ borderColor: 'var(--border)' }}>Fila ({exibidos.length})</div>
          <div className="max-h-[680px] overflow-y-auto custom-scrollbar">
            {loading && tickets.length === 0 ? (
              <p className="p-6 text-center text-xs text-foreground-muted">Carregando...</p>
            ) : exibidos.length === 0 ? (
              <div className="p-8 text-center"><Headset className="mx-auto mb-2 opacity-30"/><p className="text-xs text-foreground-muted">Nenhum ticket neste filtro.</p></div>
            ) : exibidos.map((ticket) => (
              <button key={ticket.id} type="button" onClick={() => abrirTicket(ticket)} aria-pressed={selecionado?.id === ticket.id} className="w-full border-b p-4 text-left transition-colors hover:bg-black/5" style={{ borderColor: 'var(--border)', backgroundColor: selecionado?.id === ticket.id ? `${primary}12` : undefined }}>
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate text-sm font-black uppercase">{ticket.empresa?.nome}</span>
                  {ticket.naoLidas > 0 && <span className="min-w-5 rounded-full px-1.5 py-0.5 text-center text-[9px] font-black text-black" style={{ backgroundColor: primary }}>{ticket.naoLidas}</span>}
                </div>
                <p className="mt-1 truncate text-xs font-bold">{ticket.assunto}</p>
                <p className="mt-1 truncate text-[9px] uppercase text-foreground-muted">Aberto por {rotuloPapelSolicitante(ticket.abertoPor?.role)}{ticket.abertoPor?.nome ? ` · ${ticket.abertoPor.nome}` : ''}</p>
                <p className="mt-1 text-[9px] uppercase text-foreground-muted">{ticket.protocolo} · {STATUS_TICKET_LABEL[ticket.status]}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="border px-1.5 py-0.5 text-[8px] uppercase" style={{ borderColor: 'var(--border)' }}>{CATEGORIA_TICKET_LABEL[ticket.categoria]}</span>
                  {ticket.origem === 'SUPERADMIN' && <span className="border px-1.5 py-0.5 text-[8px] font-black uppercase" style={{ borderColor: primary, color: primary }}>Iniciada pelo Admin</span>}
                  {ticket.cobravelExtra && <span className="border border-amber-500/30 px-1.5 py-0.5 text-[8px] font-black uppercase text-amber-500">Extra #{ticket.ordemNaCompetencia}</span>}
                  {ticket.classificacaoCobranca === 'BUG_SISTEMA_CONFIRMADO' && <span className="border border-blue-500/30 px-1.5 py-0.5 text-[8px] font-black uppercase text-blue-400"><Bug size={9} className="mr-1 inline" />Bug isento</span>}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {selecionado && selecionado.empresa ? (
          <div ref={detalheRef} data-testid="admin-ticket-detail" className="min-w-0 scroll-mt-3 space-y-3">
            <div className="sticky top-0 z-20 flex items-center gap-3 border p-3 xl:hidden" style={{ borderColor: primary, backgroundColor: 'var(--background)' }}>
              <button ref={voltarFilaRef} type="button" onClick={voltarParaFila} className="inline-flex min-h-11 shrink-0 items-center gap-2 border px-3 text-[10px] font-black uppercase" style={{ borderColor: primary, color: primary }}><ArrowLeft size={15} />Fila</button>
              <div className="min-w-0"><p className="truncate text-xs font-black uppercase">{selecionado.empresa.nome}</p><p className="truncate text-[10px] text-foreground-muted">{selecionado.assunto}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3 border p-3 sm:p-4 xl:grid-cols-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
              <label>
                <span className="mb-1 block text-[9px] font-bold uppercase text-foreground-muted">Status</span>
                <select disabled={saving} value={selecionado.status} onChange={(event) => void atualizar({ status: event.target.value as StatusTicketSuporte })} className="w-full border bg-background p-2 text-xs" style={{ borderColor: 'var(--border)' }}>
                  {STATUS.map((status) => <option key={status} value={status}>{STATUS_TICKET_LABEL[status]}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-[9px] font-bold uppercase text-foreground-muted">Prioridade</span>
                <select disabled={saving} value={selecionado.prioridade} onChange={(event) => void atualizar({ prioridade: event.target.value as PrioridadeTicketSuporte })} className="w-full border bg-background p-2 text-xs" style={{ borderColor: 'var(--border)' }}>
                  {PRIORIDADES.map((prioridade) => <option key={prioridade} value={prioridade}>{PRIORIDADE_TICKET_LABEL[prioridade]}</option>)}
                </select>
              </label>
              {selecionado.origem === 'SUPERADMIN' ? <>
                <div><span className="mb-1 block text-[9px] font-bold uppercase text-foreground-muted">Cobertura</span><p className="border p-2 text-xs font-bold text-green-500" style={{ borderColor: 'var(--border)' }}>Administrativo · sem franquia</p></div>
                <div><span className="mb-1 block text-[9px] font-bold uppercase text-foreground-muted">Respostas da empresa</span><button type="button" disabled={saving} onClick={() => void atualizar({ respostasEmpresaHabilitadas: !selecionado.respostasEmpresaHabilitadas })} className={`w-full border p-2 text-left text-xs font-bold disabled:opacity-50 ${selecionado.respostasEmpresaHabilitadas ? 'text-green-500' : 'text-amber-500'}`} style={{ borderColor: 'var(--border)' }}>{selecionado.respostasEmpresaHabilitadas ? 'Permitidas · pausar' : 'Pausadas · reativar'}</button></div>
              </> : <>
                <label><span className="mb-1 block text-[9px] font-bold uppercase text-foreground-muted">Classificação da franquia</span><select disabled={saving} value={selecionado.classificacaoCobranca} onChange={(event) => atualizarClassificacao(event.target.value as ClassificacaoCobrancaTicket)} className="w-full border bg-background p-2 text-xs" style={{ borderColor: 'var(--border)' }}><option value="ATENDIMENTO">Atendimento contabilizado</option><option value="BUG_SISTEMA_CONFIRMADO">Bug do sistema confirmado</option></select></label>
                <div><span className="mb-1 block text-[9px] font-bold uppercase text-foreground-muted">Cobertura</span>{selecionado.classificacaoCobranca === 'BUG_SISTEMA_CONFIRMADO' ? <p className="border border-blue-500/30 p-2 text-xs font-bold text-blue-400">Isento · não consome franquia</p> : <p className={`border p-2 text-xs font-bold ${selecionado.cobravelExtra ? 'border-amber-500/30 text-amber-500' : 'text-green-500'}`} style={!selecionado.cobravelExtra ? { borderColor: 'var(--border)' } : undefined}>{selecionado.cobravelExtra ? `Extra · ticket ${selecionado.ordemNaCompetencia}/${selecionado.franquiaNoMomento}` : `Incluso · ticket ${selecionado.ordemNaCompetencia}/${selecionado.franquiaNoMomento}`}</p>}</div>
              </>}
            </div>
            {selecionado.origem !== 'SUPERADMIN' && <div className="flex justify-end">
              <button type="button" onClick={() => setConfirmarExclusao(true)} disabled={saving || excluindo} className="interactive-control flex min-h-11 items-center gap-2 border border-red-500/50 px-4 text-[10px] font-black uppercase text-red-500 hover:bg-red-500/10 disabled:opacity-40"><Trash2 size={14} /> Excluir chamado</button>
            </div>}
            {selecionado.origem === 'SUPERADMIN' ? <p className="border border-green-500/20 bg-green-500/5 p-3 text-[10px] text-foreground-muted">Conversa administrativa preservada no histórico. Ela não consome franquia e pode ser encerrada ou reaberta pelo status acima.</p> : <p className="border border-blue-500/20 bg-blue-500/5 p-3 text-[10px] text-foreground-muted">Classifique como bug somente depois de reproduzir e confirmar uma falha do sistema. Dúvidas, auxílio operacional, cadastros e solicitações continuam contabilizados.</p>}
            <ChatWorkspace key={`${selecionado.id}:${selecionado.status}:${selecionado.respostasEmpresaHabilitadas}`} ticketId={selecionado.id} empresaId={selecionado.empresa.id} title={`${selecionado.empresa.nome} · ${selecionado.assunto}`} protocolo={selecionado.protocolo} status={selecionado.status} respostasEmpresaHabilitadas={selecionado.respostasEmpresaHabilitadas} onMessageSent={() => void carregar(true)} />
          </div>
        ) : (
          <div className="hidden min-h-[400px] items-center justify-center border p-8 text-center xl:flex" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
            <div><Headset className="mx-auto mb-3 opacity-30"/><p className="text-sm font-bold">Selecione um ticket</p><p className="mt-1 text-xs text-foreground-muted">A fila prioriza os atendimentos atualizados recentemente.</p></div>
          </div>
        )}
      </div>

      <ActionConfirmDialog
        open={Boolean(classificacaoPendente)}
        tone="warning"
        eyebrow="Impacto na franquia"
        title={classificacaoPendente === 'BUG_SISTEMA_CONFIRMADO' ? 'Confirmar bug do sistema' : 'Contabilizar como atendimento'}
        description={classificacaoPendente === 'BUG_SISTEMA_CONFIRMADO'
          ? 'Confirme somente se a equipe reproduziu e validou a falha. Este chamado deixará de consumir a franquia mensal da empresa.'
          : 'Este chamado voltará a consumir a franquia mensal e poderá alterar a cobrança dos tickets seguintes.'}
        confirmLabel={classificacaoPendente === 'BUG_SISTEMA_CONFIRMADO' ? 'Confirmar como bug' : 'Contabilizar chamado'}
        cancelLabel="Manter classificação"
        loading={saving}
        onClose={() => { if (!saving) setClassificacaoPendente(null) }}
        onConfirm={() => {
          if (!classificacaoPendente) return
          const classificacao = classificacaoPendente
          setClassificacaoPendente(null)
          void atualizar({ classificacaoCobranca: classificacao })
        }}
      />

      <AnimatePresence>
        {confirmarExclusao && selecionado && (
          <motion.div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget && !excluindo) setConfirmarExclusao(false) }}>
            <motion.div role="alertdialog" aria-modal="true" aria-labelledby="titulo-excluir-ticket" aria-describedby="descricao-excluir-ticket" className="relative w-full max-w-lg overflow-hidden border border-red-500 bg-background shadow-2xl" initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}>
              <span className="absolute inset-x-0 top-0 h-1 bg-red-500" />
              <div className="flex items-start justify-between gap-4 p-5 pt-6 sm:p-6 sm:pt-7"><div className="flex gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center border border-red-500/60 text-red-500"><ShieldAlert size={20} /></div><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500">Ação irreversível</p><h2 id="titulo-excluir-ticket" className="mt-1 font-rajdhani text-xl font-black uppercase">Excluir chamado</h2><p id="descricao-excluir-ticket" className="mt-2 text-sm leading-relaxed text-foreground-muted">O ticket <strong className="text-foreground">{selecionado.protocolo}</strong>, todas as mensagens e todas as notificações vinculadas serão removidos permanentemente. A franquia da empresa será recalculada.</p></div></div><button type="button" disabled={excluindo} onClick={() => setConfirmarExclusao(false)} aria-label="Cancelar exclusão" className="p-2 text-foreground-muted disabled:opacity-40"><X size={17} /></button></div>
              <div className="flex flex-col-reverse gap-2 border-t p-5 sm:flex-row sm:justify-end" style={{ borderColor: 'var(--border)' }}><button type="button" disabled={excluindo} onClick={() => setConfirmarExclusao(false)} className="min-h-11 border px-5 text-xs font-black uppercase disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>Manter chamado</button><motion.button type="button" autoFocus disabled={excluindo} onClick={() => void excluirTicket()} whileTap={excluindo ? undefined : { scale: 0.985 }} className="flex min-h-11 items-center justify-center gap-2 bg-red-500 px-5 text-xs font-black uppercase text-white disabled:cursor-wait disabled:opacity-70">{excluindo ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}{excluindo ? 'Excluindo tudo...' : 'Excluir permanentemente'}</motion.button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  )
}

function Resumo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border p-3 sm:p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-foreground-muted">{label}</p>
      <p className="mt-1 text-xl font-black sm:text-2xl">{value}</p>
    </div>
  )
}
