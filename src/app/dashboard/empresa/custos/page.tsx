'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import { useContainers } from '@/contexts/ContainersContext'
import { DUPLAS_OPERACIONAIS } from '@/data/DuplasOperacionais'
import { obterAnoMesSemana, MESES } from '@/lib/dataUtils'
import { 
  DollarSign, 
  Search, 
  Plus, 
  CheckCircle, 
  Clock,
  Fuel,
  Wrench,
  FileText,
  Calendar,
  Truck,
  User,
  Trash2,
  Lock,
  Utensils,
  CreditCard,
  TrendingUp,
  Percent,
  ExternalLink,
  Info
} from 'lucide-react'

// ─── TIPOS E DADOS ──────────────────────────────────────────────────────────
type CategoriaCusto = 'COMBUSTIVEL' | 'MANUTENCAO' | 'PEDAGIO' | 'ALIMENTACAO' | 'DIARIA_MOTORISTA' | 'SEGURO' | 'OUTROS'
type PlanoSaaS = 'BASICO' | 'PRO' | 'ENTERPRISE'

interface RegistroCusto {
  id: string
  duplaId: string
  data: string // YYYY-MM-DD
  ano: number
  mesIndex: number // 0 a 11
  semanaIndex: number // 1 a 4
  categoria: CategoriaCusto
  descricao: string
  valor: number
  formaPagamento: string
  status: 'PAGO' | 'PENDENTE'
}

// Linha "achatada" usada só pra renderizar a tabela — une lançamentos
// manuais de Custos com as comissões automáticas vindas de Containers,
// sem misturar os dois modelos de dados.
interface LinhaExibicao {
  id: string
  data: string
  categoria: CategoriaCusto | 'COMISSAO_TRANSPORTE'
  descricao: string
  formaPagamento: string
  valor: number
  status: 'PAGO' | 'PENDENTE'
  origem: 'MANUAL' | 'CONTAINER_AUTO'
}

// DUPLAS_OPERACIONAIS vem de src/data/duplasOperacionais.ts — a mesma fonte
// que Containers usa, então "duplaAtiva" aqui e no módulo Containers sempre
// se referem exatamente à mesma dupla.

