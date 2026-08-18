'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import { 
  FilePieChart, 
  Download, 
  Calendar, 
  Filter, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle,
  Trophy,
  FileSpreadsheet,
  Lock,
  X,
  AlertCircle
} from 'lucide-react'
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts'

type PlanoTipo = 'PREVIEW' | 'ESSENCIAL' | 'AVANCADO' | 'ENTERPRISE'

// ─── DADOS FALSOS PARA PRÉ-VISUALIZAÇÃO (MOCK) ────────────────────────────────
const MOCK_EFICIENCIA_MES = [
  { mes: 'Jan', custoKm: 4.15, kmTotal: 45000 },
  { mes: 'Fev', custoKm: 4.18, kmTotal: 42000 },
  { mes: 'Mar', custoKm: 4.25, kmTotal: 51000 },
  { mes: 'Abr', custoKm: 4.22, kmTotal: 48000 },
  { mes: 'Mai', custoKm: 4.30, kmTotal: 55000 },
  { mes: 'Jun', custoKm: 4.28, kmTotal: 53000 },
  { mes: 'Jul', custoKm: 4.24, kmTotal: 58000 },
]

const MOCK_CUSTO_VEICULO = [
  { veiculo: 'ABC-1234', combustivel: 14500, manutencao: 3200 },
  { veiculo: 'XYZ-9876', combustivel: 12800, manutencao: 8500 },
  { veiculo: 'DEF-5678', combustivel: 16100, manutencao: 1400 },
  { veiculo: 'JKL-3456', combustivel: 13200, manutencao: 2800 },
  { veiculo: 'GHI-9012', combustivel: 10100, manutencao: 9200 },
]

