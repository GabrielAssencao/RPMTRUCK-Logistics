'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { Activity, Eye, EyeOff, RefreshCw, ShieldAlert, UserCheck } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { lerSecoesLogsAdmin, salvarSecoesLogsAdmin, type SecaoLogAdmin } from '@/lib/adminSidebarPreferences'

type SecurityData = {
  paginacao: Record<SecaoLogAdmin, { pagina: number; temProxima: boolean }>
  resumo: { sessoesAtivas: number; falhasLogin24h: number; bloqueiosRateLimit24h: number }
  empresas: Array<{ id: string; nome: string }>
  sessoes: Array<{
    id: string
    criadoEm: string
    ultimaAtividade: string
    userAgent: string | null
    usuario: { nome: string; email: string; role: string }
    empresa: { nome: string } | null
  }>
  eventos: Array<{
    id: string
    tipo: string
    criadoEm: string
    ipCorrelacao: string | null
    usuario: { nome: string; email: string } | null
    empresa: { nome: string } | null
  }>
  auditoria: Array<{
    id: string
    tabela: string
    acao: string
    registroId: string | null
    origem: string
    criadoEm: string
    usuario: { nome: string; email: string } | null
    empresa: { nome: string } | null
  }>
  exclusoes: Array<{
    id: string
    protocolo: string
    status: string
    resumo: Record<string, number> | null
    politicaVersao: string
    criadoEm: string
    concluidoEm: string | null
    reterAte: string | null
  }>
}

const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'medium',
}).format(new Date(value))

const paginasIniciais: Record<SecaoLogAdmin, number> = { SESSOES: 1, EVENTOS: 1, AUDITORIA: 1, EXCLUSOES: 1 }

async function fetchSecurityData(empresaId: string, paginas: Record<SecaoLogAdmin, number>, signal?: AbortSignal): Promise<SecurityData> {
  const query = new URLSearchParams(Object.entries(paginas).map(([secao, pagina]) => [`pagina${secao}`, String(pagina)]))
  if (empresaId !== 'TODAS') query.set('empresaId', empresaId)
  const response = await fetch(`/api/admin/seguranca?${query}`, { cache: 'no-store', signal })
  const body = await response.json()
  if (!response.ok) throw new Error(body.erro || 'Falha ao carregar os registros de segurança.')
  return body
}

