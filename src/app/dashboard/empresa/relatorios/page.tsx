'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import ArquivosContasPagar from '@/components/dashboard/ArquivosContasPagar'
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
  AlertCircle,
  Archive,
  CheckCircle2,
  ShieldCheck,
  Trash2
} from 'lucide-react'
import { exportarPdf } from '@/utils/exportPdf'
import { PLANOS_CONFIG, type PlanoTipo } from '@/utils/planos'

const RelatorioCustoVeiculoChart = dynamic(
  () => import('@/components/dashboard/empresa/RelatoriosCharts').then(modulo => modulo.RelatorioCustoVeiculoChart),
  { loading: () => <div className="h-full w-full animate-pulse bg-foreground/5" /> },
)
const RelatorioEficienciaChart = dynamic(
  () => import('@/components/dashboard/empresa/RelatoriosCharts').then(modulo => modulo.RelatorioEficienciaChart),
  { loading: () => <div className="h-full w-full animate-pulse bg-foreground/5" /> },
)

interface RelatorioArquivado {
  id: string
  nome_arquivo: string
  tamanho_bytes: number
  checksum_sha256: string
  periodo_inicio: string
  periodo_fim: string
  criado_em: string
  status: 'PRONTO_DOWNLOAD' | 'DOWNLOAD_REGISTRADO' | 'CONFIRMADO_GESTOR' | 'DADOS_PURGADOS' | 'ARQUIVO_REMOVIDO'
  gerado_automaticamente: boolean
  baixado_em?: string | null
  confirmado_em?: string | null
  dados_purgados_em?: string | null
  arquivo_removido_em?: string | null
  elegivel_purga_em: string
  pode_purgar: boolean
}

interface MetricasRelatorio {
  totalCustos: number
  kmAcumulado: number
  custoPorKmAcumulado: number
  veiculoMenorCusto: { placa: string; valor: number } | null
  veiculoMaiorManutencao: { placa: string; valor: number } | null
}

function calcularIntervalo(periodo: string, dataInicio: string, dataFim: string) {
  if (periodo === 'CUSTOMIZADO') return { inicio: dataInicio, fim: dataFim }
  const fim = new Date()
  const inicio = new Date(fim)
  if (periodo === 'ESTE_MES') inicio.setDate(1)
  if (periodo === 'TRIMESTRE') inicio.setMonth(inicio.getMonth() - 3)
  if (periodo === 'ULTIMOS_6_MESES') inicio.setMonth(inicio.getMonth() - 6)
  if (periodo === 'ANO_ATUAL') inicio.setMonth(inicio.getMonth() - 12)
  if (periodo === 'HISTORICO_2_ANOS') inicio.setFullYear(inicio.getFullYear() - 2)
  if (periodo === 'HISTORICO_3_ANOS') inicio.setFullYear(inicio.getFullYear() - 3)
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) }
}