export default function CustosPage() {
  const { primary } = useTheme()
  const { containers } = useContainers()
  const [montado, setMontado] = useState(false)

  // Contexto da Empresa (Plano Ativo)
  const [planoEmpresa, setPlanoEmpresa] = useState<PlanoSaaS>('ENTERPRISE')

  // Seletor Temporal Dinâmico
  const anoAtual = new Date().getFullYear()
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual)
  const [mesSelecionadoIndex, setMesSelecionadoIndex] = useState(new Date().getMonth())
  const [semanaSelecionada, setSemanaSelecionada] = useState(1)

  // Dupla Ativa Escolhida
  const [indexDupla, setIndexDupla] = useState(0)

  // Filtros e Pesquisa
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODOS')

  // Modais e Exclusão
  const [modalRegistroOpen, setModalRegistroOpen] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  // Lançamento do Formulário
  const [formCusto, setFormCusto] = useState({
    data: new Date().toISOString().split('T')[0],
    categoria: 'COMBUSTIVEL' as CategoriaCusto,
    descricao: '',
    valor: '',
    formaPagamento: 'CARTÃO CORPORATIVO',
    status: 'PAGO' as 'PAGO' | 'PENDENTE'
  })

  // Banco de Dados em Memória de Lançamentos Manuais
  const [custos, setCustos] = useState<RegistroCusto[]>([
    { id: 'c1', duplaId: 'd1', data: '2026-07-07', ano: 2026, mesIndex: 6, semanaIndex: 1, categoria: 'COMBUSTIVEL', descricao: 'Abastecimento Diesel S10 Posto Shell', valor: 850.00, formaPagamento: 'CARTÃO CORPORATIVO', status: 'PAGO' },
    { id: 'c2', duplaId: 'd1', data: '2026-07-06', ano: 2026, mesIndex: 6, semanaIndex: 1, categoria: 'PEDAGIO', descricao: 'Pedágios Rota Anchieta', valor: 145.20, formaPagamento: 'TAG AUTO', status: 'PAGO' },
    { id: 'c3', duplaId: 'd1', data: '2026-07-08', ano: 2026, mesIndex: 6, semanaIndex: 2, categoria: 'ALIMENTACAO', descricao: 'Diária e Almoço Motorista', valor: 120.00, formaPagamento: 'PIX', status: 'PAGO' },
    { id: 'c4', duplaId: 'd2', data: '2026-07-05', ano: 2026, mesIndex: 6, semanaIndex: 1, categoria: 'MANUTENCAO', descricao: 'Troca de Correia Dentada', valor: 1400.00, formaPagamento: 'BOLETO', status: 'PENDENTE' },
  ])

  useEffect(() => {
    setMontado(true)
  }, [])

  if (!montado) return null

  const duplaAtiva = DUPLAS_OPERACIONAIS[indexDupla] || DUPLAS_OPERACIONAIS[0]

  // Histórico Permitido pelo Plano
  const anosDisponiveis = planoEmpresa === 'ENTERPRISE' 
    ? [anoAtual, anoAtual - 1, anoAtual - 2]
    : [anoAtual]

  // ─── LANÇAMENTOS MANUAIS DA SEMANA (fluxo já existente) ────────────────
  const custosFiltrados = custos.filter(c => {
    const pertenceADupla = c.duplaId === duplaAtiva.id
    const mesmoAno = c.ano === anoSelecionado
    const mesmoMes = c.mesIndex === mesSelecionadoIndex
    const mesmaSemana = c.semanaIndex === semanaSelecionada

    const matchBusca = c.descricao.toLowerCase().includes(busca.toLowerCase()) || c.categoria.toLowerCase().includes(busca.toLowerCase())
    const matchCategoria = filtroCategoria === 'TODOS' || c.categoria === filtroCategoria

    return pertenceADupla && mesmoAno && mesmoMes && mesmaSemana && matchBusca && matchCategoria
  })

  // ─── COMISSÕES AUTOMÁTICAS DE CONTAINERS (NOVO) ────────────────────────
  // Regra: container CANCELADO não gera custo. ENTREGUE = comissão PAGA.
  // AGENDADO / EM_TRÂNSITO = comissão PENDENTE (prevista, mas ainda não
  // "fechada"). Se sua regra de negócio for outra (ex: comissão devida na
  // coleta), é só trocar essa condição.
  const comissoesContainerAno = containers.filter(c => {
    if (c.duplaId !== duplaAtiva.id || c.status === 'CANCELADO') return false
    const bucket = obterAnoMesSemana(c.data)
    return bucket.ano === anoSelecionado
  })

  const comissoesContainerSemana = comissoesContainerAno.filter(c => {
    const bucket = obterAnoMesSemana(c.data)
    return bucket.mesIndex === mesSelecionadoIndex && bucket.semanaIndex === semanaSelecionada
  })

  const totalComissaoContainerAno = comissoesContainerAno.reduce((acc, c) => acc + c.comissao, 0)
  const totalComissaoContainerSemana = comissoesContainerSemana.reduce((acc, c) => acc + c.comissao, 0)
  const totalComissaoContainerPendenteSemana = comissoesContainerSemana
    .filter(c => c.status !== 'ENTREGUE')
    .reduce((acc, c) => acc + c.comissao, 0)

  // ─── TOTAIS COMBINADOS (MANUAL + AUTOMÁTICO) ───────────────────────────
  const acumuladoManualAno = custos
    .filter(c => c.duplaId === duplaAtiva.id && c.ano === anoSelecionado)
    .reduce((acc, curr) => acc + curr.valor, 0)
  const acumuladoAnoAtual = acumuladoManualAno + totalComissaoContainerAno

  const totalManualSemana = custosFiltrados.reduce((acc, curr) => acc + curr.valor, 0)
  const totalSemana = totalManualSemana + totalComissaoContainerSemana

  const totalCombustivelSemana = custosFiltrados.filter(c => c.categoria === 'COMBUSTIVEL').reduce((acc, curr) => acc + curr.valor, 0)

  const totalPendenteManualSemana = custosFiltrados.filter(c => c.status === 'PENDENTE').reduce((acc, curr) => acc + curr.valor, 0)
  const totalPendenteSemana = totalPendenteManualSemana + totalComissaoContainerPendenteSemana

  // ─── LINHAS COMBINADAS PRA TABELA ───────────────────────────────────────
  const linhasManual: LinhaExibicao[] = custosFiltrados.map(c => ({
    id: c.id,
    data: c.data,
    categoria: c.categoria,
    descricao: c.descricao,
    formaPagamento: c.formaPagamento,
    valor: c.valor,
    status: c.status,
    origem: 'MANUAL'
  }))

  const mostrarComissoesContainer = filtroCategoria === 'TODOS' || filtroCategoria === 'COMISSAO_TRANSPORTE'
  const linhasComissaoContainer: LinhaExibicao[] = mostrarComissoesContainer
    ? comissoesContainerSemana
        .filter(c => {
          const termo = busca.toLowerCase()
          return (
            c.codigo.toLowerCase().includes(termo) ||
            c.terminalInicio.toLowerCase().includes(termo) ||
            c.terminalFim.toLowerCase().includes(termo) ||
            'comissão transporte'.includes(termo) ||
            termo === ''
          )
        })
        .map(c => ({
          id: `container-${c.id}`,
          data: c.data,
          categoria: 'COMISSAO_TRANSPORTE' as const,
          descricao: `Comissão sobre frete — Container ${c.codigo} (${c.terminalInicio} → ${c.terminalFim})`,
          formaPagamento: 'AUTOMÁTICO',
          valor: c.comissao,
          status: c.status === 'ENTREGUE' ? 'PAGO' : 'PENDENTE',
          origem: 'CONTAINER_AUTO' as const
        }))
    : []

  const linhasCombinadas = [...linhasManual, ...linhasComissaoContainer].sort((a, b) => b.data.localeCompare(a.data))

  // 🔄 ALTERAÇÃO RÁPIDA DE STATUS DO LANÇAMENTO (só afeta lançamentos manuais)
  const handleAlterarStatusRapido = (id: string, novoStatus: 'PAGO' | 'PENDENTE') => {
    setCustos(prev => prev.map(c => c.id === id ? { ...c, status: novoStatus } : c))
  }

  // Salvar Novo Lançamento
  const handleSalvarDespesa = (e: React.FormEvent) => {
    e.preventDefault()

    const novoRegistro: RegistroCusto = {
      id: String(Date.now()),
      duplaId: duplaAtiva.id,
      data: formCusto.data,
      ano: anoSelecionado,
      mesIndex: mesSelecionadoIndex,
      semanaIndex: semanaSelecionada,
      categoria: formCusto.categoria,
      descricao: formCusto.descricao,
      valor: Number(formCusto.valor) || 0,
      formaPagamento: formCusto.formaPagamento,
      status: formCusto.status
    }

    setCustos(prev => [novoRegistro, ...prev])
    setModalRegistroOpen(false)
    setFormCusto({
      data: new Date().toISOString().split('T')[0],
      categoria: 'COMBUSTIVEL',
      descricao: '',
      valor: '',
      formaPagamento: 'CARTÃO CORPORATIVO',
      status: 'PAGO'
    })
  }

  const handleConfirmarExclusao = (id: string) => {
    setCustos(prev => prev.filter(c => c.id !== id))
    setExcluindoId(null)
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-mono">
      
      {/* ─── CABEÇALHO COM INDICADOR DE PLANO SAAS ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight font-rajdhani" style={{ color: 'var(--foreground)' }}>
            Centro de <span style={{ color: primary }}>Custos & Despesas</span>
          </h1>
          <p className="text-sm mt-1 text-foreground-muted">
            Lançamento detalhado por Veículo + Condutor, com comissões de Containers somadas automaticamente.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 border text-[10px] font-bold uppercase tracking-wider flex items-center gap-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
            <span>Histórico {planoEmpresa}:</span>
            <span style={{ color: primary }}>{planoEmpresa === 'ENTERPRISE' ? '3 Anos Liberados' : '1 Ano Liberado'}</span>
          </div>

          <motion.button 
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => setModalRegistroOpen(true)}
            className="flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all text-black font-extrabold"
            style={{ 
              backgroundColor: primary,
              clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
            }}
          >
            <Plus size={16} /> Lançar Despesa
          </motion.button>
        </div>
      </div>

      {/* ─── 1. SELETOR DE ALOCAÇÃO (VEÍCULO + MOTORISTA) ─── */}
      <div className="border p-4 relative" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
        <div className="flex justify-between items-center mb-3 text-[10px] uppercase font-bold text-foreground-muted tracking-widest">
          <span>Selecione o Conjunto Operacional (Veículo e Motorista Vinculado):</span>
          <span>{DUPLAS_OPERACIONAIS.length} Alocações Ativas</span>
        </div>

        <div className="flex overflow-x-auto hide-scrollbar gap-3 py-1">
          {DUPLAS_OPERACIONAIS.map((d, idx) => {
            const estaSelecionada = idx === indexDupla
            return (
              <button
                key={d.id}
                onClick={() => setIndexDupla(idx)}
                className="p-3 border text-left min-w-[280px] shrink-0 transition-all relative font-mono cursor-pointer"
                style={{
                  backgroundColor: estaSelecionada ? `${primary}15` : 'var(--background)',
                  borderColor: estaSelecionada ? primary : 'var(--border)',
                  clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
                }}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-xs font-rajdhani flex items-center gap-1.5" style={{ color: estaSelecionada ? primary : 'var(--foreground)' }}>
                    <Truck size={14} /> {d.veiculoModelo}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 border font-bold" style={{ borderColor: 'var(--border)' }}>
                    {d.veiculoPlaca}
                  </span>
                </div>
                <div className="text-[10px] text-foreground-muted flex items-center gap-1 mt-1">
                  <User size={12} style={{ color: primary }} /> Condutor: <span className="font-bold text-foreground">{d.motoristaNome}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── 2. CONTROLE TEMPORAL (ANO -> 12 MESES -> SEMANAS) ─── */}
      <div className="border p-4 space-y-4" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 text-xs font-bold uppercase">
            <Calendar size={16} style={{ color: primary }} /> Ano Fiscal:
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
              {planoEmpresa !== 'ENTERPRISE' && (
                <div className="px-2 py-1 text-[10px] text-foreground-muted flex items-center gap-1 opacity-50 cursor-not-allowed" title="Upgrade para o Plano Enterprise para acessar histórico de 3 anos">
                  <Lock size={10} /> 2025 / 2024 (Enterprise)
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-foreground-muted">Recorte Semanal:</span>
            {[1, 2, 3, 4].map(s => (
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

        {/* CARROSSEL DOS 12 MESES DO ANO */}
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

      {/* ─── 3. RESUMO FINANCEIRO (MANUAL + AUTOMÁTICO DE CONTAINERS) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <CardResumo 
          titulo={`TOTAL ACUMULADO EM ${anoSelecionado}`} 
          valor={acumuladoAnoAtual} 
          primary={primary} 
          icone={<TrendingUp size={20}/>} 
        />

        <CardResumo 
          titulo={`TOTAL SEMANA ${semanaSelecionada} (${MESES[mesSelecionadoIndex]})`} 
          valor={totalSemana} 
          primary={primary} 
          icone={<DollarSign size={20}/>} 
          destaque 
        />

        <CardResumo 
          titulo="COMBUSTÍVEL NA SEMANA" 
          valor={totalCombustivelSemana} 
          primary={primary} 
          icone={<Fuel size={20}/>} 
        />

        <CardResumo 
          titulo="COMISSÃO CONTAINERS (AUTO)" 
          valor={totalComissaoContainerSemana} 
          primary={primary} 
          icone={<Percent size={20}/>} 
        />

        <CardResumo 
          titulo="PENDENTES NA SEMANA" 
          valor={totalPendenteSemana} 
          primary={primary} 
          icone={<Clock size={20}/>} 
          alerta 
        />
      </div>

      <div className="flex items-start gap-2 text-[10px] text-foreground-muted px-1">
        <Info size={13} className="shrink-0 mt-0.5" style={{ color: primary }} />
        <span>
          O card "Comissão Containers (Auto)" já está somado dentro de "Total Semana" e "Total Acumulado" — não é um valor separado.
          Ele aparece isolado só pra você enxergar quanto do total veio de containers sem precisar abrir o outro módulo.
        </span>
      </div>

      {/* ─── 4. FILTROS E TABELA DE LANÇAMENTOS ─── */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" style={{ color: 'var(--foreground-muted)' }}>
            <Search size={16} />
          </div>
          <input 
            type="text" 
            placeholder="Buscar por descrição, categoria ou código de container..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-11 pr-4 py-3 text-sm outline-none border font-mono"
            style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        <div className="flex overflow-x-auto hide-scrollbar gap-2">
          {['TODOS', 'COMBUSTIVEL', 'MANUTENCAO', 'PEDAGIO', 'ALIMENTACAO', 'DIARIA_MOTORISTA', 'SEGURO', 'COMISSAO_TRANSPORTE'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFiltroCategoria(cat)}
              className="px-3 py-2 text-[10px] font-bold font-mono uppercase tracking-widest border whitespace-nowrap transition-all cursor-pointer"
              style={{
                backgroundColor: filtroCategoria === cat ? `${primary}15` : 'var(--background-secondary)',
                borderColor: filtroCategoria === cat ? primary : 'var(--border)',
                color: filtroCategoria === cat ? primary : 'var(--foreground-muted)'
              }}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="border overflow-hidden relative" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="p-4 border-b font-bold text-xs uppercase flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
          <span>Lançamentos — {duplaAtiva.veiculoModelo} ({duplaAtiva.veiculoPlaca}) com {duplaAtiva.motoristaNome}</span>
          <span className="text-[10px] text-foreground-muted">{linhasCombinadas.length} Registro(s) na Semana {semanaSelecionada}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap font-mono">
            <thead style={{ backgroundColor: 'var(--background)', color: 'var(--foreground-muted)' }}>
              <tr className="text-[10px] uppercase tracking-widest border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4">Descrição da Despesa</th>
                <th className="px-6 py-4">Pagamento</th>
                <th className="px-6 py-4 text-right">Valor (R$)</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y [&>tr]:border-[var(--border)]" style={{ color: 'var(--foreground)' }}>
              <AnimatePresence>
                {linhasCombinadas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm font-mono text-foreground-muted">
                      Nenhum lançamento de custo encontrado para esta semana no período selecionado.
                    </td>
                  </tr>
                ) : (
                  linhasCombinadas.map((linha) => (
                    <tr key={linha.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold">{linha.data}</td>
                      <td className="px-6 py-4">
                        <BadgeCategoria categoria={linha.categoria} primary={primary} />
                      </td>
                      <td className="px-6 py-4 text-xs font-medium">
                        <div className="flex items-center gap-2">
                          <span>{linha.descricao}</span>
                          {linha.origem === 'CONTAINER_AUTO' && (
                            <span
                              className="text-[8px] font-black px-1.5 py-0.5 rounded-sm shrink-0"
                              style={{ backgroundColor: `${primary}20`, color: primary }}
                            >
                              AUTOMÁTICO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-foreground-muted">{linha.formaPagamento}</td>
                      <td className="px-6 py-4 text-right font-bold text-xs text-green-500">
                        {linha.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>

                      {/* STATUS: EDITÁVEL PRA MANUAL, SÓ LEITURA PRA COMISSÃO DE CONTAINER */}
                      <td className="px-6 py-4 text-center">
                        {linha.origem === 'MANUAL' ? (
                          <select
                            value={linha.status}
                            onChange={(e) => handleAlterarStatusRapido(linha.id, e.target.value as 'PAGO' | 'PENDENTE')}
                            className="px-2.5 py-1 text-[10px] font-bold uppercase border bg-transparent outline-none cursor-pointer"
                            style={{
                              borderColor: linha.status === 'PAGO' ? '#22c55e' : '#eab308',
                              color: linha.status === 'PAGO' ? '#22c55e' : '#eab308'
                            }}
                          >
                            <option value="PAGO" style={{ backgroundColor: 'var(--background)', color: '#22c55e' }}>PAGO</option>
                            <option value="PENDENTE" style={{ backgroundColor: 'var(--background)', color: '#eab308' }}>PENDENTE</option>
                          </select>
                        ) : (
                          <span
                            className="px-2.5 py-1 text-[10px] font-bold uppercase border"
                            style={{
                              borderColor: linha.status === 'PAGO' ? '#22c55e' : '#eab308',
                              color: linha.status === 'PAGO' ? '#22c55e' : '#eab308'
                            }}
                            title="Editado no módulo Containers, mudando o status da movimentação"
                          >
                            {linha.status}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {linha.origem === 'MANUAL' ? (
                          excluindoId === linha.id ? (
                            <div className="inline-flex items-center gap-2 p-1 border bg-red-500/10 text-red-400 border-red-500/30 font-bold text-[10px]">
                              <span>Excluir?</span>
                              <button onClick={() => handleConfirmarExclusao(linha.id)} className="px-2 py-0.5 bg-red-500 text-black font-extrabold uppercase">Sim</button>
                              <button onClick={() => setExcluindoId(null)} className="px-2 py-0.5 border border-white/20 text-white">Não</button>
                            </div>
                          ) : (
                            <button onClick={() => setExcluindoId(linha.id)} className="p-2 text-red-400 hover:text-red-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          )
                        ) : (
                          <Link
                            href="/dashboard/empresa/containers"
                            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase hover:underline"
                            style={{ color: primary }}
                            title="Editar esse lançamento no módulo Containers"
                          >
                            Ver Container <ExternalLink size={11} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL LANÇAMENTO DE CUSTO ─── */}
      {modalRegistroOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="w-full max-w-lg border p-6 font-mono space-y-4" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="text-sm font-bold uppercase font-rajdhani">Lançar Despesa Operacional</h3>
                <p className="text-[10px] text-foreground-muted">Vinculado a: {duplaAtiva.veiculoModelo} ({duplaAtiva.veiculoPlaca}) • {duplaAtiva.motoristaNome}</p>
              </div>
              <button onClick={() => setModalRegistroOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSalvarDespesa} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Data do Lançamento *</label>
                  <input 
                    type="date" 
                    required 
                    value={formCusto.data} 
                    onChange={e => setFormCusto({...formCusto, data: e.target.value})} 
                    className="w-full p-2.5 border bg-transparent outline-none" 
                    style={{ borderColor: 'var(--border)' }} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Categoria da Despesa *</label>
                  <select 
                    value={formCusto.categoria} 
                    onChange={e => setFormCusto({...formCusto, categoria: e.target.value as any})} 
                    className="w-full p-2.5 border bg-transparent outline-none cursor-pointer" 
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <option value="COMBUSTIVEL" style={{ backgroundColor: 'var(--background)' }}>Combustível</option>
                    <option value="MANUTENCAO" style={{ backgroundColor: 'var(--background)' }}>Manutenção</option>
                    <option value="PEDAGIO" style={{ backgroundColor: 'var(--background)' }}>Pedágios / Tags</option>
                    <option value="ALIMENTACAO" style={{ backgroundColor: 'var(--background)' }}>Alimentação Motorista</option>
                    <option value="DIARIA_MOTORISTA" style={{ backgroundColor: 'var(--background)' }}>Diária Motorista</option>
                    <option value="SEGURO" style={{ backgroundColor: 'var(--background)' }}>Seguro / Proteção</option>
                    <option value="OUTROS" style={{ backgroundColor: 'var(--background)' }}>Outros Custos</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold mb-1">Descrição / Estabelecimento *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ex: Abastecimento Diesel S10 - Posto Shell / Reembolso Almoço" 
                  value={formCusto.descricao} 
                  onChange={e => setFormCusto({...formCusto, descricao: e.target.value})} 
                  className="w-full p-2.5 border bg-transparent outline-none" 
                  style={{ borderColor: 'var(--border)' }} 
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Valor (R$) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    placeholder="Ex: 450.00" 
                    value={formCusto.valor} 
                    onChange={e => setFormCusto({...formCusto, valor: e.target.value})} 
                    className="w-full p-2.5 border bg-transparent outline-none" 
                    style={{ borderColor: 'var(--border)' }} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Forma Pagto *</label>
                  <select 
                    value={formCusto.formaPagamento} 
                    onChange={e => setFormCusto({...formCusto, formaPagamento: e.target.value})} 
                    className="w-full p-2.5 border bg-transparent outline-none cursor-pointer" 
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <option value="CARTÃO CORPORATIVO" style={{ backgroundColor: 'var(--background)' }}>Cartão Corp.</option>
                    <option value="PIX" style={{ backgroundColor: 'var(--background)' }}>PIX</option>
                    <option value="BOLETO" style={{ backgroundColor: 'var(--background)' }}>Boleto</option>
                    <option value="DINHEIRO" style={{ backgroundColor: 'var(--background)' }}>Dinheiro</option>
                    <option value="TAG AUTO" style={{ backgroundColor: 'var(--background)' }}>Tag Automática</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Status *</label>
                  <select 
                    value={formCusto.status} 
                    onChange={e => setFormCusto({...formCusto, status: e.target.value as any})} 
                    className="w-full p-2.5 border bg-transparent outline-none cursor-pointer" 
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <option value="PAGO" style={{ backgroundColor: 'var(--background)' }}>PAGO</option>
                    <option value="PENDENTE" style={{ backgroundColor: 'var(--background)' }}>PENDENTE</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <button type="button" onClick={() => setModalRegistroOpen(false)} className="px-4 py-2 border uppercase">Cancelar</button>
                <button type="submit" className="px-6 py-2 uppercase font-bold text-black" style={{ backgroundColor: primary }}>Confirmar Lançamento</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  )
}

// ─── COMPONENTES AUXILIARES ──────────────────────────────────────────────────

function CardResumo({ titulo, valor, primary, icone, destaque = false, alerta = false }: { titulo: string, valor: number, primary: string, icone: React.ReactNode, destaque?: boolean, alerta?: boolean }) {
  return (
    <div 
      className="p-5 border relative overflow-hidden"
      style={{ 
        backgroundColor: destaque ? `${primary}10` : 'var(--background-secondary)', 
        borderColor: alerta ? '#ef444450' : destaque ? primary : 'var(--border)',
        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
      }}
    >
      <div className="flex justify-between items-start mb-2 relative z-10">
        <div className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color: alerta ? '#ef4444' : destaque ? primary : 'var(--foreground-muted)' }}>
          {titulo}
        </div>
        <div className="opacity-50" style={{ color: alerta ? '#ef4444' : destaque ? primary : 'var(--foreground)' }}>
          {icone}
        </div>
      </div>
      <div className="text-2xl font-black font-rajdhani tracking-tight relative z-10" style={{ color: alerta ? '#ef4444' : 'var(--foreground)' }}>
        {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </div>
    </div>
  )
}

function BadgeCategoria({ categoria, primary }: { categoria: CategoriaCusto | 'COMISSAO_TRANSPORTE', primary: string }) {
  let label = categoria.replace('_', ' ')
  let icon = <FileText size={12} />

  if (categoria === 'COMBUSTIVEL') icon = <Fuel size={12} />
  if (categoria === 'MANUTENCAO') icon = <Wrench size={12} />
  if (categoria === 'PEDAGIO') icon = <CreditCard size={12} />
  if (categoria === 'ALIMENTACAO') icon = <Utensils size={12} />
  if (categoria === 'COMISSAO_TRANSPORTE') icon = <Percent size={12} />

  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider font-bold" style={{ color: categoria === 'COMBUSTIVEL' || categoria === 'COMISSAO_TRANSPORTE' ? primary : 'var(--foreground)' }}>
      {icon}
      <span>{label}</span>
    </div>
  )
}