export default function SecurityModule() {
  const { primary } = useTheme()
  const [data, setData] = useState<SecurityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [empresaFiltro, setEmpresaFiltro] = useState('TODAS')
  const [paginas, setPaginas] = useState(paginasIniciais)
  const requisicao = useRef<AbortController | null>(null)
  const [secoesVisiveis, setSecoesVisiveis] = useState<Record<SecaoLogAdmin, boolean>>({ SESSOES: true, EVENTOS: true, AUDITORIA: true, EXCLUSOES: true })

  useEffect(() => {
    const initial = window.setTimeout(() => setSecoesVisiveis(lerSecoesLogsAdmin()), 0)
    return () => window.clearTimeout(initial)
  }, [])

  const alternarSecao = (secao: SecaoLogAdmin) => {
    setSecoesVisiveis((atuais) => salvarSecoesLogsAdmin({ ...atuais, [secao]: !atuais[secao] }))
  }

  const load = useCallback(async () => {
    requisicao.current?.abort()
    const controller = new AbortController()
    requisicao.current = controller
    setLoading(true)
    setError('')
    try {
      const resultado = await fetchSecurityData(empresaFiltro, paginas, controller.signal)
      if (!controller.signal.aborted) setData(resultado)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Falha ao carregar os registros de segurança.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [empresaFiltro, paginas])

  useEffect(() => {
    requisicao.current?.abort()
    const controller = new AbortController()
    requisicao.current = controller
    void fetchSecurityData(empresaFiltro, paginas, controller.signal)
      .then(resultado => { if (!controller.signal.aborted) setData(resultado) })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Falha ao carregar os registros de segurança.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => requisicao.current?.abort()
  }, [empresaFiltro, paginas])

  const navegacao = (secao: SecaoLogAdmin) => ({
    pagina: paginas[secao],
    temProxima: data?.paginacao?.[secao].temProxima ?? false,
    loading,
    onPage: (pagina: number) => {
      setLoading(true)
      setError('')
      setPaginas(atuais => ({ ...atuais, [secao]: pagina }))
    },
  })

  return (
    <MotionConfig reducedMotion="user">
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: primary }}>Segurança e auditoria</p>
          <h1 className="mt-2 text-2xl font-black font-rajdhani sm:text-3xl">CENTRAL DE LOGS</h1>
          <p className="mt-1 text-sm text-foreground-muted">Sessões recentes, trilhas com retenção controlada e comprovantes mínimos de exclusão.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
          <label className="min-w-64 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
            <span className="mb-1 block">Filtrar logs por empresa</span>
            <select value={empresaFiltro} onChange={(event) => {
              setLoading(true)
              setError('')
              setEmpresaFiltro(event.target.value)
              setPaginas(paginasIniciais)
            }} className="min-h-10 w-full border bg-background px-3 text-xs text-foreground outline-none" style={{ borderColor: 'var(--border)' }}>
              <option value="TODAS">Todas as empresas</option>
              <option value="SISTEMA">Somente RPMTruck / sistema</option>
              {(data?.empresas || []).map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}
            </select>
          </label>
          <button onClick={() => void load()} disabled={loading} className="flex min-h-10 items-center justify-center gap-2 border px-3 py-2 text-xs font-bold uppercase disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      {error && <div className="border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-500">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric icon={UserCheck} label="Sessões ativas" value={data?.resumo.sessoesAtivas ?? '—'} color={primary} />
        <Metric icon={ShieldAlert} label="Falhas de login / 24h" value={data?.resumo.falhasLogin24h ?? '—'} color="#ef4444" />
        <Metric icon={Activity} label="Bloqueios / 24h" value={data?.resumo.bloqueiosRateLimit24h ?? '—'} color="#f59e0b" />
      </div>

      <LogTable title="Acessando agora" pagination={navegacao('SESSOES')} visible={secoesVisiveis.SESSOES} onToggle={() => alternarSecao('SESSOES')} empty="Nenhuma sessão ativa no intervalo." columns={['Usuário', 'Empresa', 'Papel', 'Última atividade']} rows={(data?.sessoes || []).map((item) => [
        `${item.usuario.nome} · ${item.usuario.email}`,
        item.empresa?.nome || 'RPMTruck',
        item.usuario.role,
        formatDate(item.ultimaAtividade),
      ])} />

      <LogTable title="Eventos de segurança" pagination={navegacao('EVENTOS')} visible={secoesVisiveis.EVENTOS} onToggle={() => alternarSecao('EVENTOS')} empty="Nenhum evento registrado." columns={['Evento', 'Usuário', 'Empresa', 'Data']} rows={(data?.eventos || []).map((item) => [
        `${item.tipo}${item.ipCorrelacao ? ` · IP#${item.ipCorrelacao}` : ''}`,
        item.usuario ? `${item.usuario.nome} · ${item.usuario.email}` : 'Não identificado',
        item.empresa?.nome || '—',
        formatDate(item.criadoEm),
      ])} />

      <LogTable title="Auditoria operacional · retenção de 1 a 3 anos conforme o plano" pagination={navegacao('AUDITORIA')} visible={secoesVisiveis.AUDITORIA} onToggle={() => alternarSecao('AUDITORIA')} empty="Nenhuma ação auditada." columns={['Ação', 'Recurso', 'Responsável', 'Data']} rows={(data?.auditoria || []).map((item) => [
        `${item.acao} · ${item.origem}`,
        `${item.tabela}${item.registroId ? ` · ${item.registroId.slice(0, 8)}` : ''}`,
        item.usuario?.nome || item.empresa?.nome || 'Processo do sistema',
        formatDate(item.criadoEm),
      ])} />

      <LogTable title="Histórico de exclusões · comprovante mínimo" pagination={navegacao('EXCLUSOES')} visible={secoesVisiveis.EXCLUSOES} onToggle={() => alternarSecao('EXCLUSOES')} empty="Nenhuma exclusão registrada." columns={['Protocolo', 'Status', 'Resumo', 'Conclusão / retenção']} rows={(data?.exclusoes || []).map((item) => [
        item.protocolo,
        item.status.replaceAll('_', ' '),
        item.resumo
          ? Object.entries(item.resumo).map(([chave, valor]) => `${chave}: ${valor}`).join(' · ')
          : 'Registro legado',
        `${item.concluidoEm ? formatDate(item.concluidoEm) : `Solicitado em ${formatDate(item.criadoEm)}`}${item.reterAte ? ` · até ${formatDate(item.reterAte)}` : ''} · política ${item.politicaVersao}`,
      ])} />
    </div>
    </MotionConfig>
  )
}

