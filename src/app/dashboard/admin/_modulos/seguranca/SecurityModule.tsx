'use client'

import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { Activity, Eye, EyeOff, Gauge, RefreshCw, Search, ShieldAlert, UserCheck } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { lerSecoesLogsAdmin, salvarSecoesLogsAdmin, type SecaoLogAdmin } from '@/lib/adminSidebarPreferences'
import { formatarDuracaoSessao, sessaoEstaOnline } from '@/lib/sessionPresence'
import { ActionConfirmDialog } from '@/components/dashboard/ActionConfirmDialog'
import { BRAZIL_STATE_PATHS } from '@/lib/brazilStatesMap'

type PeriodoFiltro = '24H' | '7D' | '30D' | '90D'
type EventoFiltro = 'TODOS' | 'LOGIN_SUCESSO' | 'LOGIN_FALHA' | 'LOGOUT' | 'RATE_LIMIT' | 'BOT_REJEITADO' | 'SESSAO_REVOGADA' | 'MUDANCA_UF'

type SecurityData = {
  paginacao: Record<SecaoLogAdmin, { pagina: number; temProxima: boolean }>
  resumo: {
    sessoesAtivas: number
    loginsSucesso24h: number
    falhasLogin24h: number
    bloqueiosRateLimit24h: number
    eventosSeguranca24h: number
    mediaEventosHora24h: number
    taxaSucessoLogin24h: number | null
    limitesAtivos: number
  }
  capacidade: { bancoUsoBytes: number; bancoLimiteBytes: number; relatoriosUsoBytes: number; relatoriosLimiteBytes: number }
  rankings: {
    acessos: Array<{ usuarioId: string | null; nome: string; email: string | null; empresa: string; total: number }>
    origensSuspeitas: Array<{ ipCorrelacao: string; total: number }>
  }
  geografia: {
    estados: Array<{ uf: string; acessos: number; alertas: number }>
    total: number
    geolocalizados: number
    fonte: string
  }
  presenca: { verificadoEm: string; onlineWindowMs: number }
  empresas: Array<{ id: string; nome: string }>
  sessoes: Array<{
    id: string
    criadoEm: string
    ultimaAtividade: string
    userAgent: string | null
    ipCorrelacao: string | null
    atual: boolean
    usuario: { nome: string; email: string; role: string }
    empresa: { nome: string } | null
  }>
  eventos: Array<{
    id: string
    tipo: string
    criadoEm: string
    ipCorrelacao: string | null
    userAgent: string | null
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

function formatarUltimoSinal(value: string, agora: number) {
  const segundos = Math.max(0, Math.floor((agora - new Date(value).getTime()) / 1000))
  if (segundos < 60) return `Último sinal recebido há ${segundos} segundo${segundos === 1 ? '' : 's'}`
  const minutos = Math.floor(segundos / 60)
  return `Último sinal recebido há ${minutos} minuto${minutos === 1 ? '' : 's'}`
}

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const position = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / (1024 ** position)).toLocaleString('pt-BR', { maximumFractionDigits: position > 1 ? 1 : 0 })} ${units[position]}`
}

function describeDevice(userAgent: string | null) {
  const agent = userAgent || ''
  const browser = /Edg\//.test(agent) ? 'Edge' : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'Navegador não identificado'
  const system = /Windows/i.test(agent) ? 'Windows' : /Android/i.test(agent) ? 'Android' : /iPhone|iPad/i.test(agent) ? 'iOS' : /Mac OS/i.test(agent) ? 'macOS' : /Linux/i.test(agent) ? 'Linux' : 'sistema desconhecido'
  return `${browser} · ${system}`
}

const paginasIniciais: Record<SecaoLogAdmin, number> = { SESSOES: 1, EVENTOS: 1, AUDITORIA: 1, EXCLUSOES: 1 }

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  if (!text) return {}

  try {
    const body: unknown = JSON.parse(text)
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

async function fetchSecurityData(filters: {
  empresaId: string
  paginas: Record<SecaoLogAdmin, number>
  periodo: PeriodoFiltro
  tipoEvento: EventoFiltro
  busca: string
}, signal?: AbortSignal): Promise<SecurityData> {
  const query = new URLSearchParams(Object.entries(filters.paginas).map(([section, page]) => [`pagina${section}`, String(page)]))
  if (filters.empresaId !== 'TODAS') query.set('empresaId', filters.empresaId)
  query.set('periodo', filters.periodo)
  query.set('tipoEvento', filters.tipoEvento)
  if (filters.busca) query.set('busca', filters.busca)
  const response = await fetch(`/api/admin/seguranca?${query}`, { cache: 'no-store', signal })
  const body = await readJsonResponse(response)
  if (!response.ok) throw new Error(typeof body.erro === 'string' ? body.erro : 'Falha ao carregar os registros de segurança.')
  return body as SecurityData
}

export default function SecurityModule() {
  const { primary } = useTheme()
  const [data, setData] = useState<SecurityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [empresaFiltro, setEmpresaFiltro] = useState('TODAS')
  const [empresaBusca, setEmpresaBusca] = useState('')
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('7D')
  const [tipoEvento, setTipoEvento] = useState<EventoFiltro>('TODOS')
  const [buscaRascunho, setBuscaRascunho] = useState('')
  const [buscaFiltro, setBuscaFiltro] = useState('')
  const [paginas, setPaginas] = useState(paginasIniciais)
  const requisicao = useRef<AbortController | null>(null)
  const [secoesVisiveis, setSecoesVisiveis] = useState<Record<SecaoLogAdmin, boolean>>({ SESSOES: true, EVENTOS: true, AUDITORIA: true, EXCLUSOES: true })
  const [agora, setAgora] = useState(() => Date.now())
  const [sessaoParaRevogar, setSessaoParaRevogar] = useState<SecurityData['sessoes'][number] | null>(null)
  const [revogando, setRevogando] = useState(false)
  const [aba, setAba] = useState<'LOGS' | 'GEO'>('LOGS')

  useEffect(() => {
    const initial = window.setTimeout(() => setSecoesVisiveis(lerSecoesLogsAdmin()), 0)
    return () => window.clearTimeout(initial)
  }, [])

  const alternarSecao = (section: SecaoLogAdmin) => {
    setSecoesVisiveis((current) => salvarSecoesLogsAdmin({ ...current, [section]: !current[section] }))
  }

  const load = useCallback(async (silent = false) => {
    requisicao.current?.abort()
    const controller = new AbortController()
    requisicao.current = controller
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const result = await fetchSecurityData({ empresaId: empresaFiltro, paginas, periodo, tipoEvento, busca: buscaFiltro }, controller.signal)
      if (!controller.signal.aborted) {
        setData(result)
        setError('')
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Falha ao carregar os registros de segurança.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [buscaFiltro, empresaFiltro, paginas, periodo, tipoEvento])

  useEffect(() => {
    const clock = window.setInterval(() => setAgora(Date.now()), 1000)
    const update = () => {
      if (document.visibilityState === 'visible') void load(true)
    }
    const refresh = window.setInterval(update, 60_000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(clock)
      window.clearInterval(refresh)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [load])

  useEffect(() => {
    queueMicrotask(() => void load())
    return () => requisicao.current?.abort()
  }, [load])

  const empresasFiltradas = useMemo(() => {
    const term = empresaBusca.trim().toLocaleLowerCase('pt-BR')
    const companies = (data?.empresas || []).filter((company) => !term || company.nome.toLocaleLowerCase('pt-BR').includes(term))
    const selected = data?.empresas.find((company) => company.id === empresaFiltro)
    const visible = companies.slice(0, 30)
    if (selected && !visible.some((company) => company.id === selected.id)) visible.unshift(selected)
    return visible
  }, [data?.empresas, empresaBusca, empresaFiltro])

  const applySearch = (event: FormEvent) => {
    event.preventDefault()
    setPaginas(paginasIniciais)
    setBuscaFiltro(buscaRascunho.trim())
  }

  const changeStructuredFilter = (change: () => void) => {
    setLoading(true)
    setError('')
    setPaginas(paginasIniciais)
    change()
  }

  const navigation = (section: SecaoLogAdmin) => ({
    pagina: paginas[section],
    temProxima: data?.paginacao?.[section].temProxima ?? false,
    loading,
    onPage: (page: number) => {
      setLoading(true)
      setError('')
      setPaginas((current) => ({ ...current, [section]: page }))
    },
  })

  const loginRate = data?.resumo.taxaSucessoLogin24h

  const revokeSession = async () => {
    if (!sessaoParaRevogar || revogando) return
    setRevogando(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/seguranca/sessoes/${sessaoParaRevogar.id}`, { method: 'DELETE' })
      const body = await readJsonResponse(response)
      if (!response.ok) throw new Error(typeof body.erro === 'string' ? body.erro : 'Não foi possível encerrar a sessão.')
      setSessaoParaRevogar(null)
      await load(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível encerrar a sessão.')
    } finally {
      setRevogando(false)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6 sm:space-y-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: primary }}>Segurança e auditoria</p>
          <h1 className="mt-2 font-rajdhani text-2xl font-black sm:text-3xl">CENTRAL DE SEGURANÇA</h1>
          <p className="mt-1 max-w-3xl text-sm text-foreground-muted">Investigue acessos, identifique padrões suspeitos e acompanhe a capacidade da plataforma sem expor endereços IP reais.</p>
        </header>

        <nav aria-label="Visões da Central de Segurança" className="flex overflow-x-auto border-b" style={{ borderColor: 'var(--border)' }}>
          <button type="button" aria-current={aba === 'LOGS' ? 'page' : undefined} onClick={() => setAba('LOGS')} className="min-h-11 shrink-0 border-b-2 px-4 text-xs font-black uppercase tracking-wider" style={{ borderColor: aba === 'LOGS' ? primary : 'transparent', color: aba === 'LOGS' ? primary : 'var(--foreground-muted)' }}>Logs e auditoria</button>
          <button type="button" aria-current={aba === 'GEO' ? 'page' : undefined} onClick={() => setAba('GEO')} className="min-h-11 shrink-0 border-b-2 px-4 text-xs font-black uppercase tracking-wider" style={{ borderColor: aba === 'GEO' ? primary : 'transparent', color: aba === 'GEO' ? primary : 'var(--foreground-muted)' }}>Geolocalização por UF</button>
        </nav>

        <section aria-labelledby="security-filters-title" className="border p-4 sm:p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 id="security-filters-title" className="font-rajdhani text-sm font-black uppercase tracking-widest">Filtros da investigação</h2>
              <p className="mt-1 text-xs text-foreground-muted">A busca é processada no servidor e continua eficiente mesmo com muitas empresas.</p>
            </div>
            <button type="button" onClick={() => void load()} disabled={loading} className="flex min-h-10 items-center justify-center gap-2 border px-3 py-2 text-xs font-bold uppercase disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar dados
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(14rem,1fr)_10rem_13rem]">
            <label className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
              <span className="mb-1 block">Localizar empresa</span>
              <input value={empresaBusca} onChange={(event) => setEmpresaBusca(event.target.value)} type="search" placeholder="Digite parte do nome" className="min-h-11 w-full border bg-background px-3 text-xs text-foreground outline-none focus:border-primary" style={{ borderColor: 'var(--border)' }} />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
              <span className="mb-1 block">Filtrar logs por empresa</span>
              <select value={empresaFiltro} onChange={(event) => changeStructuredFilter(() => setEmpresaFiltro(event.target.value))} className="min-h-11 w-full border bg-background px-3 text-xs text-foreground outline-none focus:border-primary" style={{ borderColor: 'var(--border)' }}>
                <option value="TODAS">Todas as empresas</option>
                <option value="SISTEMA">Somente RPMTruck / sistema</option>
                {empresasFiltradas.map((company) => <option key={company.id} value={company.id}>{company.nome}</option>)}
              </select>
              {(data?.empresas.length || 0) > 30 && !empresaBusca && <span className="mt-1 block normal-case tracking-normal">Digite o nome para consultar outras empresas.</span>}
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
              <span className="mb-1 block">Período dos registros</span>
              <select value={periodo} onChange={(event) => changeStructuredFilter(() => setPeriodo(event.target.value as PeriodoFiltro))} className="min-h-11 w-full border bg-background px-3 text-xs text-foreground outline-none focus:border-primary" style={{ borderColor: 'var(--border)' }}>
                <option value="24H">Últimas 24 horas</option>
                <option value="7D">Últimos 7 dias</option>
                <option value="30D">Últimos 30 dias</option>
                <option value="90D">Últimos 90 dias</option>
              </select>
            </label>
            {aba === 'LOGS' && <label className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
              <span className="mb-1 block">Tipo de evento</span>
              <select value={tipoEvento} onChange={(event) => changeStructuredFilter(() => setTipoEvento(event.target.value as EventoFiltro))} className="min-h-11 w-full border bg-background px-3 text-xs text-foreground outline-none focus:border-primary" style={{ borderColor: 'var(--border)' }}>
                <option value="TODOS">Todos os eventos</option>
                <option value="LOGIN_SUCESSO">Login confirmado</option>
                <option value="LOGIN_FALHA">Falha de login</option>
                <option value="RATE_LIMIT">Limite excedido</option>
                <option value="SESSAO_REVOGADA">Sessão revogada</option>
                <option value="MUDANCA_UF">Mudança de UF</option>
                <option value="LOGOUT">Logout</option>
                <option value="BOT_REJEITADO">Automação rejeitada</option>
              </select>
            </label>}
          </div>

          {aba === 'LOGS' && <form onSubmit={applySearch} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Buscar na trilha de segurança</span>
              <Search aria-hidden="true" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
              <input value={buscaRascunho} onChange={(event) => setBuscaRascunho(event.target.value)} maxLength={80} placeholder="Buscar nome, e-mail, ação, recurso, protocolo ou IP# correlacionado" className="min-h-11 w-full border bg-background pl-10 pr-3 text-xs text-foreground outline-none focus:border-primary" style={{ borderColor: 'var(--border)' }} />
            </label>
            <button type="submit" disabled={loading} className="min-h-11 border px-5 text-xs font-black uppercase disabled:opacity-50" style={{ borderColor: primary, color: primary }}>Aplicar busca</button>
            {buscaFiltro && <button type="button" disabled={loading} onClick={() => { setBuscaRascunho(''); setBuscaFiltro(''); setPaginas(paginasIniciais) }} className="min-h-11 border px-4 text-xs font-bold uppercase disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>Limpar</button>}
          </form>}
        </section>

        {error && <div role="alert" className="border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-500">{error}</div>}

        {aba === 'GEO' ? <GeoSecurityPanel data={data} primary={primary} periodo={periodo} /> : <>
        <section aria-label="Indicadores de segurança" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <Metric icon={UserCheck} label="Conectados agora" value={data?.resumo.sessoesAtivas ?? '—'} color={primary} />
          <Metric icon={Activity} label="Logins confirmados / 24h" value={data?.resumo.loginsSucesso24h ?? '—'} color="var(--status-success)" />
          <Metric icon={Gauge} label="Sucesso no login / 24h" value={loginRate == null ? 'Sem dados' : `${loginRate}%`} color="var(--status-success)" />
          <Metric icon={ShieldAlert} label="Falhas de login / 24h" value={data?.resumo.falhasLogin24h ?? '—'} color="#ef4444" />
          <Metric icon={ShieldAlert} label="Bloqueios / 24h" value={data?.resumo.bloqueiosRateLimit24h ?? '—'} color="#f59e0b" />
          <Metric icon={Activity} label="Eventos de segurança / hora" value={data?.resumo.mediaEventosHora24h ?? '—'} color={primary} />
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <CapacityPanel data={data} primary={primary} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <RankingCard title="Quem mais acessou · 24h" empty="Nenhum login confirmado no período." rows={(data?.rankings.acessos || []).map((item) => ({ label: item.nome, detail: `${item.empresa}${item.email ? ` · ${item.email}` : ''}`, value: item.total }))} />
            <RankingCard title="Origens com mais alertas · 24h" empty="Nenhuma origem com falhas ou bloqueios." rows={(data?.rankings.origensSuspeitas || []).map((item) => ({ label: `IP#${item.ipCorrelacao}`, detail: 'Correlação protegida · pode representar VPN ou rede compartilhada', value: item.total }))} />
          </div>
        </div>

        <LogTable title="Acessando agora" pagination={navigation('SESSOES')} visible={secoesVisiveis.SESSOES} onToggle={() => alternarSecao('SESSOES')} empty="Nenhum usuário com presença confirmada agora." columns={['Usuário', 'Empresa', 'Papel', 'Estado', 'Dispositivo', 'IP correlacionado', 'Tempo conectado', 'Último sinal', 'Ação']} rows={(data?.sessoes || []).map((item) => [
          `${item.usuario.nome} · ${item.usuario.email}`, item.empresa?.nome || 'RPMTruck', item.usuario.role,
          sessaoEstaOnline(item.ultimaAtividade, agora) ? '● Conectado agora' : 'Sem atividade recente', describeDevice(item.userAgent),
          item.ipCorrelacao ? `IP#${item.ipCorrelacao}` : 'Não disponível', formatarDuracaoSessao(agora - new Date(item.criadoEm).getTime()), <span title={formatDate(item.ultimaAtividade)}>{formatarUltimoSinal(item.ultimaAtividade, agora)}</span>,
          item.atual ? <span className="text-[10px] font-bold uppercase text-foreground-muted">Sessão atual</span> : <button type="button" onClick={() => setSessaoParaRevogar(item)} className="min-h-9 border border-red-500/50 px-3 text-[9px] font-black uppercase text-red-500 hover:bg-red-500/10">Encerrar sessão</button>,
        ])} />

        <LogTable title="Eventos de segurança" pagination={navigation('EVENTOS')} visible={secoesVisiveis.EVENTOS} onToggle={() => alternarSecao('EVENTOS')} empty="Nenhum evento encontrado com estes filtros." columns={['Evento', 'Usuário', 'Empresa', 'Dispositivo', 'IP correlacionado', 'Data']} rows={(data?.eventos || []).map((item) => [
          item.tipo.replaceAll('_', ' '), item.usuario ? `${item.usuario.nome} · ${item.usuario.email}` : 'Não identificado', item.empresa?.nome || '—',
          describeDevice(item.userAgent), item.ipCorrelacao ? `IP#${item.ipCorrelacao}` : 'Não disponível', formatDate(item.criadoEm),
        ])} />

        <LogTable title="Auditoria operacional · retenção conforme o plano" pagination={navigation('AUDITORIA')} visible={secoesVisiveis.AUDITORIA} onToggle={() => alternarSecao('AUDITORIA')} empty="Nenhuma ação auditada com estes filtros." columns={['Ação', 'Recurso', 'Responsável', 'Empresa', 'Origem', 'Data']} rows={(data?.auditoria || []).map((item) => [
          item.acao, `${item.tabela}${item.registroId ? ` · ${item.registroId.slice(0, 8)}` : ''}`, item.usuario ? `${item.usuario.nome} · ${item.usuario.email}` : 'Processo do sistema',
          item.empresa?.nome || 'RPMTruck', item.origem, formatDate(item.criadoEm),
        ])} />

        <LogTable title="Histórico de exclusões · comprovante mínimo" pagination={navigation('EXCLUSOES')} visible={secoesVisiveis.EXCLUSOES} onToggle={() => alternarSecao('EXCLUSOES')} empty="Nenhuma exclusão encontrada com estes filtros." columns={['Protocolo', 'Status', 'Resumo', 'Conclusão / retenção']} rows={(data?.exclusoes || []).map((item) => [
          item.protocolo, item.status.replaceAll('_', ' '), item.resumo ? Object.entries(item.resumo).map(([key, value]) => `${key}: ${value}`).join(' · ') : 'Registro legado',
          `${item.concluidoEm ? formatDate(item.concluidoEm) : `Solicitado em ${formatDate(item.criadoEm)}`}${item.reterAte ? ` · até ${formatDate(item.reterAte)}` : ''} · política ${item.politicaVersao}`,
        ])} />
        <ActionConfirmDialog open={Boolean(sessaoParaRevogar)} title="Encerrar sessão ativa" description={`O acesso de ${sessaoParaRevogar?.usuario.nome || 'este usuário'} será interrompido neste dispositivo. A pessoa precisará entrar novamente. O evento ficará registrado na trilha de segurança.`} confirmLabel="Encerrar sessão" loadingLabel="Encerrando..." loading={revogando} onClose={() => { if (!revogando) setSessaoParaRevogar(null) }} onConfirm={() => void revokeSession()} />
        </>}
      </div>
    </MotionConfig>
  )
}

