'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CircleDollarSign,
  Fuel,
  Gauge,
  Info,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
  Wrench,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { DominoLoader } from '@/components/motion/OperationalFeedback'

type PeriodoMeses = 3 | 6 | 12 | 24 | 36

interface InteligenciaFrotaResponse {
  periodo: { meses: number; inicio: string; fim: string }
  resumo: {
    custoTotal: number
    custoMedioKm: number | null
    saldoOperacoesConhecido: number | null
    veiculosAnalisados: number
    veiculosComCustoKm: number
    despesasForaPadrao: number | null
    manutencoesAtrasadas: number | null
  }
  desempenhoVeiculos: Array<{
    id: string
    placa: string
    modelo: string
    status: string
    custo: number
    receitaConhecida: number | null
    saldoConhecido: number | null
    kmRodados: number | null
    custoPorKm: number | null
    coberturaKm: 'COMPLETA' | 'INSUFICIENTE'
  }>
  previsoesManutencao: Array<{
    veiculoId: string
    placa: string
    modelo: string
    tipo: string
    dataPrevista: string
    origem: 'AGENDADA' | 'ESTIMADA'
    confianca: 'ALTA' | 'MEDIA' | 'BAIXA'
    situacao: 'ATRASADA' | 'PROGRAMADA' | 'ATENCAO' | 'PREVISTA'
  }>
  combustivelMensal: Array<{ mes: string; rotulo: string; valor: number; variacaoPercentual: number | null }>
  despesasForaPadrao: Array<{
    id: string
    data: string
    categoria: string
    descricao: string
    valor: number
    referencia: number
    percentualAcima: number | null
  }>
  rentabilidadeOperacoes: Array<{
    id: string
    codigo: string
    data: string
    rota: string
    status: string
    receita: number
    custoConhecido: number
    saldoConhecido: number
    margemConhecidaPercentual: number | null
    custosCompletos: boolean
  }>
  recomendacoes: Array<{
    id: string
    prioridade: 'ALTA' | 'MEDIA' | 'BAIXA'
    titulo: string
    descricao: string
    destino: string
  }>
  metodologia: Record<string, string>
  recursos: {
    nivel: 'BASICA' | 'AVANCADA' | 'COMPLETA'
    mesesMaximos: 3 | 12 | 36
    previsaoManutencao: boolean
    despesasForaPadrao: boolean
    rentabilidadeOperacao: boolean
  }
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const dataCurta = new Intl.DateTimeFormat('pt-BR')

function corSaldo(valor: number) {
  return valor < 0 ? '#ef4444' : '#22c55e'
}

function labelCategoria(categoria: string) {
  return categoria.replaceAll('_', ' ').toLocaleLowerCase('pt-BR').replace(/^./, (letra) => letra.toLocaleUpperCase('pt-BR'))
}

export default function InteligenciaFrotaPage() {
  const { primary } = useTheme()
  const [meses, setMeses] = useState<PeriodoMeses>(3)
  const [dados, setDados] = useState<InteligenciaFrotaResponse | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setCarregando(true)
    setErro('')
    try {
      const response = await fetch(`/api/inteligencia-frota?meses=${meses}`, { cache: 'no-store', signal })
      const body = await response.json()
      if (!response.ok) {
        if (response.status === 403) setDados(null)
        throw new Error(body.erro || 'Não foi possível analisar os dados da frota.')
      }
      setDados(body)
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') setErro(error.message)
    } finally {
      if (!signal?.aborted) setCarregando(false)
    }
  }, [meses])

  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => void carregar(controller.signal))
    return () => controller.abort()
  }, [carregar])

  if (carregando && !dados) return <DominoLoader label="Analisando custos, operações e manutenção da frota" />

  const maiorCombustivel = Math.max(...(dados?.combustivelMensal.map((item) => item.valor) ?? [0]), 1)

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 font-mono">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: primary }}><BrainCircuit size={15} /> Análise gerencial {dados && <span className="border px-2 py-1 text-[8px]" style={{ borderColor: primary }}>Nível {dados.recursos.nivel.toLocaleLowerCase('pt-BR')}</span>}</div>
          <h1 className="font-rajdhani text-2xl font-black uppercase tracking-tight sm:text-3xl">Central de Inteligência da Frota</h1>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-foreground-muted">Cruza custos, quilometragem, operações e manutenção para mostrar onde agir. Estimativas e dados incompletos são identificados na própria tela.</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="periodo-inteligencia" className="sr-only">Período da análise</label>
          <select id="periodo-inteligencia" value={meses} onChange={(event) => setMeses(Number(event.target.value) as PeriodoMeses)} className="min-h-11 border bg-background px-3 text-xs font-bold" style={{ borderColor: 'var(--border)' }}>
            <option value={3}>Últimos 3 meses</option>
            {(dados?.recursos.mesesMaximos ?? 3) >= 6 && <option value={6}>Últimos 6 meses</option>}
            {(dados?.recursos.mesesMaximos ?? 3) >= 12 && <option value={12}>Últimos 12 meses</option>}
            {(dados?.recursos.mesesMaximos ?? 3) >= 24 && <option value={24}>Últimos 24 meses</option>}
            {(dados?.recursos.mesesMaximos ?? 3) >= 36 && <option value={36}>Últimos 36 meses</option>}
          </select>
          <button type="button" onClick={() => void carregar()} disabled={carregando} aria-label="Atualizar análise" className="flex min-h-11 min-w-11 items-center justify-center border disabled:opacity-50" style={{ borderColor: primary, color: primary }}><RefreshCw size={17} className={carregando ? 'animate-spin motion-reduce:animate-none' : ''} /></button>
        </div>
      </header>

      {erro && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-red-500/50 bg-red-500/10 p-4 text-xs text-red-400"><span>{erro}</span><button type="button" onClick={() => void carregar()} className="min-h-10 border border-red-500/50 px-3 font-black uppercase">Tentar novamente</button></div>}

      {dados && (
        <>
          <section aria-label="Resumo da inteligência da frota" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi titulo="Custo analisado" valor={moeda.format(dados.resumo.custoTotal)} detalhe={`${dados.periodo.meses} meses de histórico`} icone={CircleDollarSign} primary={primary} />
            <Kpi titulo="Custo médio por km" valor={dados.resumo.custoMedioKm === null ? 'Sem base suficiente' : `${moeda.format(dados.resumo.custoMedioKm)}/km`} detalhe={`${dados.resumo.veiculosComCustoKm} de ${dados.resumo.veiculosAnalisados} veículos calculáveis`} icone={Gauge} primary={primary} />
            {dados.recursos.rentabilidadeOperacao ? <Kpi titulo="Saldo conhecido das operações" valor={moeda.format(dados.resumo.saldoOperacoesConhecido ?? 0)} detalhe="Receitas menos custos vinculados" icone={Route} primary={primary} cor={corSaldo(dados.resumo.saldoOperacoesConhecido ?? 0)} /> : <Kpi titulo="Veículos analisados" valor={String(dados.resumo.veiculosAnalisados)} detalhe="Visão básica do plano Essencial" icone={Truck} primary={primary} />}
            {dados.recursos.despesasForaPadrao && dados.recursos.previsaoManutencao ? <Kpi titulo="Pontos de atenção" valor={String((dados.resumo.despesasForaPadrao ?? 0) + (dados.resumo.manutencoesAtrasadas ?? 0))} detalhe={`${dados.resumo.despesasForaPadrao ?? 0} despesas · ${dados.resumo.manutencoesAtrasadas ?? 0} manutenções`} icone={AlertTriangle} primary={primary} cor={(dados.resumo.despesasForaPadrao ?? 0) + (dados.resumo.manutencoesAtrasadas ?? 0) > 0 ? '#f59e0b' : '#22c55e'} /> : <Kpi titulo="Cobertura de quilometragem" valor={`${dados.resumo.veiculosComCustoKm}/${dados.resumo.veiculosAnalisados}`} detalhe="Veículos com custo/km calculável" icone={Gauge} primary={primary} />}
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
            <Painel titulo="Veículos que mais exigem atenção financeira" subtitulo="O saldo é conhecido, não lucro contábil: depende das receitas e despesas vinculadas." icone={Truck} primary={primary}>
              {dados.desempenhoVeiculos.length === 0 ? <Vazio texto="Cadastre veículos e custos para iniciar a comparação." /> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="border-b text-[9px] uppercase tracking-widest text-foreground-muted" style={{ borderColor: 'var(--border)' }}><tr><th className="p-3">Veículo</th><th className="p-3 text-right">Custos</th>{dados.recursos.rentabilidadeOperacao && <><th className="p-3 text-right">Receita conhecida</th><th className="p-3 text-right">Saldo conhecido</th></>}<th className="p-3 text-right">Custo/km</th></tr></thead>
                    <tbody>{dados.desempenhoVeiculos.slice(0, 10).map((veiculo) => <tr key={veiculo.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}><td className="p-3"><strong className="block">{veiculo.placa}</strong><span className="text-[10px] text-foreground-muted">{veiculo.modelo}</span></td><td className="p-3 text-right">{moeda.format(veiculo.custo)}</td>{dados.recursos.rentabilidadeOperacao && <><td className="p-3 text-right">{moeda.format(veiculo.receitaConhecida ?? 0)}</td><td className="p-3 text-right font-black" style={{ color: corSaldo(veiculo.saldoConhecido ?? 0) }}>{moeda.format(veiculo.saldoConhecido ?? 0)}</td></>}<td className="p-3 text-right">{veiculo.custoPorKm === null ? <span title="São necessárias duas leituras de quilometragem no período" className="text-foreground-muted">Dados insuficientes</span> : `${moeda.format(veiculo.custoPorKm)}/km`}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </Painel>

            <Painel titulo="Ações recomendadas" subtitulo="Sugestões por regras objetivas, sem decisão automática." icone={Sparkles} primary={primary}>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>{dados.recomendacoes.map((item) => {
                const cor = item.prioridade === 'ALTA' ? '#ef4444' : item.prioridade === 'MEDIA' ? '#f59e0b' : '#22c55e'
                return <article key={item.id} className="py-4 first:pt-0 last:pb-0"><div className="flex items-start gap-3"><span className="mt-1 h-2 w-2 shrink-0" style={{ backgroundColor: cor }} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-black">{item.titulo}</h3><span className="text-[8px] font-black uppercase tracking-widest" style={{ color: cor }}>{item.prioridade}</span></div><p className="mt-1 text-[11px] leading-relaxed text-foreground-muted">{item.descricao}</p><Link href={item.destino} className="mt-2 inline-flex min-h-9 items-center gap-1 text-[9px] font-black uppercase" style={{ color: primary }}>Ver dados <ArrowRight size={12} /></Link></div></div></article>
              })}</div>
            </Painel>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <Painel titulo="Comparação mensal de combustível" subtitulo="Compara valores lançados; litros e autonomia ainda não são registrados." icone={Fuel} primary={primary}>
              <div className="space-y-3">{dados.combustivelMensal.map((item) => <div key={item.mes} className="grid grid-cols-[62px_1fr_auto] items-center gap-3"><span className="text-[10px] font-black uppercase text-foreground-muted">{item.rotulo}</span><div className="h-5 border p-0.5" style={{ borderColor: 'var(--border)' }}><div className="h-full min-w-px transition-[width] motion-reduce:transition-none" style={{ width: `${Math.max(1, (item.valor / maiorCombustivel) * 100)}%`, backgroundColor: primary }} /></div><div className="min-w-28 text-right"><strong className="text-xs">{moeda.format(item.valor)}</strong>{item.variacaoPercentual !== null && <span className={`ml-2 inline-flex items-center text-[9px] ${item.variacaoPercentual > 0 ? 'text-red-400' : 'text-green-500'}`}>{item.variacaoPercentual > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{numero.format(Math.abs(item.variacaoPercentual))}%</span>}</div></div>)}</div>
            </Painel>

            {dados.recursos.previsaoManutencao ? <Painel titulo="Previsão de manutenção" subtitulo="Agenda cadastrada tem prioridade; estimativas usam o intervalo histórico do veículo." icone={Wrench} primary={primary}>
              {dados.previsoesManutencao.length === 0 ? <Vazio texto="Registre ao menos duas manutenções concluídas ou uma manutenção futura." /> : <div className="space-y-2">{dados.previsoesManutencao.slice(0, 8).map((item) => {
                const cor = item.situacao === 'ATRASADA' ? '#ef4444' : item.situacao === 'ATENCAO' ? '#f59e0b' : '#22c55e'
                return <div key={`${item.veiculoId}-${item.dataPrevista}-${item.tipo}`} className="flex items-center justify-between gap-3 border p-3" style={{ borderColor: 'var(--border)' }}><div><strong className="block text-xs">{item.placa} · {item.tipo}</strong><span className="text-[10px] text-foreground-muted">{item.modelo} · {item.origem === 'AGENDADA' ? 'Data agendada' : `Estimativa de confiança ${item.confianca.toLocaleLowerCase('pt-BR')}`}</span></div><div className="text-right"><strong className="block text-xs" style={{ color: cor }}>{dataCurta.format(new Date(item.dataPrevista))}</strong><span className="text-[8px] font-black uppercase" style={{ color: cor }}>{item.situacao}</span></div></div>
              })}</div>}
            </Painel> : <RecursoBloqueado titulo="Previsão de manutenção" descricao="Estimativas pelo histórico e alertas de atraso estão disponíveis a partir do plano Avançado." primary={primary} />}
          </section>

          {dados.recursos.rentabilidadeOperacao ? <Painel titulo="Rentabilidade conhecida por operação" subtitulo="Não há cadastro de cliente contratante no modelo atual; por isso a comparação segura é por operação." icone={Route} primary={primary}>
            {dados.rentabilidadeOperacoes.length === 0 ? <Vazio texto="Registre operações com frete para calcular a margem conhecida." /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b text-[9px] uppercase tracking-widest text-foreground-muted" style={{ borderColor: 'var(--border)' }}><tr><th className="p-3">Operação</th><th className="p-3">Rota</th><th className="p-3 text-right">Frete</th><th className="p-3 text-right">Custos vinculados</th><th className="p-3 text-right">Saldo conhecido</th><th className="p-3 text-right">Cobertura</th></tr></thead><tbody>{dados.rentabilidadeOperacoes.slice(0, 12).map((operacao) => <tr key={operacao.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}><td className="p-3"><strong className="block">{operacao.codigo}</strong><span className="text-[10px] text-foreground-muted">{dataCurta.format(new Date(operacao.data))} · {operacao.status}</span></td><td className="max-w-72 truncate p-3">{operacao.rota}</td><td className="p-3 text-right">{moeda.format(operacao.receita)}</td><td className="p-3 text-right">{moeda.format(operacao.custoConhecido)}</td><td className="p-3 text-right font-black" style={{ color: corSaldo(operacao.saldoConhecido) }}>{moeda.format(operacao.saldoConhecido)}<span className="block text-[9px] font-normal">{operacao.margemConhecidaPercentual === null ? '—' : `${numero.format(operacao.margemConhecidaPercentual)}%`}</span></td><td className="p-3 text-right"><span className="inline-flex items-center gap-1 text-[9px] font-bold" style={{ color: operacao.custosCompletos ? '#22c55e' : '#f59e0b' }}>{operacao.custosCompletos ? <ShieldCheck size={12} /> : <Info size={12} />}{operacao.custosCompletos ? 'Custos vinculados' : 'Parcial'}</span></td></tr>)}</tbody></table></div>}
          </Painel> : <RecursoBloqueado titulo="Rentabilidade por operação" descricao="O cruzamento de fretes e custos vinculados está disponível a partir do plano Avançado." primary={primary} />}

          <section className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
            {dados.recursos.despesasForaPadrao ? <Painel titulo="Despesas fora do padrão" subtitulo="Sinal estatístico para revisão; não significa erro ou fraude." icone={AlertTriangle} primary={primary}>
              {dados.despesasForaPadrao.length === 0 ? <Vazio texto="Nenhuma despesa discrepante com amostra suficiente foi encontrada." /> : <div className="space-y-2">{dados.despesasForaPadrao.map((item) => <div key={item.id} className="grid gap-2 border p-3 sm:grid-cols-[1fr_auto]" style={{ borderColor: 'var(--border)' }}><div><strong className="block text-xs">{item.descricao}</strong><span className="text-[10px] text-foreground-muted">{labelCategoria(item.categoria)} · {dataCurta.format(new Date(item.data))} · referência mediana {moeda.format(item.referencia)}</span></div><div className="text-left sm:text-right"><strong className="block text-sm text-amber-500">{moeda.format(item.valor)}</strong><span className="text-[9px] text-foreground-muted">{item.percentualAcima === null ? '' : `${numero.format(item.percentualAcima)}% acima`}</span></div></div>)}</div>}
            </Painel> : <RecursoBloqueado titulo="Despesas fora do padrão" descricao="A detecção estatística por categoria está disponível a partir do plano Avançado." primary={primary} />}

            <Painel titulo="Como os números são calculados" subtitulo="Transparência para apoiar decisões sem esconder limitações." icone={Info} primary={primary}>
              <dl className="space-y-4">{Object.entries(dados.metodologia).map(([chave, descricao]) => <div key={chave}><dt className="text-[9px] font-black uppercase tracking-widest" style={{ color: primary }}>{labelCategoria(chave)}</dt><dd className="mt-1 text-[11px] leading-relaxed text-foreground-muted">{descricao}</dd></div>)}</dl>
            </Painel>
          </section>
        </>
      )}
    </div>
  )
}

function Kpi({ titulo, valor, detalhe, icone: Icone, primary, cor }: { titulo: string; valor: string; detalhe: string; icone: typeof Truck; primary: string; cor?: string }) {
  return <article className="min-w-0 border p-4 sm:p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><div className="mb-4 flex items-start justify-between gap-3"><span className="text-[9px] font-black uppercase tracking-widest text-foreground-muted">{titulo}</span><Icone size={18} style={{ color: cor ?? primary }} /></div><strong className="block break-words font-rajdhani text-xl font-black sm:text-2xl" style={{ color: cor ?? 'var(--foreground)' }}>{valor}</strong><span className="mt-1 block text-[9px] uppercase leading-relaxed text-foreground-muted">{detalhe}</span></article>
}

function Painel({ titulo, subtitulo, icone: Icone, primary, children }: { titulo: string; subtitulo: string; icone: typeof Truck; primary: string; children: React.ReactNode }) {
  return <section className="border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><header className="flex items-start gap-3 border-b p-4" style={{ borderColor: 'var(--border)' }}><Icone size={17} className="mt-0.5 shrink-0" style={{ color: primary }} /><div><h2 className="text-xs font-black uppercase tracking-wider">{titulo}</h2><p className="mt-1 text-[10px] leading-relaxed text-foreground-muted">{subtitulo}</p></div></header><div className="p-4">{children}</div></section>
}

function RecursoBloqueado({ titulo, descricao, primary }: { titulo: string; descricao: string; primary: string }) {
  return <section className="flex min-h-48 flex-col justify-center border border-dashed p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: primary }}><ShieldCheck size={15} /> Inteligência avançada</div><h2 className="mt-3 text-sm font-black uppercase">{titulo}</h2><p className="mt-2 max-w-xl text-[11px] leading-relaxed text-foreground-muted">{descricao}</p><Link href="/dashboard/plano" className="mt-4 inline-flex min-h-10 w-fit items-center gap-2 border px-3 text-[9px] font-black uppercase" style={{ borderColor: primary, color: primary }}>Conhecer planos <ArrowRight size={12} /></Link></section>
}

function Vazio({ texto }: { texto: string }) {
  return <div className="py-8 text-center text-xs text-foreground-muted">{texto}</div>
}