export default function RelatoriosPage() {
  const { primary } = useTheme()
  const [montado, setMontado] = useState(false)
  
  // Contexto do Plano da Empresa
  const [planoEmpresa, setPlanoEmpresa] = useState<PlanoTipo>('ESSENCIAL')

  // Filtro de Tempo e Período
  const [periodo, setPeriodo] = useState('ESTE_MES')
  const [modalPersonalizarOpen, setModalPersonalizarOpen] = useState(false)
  const [mensagemExportacao, setMensagemExportacao] = useState('')
  const [arquivosPrivados, setArquivosPrivados] = useState<RelatorioArquivado[]>([])
  const [usoStorage, setUsoStorage] = useState({ uso_bytes: 0, uso_global_bytes: 0, limite_interno_bytes: 0, banco_uso_bytes: 0, banco_limite_bytes: 0, banco_percentual: 0 })
  const [arquivando, setArquivando] = useState(false)
  const [eficienciaMes, setEficienciaMes] = useState<Array<{ mes: string; custoKm: number; kmTotal: number }>>([])
  const [custoVeiculo, setCustoVeiculo] = useState<Array<{ veiculo: string; combustivel: number; manutencao: number }>>([])
  const [metricas, setMetricas] = useState<MetricasRelatorio>({
    totalCustos: 0,
    kmAcumulado: 0,
    custoPorKmAcumulado: 0,
    veiculoMenorCusto: null,
    veiculoMaiorManutencao: null,
  })

  // Intervalo Personalizado
  const dataHojeStr = new Date().toISOString().split('T')[0]
  const [dataInicio, setDataInicio] = useState(`${dataHojeStr.slice(0, 7)}-01`)
  const [dataFim, setDataFim] = useState(dataHojeStr)

  useEffect(() => {
    queueMicrotask(() => setMontado(true))
    const userData = localStorage.getItem('@rpmtruck:user')
    if (userData) {
      const parsed = JSON.parse(userData)
      const plano = parsed.empresaInfo?.plano ?? parsed.empresa?.plano
      if (plano && plano in PLANOS_CONFIG) queueMicrotask(() => setPlanoEmpresa(plano))
    }

    fetch('/api/relatorios/arquivos', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar os arquivos.')
        setArquivosPrivados(data.arquivos)
        setUsoStorage(data.armazenamento)
      })
      .catch((error) => setMensagemExportacao(error instanceof Error ? error.message : 'Erro ao carregar arquivos.'))

  }, [])

  useEffect(() => {
    const { inicio, fim } = calcularIntervalo(periodo, dataInicio, dataFim)
    const controller = new AbortController()
    fetch(`/api/relatorios/dados?inicio=${inicio}&fim=${fim}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.erro)
        setEficienciaMes(data.eficiencia)
        setCustoVeiculo(data.porVeiculo)
        setMetricas(data.metricas)
      })
      .catch(error => {
        if (error instanceof Error && error.name !== 'AbortError') setMensagemExportacao(error.message)
      })
    return () => controller.abort()
  }, [periodo, dataInicio, dataFim])

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
  const limiteDiasPlano = PLANOS_CONFIG[planoEmpresa].historicoAnos * 365

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

  const periodoDescricao = periodo === 'CUSTOMIZADO'
    ? `${new Date(`${dataInicio}T00:00:00`).toLocaleDateString('pt-BR')} a ${new Date(`${dataFim}T00:00:00`).toLocaleDateString('pt-BR')}`
    : OPCOES_PERIODO.find(opcao => opcao.id === periodo)?.label ?? periodo.replace(/_/g, ' ')

  const registrarExportacao = (mensagem: string) => {
    setMensagemExportacao(mensagem)
    window.setTimeout(() => setMensagemExportacao(''), 3500)
  }

  const carregarArquivosPrivados = async () => {
    const response = await fetch('/api/relatorios/arquivos', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar os arquivos.')
    setArquivosPrivados(data.arquivos)
    setUsoStorage(data.armazenamento)
  }

  const obterIntervaloSelecionado = () => {
    return calcularIntervalo(periodo, dataInicio, dataFim)
  }

  const handleGerarExcelServidor = async () => {
    setArquivando(true)
    try {
      const response = await fetch('/api/relatorios/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(obterIntervaloSelecionado()),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível gerar o Excel operacional.')

      await carregarArquivosPrivados()
      registrarExportacao('Excel operacional gerado e protegido no bucket privado.')
    } catch (error) {
      registrarExportacao(error instanceof Error ? error.message : 'Não foi possível gerar o Excel operacional.')
    } finally {
      setArquivando(false)
    }
  }

  const handleDownloadArquivado = async (id: string) => {
    try {
      const response = await fetch(`/api/relatorios/arquivos/${id}/download`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível liberar o download.')
      const link = document.createElement('a')
      link.href = data.url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.click()
      await carregarArquivosPrivados()
    } catch (error) {
      registrarExportacao(error instanceof Error ? error.message : 'Não foi possível liberar o download.')
    }
  }

  const formatarBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

  const handleConfirmarGuarda = async (id: string) => {
    try {
      const response = await fetch(`/api/relatorios/arquivos/${id}/confirmar`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível confirmar a guarda.')
      await carregarArquivosPrivados()
      registrarExportacao('Guarda do arquivo confirmada pelo gestor.')
    } catch (error) {
      registrarExportacao(error instanceof Error ? error.message : 'Não foi possível confirmar a guarda.')
    }
  }

  const handlePurgar = async (arquivo: RelatorioArquivado) => {
    if (!window.confirm('Esta ação excluirá os detalhes operacionais presentes no Excel e removerá o arquivo temporário. O histórico mínimo dos containers será preservado. Deseja continuar?')) return
    try {
      const response = await fetch(`/api/relatorios/arquivos/${arquivo.id}/purgar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmacao: 'EXCLUIR DADOS ARQUIVADOS' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível concluir a limpeza.')
      await carregarArquivosPrivados()
      registrarExportacao(data.aviso || 'Limpeza concluída e histórico permanente preservado.')
    } catch (error) {
      registrarExportacao(error instanceof Error ? error.message : 'Não foi possível concluir a limpeza.')
    }
  }

  const handleExportarPdf = () => {
    try {
      exportarPdf({
        titulo: 'Relatório operacional RPMTruck',
        subtitulo: `Período: ${periodoDescricao} · Plano ${planoEmpresa}`,
        metricas: [
          { rotulo: 'Custos no período', valor: metricas.totalCustos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
          { rotulo: 'Menor custo operacional', valor: metricas.veiculoMenorCusto?.placa ?? 'Sem dados' },
          { rotulo: 'Maior gasto manutenção', valor: metricas.veiculoMaiorManutencao?.placa ?? 'Sem dados' },
          { rotulo: 'KM percorridos no período', valor: `${metricas.kmAcumulado.toLocaleString('pt-BR')} KM` },
        ],
        secoes: [
          {
            titulo: 'Custos por veículo',
            colunas: ['Veículo', 'Combustível', 'Manutenção', 'Total'],
            linhas: custoVeiculo.map(linha => [
              linha.veiculo,
              linha.combustivel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
              linha.manutencao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
              (linha.combustivel + linha.manutencao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            ]),
          },
          {
            titulo: 'Eficiência mensal',
            colunas: ['Mês', 'Custo por KM', 'KM total'],
            linhas: eficienciaMes.map(linha => [linha.mes, `R$ ${linha.custoKm.toFixed(2)}`, linha.kmTotal.toLocaleString('pt-BR')]),
          },
        ],
      })
      registrarExportacao('Relatório aberto. Selecione “Salvar como PDF”.')
    } catch (erro) {
      registrarExportacao(erro instanceof Error ? erro.message : 'Não foi possível gerar o PDF.')
    }
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
            onClick={handleGerarExcelServidor}
            disabled={arquivando}
            className="flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all border hover:bg-white/5 cursor-pointer disabled:cursor-wait disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <FileSpreadsheet size={16} className="text-green-500" /> {arquivando ? 'GERANDO...' : 'GERAR EXCEL'}
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleExportarPdf}
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

      {mensagemExportacao && (
        <div className="border px-4 py-3 text-xs font-bold" role="status" style={{ borderColor: `${primary}55`, backgroundColor: `${primary}0d`, color: primary }}>
          {mensagemExportacao}
        </div>
      )}

      <section className="border p-4 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Archive size={18} style={{ color: primary }} />
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest">Arquivamento operacional privado</h2>
              <p className="text-[10px] text-foreground-muted">
                Empresa: {formatarBytes(usoStorage.uso_bytes)} · relatórios globais: {formatarBytes(usoStorage.uso_global_bytes)} de {formatarBytes(usoStorage.limite_interno_bytes)}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGerarExcelServidor}
            disabled={arquivando}
            className="flex items-center justify-center gap-2 border px-4 py-2 text-[10px] font-black uppercase disabled:cursor-wait disabled:opacity-40"
            style={{ borderColor: primary, color: primary }}
          >
            <FileSpreadsheet size={14} /> {arquivando ? 'Gerando...' : 'Gerar Excel do período'}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="border p-3 text-[10px]" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-2 flex items-center justify-between gap-2 font-bold uppercase">
              <span>Banco de dados</span>
              <span>{usoStorage.banco_percentual.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden bg-black/20" role="progressbar" aria-valuenow={usoStorage.banco_percentual} aria-valuemin={0} aria-valuemax={100} aria-label="Uso estimado do banco">
              <div className="h-full" style={{ width: `${Math.min(100, usoStorage.banco_percentual)}%`, backgroundColor: usoStorage.banco_percentual >= 80 ? '#ef4444' : primary }} />
            </div>
            <p className="mt-2 text-foreground-muted">{formatarBytes(usoStorage.banco_uso_bytes)} de {formatarBytes(usoStorage.banco_limite_bytes)} no plano Free.</p>
          </div>
          <div className="border p-3 text-[10px]" style={{ borderColor: 'var(--border)' }}>
            <p className="flex items-start gap-2 text-foreground-muted">
              <ShieldCheck size={15} className="mt-0.5 shrink-0" style={{ color: primary }} />
              Código, origem, destino e data de cada operação permanecem no banco. Frete, comissão, custos e manutenções só podem ser removidos após download, confirmação do gestor e fim da retenção do plano.
            </p>
          </div>
        </div>

        {arquivosPrivados.length > 0 ? (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {arquivosPrivados.slice(0, 10).map((arquivo) => (
              <div key={arquivo.id} className="flex flex-col gap-3 py-3 text-xs lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold truncate">{arquivo.nome_arquivo}</p>
                    <span className="border px-2 py-0.5 text-[8px] font-black uppercase" style={{ borderColor: 'var(--border)' }}>{arquivo.status.replaceAll('_', ' ')}</span>
                  </div>
                  <p className="text-[9px] text-foreground-muted">
                    {new Date(arquivo.periodo_inicio).toLocaleDateString('pt-BR')} a {new Date(arquivo.periodo_fim).toLocaleDateString('pt-BR')} · {formatarBytes(arquivo.tamanho_bytes)} · SHA-256 {arquivo.checksum_sha256.slice(0, 12)}…
                  </p>
                  {arquivo.confirmado_em && !arquivo.pode_purgar && !arquivo.dados_purgados_em && (
                    <p className="mt-1 text-[9px] text-foreground-muted">Retenção protegida até {new Date(arquivo.elegivel_purga_em).toLocaleDateString('pt-BR')}.</p>
                  )}
                  {arquivo.arquivo_removido_em && <p className="mt-1 text-[9px] text-green-500">Detalhes removidos; movimentações permanentes preservadas.</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!arquivo.arquivo_removido_em && (
                    <button type="button" onClick={() => handleDownloadArquivado(arquivo.id)} className="flex items-center gap-1 border px-3 py-2 text-[10px] font-bold uppercase" style={{ borderColor: 'var(--border)' }}>
                      <Download size={12} /> Baixar
                    </button>
                  )}
                  {arquivo.status === 'DOWNLOAD_REGISTRADO' && (
                    <button type="button" onClick={() => handleConfirmarGuarda(arquivo.id)} className="flex items-center gap-1 border px-3 py-2 text-[10px] font-bold uppercase" style={{ borderColor: primary, color: primary }}>
                      <CheckCircle2 size={12} /> Confirmar guarda
                    </button>
                  )}
                  {arquivo.pode_purgar && (
                    <button type="button" onClick={() => handlePurgar(arquivo)} className="flex items-center gap-1 border border-red-500/50 px-3 py-2 text-[10px] font-bold uppercase text-red-500">
                      <Trash2 size={12} /> Limpar detalhes
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-foreground-muted">Nenhum relatório gerado. Escolha um período com dados operacionais e gere o primeiro Excel.</p>
        )}
      </section>

      <ArquivosContasPagar limite={20} />

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
          titulo="Custos no Período"
          valor={metricas.totalCustos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          variacao="Somatório dos lançamentos reais"
          positivo={metricas.totalCustos === 0} icone={<TrendingDown size={20}/>} primary={primary}
        />
        <HighlightCard
          titulo="Menor Custo Operacional"
          valor={metricas.veiculoMenorCusto?.placa ?? 'Sem dados'}
          variacao={metricas.veiculoMenorCusto ? metricas.veiculoMenorCusto.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Nenhum custo no período'}
          positivo={true} icone={<Trophy size={20} className="text-yellow-500"/>} primary={primary} destaque
        />
        <HighlightCard
          titulo="Maior Gasto (Manut.)"
          valor={metricas.veiculoMaiorManutencao?.placa ?? 'Sem dados'}
          variacao={metricas.veiculoMaiorManutencao ? metricas.veiculoMaiorManutencao.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Nenhuma manutenção no período'}
          positivo={false} icone={<AlertTriangle size={20}/>} primary={primary} alerta
        />
        <HighlightCard
          titulo="KM Percorridos no Período"
          valor={`${metricas.kmAcumulado.toLocaleString('pt-BR')} KM`}
          variacao="Diferença entre leituras de odômetro"
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
            <RelatorioCustoVeiculoChart
              dados={custoVeiculo}
              corCombustivel={primary}
              corManutencao={corManutencaoAdaptativa}
            />
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
            <RelatorioEficienciaChart dados={eficienciaMes} cor={primary} />
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