export default function RelatoriosPage() {
  const { primary } = useTheme()
  const [montado, setMontado] = useState(false)
  
  // Contexto do Plano da Empresa
  const [planoEmpresa, setPlanoEmpresa] = useState<PlanoTipo>('ENTERPRISE')

  // Filtro de Tempo e Período
  const [periodo, setPeriodo] = useState('ESTE_MES')
  const [modalPersonalizarOpen, setModalPersonalizarOpen] = useState(false)

  // Intervalo Personalizado
  const dataHojeStr = new Date().toISOString().split('T')[0]
  const [dataInicio, setDataInicio] = useState('2026-01-01')
  const [dataFim, setDataFim] = useState(dataHojeStr)

  useEffect(() => {
    setMontado(true)
    const userData = localStorage.getItem('@rpmtruck:user')
    if (userData) {
      const parsed = JSON.parse(userData)
      if (parsed.empresaInfo?.plano) setPlanoEmpresa(parsed.empresaInfo.plano)
    }
  }, [])

  if (!montado) return null

  // 🎨 INTELIGÊNCIA DE CONTRASTE DE CORES DO TEMA
  // Detecta se a cor primária é tom de vermelho para trocar a cor da Manutenção para Laranja/Amarelo
  const eTemaVermelho = (corHex: string) => {
    const corLower = corHex.toLowerCase()
    return (
      corLower.includes('ef4444') || 
      corLower.includes('dc2626') || 
      corLower.includes('f87171') || 
      corLower.includes('b91c1c') || 
      corLower.includes('red')
    )
  }

  // Cor adaptativa para a barra de Manutenção
  const corManutencaoAdaptativa = eTemaVermelho(primary) ? '#f97316' : '#ef4444'

  // 🧠 CÁLCULO DO LIMITE MÁXIMO DE DIAS PERMITIDO PELO PLANO
  const obterDiasMaximosPlano = (plano: PlanoTipo): number => {
    switch (plano) {
      case 'ENTERPRISE': return 1095 // 3 Anos (365 * 3)
      case 'AVANCADO': return 730    // 2 Anos (365 * 2)
      case 'ESSENCIAL':
      case 'PREVIEW':
      default: return 365           // 1 Ano
    }
  }

  const limiteDiasPlano = obterDiasMaximosPlano(planoEmpresa)

  // Cálculo da quantidade de dias no modal personalizado
  const calcularDiferencaDias = () => {
    if (!dataInicio || !dataFim) return 0
    const inicio = new Date(dataInicio).getTime()
    const fim = new Date(dataFim).getTime()
    const diffTime = fim - inicio
    if (diffTime < 0) return 0
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }

  const diasSelecionados = calcularDiferencaDias()
  const periodoValido = diasSelecionados > 0 && diasSelecionados <= limiteDiasPlano

  // Opções de filtros com checagem de plano
  const OPCOES_PERIODO = [
    { id: 'ESTE_MES', label: 'ESTE MÊS', diasMinimos: 31 },
    { id: 'TRIMESTRE', label: 'TRIMESTRE', diasMinimos: 90 },
    { id: 'ULTIMOS_6_MESES', label: 'ÚLTIMOS 6 MESES', diasMinimos: 180 },
    { id: 'ANO_ATUAL', label: 'ANO ATUAL (1 ANO)', diasMinimos: 365 },
    { id: 'HISTORICO_2_ANOS', label: 'HISTÓRICO 2 ANOS', diasMinimos: 730 },
    { id: 'HISTORICO_3_ANOS', label: 'HISTÓRICO 3 ANOS', diasMinimos: 1095 },
  ]

  const handleAplicarPersonalizacao = (e: React.FormEvent) => {
    e.preventDefault()
    if (!periodoValido) return
    setPeriodo('CUSTOMIZADO')
    setModalPersonalizarOpen(false)
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-mono">
      
      {/* ─── CABEÇALHO E AÇÕES ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight font-rajdhani" style={{ color: 'var(--foreground)' }}>
            Inteligência & <span style={{ color: primary }}>Relatórios</span>
          </h1>
          <p className="text-sm mt-1 text-foreground-muted">
            Análise de performance, eficiência de rotas e auditoria de custos com histórico limitado pelo plano.
          </p>
        </div>
        
        {/* Ações de Exportação */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 border text-[10px] font-bold uppercase tracking-wider flex items-center gap-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
            <span>Limite do Plano {planoEmpresa}:</span>
            <span style={{ color: primary }}>{limiteDiasPlano} Dias ({limiteDiasPlano / 365} Ano(s))</span>
          </div>

          <motion.button 
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all border hover:bg-white/5 cursor-pointer"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <FileSpreadsheet size={16} className="text-green-500" /> EXCEL
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer font-extrabold text-black"
            style={{ 
              backgroundColor: primary,
              clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
            }}
          >
            <Download size={16} /> GERAR PDF
          </motion.button>
        </div>
      </div>

      {/* ─── BARRA DE FILTRO DE TEMPO INTELIGENTE ─── */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex items-center gap-3 px-4 py-3 border shrink-0" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
          <Calendar size={16} style={{ color: primary }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--foreground)' }}>Período do Relatório:</span>
        </div>
        
        <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2 md:pb-0">
          {OPCOES_PERIODO.map((per) => {
            const bloqueadoPeloPlano = per.diasMinimos > limiteDiasPlano
            const estaAtivo = periodo === per.id

            return (
              <button
                key={per.id}
                disabled={bloqueadoPeloPlano}
                onClick={() => setPeriodo(per.id)}
                className={`px-4 py-3 text-xs font-bold uppercase tracking-widest border whitespace-nowrap transition-all flex items-center gap-1.5 ${bloqueadoPeloPlano ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                style={{
                  backgroundColor: estaAtivo ? `${primary}15` : 'var(--background-secondary)',
                  borderColor: estaAtivo ? primary : 'var(--border)',
                  color: estaAtivo ? primary : 'var(--foreground-muted)',
                  clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))'
                }}
                title={bloqueadoPeloPlano ? `Requer Plano Superior (${per.diasMinimos / 365} Anos)` : ''}
              >
                {bloqueadoPeloPlano && <Lock size={12} />}
                {per.label}
              </button>
            )
          })}

          <button 
            onClick={() => setModalPersonalizarOpen(true)}
            className="px-4 py-3 border flex items-center gap-2 justify-center transition-colors hover:bg-white/5 cursor-pointer font-bold text-xs uppercase" 
            style={{ borderColor: periodo === 'CUSTOMIZADO' ? primary : 'var(--border)', backgroundColor: periodo === 'CUSTOMIZADO' ? `${primary}15` : 'var(--background-secondary)', color: periodo === 'CUSTOMIZADO' ? primary : 'var(--foreground)' }}
          >
            <Filter size={16} /> {periodo === 'CUSTOMIZADO' ? `PERSONALIZADO (${diasSelecionados} DIAS)` : 'PERSONALIZAR'}
          </button>
        </div>
      </div>

      {/* ─── HIGHLIGHTS (DESTAQUES ANALÍTICOS) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <HighlightCard 
          titulo="Custo Médio / KM" valor="R$ 4,24" variacao="-R$ 0,08 vs Trimestre" 
          positivo={true} icone={<TrendingDown size={20}/>} primary={primary} 
        />
        <HighlightCard 
          titulo="Veículo + Eficiente" valor="DEF-5678" variacao="Consumo 18% abaixo da média" 
          positivo={true} icone={<Trophy size={20} className="text-yellow-500"/>} primary={primary} destaque 
        />
        <HighlightCard 
          titulo="Maior Gasto (Manut.)" valor="XYZ-9876" variacao="R$ 8.500 neste período" 
          positivo={false} icone={<AlertTriangle size={20}/>} primary={primary} alerta 
        />
        <HighlightCard 
          titulo="Total KM Percorrido" valor="352.000 KM" variacao="+15.000 km vs Trimestre" 
          positivo={true} icone={<TrendingUp size={20}/>} primary={primary} 
        />
      </div>

      {/* ─── GRÁFICOS ANALÍTICOS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* GRÁFICO 1: Comparativo de Custos por Veículo com Ajuste Automático de Cor */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="p-5 border relative overflow-hidden"
          style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--foreground)' }}>
              Top 5: Custo por Veículo ({periodo.replace(/_/g, ' ')})
            </h3>
            <span className="text-[10px] border px-2 py-1 rounded-sm opacity-50" style={{ borderColor: 'var(--border)' }}>TOP 5</span>
          </div>
          
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_CUSTO_VEICULO} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="var(--foreground-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value/1000}k`} />
                <YAxis dataKey="veiculo" type="category" stroke="var(--foreground-muted)" fontSize={10} tickLine={false} axisLine={false} width={80} />
                <RechartsTooltip 
                  cursor={{ fill: 'var(--border)', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)', fontSize: '12px', fontFamily: 'monospace' }}
                  formatter={(val: number) => [`R$ ${val.toLocaleString('pt-BR')}`, '']}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '10px' }} />
                {/* 🎨 Combustível usa a Cor Primária do Tema */}
                <Bar dataKey="combustivel" name="Combustível" stackId="a" fill={primary} radius={[0, 0, 0, 0]} />
                {/* 🎨 Manutenção usa a Cor Adaptativa (Laranja se o tema for Vermelho) */}
                <Bar dataKey="manutencao" name="Manutenção" stackId="a" fill={corManutencaoAdaptativa} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* GRÁFICO 2: Tendência de Eficiência Global */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="p-5 border relative overflow-hidden"
          style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--foreground)' }}>
              Evolução da Eficiência (Custo/KM)
            </h3>
            <span className="text-[10px] text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-sm">
              Tendência Otimizada
            </span>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_EFICIENCIA_MES} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" stroke="var(--foreground-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--foreground-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)', fontSize: '12px', fontFamily: 'monospace' }}
                  formatter={(val: number) => [`R$ ${val.toFixed(2)} / KM`, 'Custo Média']}
                />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="custoKm" name="Custo Médio / KM (R$)" stroke={primary} strokeWidth={3} dot={{ r: 4, fill: 'var(--background)', stroke: primary, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

      </div>

      {/* ─── MODAL DE PERSONALIZAÇÃO DE DATAS COM TRAVA DE PLANO ─── */}
      <AnimatePresence>
        {modalPersonalizarOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md border p-6 font-mono space-y-4"
              style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
            >
              <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h3 className="text-sm font-bold uppercase font-rajdhani">Personalizar Período do Relatório</h3>
                  <p className="text-[10px] text-foreground-muted">Plano {planoEmpresa}: Máximo de {limiteDiasPlano} dias seguidos.</p>
                </div>
                <button onClick={() => setModalPersonalizarOpen(false)} className="cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleAplicarPersonalizacao} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Data Inicial *</label>
                  <input 
                    type="date" 
                    required 
                    value={dataInicio} 
                    onChange={e => setDataInicio(e.target.value)} 
                    className="w-full p-2.5 border bg-transparent outline-none" 
                    style={{ borderColor: 'var(--border)' }} 
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1">Data Final *</label>
                  <input 
                    type="date" 
                    required 
                    max={dataHojeStr}
                    value={dataFim} 
                    onChange={e => setDataFim(e.target.value)} 
                    className="w-full p-2.5 border bg-transparent outline-none" 
                    style={{ borderColor: 'var(--border)' }} 
                  />
                </div>

                {/* PAINEL DE VALIDAÇÃO DA SOMA DOS DIAS */}
                <div className="p-3 border text-xs space-y-1" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)' }}>
                  <div className="flex justify-between items-center font-bold">
                    <span>Intervalo Selecionado:</span>
                    <span style={{ color: periodoValido ? primary : '#ef4444' }}>{diasSelecionados} Dia(s)</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-foreground-muted">
                    <span>Limite do seu Plano ({planoEmpresa}):</span>
                    <span>{limiteDiasPlano} Dias ({limiteDiasPlano / 365} Anos)</span>
                  </div>

                  {!periodoValido && diasSelecionados > limiteDiasPlano && (
                    <div className="pt-2 text-[10px] text-red-400 flex items-center gap-1 font-bold">
                      <AlertCircle size={12} /> Excedeu o limite do plano por {diasSelecionados - limiteDiasPlano} dias. Reduza o intervalo ou faça upgrade do plano.
                    </div>
                  )}
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <button type="button" onClick={() => setModalPersonalizarOpen(false)} className="px-4 py-2 border uppercase cursor-pointer">
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={!periodoValido}
                    className={`px-6 py-2 uppercase font-bold text-black font-extrabold ${!periodoValido ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`} 
                    style={{ backgroundColor: primary }}
                  >
                    Aplicar Período
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

// ─── COMPONENTE AUXILIAR: CARTÃO DE DESTAQUE ANALÍTICO ─────────────────────
function HighlightCard({ titulo, valor, variacao, positivo, icone, primary, destaque = false, alerta = false }: { titulo: string, valor: string, variacao: string, positivo: boolean, icone: React.ReactNode, primary: string, destaque?: boolean, alerta?: boolean }) {
  return (
    <div 
      className="p-5 border relative overflow-hidden flex flex-col justify-between h-[140px]"
      style={{ 
        backgroundColor: destaque ? `${primary}08` : alerta ? '#ef444408' : 'var(--background-secondary)', 
        borderColor: alerta ? '#ef444450' : destaque ? primary : 'var(--border)',
        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
      }}
    >
      <div className="flex justify-between items-start">
        <div className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color: 'var(--foreground-muted)' }}>
          {titulo}
        </div>
        <div style={{ color: alerta ? '#ef4444' : destaque ? primary : 'var(--foreground)' }}>
          {icone}
        </div>
      </div>
      
      <div>
        <div className="text-2xl font-black font-rajdhani tracking-tight" style={{ color: alerta ? '#ef4444' : 'var(--foreground)' }}>
          {valor}
        </div>
        <div className={`text-[10px] font-mono mt-1 ${positivo ? 'text-green-500' : 'text-red-500'}`}>
          {variacao}
        </div>
      </div>
    </div>
  )
}