'use client'

import { Suspense, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import { useSearchParams } from 'next/navigation'
import { 
  Plus, 
  Bell, 
  DollarSign, 
  Trash2, 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Truck,
  History,
  CalendarPlus,
  Activity,
  Crosshair,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import Link from 'next/link'

type StatusManutencao = 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA' | 'NAO_REALIZADA'
type StatusDiagnostico = 'PASSIVO' | 'MONITORADO' | 'ALERTA' | 'CRITICO' | 'NORMAL'
type SistemaDiagnostico = 'estrutura' | 'lataria' | 'motor' | 'oleo' | 'escape' | 'combustivel' | 'arla' | 'rodas' | 'freios' | 'transmissao'

interface VeiculoSelecao {
  id: string
  modelo: string
  placa: string
  tipo: string
  kmAtual: number
  diasAntecedenciaNotificacao: number
}

interface RegistroManutencao {
  id: string
  veiculoPlaca: string
  veiculoModelo: string
  dataAgendada: string
  tipo: string
  pecas: string
  custo: number
  kmAtual: number
  status: StatusManutencao
  origem: 'FUTURA' | 'ADMINISTRATIVA'
  arquivado: boolean
}

function ManutencaoContent() {
  const { primary } = useTheme()
  const searchParams = useSearchParams()
  const placaUrl = searchParams.get('placa')

  const [montado, setMontado] = useState(false)
  const [modalInclusaoOpen, setModalInclusaoOpen] = useState(false)
  const [tipoInclusao, setTipoInclusao] = useState<'FUTURA' | 'ADMINISTRATIVA'>('FUTURA')
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  const dataHoje = new Date().toISOString().split('T')[0]

  const [formManutencao, setFormManutencao] = useState({
    dataAgendada: dataHoje,
    tipo: 'PREVENTIVA',
    pecas: '',
    custo: '',
    kmAtual: ''
  })

  const [veiculos, setVeiculos] = useState<VeiculoSelecao[]>([])
  const [feedback, setFeedback] = useState('')
  const [salvandoAntecedencia, setSalvandoAntecedencia] = useState(false)

  const [indexSelecionado, setIndexSelecionado] = useState(0)
  const [historico, setHistorico] = useState<RegistroManutencao[]>([])

  useEffect(() => {
    queueMicrotask(() => setMontado(true))
    fetch('/api/manutencoes', { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.erro); setVeiculos(data.veiculos); setHistorico(data.historico); if (placaUrl) { const idx = data.veiculos.findIndex((v: VeiculoSelecao) => v.placa.toUpperCase() === placaUrl.toUpperCase()); if (idx !== -1) setIndexSelecionado(idx) } }).catch(error => setFeedback(error instanceof Error ? error.message : 'Falha ao carregar manutenções.'))
  }, [placaUrl])

  if (!montado) return null
  if (veiculos.length === 0) return <div className="border border-dashed p-12 text-center text-sm text-foreground-muted">Nenhum veículo cadastrado para controlar manutenções.{feedback ? ` ${feedback}` : ''}</div>

  const veiculoAtivo = veiculos[indexSelecionado] || veiculos[0]
  const manutencoesDoVeiculo = historico.filter(h => h.veiculoPlaca === veiculoAtivo.placa)
  const manutencoesOperacionaisDoVeiculo = manutencoesDoVeiculo.filter(h => !h.arquivado)
  const totalManutencoesArquivadas = manutencoesDoVeiculo.length - manutencoesOperacionaisDoVeiculo.length
  const custoTotalVeiculo = manutencoesDoVeiculo.filter(m => m.status === 'CONCLUIDA').reduce((acc, item) => acc + item.custo, 0)
  const isTemaVermelho = primary === '#ef4444' || primary === '#ff0000'

  const handleAnterior = () => setIndexSelecionado(prev => (prev === 0 ? veiculos.length - 1 : prev - 1))
  const handleProximo = () => setIndexSelecionado(prev => (prev === veiculos.length - 1 ? 0 : prev + 1))
  const handleAtualizarDiasNotificacao = async (dias: number) => {
    if (!veiculoAtivo || salvandoAntecedencia || dias === veiculoAtivo.diasAntecedenciaNotificacao) return
    const veiculoId = veiculoAtivo.id
    setSalvandoAntecedencia(true)
    setFeedback('')
    try {
      const response = await fetch(`/api/veiculos/${veiculoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ diasAntecedenciaNotif: dias }) })
      if (!response.ok) return setFeedback('Não foi possível atualizar a antecedência do alerta.')
      setVeiculos(prev => prev.map(v => v.id === veiculoId ? { ...v, diasAntecedenciaNotificacao: dias } : v))
      setFeedback(`Alertas de ${veiculoAtivo.modelo} serão enviados com ${dias} dias de antecedência.`)
    } catch {
      setFeedback('Não foi possível conectar ao servidor para atualizar a antecedência do alerta.')
    } finally {
      setSalvandoAntecedencia(false)
    }
  }

  const handleSalvarManutencao = async (e: React.FormEvent) => {
    e.preventDefault()
    const response = await fetch('/api/manutencoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ veiculoId: veiculoAtivo.id, ...formManutencao, custo: Number(formManutencao.custo) || 0, kmAtual: Number(formManutencao.kmAtual) || veiculoAtivo.kmAtual, origem: tipoInclusao }) })
    const novoRegistro = await response.json()
    if (!response.ok) return setFeedback(novoRegistro.erro || 'Não foi possível salvar a manutenção.')
    setHistorico(prev => [novoRegistro, ...prev])
    setModalInclusaoOpen(false)
    setFormManutencao({ dataAgendada: dataHoje, tipo: 'PREVENTIVA', pecas: '', custo: '', kmAtual: '' })
  }

  const handleAlterarStatus = async (id: string, novoStatus: StatusManutencao) => {
    const manutencaoAtual = historico.find((item) => item.id === id)
    if (manutencaoAtual?.arquivado) {
      setFeedback('Esta manutenção faz parte de um relatório de auditoria e permanece somente para consulta.')
      return
    }
    setFeedback('')
    const response = await fetch(`/api/manutencoes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: novoStatus }) })
    const data = await response.json()
    if (!response.ok) return setFeedback(data.erro || 'Não foi possível atualizar a manutenção.')
    setHistorico(prev => prev.map(item => item.id === id ? data : item))
  }
  const handleConfirmarExclusao = async (id: string) => {
    const manutencaoAtual = historico.find((item) => item.id === id)
    if (manutencaoAtual?.arquivado) {
      setExcluindoId(null)
      setFeedback('Esta manutenção faz parte de um relatório de auditoria e não pode ser excluída.')
      return
    }
    setFeedback('')
    const response = await fetch(`/api/manutencoes/${id}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) return setFeedback(data.erro || 'Não foi possível excluir a manutenção.')
    setHistorico(prev => prev.filter(h => h.id !== id))
    setExcluindoId(null)
  }

  // Combina a categoria geral com a descrição para apontar a peça mais específica
  // sem exigir uma migração de banco antes do futuro campo `componenteAlvo`.
  const normalizarDiagnostico = (valor: string) => valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

  const registroAfetaSistema = (registro: RegistroManutencao, sistema: SistemaDiagnostico) => {
    const texto = normalizarDiagnostico(`${registro.tipo} ${registro.pecas}`)
    const termos: Record<SistemaDiagnostico, string[]> = {
      estrutura: ['CHASSI', 'ESTRUTURA', 'LONGARINA', 'QUINTA RODA'],
      lataria: ['LATARIA', 'FUNILARIA', 'AMASSADO', 'BATIDA', 'COLISAO', 'ARRANHAO', 'RISCO', 'PINTURA', 'REPINTURA', 'PARACHOQUE', 'PARALAMA', 'CAPO', 'CORROSAO', 'PORTA', 'CABINE', 'FAROL', 'RETROVISOR'],
      motor: ['MOTOR', 'BLOCO', 'CABECOTE', 'CORREIA', 'INJECAO', 'OLEO', 'FILTRO', 'RACOR'],
      oleo: ['OLEO', 'FILTRO', 'RACOR', 'LUBRIFIC'],
      escape: ['ESCAPE', 'ESCAPAMENTO', 'EXAUST', 'CATALISADOR', 'SILENCIOSO'],
      combustivel: ['COMBUSTIVEL', 'DIESEL', 'TANQUE', 'BOMBA', 'BICO'],
      arla: ['ARLA', 'SCR', 'UREIA'],
      rodas: ['PNEU', 'RODA', 'ARO', 'EIXO'],
      freios: ['FREIO', 'LONA', 'PASTILHA', 'CUICA', 'DISCO'],
      transmissao: ['CAMBIO', 'TRANSMISSAO', 'CARDA', 'EMBREAGEM', 'DIFERENCIAL'],
    }
    return termos[sistema].some(termo => texto.includes(termo))
  }

  const obterStatusPeca = (sistema: SistemaDiagnostico): StatusDiagnostico => {
    const registrosPeca = manutencoesOperacionaisDoVeiculo.filter(m => registroAfetaSistema(m, sistema))
    if (registrosPeca.length === 0) return 'PASSIVO'

    const pendentes = registrosPeca.filter(m => m.status === 'PENDENTE')
    
    if (pendentes.length > 0) {
      let statusAgendamento: StatusDiagnostico = 'MONITORADO'
      const dataAtual = new Date(dataHoje)

      for (const p of pendentes) {
        const agendada = new Date(p.dataAgendada)
        const diferencaDias = Math.ceil((agendada.getTime() - dataAtual.getTime()) / (1000 * 60 * 60 * 24))

        if (diferencaDias < 0) return 'CRITICO'
        if (diferencaDias <= veiculoAtivo.diasAntecedenciaNotificacao) {
          statusAgendamento = 'ALERTA'
        }
      }
      return statusAgendamento
    }

    const concluidas = registrosPeca.filter(m => m.status === 'CONCLUIDA')
    if (concluidas.length > 0) return 'NORMAL'

    return 'PASSIVO'
  }

  const aplicarEstiloPeca = (status: StatusDiagnostico) => {
    switch (status) {
      case 'CRITICO':
        return { 
          stroke: '#ef4444', 
          fill: 'url(#hatch-red)',
          opacity: 1,
          filter: 'url(#glow-red)',
          anim: { opacity: [0.58, 1, 0.58] }
        }
      case 'ALERTA':
        return { 
          stroke: '#eab308', 
          fill: 'url(#hatch-yellow)',
          opacity: 1,
          filter: 'url(#glow-yellow)',
          anim: { opacity: [0.62, 1, 0.62] }
        }
      case 'NORMAL':
        return { 
          stroke: '#22c55e', 
          fill: 'rgba(34, 197, 94, 0.05)', 
          opacity: 0.82,
          filter: 'none',
          anim: {} 
        }
      case 'MONITORADO':
        return { 
          stroke: primary, 
          fill: 'url(#hatch-primary)',
          opacity: 0.9,
          filter: 'url(#glow-primary)',
          anim: {} 
        }
      default:
        return { 
          stroke: primary,
          fill: `${primary}08`,
          opacity: 0.3,
          filter: 'none',
          anim: {} 
        }
    }
  }

  const estiloEstrutura = aplicarEstiloPeca(obterStatusPeca('estrutura'))
  const estiloLataria = aplicarEstiloPeca(obterStatusPeca('lataria'))
  const estiloMotor = aplicarEstiloPeca(obterStatusPeca('motor'))
  const estiloOleo = aplicarEstiloPeca(obterStatusPeca('oleo'))
  const estiloEscape = aplicarEstiloPeca(obterStatusPeca('escape'))
  const estiloCombustivel = aplicarEstiloPeca(obterStatusPeca('combustivel'))
  const estiloArla = aplicarEstiloPeca(obterStatusPeca('arla'))
  const estiloRodas = aplicarEstiloPeca(obterStatusPeca('rodas'))
  const estiloFreios = aplicarEstiloPeca(obterStatusPeca('freios'))
  const estiloTransmissao = aplicarEstiloPeca(obterStatusPeca('transmissao'))

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-mono">
      {feedback && <div role="status" className="border p-3 text-sm" style={{ borderColor: primary, color: primary }}>{feedback}</div>}

      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Link href="/dashboard/empresa/frota" className="inline-flex items-center gap-2 text-xs text-foreground-muted hover:text-foreground mb-2 transition-colors">
            <ArrowLeft size={14} /> Voltar para o Catálogo da Frota
          </Link>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight font-rajdhani" style={{ color: 'var(--foreground)' }}>
            Centro de <span style={{ color: primary }}>Manutenções & Peças</span>
          </h1>
          <p className="text-sm mt-1 text-foreground-muted">
            Gestão de revisões, gamificação de diagnóstico e alertas configuráveis.
          </p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => setModalInclusaoOpen(true)}
          className="flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all text-black font-extrabold"
          style={{ backgroundColor: primary, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}
        >
          <Plus size={16} /> Lançar Revisão
        </motion.button>
      </div>

      {/* CARROSSEL DE VEÍCULOS */}
      <div className="border p-4 relative" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
        <div className="flex justify-between items-center mb-3 text-[10px] uppercase font-bold text-foreground-muted tracking-widest">
          <span className="flex items-center gap-2"><Crosshair size={12} style={{ color: primary }}/> Selecione o Alvo do Diagnóstico:</span>
          <span>{indexSelecionado + 1} de {veiculos.length} Ativos</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleAnterior} className="p-2 border rounded-sm hover:bg-white/10 transition-colors shrink-0" style={{ borderColor: 'var(--border)' }}>
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 overflow-x-auto hide-scrollbar flex gap-3 py-1">
            {veiculos.map((v, idx) => {
              const estaSelecionado = idx === indexSelecionado
              return (
                <button
                  key={v.id} onClick={() => setIndexSelecionado(idx)}
                  className="p-3 border text-left min-w-[210px] shrink-0 transition-all relative cursor-pointer"
                  style={{ backgroundColor: estaSelecionado ? `${primary}15` : 'var(--background)', borderColor: estaSelecionado ? primary : 'var(--border)', clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-xs truncate max-w-[120px]" style={{ color: estaSelecionado ? primary : 'var(--foreground)' }}>{v.modelo}</span>
                    <span className="text-[9px] px-1.5 py-0.5 border" style={{ borderColor: 'var(--border)' }}>{v.placa}</span>
                  </div>
                  <div className="text-[10px] text-foreground-muted">{v.tipo}</div>
                </button>
              )
            })}
          </div>
          <button onClick={handleProximo} className="p-2 border rounded-sm hover:bg-white/10 transition-colors shrink-0" style={{ borderColor: 'var(--border)' }}>
            <ChevronRight size={20} />
          </button>
        </div>

        {/* MÉTRICAS RÁPIDAS */}
        {veiculoAtivo && (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 text-xs sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.7fr]" style={{ borderColor: 'var(--border)' }}>
            <div>
              <div className="text-[10px] uppercase text-foreground-muted flex items-center gap-1"><Truck size={12} style={{ color: primary }} /> Veículo</div>
              <div className="font-bold mt-1 text-sm">{veiculoAtivo.modelo}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-foreground-muted flex items-center gap-1"><Gauge size={12} style={{ color: primary }} /> Odômetro</div>
              <div className="font-bold mt-1 text-sm">{veiculoAtivo.kmAtual.toLocaleString('pt-BR')} KM</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-foreground-muted flex items-center gap-1"><DollarSign size={12} style={{ color: primary }} /> Total Gasto</div>
              <div className={`mt-1 text-sm ${isTemaVermelho ? 'text-foreground font-black underline decoration-red-500' : 'text-red-500 font-bold'}`}>
                - {custoTotalVeiculo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
            <div className="border p-3" style={{ borderColor: `${primary}55`, backgroundColor: `${primary}08` }}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center border" style={{ borderColor: `${primary}66`, color: primary, backgroundColor: `${primary}12` }}>
                  <Bell size={16} className={salvandoAntecedencia ? 'animate-pulse' : ''} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Antecedência dos alertas</div>
                  <div className="mt-0.5 font-bold">Avisar {veiculoAtivo.diasAntecedenciaNotificacao} dias antes da ocorrência</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1" aria-label="Escolher antecedência do alerta">
                {[3, 7, 15, 30].map(dias => {
                  const selecionado = dias === veiculoAtivo.diasAntecedenciaNotificacao
                  return (
                    <button
                      key={dias}
                      type="button"
                      aria-pressed={selecionado}
                      disabled={salvandoAntecedencia}
                      onClick={() => void handleAtualizarDiasNotificacao(dias)}
                      className="border px-2 py-2 text-[10px] font-black uppercase transition-colors disabled:cursor-wait disabled:opacity-60"
                      style={{ borderColor: selecionado ? primary : 'var(--border)', backgroundColor: selecionado ? primary : 'transparent', color: selecionado ? '#000' : 'var(--foreground-muted)' }}
                    >
                      {dias} dias
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── GRID DIVIDIDO: LISTA A ESQUERDA / RAIO-X A DIREITA ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* LISTA DE MANUTENÇÕES (ESQUERDA) */}
        <div className="xl:col-span-2 border overflow-hidden relative flex flex-col" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
          <div className="p-4 border-b font-bold text-xs uppercase flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
            <span className="flex items-center gap-2"><History size={14} style={{ color: primary }}/> Histórico de Intervenções</span>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead style={{ backgroundColor: 'var(--background)', color: 'var(--foreground-muted)' }}>
                <tr className="text-[10px] uppercase tracking-widest border-b" style={{ borderColor: 'var(--border)' }}>
                  <th className="px-4 py-4">Data</th>
                  <th className="px-4 py-4">Serviço / Peças</th>
                  <th className="px-4 py-4">Odômetro</th>
                  <th className="px-4 py-4">Custo</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y [&>tr]:border-[var(--border)]" style={{ color: 'var(--foreground)' }}>
                <AnimatePresence>
                  {manutencoesDoVeiculo.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-sm font-mono text-foreground-muted">
                        Nenhum registro encontrado. O Raio-X está limpo.
                      </td>
                    </tr>
                  ) : (
                    manutencoesDoVeiculo.map((h) => (
                      <motion.tr key={h.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hover:bg-white/5 transition-colors font-mono">
                        <td className="px-4 py-3 text-xs font-bold">{h.dataAgendada}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: primary }}>{h.tipo}</div>
                            {h.arquivado && (
                              <span className="inline-flex items-center gap-1 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black text-amber-500" title="Registro preservado em relatório de auditoria">
                                <Lock size={9} /> ARQUIVADO
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-foreground-muted truncate max-w-[200px]">{h.pecas}</div>
                        </td>
                        <td className="px-4 py-3 text-xs">{h.kmAtual.toLocaleString('pt-BR')} km</td>
                        <td className={`px-4 py-3 text-xs font-bold ${isTemaVermelho ? 'text-foreground' : 'text-red-500'}`}>
                          - {h.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-3">
                          {h.arquivado ? (
                            <span
                              className="inline-flex items-center gap-1 border px-2 py-1 text-[9px] font-bold uppercase"
                              style={{
                                borderColor: h.status === 'CONCLUIDA' ? '#22c55e' : h.status === 'PENDENTE' ? '#eab308' : '#ef4444',
                                color: h.status === 'CONCLUIDA' ? '#22c55e' : h.status === 'PENDENTE' ? '#eab308' : '#ef4444',
                              }}
                              title="Manutenção arquivada: disponível somente para consulta"
                            >
                              <Lock size={10} /> {h.status}
                            </span>
                          ) : (
                            <select
                              value={h.status}
                              onChange={(e) => handleAlterarStatus(h.id, e.target.value as StatusManutencao)}
                              className="px-2 py-1 text-[9px] font-bold uppercase border bg-transparent outline-none cursor-pointer"
                              style={{
                                borderColor: h.status === 'CONCLUIDA' ? '#22c55e' : h.status === 'PENDENTE' ? '#eab308' : '#ef4444',
                                color: h.status === 'CONCLUIDA' ? '#22c55e' : h.status === 'PENDENTE' ? '#eab308' : '#ef4444'
                              }}
                            >
                              <option value="PENDENTE" style={{ background: 'var(--background)', color: '#eab308' }}>PENDENTE</option>
                              <option value="CONCLUIDA" style={{ background: 'var(--background)', color: '#22c55e' }}>CONCLUÍDA</option>
                              <option value="CANCELADA" style={{ background: 'var(--background)', color: '#ef4444' }}>CANCELADA</option>
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {h.arquivado ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase text-amber-500" title="Registros arquivados não podem ser alterados ou excluídos">
                              <Lock size={12} /> Somente leitura
                            </span>
                          ) : excluindoId === h.id ? (
                            <div className="inline-flex items-center gap-2 font-bold text-[10px] text-red-500 bg-red-500/10 px-2 py-1 rounded">
                              <span>Excluir?</span>
                              <button onClick={() => handleConfirmarExclusao(h.id)} className="hover:underline text-red-400">Sim</button>
                              <button onClick={() => setExcluindoId(null)} className="text-foreground hover:underline">Não</button>
                            </div>
                          ) : (
                            <button onClick={() => setExcluindoId(h.id)} className="p-1 text-foreground-muted hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                          )}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── HUD RAIO-X DO CAMINHÃO BLUEPRINT (DIREITA) ─── */}
        <div className="border flex flex-col relative overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
          <div className="p-4 border-b flex justify-between items-center z-20 relative bg-background-secondary/80 backdrop-blur-md" style={{ borderColor: 'var(--border)' }}>
            <span className="font-bold text-xs uppercase flex items-center gap-2 tracking-widest">
              <Activity size={14} style={{ color: primary }} /> HUD Blueprint Analítico
            </span>
            <span className="text-[9px] font-bold text-foreground-muted animate-pulse">
              SYS_ACTIVE
            </span>
          </div>

          <div className="flex-1 flex items-center justify-center relative min-h-[540px] overflow-hidden bg-[#050505]">
            
            {/* ── BACKGROUND ENGINEERING GRID ── */}
            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none">
              <defs>
                <pattern id="engineering-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke={primary} strokeWidth="0.5" />
                </pattern>
                <pattern id="engineering-grid-large" width="150" height="150" patternUnits="userSpaceOnUse">
                  <rect width="150" height="150" fill="url(#engineering-grid)" />
                  <path d="M 150 0 L 0 0 0 150" fill="none" stroke={primary} strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#engineering-grid-large)" />
            </svg>

            {/* Crosshairs decorativos no fundo */}
            <div className="absolute top-10 left-10 w-4 h-4 border-l border-t opacity-50" style={{ borderColor: primary }} />
            <div className="absolute bottom-10 right-10 w-4 h-4 border-r border-b opacity-50" style={{ borderColor: primary }} />

            {/* SCANNER ANIMADO VAI E VEM */}
            <motion.div 
              className="absolute top-0 bottom-0 w-[2px] z-30 shadow-[0_0_15px_currentColor]"
              style={{ backgroundColor: primary, color: primary }}
              animate={{ left: ['0%', '100%', '0%'] }}
              transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
            />

            {/* Caminhão detalhado original + sensores alinhados ao viewBox 736 × 736 */}
            <div className="relative z-10 w-full max-w-[560px] aspect-square" aria-label={`Raio-X diagnóstico do veículo ${veiculoAtivo.placa}`}>
              <img
                src="/images/caminhaoestilizado.svg"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-contain opacity-55 select-none pointer-events-none"
                style={{ filter: 'invert(1) contrast(1.35)', mixBlendMode: 'screen' }}
              />

              <svg viewBox="0 0 736 736" className="absolute inset-0 w-full h-full overflow-visible">
                <defs>
                  <filter id="detail-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="7" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="engine-color" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
                    <feFlood floodColor={estiloMotor.stroke} result="engine-status-color" />
                    <feComposite in="engine-status-color" in2="SourceAlpha" operator="in" />
                  </filter>
                </defs>

                {/* Lataria externa: cabine, porta, para-lama e para-choque */}
                <motion.g
                  {...estiloLataria}
                  animate={estiloLataria.anim}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                >
                  <title>Lataria: {obterStatusPeca('lataria')}</title>
                  <path
                    d="M104 335 L111 238 Q114 176 168 151 L411 116 Q477 113 505 178 L510 419 L456 439 L414 326 L304 328 L286 359 L169 366 Z"
                    strokeWidth="2.2"
                  />
                  <path d="M326 205 L450 199 L476 405 L365 431 L322 336 Z" strokeWidth="1.5" />
                  <path d="M104 337 L286 357 L302 516 L104 501 Z" strokeWidth="1.5" />
                  <path d="M418 429 Q455 450 482 493" fill="none" strokeWidth="2" />
                  <path d="M371 273 l24 -9 m-17 22 31 -12 m-22 24 20 -8" fill="none" strokeWidth="1.6" opacity="0.85" />
                </motion.g>

                {/* Motor e cabeçote, sob a cabine */}
                <motion.g {...estiloMotor} animate={estiloMotor.anim} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <title>Motor: {obterStatusPeca('motor')}</title>
                  <image
                    href="/images/motorcaminhaoestilizado.svg"
                    x="248"
                    y="282"
                    width="210"
                    height="280"
                    preserveAspectRatio="xMidYMid meet"
                    filter="url(#engine-color)"
                  />
                  <path
                    d="M292 348 L405 338 L430 474 L306 500 L278 428 Z"
                    fill="none"
                    strokeWidth="1.25"
                    strokeDasharray="7 6"
                    opacity="0.55"
                  />
                </motion.g>

                {/* Óleo e filtro */}
                <motion.g {...estiloOleo} animate={estiloOleo.anim} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <rect x="365" y="455" width="48" height="68" rx="10" strokeWidth="2.5" />
                  <path d="M376 469 H402 M376 481 H402" fill="none" strokeWidth="1.5" />
                </motion.g>

                {/* Escapamento vertical e SCR */}
                <motion.g {...estiloEscape} animate={estiloEscape.anim} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <path d="M501 214 L535 218 L539 414 L508 419 Z" strokeWidth="2.5" />
                  <path d="M514 227 L526 402" fill="none" strokeWidth="1.2" strokeDasharray="8 5" />
                </motion.g>

                {/* Tanque diesel e ARLA acompanhando o chassi */}
                <motion.g {...estiloCombustivel} animate={estiloCombustivel.anim} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <path d="M505 478 L633 462 L642 526 L510 548 Z" strokeWidth="2.5" />
                  <path d="M530 477 L536 543 M606 466 L614 531" fill="none" strokeWidth="1.5" />
                  <path d="M516 493 L631 478" fill="none" strokeWidth="1" strokeDasharray="7 5" opacity="0.7" />
                </motion.g>
                <motion.g {...estiloArla} animate={estiloArla.anim} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <path d="M477 488 L510 482 L516 526 L482 532 Z" strokeWidth="2.5" />
                </motion.g>

                {/* Rodagem, transmissão e freios sobre as rodas originais */}
                <motion.g {...estiloRodas} animate={estiloRodas.anim} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <ellipse cx="463" cy="557" rx="38" ry="61" fill="transparent" strokeWidth="3" />
                  <ellipse cx="666" cy="532" rx="31" ry="55" fill="transparent" strokeWidth="3" />
                </motion.g>
                <motion.path d="M418 507 L616 482 L654 518" {...estiloTransmissao} animate={estiloTransmissao.anim} transition={{ repeat: Infinity, duration: 1.5 }} fill="none" strokeWidth="3" strokeDasharray="10 6" />
                <motion.g {...estiloFreios} animate={estiloFreios.anim} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <ellipse cx="463" cy="557" rx="17" ry="30" fill="transparent" strokeWidth="3" />
                  <ellipse cx="666" cy="532" rx="14" ry="27" fill="transparent" strokeWidth="3" />
                </motion.g>

                {/* Callouts técnicos */}
                <g fill="none" stroke={primary} strokeWidth="1" opacity="0.75">
                  <path d="M350 387 L235 330 L112 330" />
                  <path d="M520 280 L605 235 L700 235" />
                  <path d="M552 514 L338 622 L112 622" />
                  <path d="M665 532 L700 592 L724 592" />
                </g>
                <g fill={primary} fontSize="12" fontFamily="monospace" fontWeight="700">
                  <text x="108" y="324" textAnchor="start">ENGINE CORE</text>
                  <text x="700" y="229" textAnchor="end">EXHAUST / SCR</text>
                  <text x="108" y="616" textAnchor="start">DIESEL + ARLA</text>
                  <text x="724" y="586" textAnchor="end">BRAKE AXLE</text>
                </g>
              </svg>
            </div>

            {/* Blueprint geométrico anterior mantido como referência, fora da renderização */}
            <svg viewBox="0 0 800 450" className="hidden">
              <defs>
                {/* Glow Filters Elevados */}
                <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-yellow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-primary" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                {/* Padronagem (Hachura) para preenchimento de peças afetadas */}
                <pattern id="hatch-red" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#ef4444" strokeWidth="2" opacity="0.3" />
                </pattern>
                <pattern id="hatch-yellow" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#eab308" strokeWidth="2" opacity="0.3" />
                </pattern>
                <pattern id="hatch-primary" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke={primary} strokeWidth="2" opacity="0.3" />
                </pattern>
              </defs>

              {/* DADOS HUD NO BACKGROUND DO SVG */}
              <text x="750" y="40" fill={primary} fontSize="14" fontFamily="monospace" opacity="0.6" textAnchor="end">SYS.DIAGNOSTICS_RUNNING</text>
              <text x="750" y="60" fill={primary} fontSize="10" fontFamily="monospace" opacity="0.4" textAnchor="end">TARGET: {veiculoAtivo.placa}</text>

              {/* 1. CHASSI E CABINE AVANÇADA (PREVENTIVA / CORRETIVA) */}
              <motion.g 
                strokeLinecap="round"
                strokeLinejoin="round"
                {...estiloEstrutura}
                animate={estiloEstrutura.anim}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              >
                {/* Chassi - Viga Dupla Longarina */}
                <path d="M 120 290 L 720 290 L 720 310 L 120 310 Z" strokeWidth="1.5" />
                <line x1="120" y1="300" x2="720" y2="300" strokeWidth="0.5" strokeDasharray="4 2" />
                
                {/* Quinta Roda (Engate da Carreta) */}
                <path d="M 520 290 L 530 270 L 590 270 L 600 290 Z" strokeWidth="1.5" />
                <circle cx="560" cy="280" r="4" />

                {/* Perfil da Cabine (Aerodinâmica detalhada) */}
                <path d="M 130 290 L 130 180 C 130 150, 150 110, 180 100 L 290 80 C 330 80, 350 110, 360 160 L 400 290 Z" strokeWidth="2" />
                
                {/* Defletor de Ar Superior */}
                <path d="M 180 90 L 290 70 L 330 90 Z" fill="transparent" strokeWidth="1" strokeDasharray="3 3" />
                
                {/* Janela Principal */}
                <path d="M 170 180 L 170 120 C 180 110, 200 105, 230 105 L 290 105 L 320 180 Z" strokeWidth="1.5" />
                
                {/* Recorte da Porta e Maçaneta */}
                <path d="M 230 180 L 230 280 L 350 280 L 320 180 Z" strokeWidth="1" />
                <rect x="245" y="220" width="20" height="5" rx="2" />
                
                {/* Grade Frontal e Faróis */}
                <path d="M 130 200 L 160 200 M 130 220 L 165 220 M 130 240 L 170 240 M 130 260 L 175 260" strokeWidth="1.5" />
                <path d="M 135 275 L 155 275 L 150 285 L 135 285 Z" strokeWidth="1.5" /> {/* Farol */}
              </motion.g>

              {/* CONECTORES E CALLOUTS HUD (CABINE) */}
              <g opacity="0.6">
                <circle cx="280" cy="140" r="3" fill={primary} />
                <polyline points="280,140 330,100 380,100" fill="none" stroke={primary} strokeWidth="1" />
                <text x="385" y="103" fill={primary} fontSize="10" fontFamily="monospace">CABIN_STRUCT</text>
              </g>

              {/* 2. MOTORIZAÇÃO: bloco e cabeçote */}
              <motion.g 
                strokeLinecap="round"
                {...estiloMotor}
                animate={estiloMotor.anim}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              >
                {/* Bloco do Motor (Sob a cabine) */}
                <rect x="220" y="245" width="100" height="55" rx="6" strokeWidth="2" />
                {/* Cilindros / Cabeçote */}
                <circle cx="240" cy="265" r="12" fill="transparent" strokeWidth="1.5" />
                <circle cx="270" cy="265" r="12" fill="transparent" strokeWidth="1.5" />
                <circle cx="300" cy="265" r="12" fill="transparent" strokeWidth="1.5" />
              </motion.g>

              {/* Filtro e circuito de óleo */}
              <motion.g
                {...estiloOleo}
                animate={estiloOleo.anim}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              >
                {/* Filtro de Óleo / Ar */}
                <rect x="330" y="255" width="25" height="35" rx="4" strokeWidth="1.5" />
                <path d="M 325 282 L 355 282" fill="none" strokeWidth="1" strokeDasharray="3 2" />
              </motion.g>

              {/* Tubulação e escapamento */}
              <motion.g
                {...estiloEscape}
                animate={estiloEscape.anim}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              >
                {/* Tubulação / Exaustão */}
                <path d="M 320 270 L 390 270 L 390 150 L 410 150" fill="none" strokeWidth="2" />
                <rect x="395" y="100" width="30" height="50" rx="3" strokeWidth="1.5" /> {/* Escapamento vertical */}
              </motion.g>

              {/* CONECTORES E CALLOUTS HUD (MOTOR) */}
              <g opacity="0.6">
                <circle cx="270" cy="265" r="3" fill={primary} />
                <polyline points="270,265 270,210 220,210" fill="none" stroke={primary} strokeWidth="1" />
                <text x="215" y="213" fill={primary} fontSize="10" fontFamily="monospace" textAnchor="end">ENG_BLOCK_V8</text>
              </g>

              {/* 3. ALIMENTAÇÃO / TANQUES (COMBUSTIVEL) */}
              <motion.g 
                {...estiloCombustivel}
                animate={estiloCombustivel.anim}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              >
                {/* Tanque Principal (Diesel) */}
                <rect x="380" y="315" width="140" height="45" rx="12" strokeWidth="2" />
                <line x1="410" y1="315" x2="410" y2="360" strokeWidth="3" opacity="0.5" />
                <line x1="450" y1="315" x2="450" y2="360" strokeWidth="3" opacity="0.5" />
                <line x1="490" y1="315" x2="490" y2="360" strokeWidth="3" opacity="0.5" />
                {/* Bocal do Tanque */}
                <rect x="400" y="308" width="10" height="7" rx="1" strokeWidth="1.5" />
                
              </motion.g>

              <motion.g
                {...estiloArla}
                animate={estiloArla.anim}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              >
                {/* Tanque Auxiliar (Arla 32) */}
                <rect x="530" y="325" width="45" height="35" rx="6" strokeWidth="2" />
                <line x1="552.5" y1="325" x2="552.5" y2="360" strokeWidth="2" opacity="0.5" />
              </motion.g>

              {/* 4. SISTEMA DE RODAGEM (PNEUS E EIXOS) */}
              <motion.g 
                {...estiloRodas}
                animate={estiloRodas.anim}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              >
                {/* --- Roda Dianteira Direcional --- */}
                <circle cx="210" cy="355" r="50" strokeWidth="2.5" /> {/* Pneu Externo */}
                <circle cx="210" cy="355" r="38" fill="transparent" strokeWidth="1" strokeDasharray="5 5" /> {/* Perfil Pneu */}
                <circle cx="210" cy="355" r="22" fill="transparent" strokeWidth="2" /> {/* Aro */}
                <circle cx="210" cy="355" r="8" strokeWidth="2" /> {/* Cubo */}
                {/* Raios / Porcas */}
                <path d="M 210 333 L 210 347 M 210 363 L 210 377 M 188 355 L 202 355 M 218 355 L 232 355" strokeWidth="2" />

                {/* --- Tração Traseira Dupla (Trucado) --- */}
                {/* Eixo Traseiro 1 */}
                <circle cx="600" cy="355" r="50" strokeWidth="2.5" />
                <circle cx="600" cy="355" r="38" fill="transparent" strokeWidth="1" strokeDasharray="5 5" />
                <circle cx="600" cy="355" r="22" fill="transparent" strokeWidth="2" />
                <circle cx="600" cy="355" r="8" strokeWidth="2" />
                
                {/* Eixo Traseiro 2 */}
                <circle cx="710" cy="355" r="50" strokeWidth="2.5" />
                <circle cx="710" cy="355" r="38" fill="transparent" strokeWidth="1" strokeDasharray="5 5" />
                <circle cx="710" cy="355" r="22" fill="transparent" strokeWidth="2" />
                <circle cx="710" cy="355" r="8" strokeWidth="2" />

              </motion.g>

              <motion.g {...estiloTransmissao} animate={estiloTransmissao.anim} transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}>
                {/* Cardã e transmissão */}
                <line x1="320" y1="300" x2="600" y2="355" strokeWidth="3" opacity="0.3" strokeDasharray="10 5" />
                <line x1="600" y1="355" x2="710" y2="355" strokeWidth="4" opacity="0.4" />
              </motion.g>

              <motion.g {...estiloFreios} animate={estiloFreios.anim} transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}>
                {/* Cuícas de Freio (Acima dos eixos traseiros) */}
                <circle cx="630" cy="325" r="10" fill="transparent" strokeWidth="1.5" />
                <circle cx="680" cy="325" r="10" fill="transparent" strokeWidth="1.5" />
              </motion.g>

              {/* CONECTORES E CALLOUTS HUD (PNEUS E EIXOS) */}
              <g opacity="0.6">
                <circle cx="655" cy="355" r="3" fill={primary} />
                <polyline points="655,355 655,420 720,420" fill="none" stroke={primary} strokeWidth="1" />
                <text x="725" y="423" fill={primary} fontSize="10" fontFamily="monospace">TANDEM_AXLES_6X4</text>
              </g>

            </svg>
          </div>

          {/* Central de alertas ligada às zonas do caminhão */}
          <div className="bg-background-secondary border-t z-20 relative" style={{ borderColor: 'var(--border)' }}>
            <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Bell size={14} style={{ color: primary }} />
                <span className="text-[11px] uppercase font-bold tracking-[0.18em]">Ocorrências diagnosticadas</span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold border" style={{ color: primary, borderColor: `${primary}55`, backgroundColor: `${primary}0d` }}>
                  {manutencoesOperacionaisDoVeiculo.filter(item => item.status === 'PENDENTE').length} ATIVAS
                </span>
                {totalManutencoesArquivadas > 0 && (
                  <span className="text-[9px] uppercase tracking-wider text-foreground-muted">
                    {totalManutencoesArquivadas} arquivada(s) fora do diagnóstico
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] uppercase tracking-wider text-foreground-muted">
                <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-red-500" /> Crítico</span>
                <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> Alerta</span>
                <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primary }} /> Monitorado</span>
              </div>
            </div>

            <div className="p-3 grid gap-2 max-h-44 overflow-y-auto custom-scrollbar">
              {manutencoesOperacionaisDoVeiculo.filter(item => item.status === 'PENDENTE').length === 0 ? (
                <div className="flex items-center gap-3 p-3 border border-green-500/20 bg-green-500/5 text-green-500">
                  <CheckCircle2 size={18} />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider">Nenhuma ocorrência ativa</p>
                    <p className="text-[10px] text-foreground-muted mt-0.5">Todos os sistemas estão em diagnóstico passivo.</p>
                  </div>
                </div>
              ) : (
                manutencoesOperacionaisDoVeiculo
                  .filter(item => item.status === 'PENDENTE')
                  .sort((a, b) => a.dataAgendada.localeCompare(b.dataAgendada))
                  .map(item => {
                    const atrasada = item.dataAgendada < dataHoje
                    const cor = atrasada ? '#ef4444' : '#eab308'
                    return (
                      <div key={item.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3 border bg-black/10" style={{ borderColor: `${cor}35` }}>
                        <div className="w-8 h-8 flex items-center justify-center border" style={{ color: cor, borderColor: `${cor}55`, backgroundColor: `${cor}0d` }}>
                          <AlertTriangle size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: cor }}>{item.tipo}</span>
                            <span className="text-[9px] text-foreground-muted">SYS.{item.id.padStart(4, '0')}</span>
                          </div>
                          <p className="text-[11px] text-foreground truncate mt-0.5">{item.pecas}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[9px] font-bold uppercase" style={{ color: cor }}>{atrasada ? 'Atrasada' : 'Agendada'}</p>
                          <p className="text-[10px] text-foreground-muted mt-0.5">{item.dataAgendada}</p>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL DE LANÇAMENTO ─── */}
      {modalInclusaoOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-lg border p-6 font-mono space-y-5 shadow-[0_0_50px_rgba(0,0,0,0.5)]" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-start border-b pb-4" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="text-base font-bold uppercase font-rajdhani">Atualizar HUD Diagnóstico ({veiculoAtivo.placa})</h3>
                <p className="text-xs text-foreground-muted">Registre a manutenção para atualizar os sensores do Blueprint.</p>
              </div>
              <button onClick={() => setModalInclusaoOpen(false)} className="text-foreground-muted hover:text-foreground">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { setTipoInclusao('FUTURA'); setFormManutencao(p => ({ ...p, dataAgendada: dataHoje })) }} className="p-3 border text-left flex flex-col gap-1 transition-all cursor-pointer" style={{ backgroundColor: tipoInclusao === 'FUTURA' ? `${primary}15` : 'transparent', borderColor: tipoInclusao === 'FUTURA' ? primary : 'var(--border)', color: tipoInclusao === 'FUTURA' ? primary : 'var(--foreground-muted)' }}>
                <div className="flex items-center gap-2 font-bold text-xs uppercase"><CalendarPlus size={14} /> Previsão Analítica</div>
                <div className="text-[10px] leading-tight">Mapeia no HUD Blueprint e gera alertas no Sininho.</div>
              </button>
              <button type="button" onClick={() => { setTipoInclusao('ADMINISTRATIVA'); setFormManutencao(p => ({ ...p, dataAgendada: dataHoje })) }} className="p-3 border text-left flex flex-col gap-1 transition-all cursor-pointer" style={{ backgroundColor: tipoInclusao === 'ADMINISTRATIVA' ? `${primary}15` : 'transparent', borderColor: tipoInclusao === 'ADMINISTRATIVA' ? primary : 'var(--border)', color: tipoInclusao === 'ADMINISTRATIVA' ? primary : 'var(--foreground-muted)' }}>
                <div className="flex items-center gap-2 font-bold text-xs uppercase"><History size={14} /> Histórico Log</div>
                <div className="text-[10px] leading-tight">Apenas registra. Limpa os sensores (Verde).</div>
              </button>
            </div>

            <form onSubmit={handleSalvarManutencao} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">Data Prevista/Realizada</label>
                <input type="date" required min={tipoInclusao === 'FUTURA' ? dataHoje : undefined} max={tipoInclusao === 'ADMINISTRATIVA' ? dataHoje : undefined} value={formManutencao.dataAgendada} onChange={(e) => setFormManutencao({ ...formManutencao, dataAgendada: e.target.value })} className="w-full p-2.5 border bg-transparent outline-none font-mono focus:ring-1" style={{ borderColor: 'var(--border)', color: 'var(--foreground)', outlineColor: primary }} />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">Módulo Alvo do HUD</label>
                <select value={formManutencao.tipo} onChange={(e) => setFormManutencao({ ...formManutencao, tipo: e.target.value })} className="w-full p-2.5 border bg-transparent outline-none cursor-pointer focus:ring-1" style={{ borderColor: 'var(--border)', color: 'var(--foreground)', outlineColor: primary }}>
                  <option value="PREVENTIVA" style={{ backgroundColor: 'var(--background)' }}>Estrutura (Cabine & Chassi)</option>
                  <option value="CORRETIVA" style={{ backgroundColor: 'var(--background)' }}>Estrutura (Cabine & Chassi - Reparo)</option>
                  <option value="PNEUS" style={{ backgroundColor: 'var(--background)' }}>Rodagem (Pneus, Freios e Eixos)</option>
                  <option value="OLEO" style={{ backgroundColor: 'var(--background)' }}>Motorização (Bloco, Óleo e Filtros)</option>
                  <option value="COMBUSTIVEL" style={{ backgroundColor: 'var(--background)' }}>Alimentação (Tanques e Linhas)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">Descrição Técnica / Peça</label>
                <input type="text" required minLength={2} maxLength={1000} placeholder="Ex: Substituição Lonas Eixo 2, Troca Óleo Bloco V8" value={formManutencao.pecas} onChange={(e) => setFormManutencao({ ...formManutencao, pecas: e.target.value })} className="w-full p-2.5 border bg-transparent outline-none focus:ring-1" style={{ borderColor: 'var(--border)', color: 'var(--foreground)', outlineColor: primary }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Custo Projetado (R$)</label>
                  <input type="number" required min="0" max="1000000000" step="0.01" placeholder="1250.00" value={formManutencao.custo} onChange={(e) => setFormManutencao({ ...formManutencao, custo: e.target.value })} className="w-full p-2.5 border bg-transparent outline-none focus:ring-1" style={{ borderColor: 'var(--border)', color: 'var(--foreground)', outlineColor: primary }} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Leitura Odômetro (KM)</label>
                  <input type="number" required placeholder={String(veiculoAtivo.kmAtual)} value={formManutencao.kmAtual} onChange={(e) => setFormManutencao({ ...formManutencao, kmAtual: e.target.value })} className="w-full p-2.5 border bg-transparent outline-none focus:ring-1" style={{ borderColor: 'var(--border)', color: 'var(--foreground)', outlineColor: primary }} />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <button type="button" onClick={() => setModalInclusaoOpen(false)} className="px-4 py-2 border text-xs uppercase font-bold hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--border)' }}>Cancelar</button>
                <button type="submit" className="px-6 py-2 text-xs uppercase font-extrabold text-black hover:opacity-90 transition-opacity" style={{ backgroundColor: primary, color: '#000' }}>Salvar manutenção</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  )
}

export default function ManutencaoPage() {
  return (
    <Suspense fallback={<div className="min-h-[420px] animate-pulse bg-background-secondary" aria-label="Carregando manutenções" />}>
      <ManutencaoContent />
    </Suspense>
  )
}