function LogPagination({ title, pagina, temProxima, loading, onPage }: { title: string; pagina: number; temProxima: boolean; loading: boolean; onPage: (pagina: number) => void }) {
  const button = 'min-h-10 border border-border px-3 text-xs font-bold disabled:opacity-40'
  return <nav aria-label={`Paginação: ${title}`} className="mt-3 flex items-center justify-between gap-3">
    <button type="button" className={button} disabled={loading || pagina <= 1} onClick={() => onPage(pagina - 1)}>Anterior</button>
    <span role="status" className="text-xs text-foreground-muted">{loading ? 'Carregando…' : `Página ${pagina} · até 20 registros`}</span>
    <button type="button" className={button} disabled={loading || !temProxima} onClick={() => onPage(pagina + 1)}>Próxima</button>
  </nav>
}

function Metric({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: number | string; color: string }) {
  return <div className="flex items-center gap-4 border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><Icon size={20} style={{ color }} /><div><div className="text-2xl font-black font-rajdhani">{value}</div><div className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">{label}</div></div></div>
}

function LogTable({ title, visible, onToggle, empty, columns, rows, pagination }: { title: string; visible: boolean; onToggle: () => void; empty: string; columns: string[]; rows: string[][]; pagination: { pagina: number; temProxima: boolean; loading: boolean; onPage: (pagina: number) => void } }) {
  return <section className="space-y-3"><div className="flex items-center justify-between gap-4"><h2 className="text-sm font-black uppercase tracking-widest font-rajdhani">{title}</h2><button type="button" role="switch" aria-checked={visible} aria-label={`${visible ? 'Ocultar' : 'Exibir'} ${title}`} onClick={onToggle} className="interactive-control flex min-h-10 shrink-0 items-center gap-2 border px-3 text-[9px] font-black uppercase" style={{ borderColor: visible ? 'var(--primary)' : 'var(--border)', color: visible ? 'var(--primary)' : 'var(--foreground-muted)' }}>{visible ? <Eye size={14} /> : <EyeOff size={14} />}{visible ? 'Visível' : 'Oculto'}</button></div><AnimatePresence initial={false}>{visible && <motion.div key="conteudo" initial={{ opacity: 0, height: 0, y: -6 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: -4 }} transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }} className="overflow-hidden"><div className="space-y-2 sm:hidden">{rows.length === 0 ? <p className="border p-6 text-center text-xs text-foreground-muted" style={{borderColor: 'var(--border)'}}>{empty}</p> : rows.map((row, rowIndex) => <article key={rowIndex} className="border p-3" style={{borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)'}}>{row.map((cell, cellIndex) => <div key={`${rowIndex}-${cellIndex}`} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 border-b py-2 text-xs last:border-0" style={{borderColor: 'var(--border)'}}><span className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted">{columns[cellIndex]}</span><span className="min-w-0 break-words">{cell}</span></div>)}</article>)}</div><div className="hidden overflow-x-auto border sm:block" style={{ borderColor: 'var(--border)' }}><table className="min-w-[680px] w-full text-left text-xs"><thead style={{ backgroundColor: 'var(--background-secondary)' }}><tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-bold uppercase tracking-wider text-foreground-muted">{column}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-foreground-muted">{empty}</td></tr> : rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t" style={{ borderColor: 'var(--border)' }}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 align-top">{cell}</td>)}</tr>)}</tbody></table></div><LogPagination title={title} {...pagination} /></motion.div>}</AnimatePresence></section>
}
