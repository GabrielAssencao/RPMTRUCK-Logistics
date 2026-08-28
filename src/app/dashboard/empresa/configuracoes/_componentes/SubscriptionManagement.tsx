'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, CreditCard, Loader2, Plus, Send, Users, Truck } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

type PlanoId = 'ESSENCIAL' | 'AVANCADO' | 'ENTERPRISE'

interface PlanoAssinatura {
  id: PlanoId | 'PREVIEW'
  nome: string
  descricao: string
  precoBase: number
  precoUsuarioAdicional: number
  precoVeiculoAdicional: number
  usuariosBase: number
  veiculosBase: number
  historicoAnos: number
  modulos: string[]
}

interface ImpactoSolicitacao {
  mudanca?: string
  perdas?: string[]
  bloqueios?: string[]
}

interface SolicitacaoAssinatura {
  id: string
  tipo: 'ALTERAR_PLANO' | 'ALTERAR_COTAS' | 'NEGOCIAR_PAGAMENTO'
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA'
  planoSolicitado: PlanoId | null
  usuariosAdicionaisSolicitados: number
  veiculosAdicionaisSolicitados: number
  mensalidadeAtual: number
  mensalidadeProposta: number
  impacto: ImpactoSolicitacao | null
  mensagem: string | null
  respostaAdmin: string | null
  criado_em: string
}

interface FaturaPendente {
  id: string
  mes: string
  ano: number
  tipo: string
  valor: number
}