function GeoSecurityPanel({ data, primary, periodo }: { data: SecurityData | null; primary: string; periodo: PeriodoFiltro }) {
  const [mode, setMode] = useState<'acessos' | 'alertas'>('alertas')
  const [selectedUf, setSelectedUf] = useState<string | null>(null)
  const byState = new Map((data?.geografia.estados || []).map((item) => [item.uf, item]))
  const maximum = Math.max(1, ...Array.from(byState.values()).map((item) => item[mode]))
  const coverage = data?.geografia.total ? Math.round((data.geografia.geolocalizados / data.geografia.total) * 1000) / 10 : 0
  const selectedShape = BRAZIL_STATE_PATHS.find((state) => state.uf === selectedUf)
  const selectedData = selectedUf ? byState.get(selectedUf) : null
  const ranked = BRAZIL_STATE_PATHS.map((state) => ({ ...state, value: byState.get(state.uf)?.[mode] || 0 })).filter((state) => state.value > 0).sort((a, b) => b.value - a.value)
  const baseColor = mode === 'alertas' ? '#ef4444' : primary
  const fillFor = (uf: string) => {
    const value = byState.get(uf)?.[mode] || 0
    if (!value) return 'var(--background)'
    const intensity = 25 + Math.round((value / maximum) * 70)
    return `color-mix(in srgb, ${baseColor} ${intensity}%, var(--background-secondary))`
  }
  const selectState = (uf: string) => setSelectedUf((current) => current === uf ? null : uf)

  return <section className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric icon={UserCheck} label={`Acessos localizados · ${periodo}`} value={(data?.geografia.estados || []).reduce((sum, item) => sum + item.acessos, 0)} color="var(--status-success)" />
      <Metric icon={ShieldAlert} label={`Alertas localizados · ${periodo}`} value={(data?.geografia.estados || []).reduce((sum, item) => sum + item.alertas, 0)} color="#ef4444" />
      <Metric icon={Gauge} label="Cobertura geográfica" value={`${coverage}%`} color={primary} />
    </div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
      <div className="border p-4 sm:p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div><p className="text-[10px] font-black uppercase tracking-widest" style={{ color: primary }}>Distribuição aproximada</p><h2 className="mt-1 font-rajdhani text-xl font-black uppercase">Mapa de segurança do Brasil</h2><p className="mt-1 text-xs text-foreground-muted">Selecione uma UF para consultar o volume. A localização representa a saída pública da rede e pode ser afetada por VPN.</p></div>
          <div className="flex shrink-0 border p-1" style={{ borderColor: 'var(--border)' }}><button type="button" onClick={() => setMode('alertas')} aria-pressed={mode === 'alertas'} className="min-h-9 px-3 text-[9px] font-black uppercase" style={{ backgroundColor: mode === 'alertas' ? '#ef4444' : 'transparent', color: mode === 'alertas' ? '#fff' : 'var(--foreground-muted)' }}>Possíveis riscos</button><button type="button" onClick={() => setMode('acessos')} aria-pressed={mode === 'acessos'} className="min-h-9 px-3 text-[9px] font-black uppercase" style={{ backgroundColor: mode === 'acessos' ? primary : 'transparent', color: mode === 'acessos' ? '#fff' : 'var(--foreground-muted)' }}>Acessos</button></div>
        </div>
        <div className="mt-5 flex min-h-[28rem] items-center justify-center overflow-hidden bg-background p-3">
          <svg viewBox="0 0 400 400" role="img" aria-label={`Mapa do Brasil por ${mode === 'alertas' ? 'alertas de segurança' : 'acessos confirmados'}`} className="h-auto max-h-[34rem] w-full max-w-2xl">
            {BRAZIL_STATE_PATHS.filter((state) => state.uf !== 'DF').map((state) => <path key={state.uf} d={state.d} tabIndex={0} role="button" aria-label={`${state.nome}: ${byState.get(state.uf)?.[mode] || 0}`} onClick={() => selectState(state.uf)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectState(state.uf) } }} fill={fillFor(state.uf)} stroke={selectedUf === state.uf ? '#fff' : 'var(--border)'} strokeWidth={selectedUf === state.uf ? 2.5 : 1.1} className="cursor-pointer outline-none transition-[fill,stroke] hover:stroke-white focus:stroke-white"><title>{state.nome}: {byState.get(state.uf)?.[mode] || 0}</title></path>)}
            <circle cx="260" cy="218" r="4.5" tabIndex={0} role="button" aria-label={`Distrito Federal: ${byState.get('DF')?.[mode] || 0}`} onClick={() => selectState('DF')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectState('DF') } }} fill={fillFor('DF')} stroke={selectedUf === 'DF' ? '#fff' : 'var(--border)'} strokeWidth={selectedUf === 'DF' ? 2.5 : 1.1} className="cursor-pointer outline-none hover:stroke-white focus:stroke-white"><title>Distrito Federal: {byState.get('DF')?.[mode] || 0}</title></circle>
          </svg>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[9px] uppercase tracking-wider text-foreground-muted"><span>Menor volume</span>{[20, 40, 60, 80, 100].map((level) => <span key={level} aria-hidden="true" className="h-3 flex-1" style={{ backgroundColor: `color-mix(in srgb, ${baseColor} ${level}%, var(--background-secondary))` }} />)}<span>Maior volume</span></div>
      </div>

      <aside className="space-y-4">
        <div className="border p-4" style={{ borderColor: selectedShape ? baseColor : 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><p className="text-[9px] font-black uppercase tracking-widest text-foreground-muted">UF selecionada</p><h3 className="mt-2 font-rajdhani text-xl font-black uppercase">{selectedShape?.nome || 'Selecione no mapa'}</h3>{selectedShape && <div className="mt-3 grid grid-cols-2 gap-3"><div><span className="text-[9px] uppercase text-foreground-muted">Acessos</span><strong className="block text-xl">{selectedData?.acessos || 0}</strong></div><div><span className="text-[9px] uppercase text-foreground-muted">Alertas</span><strong className="block text-xl text-red-500">{selectedData?.alertas || 0}</strong></div></div>}</div>
        <div className="border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><h3 className="font-rajdhani text-sm font-black uppercase tracking-widest">Estados com maior volume</h3>{ranked.length === 0 ? <p className="mt-3 text-xs leading-relaxed text-foreground-muted">Não há eventos com UF confiável neste período. A distribuição será exibida conforme novos acessos forem registrados.</p> : <ol className="mt-3 space-y-2">{ranked.slice(0, 10).map((state, index) => <li key={state.uf} className="flex items-center justify-between gap-3 border-t pt-2 text-xs first:border-0 first:pt-0" style={{ borderColor: 'var(--border)' }}><button type="button" onClick={() => setSelectedUf(state.uf)} className="min-w-0 text-left hover:underline"><span className="mr-2 text-foreground-muted">{index + 1}.</span>{state.nome}</button><strong>{state.value}</strong></li>)}</ol>}</div>
        <div className="border border-amber-500/40 bg-amber-500/5 p-4 text-[10px] leading-relaxed text-foreground-muted"><strong className="block uppercase tracking-wider text-amber-500">Leitura responsável</strong><span className="mt-1 block">“Possíveis riscos” reúne falhas de login, rate limits e automações rejeitadas. Não significa que todos os eventos sejam ataques. {data?.geografia.total ? `${data.geografia.total - data.geografia.geolocalizados} evento(s) ficaram sem UF confiável.` : ''}</span></div>
      </aside>
    </div>
  </section>
}

function CapacityPanel({ data, primary }: { data: SecurityData | null; primary: string }) {
  const databaseUsage = data?.capacidade.bancoUsoBytes || 0
  const databaseLimit = data?.capacidade.bancoLimiteBytes || 0
  const databasePercent = databaseLimit > 0 ? Math.min((databaseUsage / databaseLimit) * 100, 100) : 0
  const reportsUsage = data?.capacidade.relatoriosUsoBytes || 0
  const reportsLimit = data?.capacidade.relatoriosLimiteBytes || 0
  const reportsPercent = reportsLimit > 0 ? Math.min((reportsUsage / reportsLimit) * 100, 100) : 0
  const status = databasePercent >= 85 || reportsPercent >= 85 ? 'Ação necessária' : databasePercent >= 70 || reportsPercent >= 70 ? 'Acompanhar crescimento' : 'Capacidade saudável'
  const color = databasePercent >= 85 || reportsPercent >= 85 ? '#ef4444' : databasePercent >= 70 || reportsPercent >= 70 ? '#f59e0b' : 'var(--status-success)'

  return <section className="border p-4 sm:p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><p className="text-[10px] font-black uppercase tracking-widest" style={{ color: primary }}>Capacidade operacional</p><h2 className="mt-1 font-rajdhani text-lg font-black uppercase">Banco e arquivos privados</h2></div><span className="border px-2 py-1 text-[9px] font-black uppercase tracking-wider" style={{ borderColor: color, color }}>{status}</span></div>
    <CapacityBar label="Banco PostgreSQL" used={databaseUsage} limit={databaseLimit} percent={databasePercent} color={color} />
    <CapacityBar label="Relatórios armazenados" used={reportsUsage} limit={reportsLimit} percent={reportsPercent} color={reportsPercent >= 85 ? '#ef4444' : reportsPercent >= 70 ? '#f59e0b' : primary} />
    <div className="mt-4 grid gap-2 border-t pt-4 text-xs sm:grid-cols-2" style={{ borderColor: 'var(--border)' }}><div><span className="block text-[9px] font-bold uppercase tracking-wider text-foreground-muted">Proteções ativas agora</span><strong className="mt-1 block font-rajdhani text-xl">{data?.resumo.limitesAtivos ?? '—'}</strong></div><div><span className="block text-[9px] font-bold uppercase tracking-wider text-foreground-muted">Eventos de segurança / 24h</span><strong className="mt-1 block font-rajdhani text-xl">{data?.resumo.eventosSeguranca24h ?? '—'}</strong></div></div>
    <p className="mt-4 text-[10px] leading-relaxed text-foreground-muted">Os limites são alertas internos configuráveis. Confirme a cota contratada no provedor antes de ampliar a infraestrutura.</p>
  </section>
}

function CapacityBar({ label, used, limit, percent, color }: { label: string; used: number; limit: number; percent: number; color: string }) {
  return <div className="mt-4"><div className="flex items-center justify-between gap-3 text-xs"><span className="font-bold">{label}</span><span className="text-foreground-muted">{formatBytes(used)} de {formatBytes(limit)} · {percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span></div><div className="mt-2 h-2 overflow-hidden bg-background"><div className="h-full transition-[width] duration-300" style={{ width: `${percent}%`, backgroundColor: color }} /></div></div>
}

function RankingCard({ title, empty, rows }: { title: string; empty: string; rows: Array<{ label: string; detail: string; value: number }> }) {
  return <section className="border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><h2 className="font-rajdhani text-sm font-black uppercase tracking-widest">{title}</h2>{rows.length === 0 ? <p className="mt-3 text-xs text-foreground-muted">{empty}</p> : <ol className="mt-3 space-y-2">{rows.map((row, index) => <li key={`${row.label}-${index}`} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-2 border-t pt-2 first:border-0 first:pt-0" style={{ borderColor: 'var(--border)' }}><span className="text-xs font-black text-foreground-muted">{index + 1}</span><span className="min-w-0"><span className="block truncate text-xs font-bold">{row.label}</span><span className="mt-0.5 block text-[9px] leading-relaxed text-foreground-muted">{row.detail}</span></span><span className="text-sm font-black">{row.value}</span></li>)}</ol>}</section>
}

