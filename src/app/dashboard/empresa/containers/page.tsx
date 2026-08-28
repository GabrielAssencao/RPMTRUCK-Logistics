'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useContainers, StatusContainer, TipoContainer, type RegistroContainer } from '@/contexts/ContainersContext'
import { obterAnoMesSemana, MESES } from '@/lib/dataUtils'
import {
  Container as ContainerIcon,
  Search,
  Plus,
  Trash2,
  Pencil,
  Truck,
  MapPin,
  ArrowRight,
  DollarSign,
  Percent,
  Clock,
  ArrowRightLeft,
  PackageCheck,
  PackageX,
  Calendar,
  X,
  Lock,
  Box,
  CheckSquare,
  Square,
  Layers,
  PieChart,
  User,
  ShieldAlert,
  ChevronRight
} from 'lucide-react'

// ─── CONFIGURAÇÃO DE STATUS (COR + ÍCONE) ─────────────────────────────────
const STATUS_CONFIG: Record<StatusContainer, { label: string; cor: string; icone: LucideIcon }> = {
  AGENDADO: { label: 'AGENDADO', cor: '#3b82f6', icone: Clock },
  EM_TRANSITO: { label: 'EM TRÂNSITO', cor: '#eab308', icone: ArrowRightLeft },
  ENTREGUE: { label: 'ENTREGUE', cor: '#22c55e', icone: PackageCheck },
  CANCELADO: { label: 'CANCELADO', cor: '#ef4444', icone: PackageX },
}

const TIPOS_CONTAINER: TipoContainer[] = ['20 PÉS', '40 PÉS', '40 HC', 'REEFER', 'TANQUE', 'OUTRO']

export interface ItemConteudo {
  nome: string
  porcentagem: number
}

interface MovimentacaoPermanente {
  id: string
  codigo: string
  origem: string
  destino: string
  data: string
  checksumArquivo: string | null
  arquivadoEm: string | null
  detalhesPurgadosEm: string | null
  arquivo: { id: string; nome_arquivo: string; arquivo_removido_em: string | null } | null
}

const FORM_INICIAL = {
  data: new Date().toISOString().split('T')[0],
  codigo: '',
  tipo: '40 HC' as TipoContainer,
  terminalInicio: '',
  terminalFim: '',
  duplaId: '',
  frete: '',
  percentualComissao: '10',
  comissao: '0.00',
  status: 'AGENDADO' as StatusContainer,
  observacoes: '',
  itensConteudo: [] as ItemConteudo[]
}