interface AssinaturaResponse {
  empresa: {
    nome: string
    plano: PlanoId | 'PREVIEW'
    usuariosAdicionais: number
    veiculosAdicionais: number
    totalUsuarios: number
    totalVeiculos: number
    limiteUsuarios: number
    limiteVeiculos: number
    mensalidade: number
  }
  planoAtual: PlanoAssinatura
  planos: PlanoAssinatura[]
  solicitacoes: SolicitacaoAssinatura[]
  faturasPendentes: FaturaPendente[]
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const ORDEM: Record<PlanoId | 'PREVIEW', number> = { PREVIEW: 0, ESSENCIAL: 1, AVANCADO: 2, ENTERPRISE: 3 }

function extrairImpacto(valor: ImpactoSolicitacao | null) {
  return {
    perdas: Array.isArray(valor?.perdas) ? valor.perdas : [],
    bloqueios: Array.isArray(valor?.bloqueios) ? valor.bloqueios : [],
  }
}

export default function SubscriptionManagement() {
  const { primary } = useTheme()
  const [dados, setDados] = useState<AssinaturaResponse | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoId | null>(null)
  const [adicionarUsuarios, setAdicionarUsuarios] = useState(0)
  const [adicionarVeiculos, setAdicionarVeiculos] = useState(0)
  const [faturaId, setFaturaId] = useState('')
  const [mensagemNegociacao, setMensagemNegociacao] = useState('')

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setCarregando(true)
    try {
      const response = await fetch('/api/empresa/assinatura', { cache: 'no-store', signal })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível carregar a assinatura.')
      setDados(body)
      setFeedback('')
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setFeedback(cause instanceof Error ? cause.message : 'Não foi possível carregar a assinatura.')
    } finally {
      if (!signal?.aborted) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) void carregar(controller.signal)
    })
    return () => controller.abort()
  }, [carregar])

  const planoAtual = dados?.planoAtual
  const planoDestino = dados?.planos.find((plano) => plano.id === planoSelecionado)
  const previaPlano = useMemo(() => {
    if (!dados || !planoAtual || !planoDestino) return null
    const perdas: string[] = []
    const bloqueios: string[] = []
    const modulosPerdidos = planoAtual.modulos.filter((modulo) => !planoDestino.modulos.includes(modulo))
    if (planoDestino.historicoAnos < planoAtual.historicoAnos) {
      perdas.push(`Histórico online: ${planoAtual.historicoAnos} → ${planoDestino.historicoAnos} ano(s).`)
    }
    if (modulosPerdidos.length > 0) perdas.push(`Módulos removidos: ${modulosPerdidos.join(', ')}.`)
    const limiteUsuarios = planoDestino.usuariosBase + dados.empresa.usuariosAdicionais
    const limiteVeiculos = planoDestino.veiculosBase + dados.empresa.veiculosAdicionais
    if (dados.empresa.totalUsuarios > limiteUsuarios) bloqueios.push(`A empresa excederá o limite em ${dados.empresa.totalUsuarios - limiteUsuarios} usuário(s).`)
    if (dados.empresa.totalVeiculos > limiteVeiculos) bloqueios.push(`A empresa excederá o limite em ${dados.empresa.totalVeiculos - limiteVeiculos} veículo(s).`)
    return {
      perdas,
      bloqueios,
      mensalidade: planoDestino.precoBase
        + dados.empresa.usuariosAdicionais * planoDestino.precoUsuarioAdicional
        + dados.empresa.veiculosAdicionais * planoDestino.precoVeiculoAdicional,
      downgrade: ORDEM[planoDestino.id] < ORDEM[dados.empresa.plano],
    }
  }, [dados, planoAtual, planoDestino])

  const enviar = async (body: Record<string, unknown>, mensagemSucesso: string) => {
    setProcessando(true)
    setFeedback('')
    try {
      const response = await fetch('/api/empresa/assinatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível enviar a solicitação.')
      setPlanoSelecionado(null)
      setAdicionarUsuarios(0)
      setAdicionarVeiculos(0)
      setFaturaId('')
      setMensagemNegociacao('')
      await carregar()
      setFeedback(mensagemSucesso)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Não foi possível enviar a solicitação.')
    } finally {
      setProcessando(false)
    }
  }

  if (carregando && !dados) {
    return <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin" style={{ color: primary }} /></div>
  }
  if (!dados) {
    return <div role="alert" className="border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-500">{feedback}</div>
  }

  const pendencias = dados.solicitacoes.filter((solicitacao) => solicitacao.status === 'PENDENTE')
  const planoCotas = planoAtual ?? dados.planos[0]
  const mensalidadeComCotas = planoCotas
    ? dados.empresa.mensalidade
      + adicionarUsuarios * planoCotas.precoUsuarioAdicional
      + adicionarVeiculos * planoCotas.precoVeiculoAdicional
    : dados.empresa.mensalidade

  return (
    <div className="space-y-8">
      {feedback && <div role="status" className="border p-3 text-sm" style={{ borderColor: primary, color: primary }}>{feedback}</div>}

      <section className="border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: primary }}>Assinatura ativa</div>
            <h3 className="mt-2 text-3xl font-black uppercase font-rajdhani">Plano {dados.empresa.plano}</h3>
          </div>
          <div className="text-left md:text-right">
            <div className="text-3xl font-black font-rajdhani" style={{ color: primary }}>{moeda.format(dados.empresa.mensalidade)}</div>
            <div className="text-[10px] uppercase tracking-widest text-foreground-muted">mensalidade atual calculada</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Usuários" value={`${dados.empresa.totalUsuarios} / ${dados.empresa.limiteUsuarios}`} icon={<Users size={15} />} />
          <Metric label="Veículos" value={`${dados.empresa.totalVeiculos} / ${dados.empresa.limiteVeiculos}`} icon={<Truck size={15} />} />
          <Metric label="Usuários extras" value={String(dados.empresa.usuariosAdicionais)} icon={<Plus size={15} />} />
          <Metric label="Veículos extras" value={String(dados.empresa.veiculosAdicionais)} icon={<Plus size={15} />} />
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h3 className="text-xl font-black uppercase font-rajdhani">Alterar plano</h3>
          <p className="text-sm text-foreground-muted">A alteração só entra em vigor depois da aprovação do SuperAdmin.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {dados.planos.map((plano) => {
            if (plano.id === 'PREVIEW') return null
            const planoId = plano.id
            const atual = plano.id === dados.empresa.plano
            return (
              <button
                type="button"
                key={plano.id}
                disabled={atual || processando}
                onClick={() => setPlanoSelecionado(planoId)}
                className="border p-5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderColor: planoSelecionado === plano.id ? primary : 'var(--border)', backgroundColor: 'var(--background-secondary)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-black uppercase font-rajdhani">{plano.nome}</span>
                  {ORDEM[plano.id] > ORDEM[dados.empresa.plano] ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                </div>
                <div className="mt-2 text-xl font-black" style={{ color: primary }}>{moeda.format(plano.precoBase)}/mês</div>
                <p className="mt-2 text-xs text-foreground-muted">{plano.descricao}</p>
              </button>
            )
          })}
        </div>

        {planoSelecionado && previaPlano && (
          <div className="mt-4 border p-5" style={{ borderColor: previaPlano.downgrade ? '#f59e0b' : primary, backgroundColor: 'var(--background-secondary)' }}>
            <div className="flex items-start gap-3">
              {previaPlano.downgrade && <AlertTriangle className="mt-0.5 shrink-0 text-amber-500" size={18} />}
              <div className="flex-1">
                <div className="font-bold">Nova mensalidade estimada: {moeda.format(previaPlano.mensalidade)}</div>
                {previaPlano.perdas.map((perda) => <p key={perda} className="mt-2 text-sm text-amber-500">• {perda}</p>)}
                {previaPlano.bloqueios.map((bloqueio) => <p key={bloqueio} className="mt-2 text-sm text-red-500">• {bloqueio}</p>)}
                <button
                  type="button"
                  disabled={processando}
                  onClick={() => void enviar({ tipo: 'ALTERAR_PLANO', plano: planoSelecionado }, 'Solicitação de alteração de plano enviada.')}
                  className="mt-5 px-5 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-50"
                  style={{ backgroundColor: primary, color: '#000' }}
                >
                  Confirmar solicitação
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <h3 className="text-xl font-black uppercase font-rajdhani">Adicionar capacidade</h3>
        <p className="mb-5 text-sm text-foreground-muted">Os valores abaixo são adicionais mensais e serão confirmados pelo SuperAdmin.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField label={`Novos usuários (${moeda.format(planoCotas?.precoUsuarioAdicional ?? 0)}/mês cada)`} value={adicionarUsuarios} max={Math.max(0, 10_000 - dados.empresa.usuariosAdicionais)} onChange={setAdicionarUsuarios} />
          <NumberField label={`Novos veículos (${moeda.format(planoCotas?.precoVeiculoAdicional ?? 0)}/mês cada)`} value={adicionarVeiculos} max={Math.max(0, 100_000 - dados.empresa.veiculosAdicionais)} onChange={setAdicionarVeiculos} />
        </div>
        <div className="mt-5 flex flex-col justify-between gap-4 border-t pt-5 sm:flex-row sm:items-center" style={{ borderColor: 'var(--border)' }}>
          <div><span className="text-sm text-foreground-muted">Nova mensalidade estimada: </span><strong>{moeda.format(mensalidadeComCotas)}</strong></div>
          <button
            type="button"
            disabled={processando || (adicionarUsuarios === 0 && adicionarVeiculos === 0)}
            onClick={() => void enviar({ tipo: 'ALTERAR_COTAS', adicionarUsuarios, adicionarVeiculos }, 'Solicitação de capacidade enviada.')}
            className="px-5 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-40"
            style={{ backgroundColor: primary, color: '#000' }}
          >
            Solicitar adição
          </button>
        </div>
      </section>

      <section className="border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="mb-5 flex items-center gap-2"><CreditCard size={18} style={{ color: primary }} /><h3 className="text-xl font-black uppercase font-rajdhani">Negociar pagamento</h3></div>
        {dados.faturasPendentes.length === 0 ? (
          <p className="text-sm text-foreground-muted">Não existem faturas pendentes para negociação.</p>
        ) : (
          <div className="space-y-4">
            <select value={faturaId} onChange={(event) => setFaturaId(event.target.value)} className="w-full border bg-background p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
              <option value="">Selecione uma fatura pendente</option>
              {dados.faturasPendentes.map((fatura) => <option key={fatura.id} value={fatura.id}>{fatura.mes}/{fatura.ano} · {fatura.tipo} · {moeda.format(fatura.valor)}</option>)}
            </select>
            <textarea value={mensagemNegociacao} onChange={(event) => setMensagemNegociacao(event.target.value)} maxLength={1200} rows={4} placeholder="Descreva a proposta, datas ou condições que deseja negociar." className="w-full resize-none border bg-background p-3 text-sm outline-none" style={{ borderColor: 'var(--border)' }} />
            <p className="text-xs text-foreground-muted">Não informe senhas, dados completos de cartão ou credenciais bancárias.</p>
            <button
              type="button"
              disabled={processando || !faturaId || mensagemNegociacao.trim().length < 10}
              onClick={() => void enviar({ tipo: 'NEGOCIAR_PAGAMENTO', faturaId, mensagem: mensagemNegociacao }, 'Pedido de negociação enviado.')}
              className="flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-40"
              style={{ backgroundColor: primary, color: '#000' }}
            >
              <Send size={14} /> Enviar proposta
            </button>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-4 text-xl font-black uppercase font-rajdhani">Histórico de solicitações</h3>
        {dados.solicitacoes.length === 0 ? (
          <div className="border border-dashed p-8 text-center text-sm text-foreground-muted">Nenhuma solicitação registrada.</div>
        ) : (
          <div className="space-y-3">
            {dados.solicitacoes.map((solicitacao) => {
              const impacto = extrairImpacto(solicitacao.impacto)
              return (
                <div key={solicitacao.id} className="border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div><strong className="text-sm">{solicitacao.tipo.replaceAll('_', ' ')}</strong><div className="text-[10px] uppercase tracking-widest text-foreground-muted">{new Date(solicitacao.criado_em).toLocaleString('pt-BR')}</div></div>
                    <Status status={solicitacao.status} />
                  </div>
                  {impacto.perdas.map((perda) => <p key={perda} className="mt-2 text-xs text-amber-500">• {perda}</p>)}
                  {impacto.bloqueios.map((bloqueio) => <p key={bloqueio} className="mt-2 text-xs text-red-500">• {bloqueio}</p>)}
                  {solicitacao.respostaAdmin && <p className="mt-3 border-t pt-3 text-sm text-foreground-muted" style={{ borderColor: 'var(--border)' }}>Resposta: {solicitacao.respostaAdmin}</p>}
                </div>
              )
            })}
          </div>
        )}
        {pendencias.length > 0 && <p className="mt-3 text-xs text-foreground-muted">Existem {pendencias.length} solicitação(ões) aguardando análise.</p>}
      </section>
    </div>
  )
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="border p-3" style={{ borderColor: 'var(--border)' }}><div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-foreground-muted">{icon}{label}</div><div className="mt-2 text-lg font-black">{value}</div></div>
}

function NumberField({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return <label className="block text-xs font-bold uppercase tracking-wider text-foreground-muted">{label}<input type="number" min={0} max={max} value={value} onChange={(event) => onChange(Math.min(max, Math.max(0, Number.parseInt(event.target.value || '0', 10))))} className="mt-2 w-full border bg-background p-3 text-foreground outline-none" style={{ borderColor: 'var(--border)' }} /></label>
}

function Status({ status }: { status: SolicitacaoAssinatura['status'] }) {
  const classes = status === 'APROVADA' ? 'border-green-500/30 text-green-500' : status === 'REJEITADA' ? 'border-red-500/30 text-red-500' : 'border-amber-500/30 text-amber-500'
  return <span className={`w-fit border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${classes}`}>{status}</span>
}
