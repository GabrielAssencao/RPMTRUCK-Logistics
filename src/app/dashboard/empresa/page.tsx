'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import { 
  Truck, 
  MapPin, 
  DollarSign, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle,
  Clock,
  Wrench,
  Calendar,
  Send,
  X,
  UserCheck,
  ShieldAlert,
  Lock,
  Sparkles,
  ArrowRight,
  ReceiptText,
} from 'lucide-react'
import type { PlanoTipo } from '@/utils/planos'

const DashboardCostAreaChart = dynamic(
  () => import('@/components/dashboard/empresa/EmpresaDashboardCharts').then(modulo => modulo.DashboardCostAreaChart),
  { loading: () => <div className="h-full w-full animate-pulse bg-foreground/5" /> },
)
const DashboardDistributionPieChart = dynamic(
  () => import('@/components/dashboard/empresa/EmpresaDashboardCharts').then(modulo => modulo.DashboardDistributionPieChart),
  { loading: () => <div className="h-full w-full animate-pulse bg-foreground/5" /> },
)

type Urgencia = 'ALTA' | 'MEDIA' | 'BAIXA'

interface AlertaInteligente {
  id: string
  categoria: 'VEICULO' | 'MOTORISTA'
  subtipo: 'NAO_REALIZADA' | 'PENDENTE' | 'CANCELADA' | 'MULTA' | 'SALARIO' | 'DOCUMENTO' | 'ATRASO' | 'HORARIO'
  foco: string
  descricao: string
}

interface OperadorOption {
  id: string
  nome: string
  cargo: string
}

interface ResumoContasPagar {
  visivel: boolean
  total: number
  urgentes: number
  proximas: number
  contas: Array<{ id: string; descricao: string; fornecedor: string | null; vencimento: string; valor: number; diasParaVencer: number; nivel: 'VERDE' | 'AMARELO' | 'VERMELHO' }>
}