export default function ContainersPage() {
  const { primary } = useTheme()
  const {
    containers,
    duplas,
    erro: erroContainers,
    adicionarContainer,
    atualizarContainer,
    removerContainer,
    totalEmTransito
  } = useContainers()
  const encontrarDupla = (id: string) => duplas.find(dupla => dupla.id === id)

  // ─── ESTADOS DE SELEÇÃO E NAVEGAÇÃO GAMIFICADA ──────────────────────────
  const [containerAtivoId, setContainerAtivoId] = useState<string | null>(null)
  const [selecionados, setSelecionados] = useState<string[]>([])

  // ─── CONTROLE TEMPORAL ──────────────────────────────────────────────────
  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const [anosDisponiveis] = useState([anoAtual, anoAtual - 1, anoAtual - 2])
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual)
  const [mesSelecionadoIndex, setMesSelecionadoIndex] = useState(hoje.getMonth())
  const [semanaSelecionada, setSemanaSelecionada] = useState<'TODAS' | 1 | 2 | 3 | 4>('TODAS')

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | StatusContainer>('TODOS')
  const [filtroDupla, setFiltroDupla] = useState('TODOS')
  const [buscaHistorico, setBuscaHistorico] = useState('')
  const [paginaHistorico, setPaginaHistorico] = useState(1)
  const [historicoPermanente, setHistoricoPermanente] = useState<MovimentacaoPermanente[]>([])
  const [totalPaginasHistorico, setTotalPaginasHistorico] = useState(1)
  const [carregandoHistorico, setCarregandoHistorico] = useState(true)
  const [erroHistorico, setErroHistorico] = useState('')

  // Modal Lançamento / Edição
  const [modalOpen, setModalOpen] = useState(false)
  const [containerEditandoId, setContainerEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [novoItemNome, setNovoItemNome] = useState('')
  const [novoItemPorcentagem, setNovoItemPorcentagem] = useState('')

  // Exclusão inline
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        setCarregandoHistorico(true)
        setErroHistorico('')
        const params = new URLSearchParams({ busca: buscaHistorico, pagina: String(paginaHistorico) })
        const response = await fetch(`/api/containers/historico?${params}`, { cache: 'no-store', signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar o histórico permanente.')
        setHistoricoPermanente(data.registros)
        setTotalPaginasHistorico(data.paginacao.totalPaginas)
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') setErroHistorico(error.message)
      } finally {
        if (!controller.signal.aborted) setCarregandoHistorico(false)
      }
    }, 250)
    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [buscaHistorico, paginaHistorico])

  // ─── FILTRAGEM DE DADOS ─────────────────────────────────────────────────
  const containersFiltrados = containers.filter(c => {
    const bucket = obterAnoMesSemana(c.data)
    const matchAno = bucket.ano === anoSelecionado
    const matchMes = bucket.mesIndex === mesSelecionadoIndex
    const matchSemana = semanaSelecionada === 'TODAS' || bucket.semanaIndex === semanaSelecionada

    const termo = busca.toLowerCase()
    const matchBusca =
      c.codigo.toLowerCase().includes(termo) ||
      c.terminalInicio.toLowerCase().includes(termo) ||
      c.terminalFim.toLowerCase().includes(termo)
    const matchStatus = filtroStatus === 'TODOS' || c.status === filtroStatus
    const matchDupla = filtroDupla === 'TODOS' || c.duplaId === filtroDupla

    return matchAno && matchMes && matchSemana && matchBusca && matchStatus && matchDupla
  })

  const activeContainer = containers.find(c => c.id === containerAtivoId)
  const activeDupla = activeContainer ? encontrarDupla(activeContainer.duplaId) : null
  const activeItens = activeContainer?.itensConteudo as ItemConteudo[] | undefined

  // Resumos
  const totalContainersPeriodo = containersFiltrados.length
  const totalFretePeriodo = containersFiltrados.reduce((acc, c) => acc + c.frete, 0)
  const totalComissaoPeriodo = containersFiltrados.reduce((acc, c) => acc + c.comissao, 0)

  // ─── AÇÕES EM LOTE ──────────────────────────────────────────────────────
  const handleToggleSelecionarTudo = () => {
    if (selecionados.length === containersFiltrados.length) {
      setSelecionados([])
    } else {
      setSelecionados(containersFiltrados.map(c => c.id))
    }
  }

  const handleToggleSelecionar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelecionados(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const handleAlterarStatusEmLote = (novoStatus: StatusContainer) => {
    selecionados.forEach(id => {
      atualizarContainer(id, { status: novoStatus })
    })
    setSelecionados([])
  }

  // ─── FORMULÁRIO DE CARGA ────────────────────────────────────────────────
  const handleAdicionarItemConteudo = () => {
    if (!novoItemNome.trim() || !novoItemPorcentagem) return
    const porcentagemNum = Number(novoItemPorcentagem)
    if (porcentagemNum <= 0 || porcentagemNum > 100) return

    const totalAtual = form.itensConteudo.reduce((acc, i) => acc + i.porcentagem, 0)
    if (totalAtual + porcentagemNum > 100) {
      alert(`O limite total de carga é 100%. Você já preencheu ${totalAtual}%.`)
      return
    }

    setForm(prev => ({
      ...prev,
      itensConteudo: [
        ...prev.itensConteudo,
        { nome: novoItemNome.trim(), porcentagem: porcentagemNum }
      ]
    }))
    setNovoItemNome('')
    setNovoItemPorcentagem('')
  }

  const handleRemoverItemConteudo = (index: number) => {
    setForm(prev => ({
      ...prev,
      itensConteudo: prev.itensConteudo.filter((_, i) => i !== index)
    }))
  }

  // ─── CRIAÇÃO E EDIÇÃO ──────────────────────────────────────────────────
  const handleAbrirNovo = () => {
    setContainerEditandoId(null)
    setForm({ ...FORM_INICIAL, duplaId: duplas[0]?.id ?? '' })
    setModalOpen(true)
  }

  const handleAbrirEditar = (registro: RegistroContainer) => {
    setContainerEditandoId(registro.id)
    setForm({
      data: registro.data,
      codigo: registro.codigo,
      tipo: registro.tipo,
      terminalInicio: registro.terminalInicio,
      terminalFim: registro.terminalFim,
      duplaId: registro.duplaId,
      frete: String(registro.frete),
      percentualComissao: String(registro.percentualComissao),
      comissao: String(registro.comissao),
      status: registro.status,
      observacoes: registro.observacoes ?? '',
      itensConteudo: registro.itensConteudo ?? []
    })
    setModalOpen(true)
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()

    const dados = {
      data: form.data,
      codigo: form.codigo.toUpperCase(),
      tipo: form.tipo,
      terminalInicio: form.terminalInicio,
      terminalFim: form.terminalFim,
      duplaId: form.duplaId,
      frete: Number(form.frete) || 0,
      percentualComissao: Number(form.percentualComissao),
      status: form.status,
      observacoes: form.observacoes || undefined,
      itensConteudo: form.itensConteudo
    }

    const salvo = containerEditandoId
      ? await atualizarContainer(containerEditandoId, dados)
      : await adicionarContainer(dados)

    if (!salvo) return

    setModalOpen(false)
    setForm({ ...FORM_INICIAL, duplaId: duplas[0]?.id ?? '' })
    setContainerEditandoId(null)
  }

  const atualizarCalculoComissao = (frete: string, percentual: string) => {
    const freteNumero = Number(frete)
    const percentualNumero = Number(percentual)
    const comissao = Number.isFinite(freteNumero) && Number.isFinite(percentualNumero)
      ? (freteNumero * percentualNumero / 100).toFixed(2)
      : '0.00'
    setForm(prev => ({ ...prev, frete, percentualComissao: percentual, comissao }))
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-mono">
      {erroContainers && <div role="alert" className="border border-red-500/30 p-3 text-sm text-red-500">{erroContainers}</div>}

      {/* ─── CABEÇALHO ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight font-rajdhani sm:text-3xl" style={{ color: 'var(--foreground)' }}>
            Controle de <span style={{ color: primary }}>Containers 3D</span>
          </h1>
          <p className="text-sm mt-1 text-foreground-muted">
            Seleção gamificada de pátio, renderização transparente de carga e alteração em lote.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handleAbrirNovo}
          className="flex w-full items-center justify-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all text-black font-extrabold shrink-0 cursor-pointer md:w-auto"
          style={{
            backgroundColor: primary,
            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
          }}
        >
          <Plus size={16} /> Novo Container
        </motion.button>
      </div>

      {/* ─── BARRA DE AÇÃO EM LOTE ─── */}
      <AnimatePresence>
        {selecionados.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 border flex flex-wrap items-center justify-between gap-4"
            style={{ backgroundColor: `${primary}15`, borderColor: primary }}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase">
              <Layers size={16} style={{ color: primary }} />
              <span>{selecionados.length} container(s) selecionado(s)</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-foreground-muted mr-2">Alterar Status em Bloco:</span>
              {(Object.keys(STATUS_CONFIG) as StatusContainer[]).map(st => (
                <button
                  key={st}
                  onClick={() => handleAlterarStatusEmLote(st)}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase border transition-all hover:opacity-80 cursor-pointer"
                  style={{
                    backgroundColor: STATUS_CONFIG[st].cor,
                    color: '#000',
                    borderColor: STATUS_CONFIG[st].cor
                  }}
                >
                  {STATUS_CONFIG[st].label}
                </button>
              ))}
              <button
                onClick={() => setSelecionados([])}
                className="px-3 py-1.5 text-[10px] font-bold uppercase border hover:bg-white/10 cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── CONTROLE TEMPORAL ─── */}
      <div className="border p-4 space-y-4" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 text-xs font-bold uppercase">
            <Calendar size={16} style={{ color: primary }} /> Ano:
            <div className="flex gap-1 ml-2">
              {anosDisponiveis.map(ano => (
                <button
                  key={ano}
                  onClick={() => setAnoSelecionado(ano)}
                  className="px-3 py-1 border text-xs font-bold transition-all cursor-pointer"
                  style={{
                    backgroundColor: anoSelecionado === ano ? primary : 'transparent',
                    color: anoSelecionado === ano ? '#000' : 'var(--foreground-muted)',
                    borderColor: anoSelecionado === ano ? primary : 'var(--border)'
                  }}
                >
                  {ano}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-foreground-muted">Recorte Semanal:</span>
            <button
              onClick={() => setSemanaSelecionada('TODAS')}
              className="px-3 py-1 text-[10px] font-bold border uppercase transition-all cursor-pointer"
              style={{
                backgroundColor: semanaSelecionada === 'TODAS' ? `${primary}20` : 'var(--background)',
                borderColor: semanaSelecionada === 'TODAS' ? primary : 'var(--border)',
                color: semanaSelecionada === 'TODAS' ? primary : 'var(--foreground-muted)'
              }}
            >
              Mês Inteiro
            </button>
            {([1, 2, 3, 4] as const).map(s => (
              <button
                key={s}
                onClick={() => setSemanaSelecionada(s)}
                className="px-3 py-1 text-[10px] font-bold border uppercase transition-all cursor-pointer"
                style={{
                  backgroundColor: semanaSelecionada === s ? `${primary}20` : 'var(--background)',
                  borderColor: semanaSelecionada === s ? primary : 'var(--border)',
                  color: semanaSelecionada === s ? primary : 'var(--foreground-muted)'
                }}
              >
                Semana {s}
              </button>
            ))}
          </div>
        </div>

        {/* CARROSSEL DOS MESES */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 py-1">
          {MESES.map((mes, idx) => {
            const estaAtivo = idx === mesSelecionadoIndex
            return (
              <button
                key={mes}
                onClick={() => setMesSelecionadoIndex(idx)}
                className="px-4 py-2 border text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer"
                style={{
                  backgroundColor: estaAtivo ? primary : 'var(--background)',
                  color: estaAtivo ? '#000' : 'var(--foreground-muted)',
                  borderColor: estaAtivo ? primary : 'var(--border)',
                  clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))'
                }}
              >
                {mes}
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── CARDS DE RESUMO ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <CardResumo titulo="CONTAINERS NO PERÍODO" valor={String(totalContainersPeriodo)} primary={primary} icone={<ContainerIcon size={20} />} />
        <CardResumo titulo="EM TRÂNSITO AGORA" valor={String(totalEmTransito)} primary={primary} icone={<ArrowRightLeft size={20} />} destaque />
        <CardResumo
          titulo="FRETE MOVIMENTADO"
          valor={totalFretePeriodo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          primary={primary}
          icone={<DollarSign size={20} />}
        />
        <CardResumo
          titulo="COMISSÃO GERADA"
          valor={totalComissaoPeriodo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          primary={primary}
          icone={<Percent size={20} />}
        />
      </div>

      {/* ─── PÁTIO DE CONTAINERS 3D GAMIFICADO (SELEÇÃO ESTILO JOGO) ─── */}
      <div className="border p-3 relative overflow-hidden sm:p-6" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
        
        <div className="flex items-center justify-between mb-4">
          <span className="font-bold text-xs uppercase flex items-center gap-2">
            <Box size={18} style={{ color: primary }} /> Pátio Virtual 3D & Inspecção
          </span>
          <span className="hidden text-[10px] text-foreground-muted sm:block">
            Clique em um bloco para inspecionar ou desloque o carrossel para alternar
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ── PAINEL LATERAL ESQUERDO (APARECE QUANDO UM CONTAINER É SELECIONADO) ── */}
          <AnimatePresence>
            {activeContainer && (
              <motion.div
                initial={{ opacity: 0, x: -50, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -50, scale: 0.95 }}
                transition={{ duration: 0.4, type: 'spring' }}
                className="lg:col-span-4 space-y-4"
              >
                {/* Card do Container Ativo */}
                <div
                  className="p-5 border relative overflow-hidden space-y-4 shadow-2xl"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: primary,
                    clipPath: 'polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 15px 100%, 0 calc(100% - 15px))'
                  }}
                >
                  <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <span className="text-[9px] uppercase tracking-widest text-foreground-muted">Identificador ISO</span>
                      <h2 className="text-2xl font-black font-rajdhani">{activeContainer.codigo}</h2>
                    </div>
                    <button
                      onClick={() => setContainerAtivoId(null)}
                      className="p-1 text-foreground-muted hover:text-foreground cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Detalhamento do Frete e Tipo */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-background-secondary border rounded-sm" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-[9px] font-bold uppercase text-foreground-muted block mb-1">Valor do Frete</span>
                      <span className="text-lg font-black text-green-500 font-rajdhani">
                        {activeContainer.frete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="p-3 bg-background-secondary border rounded-sm" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-[9px] font-bold uppercase text-foreground-muted block mb-1">Tipo de Caixa</span>
                      <span className="text-lg font-black font-rajdhani" style={{ color: primary }}>
                        {activeContainer.tipo}
                      </span>
                    </div>
                  </div>

                  {/* Descrição do Conteúdo Interno / Porcentagens */}
                  <div className="p-3 border rounded-sm space-y-2 bg-background-secondary" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                      <span className="flex items-center gap-1"><PieChart size={14} style={{ color: primary }} /> Carga Alocada</span>
                      {activeItens && activeItens.length > 0 ? (
                        <span style={{ color: primary }}>{activeItens.reduce((a, b) => a + b.porcentagem, 0)}% Ocupado</span>
                      ) : (
                        <span className="text-red-400">Restrito</span>
                      )}
                    </div>

                    {activeItens && activeItens.length > 0 ? (
                      <div className="space-y-2 pt-1">
                        {activeItens.map((item, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span>{item.nome}</span>
                              <span className="font-bold">{item.porcentagem}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                              <div className="h-full" style={{ width: `${item.porcentagem}%`, backgroundColor: primary }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 border border-dashed text-center bg-black/20 flex flex-col items-center gap-1" style={{ borderColor: 'var(--border)' }}>
                        <ShieldAlert size={18} className="text-yellow-500" />
                        <span className="text-[10px] uppercase font-bold text-yellow-500">CONTEÚDO CONFIDENCIAL</span>
                        <span className="text-[9px] text-foreground-muted">Nenhum item detalhado pelo lançador</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Inferior: Destino, Veículo e Motorista */}
                {activeDupla && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 border space-y-3"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                      clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
                    }}
                  >
                    <div className="flex items-center justify-between text-xs font-bold border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                      <span className="uppercase text-[10px] text-foreground-muted">Rota de Destino</span>
                      <span className="text-xs flex items-center gap-1 font-mono font-bold" style={{ color: primary }}>
                        {activeContainer.terminalInicio} <ChevronRight size={12} /> {activeContainer.terminalFim}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <Truck size={16} style={{ color: primary }} />
                        <div>
                          <p className="text-[9px] text-foreground-muted uppercase">Veículo</p>
                          <p className="font-bold truncate">{activeDupla.veiculoModelo}</p>
                          <p className="text-[10px] text-foreground-muted">{activeDupla.veiculoPlaca}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <User size={16} style={{ color: primary }} />
                        <div>
                          <p className="text-[9px] text-foreground-muted uppercase">Condutor</p>
                          <p className="font-bold truncate">{activeDupla.motoristaNome}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── CARROSSEL DE BLOCOS 3D COM DOBRAS E EFECTO GLOSS ── */}
          <div className={`${activeContainer ? 'lg:col-span-8' : 'lg:col-span-12'} transition-all duration-500 overflow-hidden`}>
            <div className="flex gap-6 overflow-x-auto pb-6 pt-2 custom-scrollbar" style={{ perspective: '1200px' }}>
              {containersFiltrados.map((container) => {
                const isSelected = containerAtivoId === container.id
                const itens = container.itensConteudo as ItemConteudo[] | undefined
                const porcentagemTotal = itens?.reduce((acc, i) => acc + i.porcentagem, 0) ?? 0

                return (
                  <motion.div
                    key={container.id}
                    layout
                    onClick={() => setContainerAtivoId(isSelected ? null : container.id)}
                    animate={{
                      scale: isSelected ? 1.05 : 1,
                      rotateY: isSelected ? -10 : 20,
                      rotateX: isSelected ? 0 : 5,
                    }}
                    whileHover={{ scale: 1.03, rotateY: 0, rotateX: 0 }}
                    transition={{ duration: 0.3, type: 'spring' }}
                    className="relative shrink-0 cursor-pointer group"
                    style={{
                      width: '240px',
                      height: '280px',
                      transformStyle: 'preserve-3d'
                    }}
                  >
                    {/* CONTAINER 3D PAREDE FRISO + VIDRO GLOSS TRANSPARENTE */}
                    <div
                      className="w-full h-full border shadow-2xl relative overflow-hidden flex flex-col justify-between p-4 backdrop-blur-md transition-all"
                      style={{
                        backgroundColor: isSelected ? `${primary}20` : 'rgba(20, 20, 20, 0.7)',
                        borderColor: isSelected ? primary : 'var(--border)',
                        boxShadow: isSelected ? `0 20px 40px -10px color-mix(in srgb, ${primary} 40%, transparent)` : 'none',
                        clipPath: 'polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 15px 100%, 0 calc(100% - 15px))'
                      }}
                    >
                      {/* Textura de Frisos das Paredes Metálicas do Contêiner (Dobras) */}
                      <div
                        className="absolute inset-0 opacity-15 pointer-events-none"
                        style={{
                          backgroundImage: 'repeating-linear-gradient(90deg, #000, #000 6px, rgba(255,255,255,0.2) 6px, rgba(255,255,255,0.2) 12px)'
                        }}
                      />

                      {/* Efeito Gloss / Reflexo no Vidro Transparente */}
                      <div
                        className="absolute -top-12 -left-12 w-40 h-40 bg-white/10 rounded-full blur-xl pointer-events-none group-hover:scale-150 transition-transform"
                      />

                      {/* Topo do Bloco: Tag & Tipo */}
                      <div className="relative z-10 flex justify-between items-start">
                        <span
                          className="text-[9px] font-black uppercase px-2 py-0.5 border"
                          style={{
                            borderColor: STATUS_CONFIG[container.status].cor,
                            color: STATUS_CONFIG[container.status].cor,
                            backgroundColor: `${STATUS_CONFIG[container.status].cor}15`
                          }}
                        >
                          {STATUS_CONFIG[container.status].label}
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: primary }}>{container.tipo}</span>
                      </div>

                      {/* Meio: Representação Interna Transparente de Carga Preenchida */}
                      <div className="relative z-10 my-auto py-2">
                        {itens && itens.length > 0 ? (
                          <div className="space-y-2 bg-black/40 p-2.5 border rounded-sm backdrop-blur-xs" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex justify-between items-center text-[9px] font-bold">
                              <span className="uppercase text-foreground-muted">Capacidade</span>
                              <span style={{ color: primary }}>{porcentagemTotal}%</span>
                            </div>

                            {/* Barra de Progresso Interna estilo Carga */}
                            <div className="w-full h-3 bg-black/60 border overflow-hidden rounded-xs flex" style={{ borderColor: 'var(--border)' }}>
                              {itens.map((item, idx) => (
                                <div
                                  key={idx}
                                  title={`${item.nome}: ${item.porcentagem}%`}
                                  style={{
                                    width: `${item.porcentagem}%`,
                                    backgroundColor: idx % 2 === 0 ? primary : '#3b82f6'
                                  }}
                                  className="h-full border-r border-black/40"
                                />
                              ))}
                            </div>

                            <p className="text-[9px] text-foreground-muted truncate font-mono">
                              {itens.map(i => `${i.porcentagem}% ${i.nome}`).join(' • ')}
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 border border-dashed border-yellow-500/40 bg-yellow-500/10 text-center flex flex-col items-center gap-1 rounded-sm">
                            <Lock size={16} className="text-yellow-500 animate-pulse" />
                            <span className="text-[9px] font-bold uppercase text-yellow-500 tracking-wider">CONTEÚDO CONFIDENCIAL</span>
                          </div>
                        )}
                      </div>

                      {/* Rodapé do Bloco: Código ISO */}
                      <div className="relative z-10 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-[8px] uppercase tracking-widest text-foreground-muted block">Código ISO</span>
                        <h4 className="font-rajdhani text-lg font-black truncate">{container.codigo}</h4>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

        </div>
      </div>

      {/* ─── FILTROS DE BUSCA ─── */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" style={{ color: 'var(--foreground-muted)' }}>
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Buscar por código do container ou terminal..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-11 pr-4 py-3 text-sm outline-none border font-mono"
            style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        <div className="flex items-center gap-2 font-mono text-xs border px-3" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
          <Truck size={14} style={{ color: primary }} />
          <select
            value={filtroDupla}
            onChange={(e) => setFiltroDupla(e.target.value)}
            className="bg-transparent outline-none py-3 text-xs uppercase font-bold cursor-pointer"
            style={{ color: 'var(--foreground)' }}
          >
            <option value="TODOS" style={{ backgroundColor: 'var(--background)' }}>Todos Transportadores</option>
            {duplas.map(d => (
              <option key={d.id} value={d.id} style={{ backgroundColor: 'var(--background)' }}>
                {d.veiculoModelo} ({d.veiculoPlaca})
              </option>
            ))}
          </select>
        </div>

        <div className="flex overflow-x-auto hide-scrollbar gap-2">
          {(['TODOS', 'AGENDADO', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADO'] as const).map((st) => {
            const ativo = filtroStatus === st
            const cor = st === 'TODOS' ? primary : STATUS_CONFIG[st].cor
            const label = st === 'TODOS' ? 'TODOS' : STATUS_CONFIG[st].label
            return (
              <button
                key={st}
                onClick={() => setFiltroStatus(st)}
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest border whitespace-nowrap transition-all cursor-pointer"
                style={{
                  backgroundColor: ativo ? `${cor}15` : 'var(--background-secondary)',
                  borderColor: ativo ? cor : 'var(--border)',
                  color: ativo ? cor : 'var(--foreground-muted)'
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── TABELA DE MOVIMENTAÇÕES REGISTRADAS COM SELEÇÃO MULTIPLA ─── */}
      <div className="border overflow-hidden relative" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="p-4 border-b font-bold text-xs uppercase flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <button onClick={handleToggleSelecionarTudo} className="text-foreground-muted hover:text-foreground cursor-pointer">
              {selecionados.length > 0 && selecionados.length === containersFiltrados.length ? (
                <CheckSquare size={16} style={{ color: primary }} />
              ) : (
                <Square size={16} />
              )}
            </button>
            <span>Movimentações Registradas</span>
          </div>
          <span className="text-[10px] text-foreground-muted">{containersFiltrados.length} Registro(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-left text-sm whitespace-nowrap font-mono">
            <thead style={{ backgroundColor: 'var(--background)', color: 'var(--foreground-muted)' }}>
              <tr className="text-[10px] uppercase tracking-widest border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="px-4 py-4 text-center">Sel</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Container</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Rota (Início → Fim)</th>
                <th className="px-6 py-4">Transportador</th>
                <th className="px-6 py-4 text-right">Frete</th>
                <th className="px-6 py-4 text-right">Comissão</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y [&>tr]:border-[var(--border)]" style={{ color: 'var(--foreground)' }}>
              <AnimatePresence>
                {containersFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-sm font-mono text-foreground-muted">
                      Nenhum container encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  containersFiltrados.map((c) => {
                    const dupla = encontrarDupla(c.duplaId)
                    const isChecked = selecionados.includes(c.id)

                    return (
                      <motion.tr
                        key={c.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-white/5 transition-colors"
                        style={{ backgroundColor: isChecked ? `${primary}08` : 'transparent' }}
                      >
                        <td className="px-4 py-4 text-center">
                          <button onClick={(e) => handleToggleSelecionar(c.id, e)} className="text-foreground-muted hover:text-foreground cursor-pointer">
                            {isChecked ? <CheckSquare size={16} style={{ color: primary }} /> : <Square size={16} />}
                          </button>
                        </td>

                        <td className="px-6 py-4 text-xs font-bold">{c.data}</td>

                        <td className="px-6 py-4">
                          <span className="font-mono text-xs px-2.5 py-1 border rounded-sm font-bold tracking-wider" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
                            {c.codigo}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-xs font-bold" style={{ color: primary }}>{c.tipo}</td>

                        <td className="px-6 py-4 text-xs">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={11} className="text-foreground-muted shrink-0" />
                            <span>{c.terminalInicio}</span>
                            <ArrowRight size={11} className="text-foreground-muted shrink-0" />
                            <MapPin size={11} style={{ color: primary }} className="shrink-0" />
                            <span className="font-bold">{c.terminalFim}</span>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-xs">
                          {dupla ? (
                            <div>
                              <div className="font-bold flex items-center gap-1.5"><Truck size={12} style={{ color: primary }} /> {dupla.veiculoModelo}</div>
                              <div className="text-[10px] text-foreground-muted">{dupla.motoristaNome} • {dupla.veiculoPlaca}</div>
                            </div>
                          ) : (
                            <span className="italic text-foreground-muted opacity-60">Não vinculado</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right font-bold text-xs text-green-500">
                          {c.frete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>

                        <td className="px-6 py-4 text-right font-bold text-xs" style={{ color: primary }}>
                          {c.comissao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>

                        <td className="px-6 py-4 text-center">
                          <select
                            value={c.status}
                            onChange={(e) => atualizarContainer(c.id, { status: e.target.value as StatusContainer })}
                            className="px-2.5 py-1 text-[10px] font-bold uppercase border bg-transparent outline-none cursor-pointer"
                            style={{ borderColor: STATUS_CONFIG[c.status].cor, color: STATUS_CONFIG[c.status].cor }}
                          >
                            {(Object.keys(STATUS_CONFIG) as StatusContainer[]).map(st => (
                              <option key={st} value={st} style={{ backgroundColor: 'var(--background)', color: STATUS_CONFIG[st].cor }}>
                                {STATUS_CONFIG[st].label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-6 py-4 text-right">
                          {excluindoId === c.id ? (
                            <div className="inline-flex items-center gap-2 p-1 border bg-red-500/10 text-red-400 border-red-500/30 font-bold text-[10px]">
                              <span>Excluir?</span>
                              <button onClick={() => { removerContainer(c.id); setExcluindoId(null) }} className="px-2 py-0.5 bg-red-500 text-black font-extrabold uppercase hover:bg-red-600 cursor-pointer">Sim</button>
                              <button onClick={() => setExcluindoId(null)} className="px-2 py-0.5 border border-white/20 text-white hover:bg-white/10 cursor-pointer">Não</button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <button onClick={() => handleAbrirEditar(c)} className="p-2 text-foreground-muted hover:text-foreground transition-colors cursor-pointer">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => setExcluindoId(c.id)} className="p-2 text-red-400 hover:text-red-500 transition-colors cursor-pointer">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    )
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      <section className="border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
              <ShieldAlert size={16} style={{ color: primary }} /> Histórico permanente
            </h2>
            <p className="mt-1 text-[10px] text-foreground-muted">Código, origem, destino e data continuam disponíveis mesmo após a limpeza dos detalhes operacionais.</p>
          </div>
          <label className="flex min-w-0 items-center gap-2 border px-3 py-2 md:w-80" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
            <Search size={14} className="shrink-0 text-foreground-muted" />
            <span className="sr-only">Buscar no histórico permanente</span>
            <input
              value={buscaHistorico}
              onChange={(event) => { setBuscaHistorico(event.target.value); setPaginaHistorico(1) }}
              placeholder="Container, origem ou destino"
              className="w-full bg-transparent text-xs outline-none placeholder:text-foreground-muted"
            />
          </label>
        </div>

        {erroHistorico ? (
          <p className="p-4 text-xs text-red-500" role="alert">{erroHistorico}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full whitespace-nowrap text-left text-xs">
              <thead style={{ backgroundColor: 'var(--background)', color: 'var(--foreground-muted)' }}>
                <tr className="border-b text-[10px] uppercase tracking-widest" style={{ borderColor: 'var(--border)' }}>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Container</th>
                  <th className="px-5 py-3">Origem</th>
                  <th className="px-5 py-3">Destino</th>
                  <th className="px-5 py-3">Auditoria</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {carregandoHistorico ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-foreground-muted">Carregando histórico...</td></tr>
                ) : historicoPermanente.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-foreground-muted">Nenhuma movimentação permanente encontrada.</td></tr>
                ) : historicoPermanente.map((registro) => (
                  <tr key={registro.id}>
                    <td className="px-5 py-3 font-bold">{new Date(`${registro.data}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                    <td className="px-5 py-3 font-mono font-black" style={{ color: primary }}>{registro.codigo}</td>
                    <td className="px-5 py-3">{registro.origem}</td>
                    <td className="px-5 py-3">{registro.destino}</td>
                    <td className="px-5 py-3 text-[10px] text-foreground-muted">
                      {registro.detalhesPurgadosEm
                        ? 'Detalhes limpos · registro permanente'
                        : registro.arquivadoEm
                          ? `Arquivado · ${registro.checksumArquivo?.slice(0, 10) ?? 'sem checksum'}…`
                          : 'Dados operacionais ativos'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t p-3 text-[10px] font-bold uppercase" style={{ borderColor: 'var(--border)' }}>
          <button type="button" disabled={paginaHistorico <= 1 || carregandoHistorico} onClick={() => setPaginaHistorico(pagina => pagina - 1)} className="border px-3 py-2 disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>Anterior</button>
          <span>{paginaHistorico} / {totalPaginasHistorico}</span>
          <button type="button" disabled={paginaHistorico >= totalPaginasHistorico || carregandoHistorico} onClick={() => setPaginaHistorico(pagina => pagina + 1)} className="border px-3 py-2 disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>Próxima</button>
        </div>
      </section>

      {/* ─── MODAL LANÇAMENTO COM FORMULÁRIO DE CARGA POR PORCENTAGEM ─── */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg border p-4 font-mono space-y-4 max-h-[92dvh] overflow-y-auto sm:p-6"
              style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
            >
              <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h3 className="text-sm font-bold uppercase font-rajdhani">
                    {containerEditandoId ? 'Editar Container' : 'Lançar Novo Container'}
                  </h3>
                  <p className="text-[10px] text-foreground-muted">Preencha os dados e os itens da carga (opcional).</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="cursor-pointer text-foreground-muted hover:text-foreground">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSalvar} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Data *</label>
                    <input
                      type="date" required
                      value={form.data}
                      onChange={e => setForm({ ...form, data: e.target.value })}
                      className="w-full p-2.5 border bg-transparent outline-none"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Código do Container *</label>
                    <input
                      type="text" required
                      placeholder="Ex: MSCU 734521-0"
                      pattern="[A-Za-z]{4}[ -]?[0-9]{6}[ -]?[0-9]"
                      maxLength={15}
                      title="Use quatro letras e sete números, por exemplo MSCU 734521-0."
                      value={form.codigo}
                      onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                      className="w-full p-2.5 border bg-transparent outline-none uppercase"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Tipo *</label>
                    <select
                      value={form.tipo}
                      onChange={e => setForm({ ...form, tipo: e.target.value as TipoContainer })}
                      className="w-full p-2.5 border bg-transparent outline-none cursor-pointer"
                      style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    >
                      {TIPOS_CONTAINER.map(t => (
                        <option key={t} value={t} style={{ backgroundColor: 'var(--background)' }}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Transportador (Dupla) *</label>
                    <select
                      required
                      value={form.duplaId}
                      onChange={e => setForm({ ...form, duplaId: e.target.value })}
                      className="w-full p-2.5 border bg-transparent outline-none cursor-pointer"
                      style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    >
                      {duplas.map(d => (
                        <option key={d.id} value={d.id} style={{ backgroundColor: 'var(--background)' }}>
                          {d.veiculoModelo} ({d.veiculoPlaca}) — {d.motoristaNome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Terminal Início *</label>
                    <input
                      type="text" required
                      placeholder="Ex: Porto de Santos"
                      maxLength={160}
                      value={form.terminalInicio}
                      onChange={e => setForm({ ...form, terminalInicio: e.target.value })}
                      className="w-full p-2.5 border bg-transparent outline-none"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Terminal Fim *</label>
                    <input
                      type="text" required
                      placeholder="Ex: CD Guarulhos"
                      maxLength={160}
                      value={form.terminalFim}
                      onChange={e => setForm({ ...form, terminalFim: e.target.value })}
                      className="w-full p-2.5 border bg-transparent outline-none"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Frete (R$) *</label>
                    <input
                      type="number" step="0.01" min="0" max="1000000000" required
                      placeholder="Ex: 4200.00"
                      value={form.frete}
                      onChange={e => atualizarCalculoComissao(e.target.value, form.percentualComissao)}
                      className="w-full p-2.5 border bg-transparent outline-none"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Percentual do motorista (%) *</label>
                    <input
                      type="number" step="0.01" min="0" max="100" required
                      placeholder="Ex: 20"
                      value={form.percentualComissao}
                      onChange={e => atualizarCalculoComissao(form.frete, e.target.value)}
                      className="w-full p-2.5 border bg-transparent outline-none"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold mb-1">Comissão calculada (R$)</label>
                    <input
                      type="number" step="0.01" readOnly
                      value={form.comissao}
                      aria-describedby="ajuda-comissao"
                      className="w-full p-2.5 border bg-transparent outline-none opacity-75"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  </div>
                </div>
                <p id="ajuda-comissao" className="text-[10px] text-foreground-muted">
                  Informe o percentual acordado. A comissão é calculada automaticamente sobre o frete e confirmada novamente pelo servidor.
                </p>

                {/* ── SEÇÃO OPCIONAL DE PREENCHIMENTO DE CARGA (% DO VEÍCULO) ── */}
                <div className="p-3 border space-y-3 bg-background-secondary" style={{ borderColor: 'var(--border)' }}>
                  <label className="block text-[10px] uppercase font-bold flex items-center justify-between">
                    <span>Conteúdo da Carga (Opcional - % Ocupada)</span>
                    <span className="text-foreground-muted">{form.itensConteudo.reduce((a, b) => a + b.porcentagem, 0)}% Total</span>
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Pneus, Peças Automotivas"
                      maxLength={100}
                      value={novoItemNome}
                      onChange={e => setNovoItemNome(e.target.value)}
                      className="flex-1 p-2 border text-xs bg-transparent outline-none"
                      style={{ borderColor: 'var(--border)' }}
                    />
                    <input
                      type="number"
                      placeholder="%"
                      min="1" max="100"
                      value={novoItemPorcentagem}
                      onChange={e => setNovoItemPorcentagem(e.target.value)}
                      className="w-16 p-2 border text-xs bg-transparent outline-none"
                      style={{ borderColor: 'var(--border)' }}
                    />
                    <button
                      type="button"
                      onClick={handleAdicionarItemConteudo}
                      className="px-3 border text-xs font-bold uppercase cursor-pointer"
                      style={{ backgroundColor: primary, color: '#000', borderColor: primary }}
                    >
                      +
                    </button>
                  </div>

                  {form.itensConteudo.length > 0 ? (
                    <div className="space-y-1 pt-1">
                      {form.itensConteudo.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] p-1.5 border bg-background" style={{ borderColor: 'var(--border)' }}>
                          <span>{item.nome}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold" style={{ color: primary }}>{item.porcentagem}%</span>
                            <button
                              type="button"
                              onClick={() => handleRemoverItemConteudo(idx)}
                              className="text-red-400 hover:text-red-500 cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[9px] text-foreground-muted italic">
                      Se não adicionar itens, o contêiner será exibido com a marcação “CONTEÚDO CONFIDENCIAL”.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Status *</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as StatusContainer })}
                    className="w-full p-2.5 border bg-transparent outline-none cursor-pointer"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    {(Object.keys(STATUS_CONFIG) as StatusContainer[]).map(st => (
                      <option key={st} value={st} style={{ backgroundColor: 'var(--background)' }}>{STATUS_CONFIG[st].label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Observações (Opcional)</label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Aguardando liberação alfandegária"
                    maxLength={2000}
                    value={form.observacoes}
                    onChange={e => setForm({ ...form, observacoes: e.target.value })}
                    className="w-full p-2.5 border bg-transparent outline-none resize-none"
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border uppercase cursor-pointer">Cancelar</button>
                  <button type="submit" className="px-6 py-2 uppercase font-bold text-black cursor-pointer" style={{ backgroundColor: primary }}>
                    {containerEditandoId ? 'Salvar Alterações' : 'Confirmar Lançamento'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}

function CardResumo({ titulo, valor, primary, icone, destaque = false }: { titulo: string, valor: string, primary: string, icone: React.ReactNode, destaque?: boolean }) {
  return (
    <div
      className="p-5 border relative overflow-hidden"
      style={{
        backgroundColor: destaque ? `${primary}10` : 'var(--background-secondary)',
        borderColor: destaque ? primary : 'var(--border)',
        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
      }}
    >
      <div className="flex justify-between items-start mb-2 relative z-10">
        <div className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color: destaque ? primary : 'var(--foreground-muted)' }}>
          {titulo}
        </div>
        <div className="opacity-60" style={{ color: destaque ? primary : 'var(--foreground)' }}>
          {icone}
        </div>
      </div>
      <div className="text-2xl font-black font-rajdhani tracking-tight relative z-10" style={{ color: 'var(--foreground)' }}>
        {valor}
      </div>
    </div>
  )
}
