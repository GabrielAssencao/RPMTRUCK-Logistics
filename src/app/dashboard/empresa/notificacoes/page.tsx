'use client'

import { useEffect, useState } from 'react'
import { Bell, Check, CheckCheck, ChevronLeft, ChevronRight, Inbox, Trash2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { NOTIFICACOES_ATUALIZADAS_EVENT, type Notificacao } from '@/hooks/useNotificacoes'

type FiltroLeitura = 'todas' | 'nao_lidas' | 'lidas'

interface RespostaNotificacoes {
  notificacoes: Notificacao[]
  naoLidas: number
  pagina: number
  total: number
  totalPaginas: number
}

const FILTROS: Array<{ valor: FiltroLeitura; label: string }> = [
  { valor: 'todas', label: 'Todas' },
  { valor: 'nao_lidas', label: 'Não lidas' },
  { valor: 'lidas', label: 'Lidas' },
]

const CORES_MODULO: Record<string, string> = {
  FROTA: '#f59e0b',
  MOTORISTAS: '#3b82f6',
  CONTAINERS: '#8b5cf6',
  CUSTOS: '#10b981',
  TAREFAS: '#06b6d4',
  RELATORIOS: '#a3e635',
  USUARIOS: '#f97316',
  SEGURANÇA: '#ef4444',
}

export default function CentralNotificacoesPage() {
  const { primary } = useTheme()
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [filtro, setFiltro] = useState<FiltroLeitura>('todas')
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [naoLidas, setNaoLidas] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [feedback, setFeedback] = useState('')
  const [revisao, setRevisao] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ pagina: String(pagina), limite: '20' })
    if (filtro !== 'todas') params.set('lidas', String(filtro === 'lidas'))

    fetch(`/api/notificacoes?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json() as RespostaNotificacoes & { erro?: string }
        if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar as notificações.')
        setNotificacoes(data.notificacoes)
        setNaoLidas(data.naoLidas)
        setTotal(data.total)
        setTotalPaginas(data.totalPaginas)
        if (pagina > data.totalPaginas) setPagina(data.totalPaginas)
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setErro(error instanceof Error ? error.message : 'Não foi possível carregar as notificações.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [filtro, pagina, revisao])

  const avisarLayout = () => window.dispatchEvent(new Event(NOTIFICACOES_ATUALIZADAS_EVENT))

  const marcarComoLida = async (notificacao: Notificacao) => {
    if (notificacao.lida || processando) return
    setProcessando(notificacao.id)
    setErro('')
    try {
      const response = await fetch(`/api/notificacoes/${notificacao.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lida: true }),
      })
      if (!response.ok) throw new Error('Não foi possível marcar a notificação como lida.')
      setNotificacoes(atuais => filtro === 'nao_lidas'
        ? atuais.filter(item => item.id !== notificacao.id)
        : atuais.map(item => item.id === notificacao.id ? { ...item, lida: true } : item))
      setNaoLidas(atual => Math.max(0, atual - 1))
      setFeedback('Notificação marcada como lida.')
      avisarLayout()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao atualizar a notificação.')
    } finally {
      setProcessando(null)
    }
  }

  const marcarTodasComoLidas = async () => {
    if (naoLidas === 0 || processando) return
    setProcessando('todas')
    setErro('')
    try {
      const response = await fetch('/api/notificacoes', { method: 'PATCH' })
      if (!response.ok) throw new Error('Não foi possível marcar todas como lidas.')
      setFeedback(`${naoLidas} notificação(ões) marcada(s) como lida(s).`)
      setLoading(true)
      setPagina(1)
      setRevisao(atual => atual + 1)
      avisarLayout()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao atualizar as notificações.')
    } finally {
      setProcessando(null)
    }
  }

  const limparLidas = async () => {
    if (processando || !window.confirm('Remover permanentemente todas as notificações já lidas? As não lidas serão preservadas.')) return
    setProcessando('limpar')
    setErro('')
    try {
      const response = await fetch('/api/notificacoes', { method: 'DELETE' })
      const data = await response.json() as { removidas?: number; erro?: string }
      if (!response.ok) throw new Error(data.erro || 'Não foi possível limpar as notificações lidas.')
      setFeedback(`${data.removidas ?? 0} notificação(ões) lida(s) removida(s).`)
      setLoading(true)
      setPagina(1)
      setRevisao(atual => atual + 1)
      avisarLayout()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao limpar as notificações.')
    } finally {
      setProcessando(null)
    }
  }

  const excluirNotificacao = async (notificacao: Notificacao) => {
    if (processando || !window.confirm(`Excluir permanentemente a notificação “${notificacao.titulo}”?`)) return
    setProcessando(notificacao.id)
    setErro('')
    try {
      const response = await fetch(`/api/notificacoes/${notificacao.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Não foi possível excluir a notificação.')
      setFeedback('Notificação excluída.')
      setLoading(true)
      setRevisao(atual => atual + 1)
      avisarLayout()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao excluir a notificação.')
    } finally {
      setProcessando(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 font-mono">
      <div className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between" style={{ borderColor: 'var(--border)' }}>
        <div>
          <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: primary }}><Bell size={13} /> Comunicação operacional</p>
          <h1 className="text-3xl font-black uppercase tracking-tight font-rajdhani">Central de <span style={{ color: primary }}>Notificações</span></h1>
          <p className="mt-1 text-sm text-foreground-muted">Consulte o histórico, acompanhe o estado de leitura e mantenha a caixa organizada.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={naoLidas === 0 || Boolean(processando)} onClick={() => void marcarTodasComoLidas()} className="flex items-center gap-2 border px-4 py-2 text-[10px] font-bold uppercase disabled:opacity-40" style={{ borderColor: primary, color: primary }}><CheckCheck size={14} /> Marcar todas como lidas</button>
          <button type="button" disabled={Boolean(processando)} onClick={() => void limparLidas()} className="flex items-center gap-2 border border-red-500/40 px-4 py-2 text-[10px] font-bold uppercase text-red-500 disabled:opacity-40"><Trash2 size={14} /> Limpar lidas</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ResumoCard label="Não lidas" valor={naoLidas} destaque={primary} />
        <ResumoCard label="Neste filtro" valor={total} />
        <ResumoCard label="Página atual" valor={`${pagina} / ${totalPaginas}`} />
      </div>

      {(erro || feedback) && <div role={erro ? 'alert' : 'status'} className={`border p-3 text-xs ${erro ? 'border-red-500/40 text-red-500' : ''}`} style={erro ? undefined : { borderColor: primary, color: primary }}>{erro || feedback}</div>}

      <section className="overflow-hidden border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-xs font-bold uppercase tracking-widest">Histórico de notificações</h2>
          <div className="flex border" style={{ borderColor: 'var(--border)' }} aria-label="Filtrar notificações por leitura">
            {FILTROS.map(item => {
              const ativo = filtro === item.valor
              return <button key={item.valor} type="button" aria-pressed={ativo} onClick={() => { setLoading(true); setErro(''); setFiltro(item.valor); setPagina(1); setFeedback('') }} className="px-3 py-2 text-[10px] font-bold uppercase transition-colors" style={{ backgroundColor: ativo ? primary : 'transparent', color: ativo ? '#000' : 'var(--foreground-muted)' }}>{item.label}</button>
            })}
          </div>
        </div>

        <div aria-live="polite" aria-busy={loading}>
          {loading ? (
            <div className="space-y-3 p-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse border bg-foreground/5" style={{ borderColor: 'var(--border)' }} />)}</div>
          ) : notificacoes.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center"><Inbox size={30} className="mb-3 text-foreground-muted" /><p className="text-sm font-bold">Nenhuma notificação neste filtro</p><p className="mt-1 text-xs text-foreground-muted">Quando houver uma nova ocorrência, ela aparecerá aqui.</p></div>
          ) : (
            <div className="divide-y [&>article]:border-[var(--border)]">
              {notificacoes.map(notificacao => {
                const corModulo = CORES_MODULO[notificacao.modulo] || primary
                return (
                  <article key={notificacao.id} className="group grid gap-4 border-t-0 p-4 transition-colors hover:bg-white/[0.03] sm:grid-cols-[auto_1fr_auto]" style={{ backgroundColor: notificacao.lida ? 'transparent' : `${primary}08` }}>
                    <span className="mt-1 h-3 w-3 border" style={{ borderColor: corModulo, backgroundColor: notificacao.lida ? 'transparent' : corModulo }} aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ borderColor: `${corModulo}88`, color: corModulo }}>{notificacao.modulo}</span>
                        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: notificacao.lida ? 'var(--foreground-muted)' : primary }}>{notificacao.lida ? 'Lida' : 'Não lida'}</span>
                      </div>
                      <h3 className="mt-2 break-words text-sm font-bold">{notificacao.titulo}</h3>
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-foreground-muted">{notificacao.mensagem}</p>
                      {notificacao.veiculo && <p className="mt-2 text-[10px] font-bold uppercase text-foreground-muted">Veículo: {notificacao.veiculo.modelo} • {notificacao.veiculo.placa}</p>}
                      <time dateTime={notificacao.criado_em} className="mt-2 block text-[9px] text-foreground-muted">{new Date(notificacao.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time>
                    </div>
                    <div className="flex items-start gap-1 sm:justify-end">
                      {!notificacao.lida && <button type="button" disabled={Boolean(processando)} onClick={() => void marcarComoLida(notificacao)} className="p-2 text-foreground-muted transition-colors hover:text-foreground disabled:opacity-40" title="Marcar como lida" aria-label={`Marcar “${notificacao.titulo}” como lida`}><Check size={15} /></button>}
                      <button type="button" disabled={Boolean(processando)} onClick={() => void excluirNotificacao(notificacao)} className="p-2 text-foreground-muted transition-colors hover:text-red-500 disabled:opacity-40" title="Excluir notificação" aria-label={`Excluir “${notificacao.titulo}”`}><Trash2 size={15} /></button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        {totalPaginas > 1 && <div className="flex items-center justify-between border-t p-4" style={{ borderColor: 'var(--border)' }}>
          <button type="button" disabled={pagina <= 1 || loading} onClick={() => { setLoading(true); setPagina(atual => Math.max(1, atual - 1)) }} className="flex items-center gap-1 border px-3 py-2 text-[10px] font-bold uppercase disabled:opacity-30" style={{ borderColor: 'var(--border)' }}><ChevronLeft size={13} /> Anterior</button>
          <span className="text-[10px] uppercase text-foreground-muted">Página {pagina} de {totalPaginas}</span>
          <button type="button" disabled={pagina >= totalPaginas || loading} onClick={() => { setLoading(true); setPagina(atual => Math.min(totalPaginas, atual + 1)) }} className="flex items-center gap-1 border px-3 py-2 text-[10px] font-bold uppercase disabled:opacity-30" style={{ borderColor: 'var(--border)' }}>Próxima <ChevronRight size={13} /></button>
        </div>}
      </section>
    </div>
  )
}

function ResumoCard({ label, valor, destaque }: { label: string; valor: number | string; destaque?: string }) {
  return <div className="border p-4" style={{ borderColor: destaque ? `${destaque}66` : 'var(--border)', backgroundColor: destaque ? `${destaque}08` : 'var(--background-secondary)' }}><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-foreground-muted">{label}</p><p className="mt-2 text-2xl font-black font-rajdhani" style={{ color: destaque || 'var(--foreground)' }}>{valor}</p></div>
}