function LogPagination({ title, pagina, temProxima, loading, onPage }: { title: string; pagina: number; temProxima: boolean; loading: boolean; onPage: (page: number) => void }) {
  const button = 'min-h-10 border border-border px-3 text-xs font-bold disabled:opacity-40'
  return <nav aria-label={`Paginação: ${title}`} className="mt-3 flex items-center justify-between gap-3"><button type="button" className={button} disabled={loading || pagina <= 1} onClick={() => onPage(pagina - 1)}>Anterior</button><span role="status" className="text-center text-xs text-foreground-muted">{loading ? 'Carregando…' : `Página ${pagina} · até 20 registros`}</span><button type="button" className={button} disabled={loading || !temProxima} onClick={() => onPage(pagina + 1)}>Próxima</button></nav>
}

function Metric({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: number | string; color: string }) {
  return <div className="flex min-h-24 items-center gap-4 border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><Icon size={20} style={{ color }} /><div className="min-w-0"><div className="font-rajdhani text-2xl font-black">{value}</div><div className="text-[9px] font-bold uppercase tracking-widest text-foreground-muted">{label}</div></div></div>
}

function LogTable({ title, visible, onToggle, empty, columns, rows, pagination }: { title: string; visible: boolean; onToggle: () => void; empty: string; columns: string[]; rows: ReactNode[][]; pagination: { pagina: number; temProxima: boolean; loading: boolean; onPage: (page: number) => void } }) {
  return <section className="space-y-3"><div className="flex items-center justify-between gap-4"><h2 className="font-rajdhani text-sm font-black uppercase tracking-widest">{title}</h2><button type="button" role="switch" aria-checked={visible} aria-label={`${visible ? 'Ocultar' : 'Exibir'} ${title}`} onClick={onToggle} className="interactive-control flex min-h-10 shrink-0 items-center gap-2 border px-3 text-[9px] font-black uppercase" style={{ borderColor: visible ? 'var(--primary)' : 'var(--border)', color: visible ? 'var(--primary)' : 'var(--foreground-muted)' }}>{visible ? <Eye size={14} /> : <EyeOff size={14} />}{visible ? 'Visível' : 'Oculto'}</button></div><AnimatePresence initial={false}>{visible && <motion.div key="content" initial={{ opacity: 0, height: 0, y: -6 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: -4 }} transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }} className="overflow-hidden"><div className="space-y-2 sm:hidden">{rows.length === 0 ? <p className="border p-6 text-center text-xs text-foreground-muted" style={{ borderColor: 'var(--border)' }}>{empty}</p> : rows.map((row, rowIndex) => <article key={rowIndex} className="border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>{row.map((cell, cellIndex) => <div key={`${rowIndex}-${cellIndex}`} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 border-b py-2 text-xs last:border-0" style={{ borderColor: 'var(--border)' }}><span className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted">{columns[cellIndex]}</span><span className="min-w-0 break-words">{cell}</span></div>)}</article>)}</div><div className="hidden overflow-x-auto border sm:block" style={{ borderColor: 'var(--border)' }}><table className="w-full min-w-[860px] text-left text-xs"><thead style={{ backgroundColor: 'var(--background-secondary)' }}><tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-bold uppercase tracking-wider text-foreground-muted">{column}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-foreground-muted">{empty}</td></tr> : rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t" style={{ borderColor: 'var(--border)' }}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className="max-w-xs break-words px-4 py-3 align-top">{cell}</td>)}</tr>)}</tbody></table></div><LogPagination title={title} {...pagination} /></motion.div>}</AnimatePresence></section>
}