export default function PainelEmpresa() {
  const { primary } = useTheme()
  const [montado, setMontado] = useState(false)
  
  const [nomeUsuario, setNomeUsuario] = useState('Gabriel Souza')
  const [nomeEmpresa, setNomeEmpresa] = useState('Transportes RPM')
  const [planoEmpresa, setPlanoEmpresa] = useState<PlanoTipo>('ESSENCIAL') // Padrão Essencial para teste
  const [tarefasHabilitadas, setTarefasHabilitadas] = useState(false)
  const [podeDelegarTarefas, setPodeDelegarTarefas] = useState(false)
  const [dadosGraficos, setDadosGraficos] = useState<Record<string, Array<{ dia: string; combustivel: number; manutencao: number; pedagio: number }>>>({ '7_DIAS': [], '15_DIAS': [], '30_DIAS': [] })
  const [dadosDistribuicaoCustos, setDadosDistribuicaoCustos] = useState<Array<{ name: string; value: number }>>([])
  const [alertas, setAlertas] = useState<AlertaInteligente[]>([])
  const [operadores, setOperadores] = useState<OperadorOption[]>([])
  const [metricas, setMetricas] = useState({ totalVeiculos: 0, totalAtivos: 0, totalOperacionais: 0, custoMes: 0, custoKm: 0, tarefasPendentes: 0 })
  const [feedback, setFeedback] = useState('')
  const [contasPagar, setContasPagar] = useState<ResumoContasPagar>({ visivel: false, total: 0, urgentes: 0, proximas: 0, contas: [] })

  const [recorteDias, setRecorteDias] = useState<'7_DIAS' | '15_DIAS' | '30_DIAS'>('7_DIAS')

  // Modais
  const [alertaDetalhado, setAlertaDetalhado] = useState<AlertaInteligente | null>(null)
  const [alertaParaDelegar, setAlertaParaDelegar] = useState<AlertaInteligente | null>(null)
  const [modalUpgradeOpen, setModalUpgradeOpen] = useState(false)
  
  // Form de Delegação
  const [operadorSelecionado, setOperadorSelecionado] = useState('')
  const [instrucaoDelegacao, setInstrucaoDelegacao] = useState('')

  useEffect(() => {
    queueMicrotask(() => setMontado(true))
    fetch('/api/dashboard/empresa', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar o painel.')
        setNomeUsuario(data.usuario.nome)
        setNomeEmpresa(data.empresa.nome)
        setPlanoEmpresa(data.empresa.plano)
        setTarefasHabilitadas(data.empresa.modulos.includes('TAREFAS'))
        setPodeDelegarTarefas(Boolean(data.usuario.podeDelegar))
        setMetricas(data.metricas)
        setDadosGraficos(data.graficos)
        setDadosDistribuicaoCustos(data.graficos.distribuicao)
        setAlertas(data.alertas)
        setOperadores(data.operadores)
        setContasPagar(data.contasPagar ?? { visivel: false, total: 0, urgentes: 0, proximas: 0, contas: [] })
      })
      .catch(error => setFeedback(error instanceof Error ? error.message : 'Falha ao carregar painel.'))
  }, [])

  useEffect(() => {
    if (!alertaDetalhado) return
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAlertaDetalhado(null)
    }
    window.addEventListener('keydown', fecharComEscape)
    return () => window.removeEventListener('keydown', fecharComEscape)
  }, [alertaDetalhado])

  if (!montado) return null

  // 🎨 CONTRASTE ADAPTATIVO DE CORES
  const eTemaVermelho = (c: string) => c.toLowerCase().includes('ef4444') || c.toLowerCase().includes('red')
  const eTemaAmarelo = (c: string) => c.toLowerCase().includes('eab308') || c.toLowerCase().includes('yellow')

  const corCombustivel = primary
  const corManutencao = eTemaVermelho(primary) ? '#f97316' : '#ef4444'
  const corPedagio = eTemaAmarelo(primary) ? '#06b6d4' : '#eab308'

  const calcularUrgencia = (alerta: AlertaInteligente): Urgencia => {
    if (alerta.categoria === 'VEICULO' && alerta.subtipo === 'NAO_REALIZADA') return 'ALTA'
    if (alerta.categoria === 'MOTORISTA' && alerta.subtipo === 'MULTA') return 'ALTA'
    return 'BAIXA'
  }

  // 🎯 GATILHO DE CLIQUE EM DELEGAR TAREFA
  const handleClicarDelegar = (alerta: AlertaInteligente) => {
    if (!podeDelegarTarefas) return
    if (!tarefasHabilitadas) {
      // Abre o modal de incentivo ao upgrade
      setModalUpgradeOpen(true)
    } else {
      // Abre o modal de delegação normal (Avançado / Enterprise)
      setAlertaParaDelegar(alerta)
    }
  }

  const handleDelegarTarefa = async () => {
    if (!podeDelegarTarefas || !alertaParaDelegar || !operadorSelecionado) return
    const response = await fetch('/api/tarefas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: `${alertaParaDelegar.categoria}: ${alertaParaDelegar.foco}`,
        descricao: instrucaoDelegacao || alertaParaDelegar.descricao,
        prioridade: calcularUrgencia(alertaParaDelegar) === 'ALTA' ? 'ALTA' : 'MEDIA',
        responsavelId: operadorSelecionado,
        modulo: alertaParaDelegar.categoria === 'VEICULO' ? 'FROTA' : 'MOTORISTAS',
        origemId: alertaParaDelegar.id,
      }),
    })
    const data = await response.json()
    if (!response.ok) return setFeedback(data.erro || 'Não foi possível delegar a tarefa.')
    setFeedback('Tarefa delegada e responsável notificado com sucesso.')
    setAlertaParaDelegar(null)
    setOperadorSelecionado('')
    setInstrucaoDelegacao('')
    setMetricas(atual => ({ ...atual, tarefasPendentes: atual.tarefasPendentes + 1 }))
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-mono">
      {feedback && <div role="status" className="border p-3 text-sm" style={{ borderColor: primary, color: primary }}>{feedback}</div>}
      
      {/* ─── CABEÇALHO ─── */}
      <div className="mb-6 pb-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-2xl font-black uppercase tracking-tight font-rajdhani sm:text-3xl" style={{ color: 'var(--foreground)' }}>
          Visão Geral <span style={{ color: primary }}>da Frota</span>
        </h1>
        
        <div className="mt-2 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-foreground-muted">Olá,</span>
            <span className="font-bold text-foreground font-sans text-sm">{nomeUsuario}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-bold uppercase tracking-wider text-foreground">{nomeEmpresa}</span>
            <span className="text-foreground-muted">•</span>
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest bg-green-500/10 text-green-500 border border-green-500/20">
              PLANO {planoEmpresa}
            </span>
          </div>
        </div>
      </div>

      {/* ─── LINHA 1: METRICAS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricaCard titulo="FROTA ATIVA" valor={`${metricas.totalAtivos} / ${metricas.totalVeiculos}`} icone={<Truck size={20} />} variacao={`${metricas.totalOperacionais} operacionais`} positivo={true} primary={primary} />
        <MetricaCard titulo="OPERACIONAIS AGORA" valor={String(metricas.totalOperacionais)} icone={<MapPin size={20} />} variacao={`${metricas.totalVeiculos ? Math.round(metricas.totalOperacionais / metricas.totalVeiculos * 100) : 0}% da frota`} positivo={true} primary={primary} />
        <MetricaCard titulo="CUSTO ACUMULADO (MÊS)" valor={metricas.custoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icone={<DollarSign size={20} />} variacao="Dados consolidados do banco" positivo={metricas.custoMes === 0} primary={primary} />
        <MetricaCard titulo="CUSTO MÉDIO POR KM" valor={metricas.custoKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icone={<TrendingDown size={20} />} variacao="Custo mensal / odômetros" positivo={true} primary={primary} />
      </div>

      {contasPagar.visivel && (
        <section className="border" style={{ borderColor: contasPagar.urgentes > 0 ? '#ef4444' : 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between" style={{borderColor: 'var(--border)'}}>
            <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest"><ReceiptText size={15} style={{color: primary}} />Contas a pagar</p><p className="mt-1 text-[11px] text-foreground-muted">{contasPagar.urgentes} urgente(s) · {contasPagar.proximas} próxima(s) · {contasPagar.total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} pendente</p></div>
            <Link href="/dashboard/empresa/contas-pagar" className="flex min-h-10 items-center justify-center border px-3 text-[10px] font-black uppercase" style={{borderColor: primary, color: primary}}>Abrir organizador <ArrowRight size={13} className="ml-2" /></Link>
          </div>
          {contasPagar.contas.length === 0 ? <p className="p-5 text-xs text-foreground-muted">Nenhum vencimento pendente.</p> : <div className="grid gap-px bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-5">{contasPagar.contas.map(conta => { const cor = conta.nivel === 'VERMELHO' ? '#ef4444' : conta.nivel === 'AMARELO' ? '#f59e0b' : '#22c55e'; return <div key={conta.id} className="min-w-0 bg-[var(--background-secondary)] p-4"><p className="truncate text-xs font-black">{conta.descricao}</p><p className="mt-1 truncate text-[10px] text-foreground-muted">{conta.fornecedor || 'Fornecedor não informado'}</p><p className="mt-3 font-rajdhani text-lg font-black">{conta.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p><p className="text-[9px] font-black uppercase" style={{color: cor}}>{conta.diasParaVencer < 0 ? `Vencida há ${Math.abs(conta.diasParaVencer)} dia(s)` : conta.diasParaVencer === 0 ? 'Vence hoje' : `Vence em ${conta.diasParaVencer} dia(s)`}</p></div> })}</div>}
        </section>
      )}

      {/* ─── LINHA 2: GRÁFICOS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 p-5 border relative overflow-hidden" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--foreground)' }}>Evolução de Custos ({recorteDias.replace('_', ' ')})</h3>
            <div className="flex items-center gap-4 text-[10px] uppercase font-bold">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: corCombustivel }} /> Combustível</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: corManutencao }} /> Manutenção</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: corPedagio }} /> Pedágios</div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <DashboardCostAreaChart
              dados={dadosGraficos[recorteDias] ?? []}
              corCombustivel={corCombustivel}
              corManutencao={corManutencao}
              corPedagio={corPedagio}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 border rounded-xl flex flex-col"
          style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--foreground)' }}>
              Distribuição de Despesas
            </h3>
            <span className="text-[10px] uppercase tracking-widest opacity-60">Total</span>
          </div>

          <div className="flex-1 min-h-[250px]">
            <DashboardDistributionPieChart
              dados={dadosDistribuicaoCustos}
              cores={[corCombustivel, corManutencao, corPedagio, 'var(--border)']}
            />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.15em]">
            {dadosDistribuicaoCustos.map((entry, index) => {
              const color = index === 0 ? corCombustivel : index === 1 ? corManutencao : index === 2 ? corPedagio : 'var(--border)';
              return (
                <div key={entry.name} className="flex items-center gap-2 opacity-80">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span>{entry.name}</span>
                  <span className="ml-auto font-bold">{entry.value}%</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
        {[
          { label: 'COBERTURA', value: `${metricas.totalVeiculos ? Math.round(metricas.totalAtivos / metricas.totalVeiculos * 100) : 0}%`, trend: `${metricas.totalAtivos} veículos ativos`, color: primary },
          { label: 'DISPONIBILIDADE', value: `${metricas.totalVeiculos ? Math.round(metricas.totalOperacionais / metricas.totalVeiculos * 100) : 0}%`, trend: `${metricas.totalOperacionais} operacionais`, color: '#22c55e' },
          { label: 'RISCO', value: alertas.length ? 'Atenção' : 'Baixo', trend: `${alertas.length} alertas pendentes`, color: '#f59e0b' },
          { label: 'TAREFAS', value: String(metricas.tarefasPendentes), trend: 'pendentes ou em andamento', color: '#38bdf8' },
        ].map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="border rounded-xl p-4"
            style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}
          >
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">{card.label}</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <span className="text-2xl font-black tracking-tight" style={{ color: card.color }}>{card.value}</span>
              <span className="text-[10px] uppercase tracking-[0.14em] opacity-60">{card.trend}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── LINHA 3: ALERTAS COM ATRIBUIÇÃO/DELEGAÇÃO CONDICIONAL POR PLANO ─── */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="border mt-6 overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="flex flex-col gap-1 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <AlertTriangle size={14} style={{ color: primary }} /> Alertas Que Exigem Atenção
          </h3>
          <span className="text-[10px] text-foreground-muted">Prioridades calculadas automaticamente</span>
        </div>
        
        <div className="divide-y sm:hidden" style={{borderColor: 'var(--border)'}}>
          {alertas.length === 0 && <p className="p-8 text-center text-xs text-foreground-muted">Nenhum alerta operacional pendente.</p>}
          {alertas.map(alerta => { const urgencia = calcularUrgencia(alerta); return <article key={alerta.id} className="space-y-3 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-xs font-black">{alerta.foco}</p><p className="mt-1 text-[9px] uppercase text-foreground-muted">{alerta.categoria} · {alerta.subtipo}</p></div><BadgeUrgencia urgencia={urgencia} /></div><p className="break-words text-xs leading-5 text-foreground-muted">{alerta.descricao}</p><div className="flex flex-col gap-2 min-[420px]:flex-row">{alerta.descricao.length > 55 && <button type="button" onClick={() => setAlertaDetalhado(alerta)} className="min-h-10 border px-3 text-[10px] font-bold uppercase" style={{borderColor: 'var(--border)', color: primary}}>Ver detalhes</button>}{podeDelegarTarefas && <button type="button" onClick={() => handleClicarDelegar(alerta)} className="min-h-10 border px-3 text-[10px] font-bold uppercase" style={{borderColor: tarefasHabilitadas ? primary : 'var(--border)', color: tarefasHabilitadas ? primary : 'var(--foreground-muted)'}}>{tarefasHabilitadas ? 'Delegar tarefa' : 'Delegar · Avançado'}</button>}</div></article> })}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="min-w-[760px] w-full text-left text-sm whitespace-nowrap">
            <thead style={{ backgroundColor: 'var(--background)', color: 'var(--foreground-muted)' }}>
              <tr className="text-[10px] uppercase tracking-widest">
                <th className="px-5 py-3 font-medium">Urgência</th>
                <th className="px-5 py-3 font-medium">Categoria / Foco</th>
                <th className="px-5 py-3 font-medium">Descrição da Pendência</th>
                {podeDelegarTarefas && <th className="px-5 py-3 font-medium text-right">Ação / Delegar</th>}
              </tr>
            </thead>
            <tbody className="divide-y [&>tr]:border-[var(--border)]" style={{ color: 'var(--foreground)' }}>
              {alertas.length === 0 && <tr><td colSpan={podeDelegarTarefas ? 4 : 3} className="px-5 py-10 text-center text-xs text-foreground-muted">Nenhum alerta operacional pendente.</td></tr>}
              {alertas.map((alerta) => {
                const urgencia = calcularUrgencia(alerta)
                const descCurta = alerta.descricao.length > 55 ? `${alerta.descricao.substring(0, 55)}...` : alerta.descricao

                return (
                  <tr key={alerta.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3"><BadgeUrgencia urgencia={urgencia} /></td>
                    <td className="px-5 py-3">
                      <div className="font-bold text-xs">{alerta.foco}</div>
                      <div className="text-[10px] text-foreground-muted uppercase">{alerta.categoria} • {alerta.subtipo}</div>
                    </td>
                    <td className="max-w-xl px-5 py-3 text-xs whitespace-normal">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 text-foreground-muted">{descCurta}</span>
                        {alerta.descricao.length > 55 && (
                          <button type="button" onClick={() => setAlertaDetalhado(alerta)} className="shrink-0 cursor-pointer text-[10px] font-bold uppercase underline transition-opacity hover:opacity-80" style={{ color: primary }} aria-label={`Ver observação completa de ${alerta.foco}`}>
                            Ver detalhes
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 🔒 BOTÃO COM INDICADOR VISUAL DO PLANO AVANÇADO */}
                    {podeDelegarTarefas && <td className="px-5 py-3 text-right">
                      <button 
                        onClick={() => handleClicarDelegar(alerta)}
                        className="px-3 py-1.5 border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ml-auto hover:bg-white/5 transition-all cursor-pointer relative"
                        style={{ 
                          borderColor: tarefasHabilitadas ? primary : 'var(--border)',
                          color: tarefasHabilitadas ? primary : 'var(--foreground-muted)'
                        }}
                      >
                        {!tarefasHabilitadas ? (
                          <>
                            <Lock size={12} className="text-yellow-500" />
                            <span>Delegar</span>
                            <span className="px-1 py-0.2 text-[8px] font-black bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">AVANÇADO</span>
                          </>
                        ) : (
                          <>
                            <Send size={12} /> Delegar Tarefa
                          </>
                        )}
                      </button>
                    </td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      <AnimatePresence>
        {alertaDetalhado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onMouseDown={(event) => event.target === event.currentTarget && setAlertaDetalhado(null)}>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-detalhes-alerta"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-xl border"
              style={{ backgroundColor: 'var(--background)', borderColor: primary }}
            >
              <div className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: primary }}>Observação completa</p>
                  <h2 id="titulo-detalhes-alerta" className="mt-1 text-lg font-black uppercase font-rajdhani">{alertaDetalhado.foco}</h2>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-foreground-muted">{alertaDetalhado.categoria} • {alertaDetalhado.subtipo}</p>
                </div>
                <button type="button" autoFocus onClick={() => setAlertaDetalhado(null)} aria-label="Fechar detalhes do alerta" className="p-1 text-foreground-muted transition-colors hover:text-foreground"><X size={18} /></button>
              </div>
              <div className="p-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Descrição da pendência</p>
                <p className="whitespace-pre-wrap break-words border-l-2 pl-4 text-sm leading-6" style={{ borderColor: primary }}>{alertaDetalhado.descricao}</p>
              </div>
              <div className="flex justify-end border-t p-4" style={{ borderColor: 'var(--border)' }}>
                <button type="button" onClick={() => setAlertaDetalhado(null)} className="border px-4 py-2 text-xs font-bold uppercase" style={{ borderColor: 'var(--border)' }}>Fechar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {podeDelegarTarefas && alertaParaDelegar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-lg space-y-5 border p-6" style={{ backgroundColor: 'var(--background)', borderColor: primary }}>
              <div className="flex items-start justify-between border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                <div><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: primary }}>Delegar alerta</p><h2 className="mt-1 font-bold">{alertaParaDelegar.foco}</h2></div>
                <button onClick={() => setAlertaParaDelegar(null)} aria-label="Fechar"><X size={18} /></button>
              </div>
              <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase text-foreground-muted">Responsável</span><select value={operadorSelecionado} onChange={event => setOperadorSelecionado(event.target.value)} className="w-full border bg-background p-3 text-sm outline-none" style={{ borderColor: 'var(--border)' }}><option value="">Selecione um usuário</option>{operadores.map(operador => <option key={operador.id} value={operador.id}>{operador.nome} — {operador.cargo}</option>)}</select></label>
              <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase text-foreground-muted">Instruções</span><textarea rows={4} value={instrucaoDelegacao} onChange={event => setInstrucaoDelegacao(event.target.value)} placeholder={alertaParaDelegar.descricao} className="w-full resize-y border bg-transparent p-3 text-sm outline-none" style={{ borderColor: 'var(--border)' }} /></label>
              <div className="flex justify-end gap-3"><button onClick={() => setAlertaParaDelegar(null)} className="border px-4 py-2 text-xs font-bold" style={{ borderColor: 'var(--border)' }}>Cancelar</button><button disabled={!operadorSelecionado} onClick={() => void handleDelegarTarefa()} className="px-4 py-2 text-xs font-black text-black disabled:opacity-40" style={{ backgroundColor: primary }}>Delegar e notificar</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🚀 MODAL DE INCENTIVO AO UPGRADE (RECURSO AVANÇADO/ENTERPRISE) */}
      <AnimatePresence>
        {modalUpgradeOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md border p-6 space-y-4 font-mono relative overflow-hidden"
              style={{ backgroundColor: 'var(--background)', borderColor: primary }}
            >
              <div className="flex justify-between items-start border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Sparkles size={18} style={{ color: primary }} />
                  <h3 className="text-sm font-bold uppercase font-rajdhani text-foreground">Funcionalidade Avançada</h3>
                </div>
                <button onClick={() => setModalUpgradeOpen(false)} className="cursor-pointer">✕</button>
              </div>

              <div className="space-y-3 py-2">
                <div className="p-3 border text-xs leading-relaxed bg-white/5" style={{ borderColor: 'var(--border)' }}>
                  <p className="font-bold mb-1 text-foreground">Delegação Direta por Notificação em Tempo Real</p>
                  <p className="text-foreground-muted text-[11px]">
                    Atribua tarefas e alertas críticos diretamente para os seus operadores do sistema. Eles recebem notificações instantâneas no painel e você acompanha o status de resolução.
                  </p>
                </div>

                <div className="text-[10px] uppercase font-bold text-foreground-muted flex items-center justify-between px-1">
                  <span>Disponível nos Planos:</span>
                  <span className="font-bold text-foreground" style={{ color: primary }}>AVANÇADO / ENTERPRISE</span>
                </div>
              </div>

              <div className="pt-3 flex flex-col gap-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <button 
                  onClick={() => {
                    setModalUpgradeOpen(false)
                    window.location.href = '/solicitar-acesso?plano=AVANCADO'
                  }}
                  className="w-full py-3 px-4 font-extrabold uppercase text-xs text-black flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-[1.01]"
                  style={{ backgroundColor: primary, clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
                >
                  Fazer Upgrade para Avançado <ArrowRight size={14} />
                </button>
                <button onClick={() => setModalUpgradeOpen(false)} className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-foreground-muted hover:text-foreground">
                  Continuar no Plano Essencial
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}

function MetricaCard({ titulo, valor, icone, variacao, positivo, primary }: { titulo: string, valor: string, icone: React.ReactNode, variacao: string, positivo: boolean, primary: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-5 border relative overflow-hidden group" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="text-[10px] font-bold uppercase tracking-widest font-mono text-foreground-muted">{titulo}</div>
        <div className="p-2 rounded-sm" style={{ backgroundColor: 'var(--background)', color: primary, border: '1px solid var(--border)' }}>{icone}</div>
      </div>
      <div className="relative z-10">
        <div className="text-3xl font-black font-rajdhani tracking-tight mb-1" style={{ color: 'var(--foreground)' }}>{valor}</div>
        <div className={`text-[10px] font-mono uppercase tracking-widest flex items-center gap-1 ${positivo ? 'text-green-500' : 'text-red-500'}`}>{variacao}</div>
      </div>
    </motion.div>
  )
}

function BadgeUrgencia({ urgencia }: { urgencia: Urgencia }) {
  if (urgencia === 'ALTA') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-bold tracking-widest bg-red-500/10 text-red-500 border border-red-500/20"><ShieldAlert size={11} /> ALTA URGÊNCIA</span>
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-bold tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20"><Wrench size={11} /> BAIXA URGÊNCIA</span>
}
