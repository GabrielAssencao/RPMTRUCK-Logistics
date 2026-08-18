'use client'

import { useState, useEffect } from 'react'
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
  ArrowRight
} from 'lucide-react'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

type Urgencia = 'ALTA' | 'MEDIA' | 'BAIXA'
type PlanoTipo = 'PREVIEW' | 'ESSENCIAL' | 'AVANCADO' | 'ENTERPRISE'

interface AlertaInteligente {
  id: number
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

const DADOS_GRAFICOS: Record<string, any[]> = {
  '7_DIAS': [
    { dia: 'Seg', combustivel: 4000, manutencao: 2400, pedagio: 850 },
    { dia: 'Ter', combustivel: 3000, manutencao: 1398, pedagio: 620 },
    { dia: 'Qua', combustivel: 2000, manutencao: 9800, pedagio: 1100 },
    { dia: 'Qui', combustivel: 2780, manutencao: 3908, pedagio: 740 },
    { dia: 'Sex', combustivel: 1890, manutencao: 4800, pedagio: 950 },
    { dia: 'Sáb', combustivel: 2390, manutencao: 3800, pedagio: 410 },
    { dia: 'Dom', combustivel: 3490, manutencao: 4300, pedagio: 300 },
  ],
  '15_DIAS': [
    { dia: 'Semana 1', combustivel: 18500, manutencao: 12400, pedagio: 4200 },
    { dia: 'Semana 2', combustivel: 21000, manutencao: 8900, pedagio: 4800 },
  ],
  '30_DIAS': [
    { dia: 'Semana 1', combustivel: 18500, manutencao: 12400, pedagio: 4200 },
    { dia: 'Semana 2', combustivel: 21000, manutencao: 8900, pedagio: 4800 },
    { dia: 'Semana 3', combustivel: 19400, manutencao: 15200, pedagio: 3900 },
    { dia: 'Semana 4', combustivel: 23100, manutencao: 6400, pedagio: 5100 },
  ]
}

const dadosDistribuicaoCustos = [
  { name: 'Combustível', value: 65 },
  { name: 'Manutenção', value: 20 },
  { name: 'Pedágios', value: 10 },
  { name: 'Outros', value: 5 },
]

const ALERTAS_INICIAIS: AlertaInteligente[] = [
  { 
    id: 1, 
    categoria: 'VEICULO', 
    subtipo: 'NAO_REALIZADA', 
    foco: 'VOLVO FH540 (ABC-1234)', 
    descricao: 'Manutenção preventiva da caixa de transmissão não foi realizada dentro do prazo estipulado e o caminhão encontra-se em viagem de longa distância.' 
  },
  { 
    id: 2, 
    categoria: 'MOTORISTA', 
    subtipo: 'MULTA', 
    foco: 'Carlos Eduardo (Motorista)', 
    descricao: 'Infração grave cometida por excesso de velocidade na Rodovia dos Imigrantes (KM 42). Necessita de indicação de condutor iminente.' 
  },
  { 
    id: 3, 
    categoria: 'MOTORISTA', 
    subtipo: 'DOCUMENTO', 
    foco: 'João Silva (Motorista)', 
    descricao: 'Exame toxicológico e CNH da categoria E expiram nos próximos 15 dias uteis.' 
  },
]

const OPERADORES_DISPONIVEIS: OperadorOption[] = [
  { id: 'op1', nome: 'Carlos Eduardo', cargo: 'Operador Logístico Senior' },
  { id: 'op2', nome: 'Ana Paula', cargo: 'Supervisora de Frota' },
]

export default function PainelEmpresa() {
  const { primary } = useTheme()
  const [montado, setMontado] = useState(false)
  
  const [nomeUsuario, setNomeUsuario] = useState('Gabriel Souza')
  const [nomeEmpresa, setNomeEmpresa] = useState('Transportes RPM')
  const [planoEmpresa, setPlanoEmpresa] = useState<PlanoTipo>('ESSENCIAL') // Padrão Essencial para teste

  const [recorteDias, setRecorteDias] = useState<'7_DIAS' | '15_DIAS' | '30_DIAS'>('7_DIAS')

  // Modais
  const [alertaDetalhado, setAlertaDetalhado] = useState<AlertaInteligente | null>(null)
  const [alertaParaDelegar, setAlertaParaDelegar] = useState<AlertaInteligente | null>(null)
  const [modalUpgradeOpen, setModalUpgradeOpen] = useState(false)
  
  // Form de Delegação
  const [operadorSelecionado, setOperadorSelecionado] = useState('')
  const [instrucaoDelegacao, setInstrucaoDelegacao] = useState('')

  useEffect(() => {
    setMontado(true)
    const userData = localStorage.getItem('@rpmtruck:user')
    if (userData) {
      const parsed = JSON.parse(userData)
      if (parsed.nome) setNomeUsuario(parsed.nome)
      if (parsed.empresaInfo?.nome) setNomeEmpresa(parsed.empresaInfo.nome)
      if (parsed.empresaInfo?.plano) setPlanoEmpresa(parsed.empresaInfo.plano)
    }
  }, [])

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
    if (planoEmpresa === 'ESSENCIAL') {
      // Abre o modal de incentivo ao upgrade
      setModalUpgradeOpen(true)
    } else {
      // Abre o modal de delegação normal (Avançado / Enterprise)
      setAlertaParaDelegar(alerta)
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-mono">
      
      {/* ─── CABEÇALHO ─── */}
      <div className="mb-6 pb-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-3xl font-black uppercase tracking-tight font-rajdhani" style={{ color: 'var(--foreground)' }}>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricaCard titulo="FROTA ATIVA" valor="42 / 45" icone={<Truck size={20} />} variacao="+2 operacionais" positivo={true} primary={primary} />
        <MetricaCard titulo="EM ROTA AGORA" valor="28" icone={<MapPin size={20} />} variacao="62% de ocupação" positivo={true} primary={primary} />
        <MetricaCard titulo="CUSTO ACUMULADO (MÊS)" valor="R$ 185.280,00" icone={<DollarSign size={20} />} variacao="+12% vs. mês passado" positivo={false} primary={primary} />
        <MetricaCard titulo="CUSTO MÉDIO POR KM" valor="R$ 4,82" icone={<TrendingDown size={20} />} variacao="-R$ 0,15 (Eficiência)" positivo={true} primary={primary} />
      </div>

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
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DADOS_GRAFICOS[recorteDias]} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="dia" stroke="var(--foreground-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--foreground-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v/1000}k`} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)', fontSize: '12px' }} formatter={(val: number) => [`R$ ${val.toLocaleString('pt-BR')}`, '']} />
                <Area type="monotone" dataKey="combustivel" stroke={corCombustivel} strokeWidth={2} fillOpacity={0.2} fill={corCombustivel} name="Combustível" />
                <Area type="monotone" dataKey="manutencao" stroke={corManutencao} strokeWidth={2} fillOpacity={0.2} fill={corManutencao} name="Manutenção" />
                <Area type="monotone" dataKey="pedagio" stroke={corPedagio} strokeWidth={2} fillOpacity={0.2} fill={corPedagio} name="Pedágio" />
              </AreaChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dadosDistribuicaoCustos}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={88}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="var(--background-secondary)"
                  strokeWidth={3}
                  startAngle={90}
                  endAngle={-270}
                >
                  {dadosDistribuicaoCustos.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? corCombustivel : index === 1 ? corManutencao : index === 2 ? corPedagio : 'var(--border)'}
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                    fontSize: '12px',
                    borderRadius: '12px',
                  }}
                  formatter={(val: number) => [`${val}%`, 'Proporção']}
                />
              </PieChart>
            </ResponsiveContainer>
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
          { label: 'COBERTURA', value: '94,7%', trend: '+3,2% vs. semana', color: primary },
          { label: 'DISPONIBILIDADE', value: '87,4%', trend: '18 veículos em rota', color: '#22c55e' },
          { label: 'RISCO', value: 'Baixo', trend: '2 alertas críticos', color: '#f59e0b' },
          { label: 'EFICIÊNCIA', value: '96,1%', trend: '+1,6% de melhoria', color: '#38bdf8' },
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
        <div className="px-5 py-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <AlertTriangle size={14} style={{ color: primary }} /> Alertas Que Exigem Atenção
          </h3>
          <span className="text-[10px] text-foreground-muted">Prioridades calculadas automaticamente</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead style={{ backgroundColor: 'var(--background)', color: 'var(--foreground-muted)' }}>
              <tr className="text-[10px] uppercase tracking-widest">
                <th className="px-5 py-3 font-medium">Urgência</th>
                <th className="px-5 py-3 font-medium">Categoria / Foco</th>
                <th className="px-5 py-3 font-medium">Descrição da Pendência</th>
                <th className="px-5 py-3 font-medium text-right">Ação / Delegar</th>
              </tr>
            </thead>
            <tbody className="divide-y [&>tr]:border-[var(--border)]" style={{ color: 'var(--foreground)' }}>
              {ALERTAS_INICIAIS.map((alerta) => {
                const urgencia = calcularUrgencia(alerta)
                const descCurta = alerta.descricao.length > 55 ? `${alerta.descricao.substring(0, 55)}...` : alerta.descricao

                return (
                  <tr key={alerta.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3"><BadgeUrgencia urgencia={urgencia} /></td>
                    <td className="px-5 py-3">
                      <div className="font-bold text-xs">{alerta.foco}</div>
                      <div className="text-[10px] text-foreground-muted uppercase">{alerta.categoria} • {alerta.subtipo}</div>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground-muted">{descCurta}</span>
                        {alerta.descricao.length > 55 && (
                          <button onClick={() => setAlertaDetalhado(alerta)} className="text-[10px] font-bold uppercase underline hover:opacity-80 shrink-0 cursor-pointer" style={{ color: primary }}>
                            Ver detalhes
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 🔒 BOTÃO COM INDICADOR VISUAL DO PLANO AVANÇADO */}
                    <td className="px-5 py-3 text-right">
                      <button 
                        onClick={() => handleClicarDelegar(alerta)}
                        className="px-3 py-1.5 border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ml-auto hover:bg-white/5 transition-all cursor-pointer relative"
                        style={{ 
                          borderColor: planoEmpresa === 'ESSENCIAL' ? 'var(--border)' : primary, 
                          color: planoEmpresa === 'ESSENCIAL' ? 'var(--foreground-muted)' : primary 
                        }}
                      >
                        {planoEmpresa === 'ESSENCIAL' ? (
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
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

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
