'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, CalendarClock, CheckCircle2, CreditCard, Loader2, Plus, Send, ShieldCheck, Users, Truck } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { ActionConfirmDialog } from '@/components/dashboard/ActionConfirmDialog'
import PaymentAccessCountdown, { type ResumoPagamento } from '@/components/dashboard/empresa/PaymentAccessCountdown'

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
  vencimentoProposto?: string | null
  diaVencimentoAtual?: number
  diaVencimentoProposto?: number
  perdas?: string[]
  bloqueios?: string[]
}

interface SolicitacaoAssinatura {
  id: string
  tipo: 'ALTERAR_PLANO' | 'ALTERAR_COTAS' | 'ALTERAR_VENCIMENTO' | 'NEGOCIAR_PAGAMENTO'
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
  vencimento: string | null
  pixCopiaECola: string | null
  comprovantePath: string | null
  comprovanteNome: string | null
  comprovanteEnviadoEm: string | null
  provedorPagamento: 'MANUAL' | 'ASAAS'
  gatewayPaymentId: string | null
  gatewayStatus: string | null
  gatewayBillingType: string | null
  gatewayInvoiceUrl: string | null
  gatewayErro: string | null
  gatewaySincronizadoEm: string | null
}

interface AssinaturaResponse {
  pagamento: ResumoPagamento
  empresa: {
    nome: string
    plano: PlanoId | 'PREVIEW'
    diaVencimento: number
    temDocumentoFiscal: boolean
    usuariosAdicionais: number
    veiculosAdicionais: number
    totalUsuarios: number
    totalVeiculos: number
    limiteUsuarios: number
    limiteVeiculos: number
    mensalidade: number
    condicaoComercial: {
      nome: string
      descricao: string | null
      precoBasePromocional: number
      precoBaseRenovacao: number
      mesesPromocionais: number
      ativadaEm: string
      taxaImplantacao: number
      primeiraMensalidadePaga: boolean
    } | null
  }
  planoAtual: PlanoAssinatura
  planos: PlanoAssinatura[]
  solicitacoes: SolicitacaoAssinatura[]
  faturasPendentes: FaturaPendente[]
  gateway: { enabled: boolean; ready: boolean; environment: 'sandbox' | 'production' }
  recorrenciaDisponivel: boolean
  recorrenciaPodeAderir: boolean
  recorrencia: {
    metodo: 'CARTAO' | 'PIX_AUTOMATICO'
    status: 'AGUARDANDO_ADESAO' | 'ATIVA' | 'CANCELADA' | 'FALHA'
    valor: number
    faturaInicialId: string
    adesaoUrl: string | null
    pixCopiaECola: string | null
    valorRenovacao: number | null
    renovacaoEm: string | null
    acaoFimPromocao: 'ATUALIZAR_VALOR' | 'DESATIVAR_RECORRENCIA' | null
    transicaoPromocaoStatus: 'AGENDADA' | 'PROCESSANDO' | 'CONFIRMADA' | 'FALHA' | null
  } | null
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const ORDEM: Record<PlanoId | 'PREVIEW', number> = { PREVIEW: 0, ESSENCIAL: 1, AVANCADO: 2, ENTERPRISE: 3 }

function dataCobranca(value: string | null) {
  if (!value) return 'data ainda não definida'
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function statusCobranca(fatura: Pick<FaturaPendente, 'gatewayStatus' | 'vencimento'>, agoraServidor: number) {
  const rotulos: Record<string, string> = {
    CONFIRMED: 'Pagamento confirmado',
    RECEIVED: 'Pagamento recebido',
    REFUNDED: 'Estornada',
    CREATING: 'Gerando cobrança',
    ERROR: 'Falha na cobrança',
  }
  if (fatura.gatewayStatus && rotulos[fatura.gatewayStatus]) return rotulos[fatura.gatewayStatus]
  if (fatura.vencimento && new Date(fatura.vencimento).getTime() > agoraServidor) return 'Fatura futura'
  return 'Fatura pendente'
}

function faturaFutura(fatura: Pick<FaturaPendente, 'vencimento'>, agoraServidor: number) {
  return Boolean(fatura.vencimento && new Date(fatura.vencimento).getTime() > agoraServidor)
}

function extrairImpacto(valor: ImpactoSolicitacao | null) {
  return {
    perdas: Array.isArray(valor?.perdas) ? valor.perdas : [],
    bloqueios: Array.isArray(valor?.bloqueios) ? valor.bloqueios : [],
  }
}

interface SubscriptionManagementProps {
  onNavigateProfile?: () => void
}

function CampoRecorrencia({ label, valor, onChange, autoComplete, maxLength }: {
  label: string
  valor: string
  onChange: (valor: string) => void
  autoComplete?: string
  maxLength: number
}) {
  return <label className="space-y-1 text-xs font-bold uppercase tracking-wide">
    <span>{label}</span>
    <input
      className="min-h-10 w-full border bg-transparent px-3 text-sm font-normal normal-case tracking-normal outline-none focus:ring-2"
      style={{ borderColor: 'var(--border)' }}
      value={valor}
      onChange={event => onChange(event.target.value)}
      autoComplete={autoComplete}
      maxLength={maxLength}
      required
    />
  </label>
}

export default function SubscriptionManagement({ onNavigateProfile }: SubscriptionManagementProps = {}) {
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
  const [vencimentoProposto, setVencimentoProposto] = useState('')
  const [diaVencimentoSolicitado, setDiaVencimentoSolicitado] = useState<number | null>(null)
  const [enviandoComprovante, setEnviandoComprovante] = useState('')
  const [gerandoCobranca, setGerandoCobranca] = useState('')
  const [iniciandoRecorrencia, setIniciandoRecorrencia] = useState(false)
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false)
  const [editandoDocumentoFiscal, setEditandoDocumentoFiscal] = useState(false)
  const [cnpjDocumentoFiscal, setCnpjDocumentoFiscal] = useState('')
  const [salvandoDocumentoFiscal, setSalvandoDocumentoFiscal] = useState(false)
  const [cadastroRecorrencia, setCadastroRecorrencia] = useState({
    telefone: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '',
  })

  const carregar = useCallback(async (signal?: AbortSignal, silencioso = false) => {
    if (!silencioso) setCarregando(true)
    try {
      const response = await fetch('/api/empresa/assinatura', { cache: 'no-store', signal })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível carregar a assinatura.')
      setDados(body)
      if (!silencioso) setFeedback('')
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      if (!silencioso) setFeedback(cause instanceof Error ? cause.message : 'Não foi possível carregar a assinatura.')
    } finally {
      if (!silencioso && !signal?.aborted) setCarregando(false)
    }
  }, [])

  const aderirCartaoRecorrente = async (faturaId?: string) => {
    setIniciandoRecorrencia(true); setFeedback('')
    try {
      const response = await fetch('/api/empresa/recorrencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(faturaId ? { faturaId } : {}), metodo: 'CARTAO', dadosCadastrais: cadastroRecorrencia }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível iniciar a adesão recorrente.')
      await carregar()
      setFeedback('Autorização iniciada. Abra o ambiente seguro para cadastrar o cartão; nenhuma mensalidade é considerada paga apenas por abrir o link.')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Não foi possível iniciar a adesão recorrente.')
    } finally { setIniciandoRecorrencia(false) }
  }

  const cancelarRecorrencia = async () => {
    setIniciandoRecorrencia(true); setFeedback('')
    try {
      const response = await fetch('/api/empresa/recorrencia', { method: 'DELETE' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível cancelar a recorrência.')
      await carregar()
      setFeedback(body.mensagem)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Não foi possível cancelar a recorrência.')
    } finally {
      setIniciandoRecorrencia(false)
      setConfirmarCancelamento(false)
    }
  }

  const salvarAcaoFimPromocao = async (acaoFimPromocao: 'ATUALIZAR_VALOR' | 'DESATIVAR_RECORRENCIA') => {
    setProcessando(true); setFeedback('')
    try {
      const response = await fetch('/api/empresa/recorrencia', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acaoFimPromocao }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível salvar a preferência.')
      await carregar()
      setFeedback(body.mensagem)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Não foi possível salvar a preferência.')
    } finally {
      setProcessando(false)
    }
  }

  const enviarComprovante = async (faturaId: string, arquivo: File | null) => {
    if (!arquivo) return
    if (arquivo.type !== 'application/pdf' || arquivo.size > 5 * 1024 * 1024) { setFeedback('Envie um comprovante PDF de até 5 MB.'); return }
    setEnviandoComprovante(faturaId); setFeedback('')
    try {
      const form = new FormData(); form.set('comprovante', arquivo)
      const response = await fetch(`/api/empresa/faturas/${faturaId}/comprovante`, { method: 'POST', body: form })
      const body = await response.json(); if (!response.ok) throw new Error(body.erro || 'Falha ao enviar comprovante.')
      await carregar(); setFeedback(body.mensagem)
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Falha ao enviar comprovante.') }
    finally { setEnviandoComprovante('') }
  }

  const gerarCobranca = async (faturaId: string, billingType: 'PIX' | 'UNDEFINED', segundaFaturaId?: string) => {
    setGerandoCobranca(faturaId); setFeedback('')
    try {
      const response = await fetch(`/api/empresa/faturas/${faturaId}/cobranca`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ billingType, segundaFaturaId }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível gerar a cobrança.')
      await carregar()
      setFeedback(segundaFaturaId ? 'Cobrança conjunta de implantação e mensalidade gerada.' : billingType === 'PIX' ? 'Cobrança Pix gerada com segurança.' : 'Cobrança criada. Abra o ambiente seguro para escolher cartão ou boleto.')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Não foi possível gerar a cobrança.')
    } finally {
      setGerandoCobranca('')
    }
  }

  const salvarDocumentoFiscal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cnpj = cnpjDocumentoFiscal.replace(/\D/g, '')
    if (cnpj.length !== 14) {
      setFeedback('Informe um CNPJ com 14 dígitos.')
      return
    }

    setSalvandoDocumentoFiscal(true)
    setFeedback('')
    try {
      const response = await fetch('/api/empresa/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível cadastrar o CNPJ.')
      await carregar()
      setEditandoDocumentoFiscal(false)
      setCnpjDocumentoFiscal('')
      setFeedback('CNPJ cadastrado. Agora você pode gerar a cobrança.')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o CNPJ.')
    } finally {
      setSalvandoDocumentoFiscal(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) void carregar(controller.signal)
    })
    return () => controller.abort()
  }, [carregar])

  const acompanharPagamento = Boolean(
    dados?.recorrencia?.status === 'AGUARDANDO_ADESAO'
    || dados?.faturasPendentes.some(fatura => fatura.gatewayPaymentId && fatura.gatewayStatus !== 'ERROR'),
  )

  useEffect(() => {
    if (!acompanharPagamento) return

    let consultaEmAndamento = false
    let ultimaConsulta = 0
    let controller: AbortController | null = null
    const atualizar = async () => {
      const agora = Date.now()
      if (document.hidden || consultaEmAndamento || agora - ultimaConsulta < 10_000) return
      consultaEmAndamento = true
      ultimaConsulta = agora
      controller = new AbortController()
      try {
        await carregar(controller.signal, true)
      } finally {
        consultaEmAndamento = false
      }
    }
    const aoRetomar = () => { if (!document.hidden) void atualizar() }
    const intervalo = window.setInterval(() => { void atualizar() }, 30_000)
    document.addEventListener('visibilitychange', aoRetomar)
    window.addEventListener('focus', aoRetomar)
    return () => {
      controller?.abort()
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoRetomar)
      window.removeEventListener('focus', aoRetomar)
    }
  }, [acompanharPagamento, carregar])

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
      setVencimentoProposto('')
      setDiaVencimentoSolicitado(null)
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
  const implantacaoPendente = dados.faturasPendentes.find(fatura => fatura.tipo === 'IMPLEMENTACAO' && fatura.valor > 0 && !fatura.gatewayPaymentId)
  const mensalidadeConjunta = implantacaoPendente && dados.faturasPendentes.find(fatura => fatura.tipo === 'MENSALIDADE' && fatura.valor > 0 && !fatura.gatewayPaymentId && fatura.mes === implantacaoPendente.mes && fatura.ano === implantacaoPendente.ano)
  const recorrenciaEmCurso = dados.recorrencia && ['AGUARDANDO_ADESAO', 'ATIVA'].includes(dados.recorrencia.status) ? dados.recorrencia : null
  const mensalidadeRecorrente = Boolean(recorrenciaEmCurso)
  const agoraServidor = new Date(dados.pagamento.servidorAgora).getTime()
  const faturasFuturas = dados.faturasPendentes.filter(fatura => faturaFutura(fatura, agoraServidor))
  const faturasVencidasOuSemPrazo = dados.faturasPendentes.length - faturasFuturas.length
  const mensalidadeParaRecorrencia = dados.faturasPendentes.find(fatura => fatura.tipo === 'MENSALIDADE' && !fatura.gatewayPaymentId
    && fatura.valor > 0 && fatura.vencimento && new Date(fatura.vencimento).getTime() > agoraServidor)
  const faturaDaRecorrencia = dados.recorrencia
    ? dados.faturasPendentes.find(fatura => fatura.id === dados.recorrencia?.faturaInicialId) ?? null
    : null
  const recorrenciaAtiva = dados.recorrencia?.status === 'ATIVA'
  const recorrenciaResumo = recorrenciaAtiva
    ? 'Cartão autorizado'
    : dados.recorrencia?.status === 'AGUARDANDO_ADESAO'
      ? 'Adesão incompleta'
      : dados.recorrencia?.status === 'FALHA'
        ? 'Falha na adesão'
        : dados.recorrencia?.status === 'CANCELADA'
          ? 'Cancelado'
          : 'Não configurado'
  const planoCotas = planoAtual ?? dados.planos[0]
  const mensalidadeComCotas = planoCotas
    ? dados.empresa.mensalidade
      + adicionarUsuarios * planoCotas.precoUsuarioAdicional
      + adicionarVeiculos * planoCotas.precoVeiculoAdicional
    : dados.empresa.mensalidade

  return (
    <div className="space-y-8">
      <section aria-labelledby="resumo-financeiro" className="border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <h2 id="resumo-financeiro" className="font-bold">Resumo financeiro</h2>
          <p className="mt-1 text-xs text-foreground-muted">Pagamento automático, situação do acesso e quitação de faturas são acompanhados separadamente.</p>
        </div>
        <div className="grid md:grid-cols-3 md:divide-x" style={{ borderColor: 'var(--border)' }}>
          <ResumoFinanceiroItem
            icon={<ShieldCheck size={17} />}
            label="Acesso da empresa"
            value={dados.pagamento.bloqueado ? 'Bloqueado' : 'Liberado'}
            description={dados.pagamento.bloqueado ? 'Regularize as cobranças vencidas para recuperar o acesso.' : 'O acesso permanece liberado enquanto não houver cobrança vencida.'}
            tone={dados.pagamento.bloqueado ? 'danger' : 'success'}
          />
          <ResumoFinanceiroItem
            icon={<CalendarClock size={17} />}
            label={faturasVencidasOuSemPrazo > 0 ? 'Cobranças pendentes' : faturasFuturas.length > 0 ? 'Faturas futuras' : 'Cobranças do plano'}
            value={dados.pagamento.valorPendente > 0 ? moeda.format(dados.pagamento.valorPendente) : 'Nenhuma'}
            description={dados.pagamento.valorPendente <= 0
              ? 'Não há valores aguardando pagamento.'
              : faturasVencidasOuSemPrazo > 0
                ? `${faturasVencidasOuSemPrazo} fatura(s) precisa(m) de pagamento. Próximo prazo: ${dataCobranca(dados.pagamento.vencimento)}.`
                : `${faturasFuturas.length} fatura(s) programada(s). Próximo vencimento: ${dataCobranca(dados.pagamento.vencimento)}.`}
            tone={faturasVencidasOuSemPrazo > 0 ? 'warning' : dados.pagamento.valorPendente > 0 ? 'neutral' : 'success'}
          />
          <ResumoFinanceiroItem
            icon={<CreditCard size={17} />}
            label="Pagamento automático"
            value={recorrenciaResumo}
            description={recorrenciaAtiva
              ? faturaDaRecorrencia ? `Próxima tentativa prevista para ${dataCobranca(faturaDaRecorrencia.vencimento)}.` : 'O cartão será cobrado automaticamente nas próximas mensalidades.'
              : 'Não confunda autorização do cartão com mensalidade paga.'}
            tone={recorrenciaAtiva ? 'success' : dados.recorrencia?.status === 'FALHA' ? 'danger' : 'neutral'}
          />
        </div>
      </section>
      <PaymentAccessCountdown pagamento={dados.pagamento} mostrarLinkGestao={false} />
      {feedback && <div role="status" aria-live="polite" className="border p-3 text-sm" style={{ borderColor: primary, color: primary }}>{feedback}</div>}
      {(dados.recorrenciaDisponivel || dados.recorrencia) && <section aria-label="Pagamento recorrente" className="border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
          <div>
            <h2 className="font-bold">Pagamento automático no cartão</h2>
            <p className="mt-1 text-xs text-foreground-muted">Autoriza cobranças futuras. Cada mensalidade só é quitada depois da confirmação do pagamento.</p>
          </div>
          <span className={`w-fit border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${recorrenciaAtiva ? 'border-green-500/40 text-green-500' : dados.recorrencia?.status === 'FALHA' ? 'border-red-500/40 text-red-500' : 'border-amber-500/40 text-amber-500'}`}>{recorrenciaResumo}</span>
        </div>
        {recorrenciaEmCurso ? <div className="mt-2 space-y-2 text-sm">
          <div className="mt-4 grid gap-3 border-y py-3 sm:grid-cols-3" style={{ borderColor: 'var(--border)' }}>
            <div><span className="block text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Forma autorizada</span><strong>Cartão de crédito</strong></div>
            <div><span className="block text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Valor mensal atual</span><strong>{moeda.format(recorrenciaEmCurso.valor)}</strong></div>
            <div><span className="block text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Próxima mensalidade</span><strong>{faturaDaRecorrencia ? dataCobranca(faturaDaRecorrencia.vencimento) : 'Será gerada automaticamente'}</strong></div>
          </div>
          {recorrenciaEmCurso.status === 'AGUARDANDO_ADESAO' && <div className="border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="font-bold text-amber-600">A autorização do cartão ainda não foi concluída.</p>
            <p className="mt-1 text-xs text-foreground-muted">Abra o ambiente seguro para terminar. Nenhuma fatura será considerada paga somente por iniciar esta etapa.</p>
          </div>}
          {recorrenciaEmCurso.adesaoUrl && recorrenciaEmCurso.status === 'AGUARDANDO_ADESAO' && <a className="inline-flex min-h-10 items-center border px-3 py-2 text-xs font-bold uppercase" style={{ borderColor: primary, color: primary }} href={recorrenciaEmCurso.adesaoUrl} target="_blank" rel="noreferrer">Concluir autorização do cartão</a>}
          {recorrenciaEmCurso.status === 'ATIVA' && <div className="border border-green-500/30 bg-green-500/10 p-3">
            <p className="flex items-center gap-2 font-bold text-green-600"><CheckCircle2 size={16} /> Cartão autorizado para as próximas cobranças</p>
            <p className="mt-1 text-xs text-foreground-muted">{faturaDaRecorrencia ? faturaFutura(faturaDaRecorrencia, agoraServidor)
              ? `A próxima mensalidade está programada para ${dataCobranca(faturaDaRecorrencia.vencimento)} e só será quitada após a confirmação do pagamento.`
              : 'A mensalidade já venceu e continua aguardando a confirmação do pagamento.'
              : 'As próximas mensalidades serão geradas e conciliadas automaticamente.'}</p>
          </div>}
          {recorrenciaEmCurso.status === 'ATIVA' && recorrenciaEmCurso.renovacaoEm && recorrenciaEmCurso.valorRenovacao !== null && (
            <div className="border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 shrink-0" size={17} style={{ color: primary }} />
                <div>
                  <p className="font-bold">Fim da condição promocional</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    A mensalidade com vencimento em {dataCobranca(recorrenciaEmCurso.renovacaoEm)} será de {moeda.format(recorrenciaEmCurso.valorRenovacao)}.
                    Você será avisado com antecedência e pode escolher o que acontecerá com o cartão automático.
                  </p>
                </div>
              </div>
              {recorrenciaEmCurso.transicaoPromocaoStatus === 'AGENDADA' ? (
                <fieldset className="mt-4 grid gap-2 sm:grid-cols-2" disabled={processando}>
                  <legend className="sr-only">Escolha para o fim da promoção</legend>
                  <button
                    type="button"
                    aria-pressed={recorrenciaEmCurso.acaoFimPromocao === 'ATUALIZAR_VALOR'}
                    onClick={() => void salvarAcaoFimPromocao('ATUALIZAR_VALOR')}
                    className="min-h-20 border p-3 text-left text-xs disabled:opacity-50"
                    style={{ borderColor: recorrenciaEmCurso.acaoFimPromocao === 'ATUALIZAR_VALOR' ? primary : 'var(--border)' }}
                  >
                    <strong className="block text-sm">Continuar automaticamente</strong>
                    Usar {moeda.format(recorrenciaEmCurso.valorRenovacao)} nas mensalidades após a promoção.
                  </button>
                  <button
                    type="button"
                    aria-pressed={recorrenciaEmCurso.acaoFimPromocao === 'DESATIVAR_RECORRENCIA'}
                    onClick={() => void salvarAcaoFimPromocao('DESATIVAR_RECORRENCIA')}
                    className="min-h-20 border p-3 text-left text-xs disabled:opacity-50"
                    style={{ borderColor: recorrenciaEmCurso.acaoFimPromocao === 'DESATIVAR_RECORRENCIA' ? '#f59e0b' : 'var(--border)' }}
                  >
                    <strong className="block text-sm">Desativar ao fim da promoção</strong>
                    Preservar a última cobrança promocional e impedir novas cobranças integrais.
                  </button>
                </fieldset>
              ) : (
                <p role={recorrenciaEmCurso.transicaoPromocaoStatus === 'FALHA' ? 'alert' : 'status'} className="mt-4 border p-3 text-xs" style={{ borderColor: 'var(--border)' }}>
                  {recorrenciaEmCurso.transicaoPromocaoStatus === 'PROCESSANDO'
                    ? 'A alteração foi enviada e aguarda confirmação do processador de pagamentos.'
                    : recorrenciaEmCurso.transicaoPromocaoStatus === 'CONFIRMADA'
                      ? recorrenciaEmCurso.acaoFimPromocao === 'ATUALIZAR_VALOR'
                        ? 'O novo valor do pagamento automático foi confirmado.'
                        : 'A desativação ao fim da promoção foi confirmada.'
                      : 'A alteração não foi confirmada. Novas cobranças automáticas foram interrompidas e o suporte foi avisado.'}
                </p>
              )}
              <p className="mt-3 text-[11px] text-foreground-muted">A preparação técnica ocorre antes da geração da primeira cobrança integral. Isso não encurta a promoção nem cancela uma cobrança promocional já emitida.</p>
            </div>
          )}
          <button type="button" disabled={iniciandoRecorrencia} onClick={() => setConfirmarCancelamento(true)} className="border px-3 py-2 text-xs font-bold uppercase transition-colors hover:border-amber-500 hover:text-amber-600 disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>Desativar pagamento automático</button>
          <p className="text-xs text-foreground-muted">Desativar impede novas cobranças automáticas, mas não remove faturas já geradas ou valores pendentes.</p>
        </div> : <form className="mt-2 space-y-3 text-sm" onSubmit={event => {
          event.preventDefault()
          if (dados.recorrenciaPodeAderir) void aderirCartaoRecorrente(mensalidadeParaRecorrencia?.id)
        }}>
          <p className="text-foreground-muted">Cadastre um cartão no ambiente seguro de pagamento para que as próximas mensalidades sejam cobradas automaticamente no vencimento.</p>
          {dados.recorrencia?.status === 'FALHA' && <p role="alert" className="border border-amber-500/40 bg-amber-500/10 p-3 text-amber-600">A tentativa anterior não criou um checkout. Revise os dados e tente novamente.</p>}
          {dados.recorrencia?.status === 'CANCELADA' && <p className="border border-amber-500/40 bg-amber-500/10 p-3 text-amber-600">O pagamento automático foi desativado. As cobranças já emitidas continuam válidas. Quando a empresa estiver em dia, você poderá autorizar um cartão novamente.</p>}
          {dados.pagamento.bloqueado && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-red-500">Quite as cobranças vencidas para autorizar novamente o pagamento automático.</p>}
          {!dados.pagamento.bloqueado && !dados.recorrenciaPodeAderir && <p className="border border-amber-500/40 bg-amber-500/10 p-3 text-amber-600">Pague a primeira mensalidade para liberar o pagamento automático das próximas cobranças.</p>}
          {dados.recorrenciaPodeAderir ? <>
            <p className="text-xs text-foreground-muted">Esses dados serão enviados com segurança ao processador de pagamentos e não serão armazenados no RPM Truck.</p>
            {!mensalidadeParaRecorrencia && <p className="border p-3 text-xs text-foreground-muted" style={{ borderColor: 'var(--border)' }}>A empresa está em dia. Ao continuar, o sistema preparará automaticamente a próxima mensalidade e usará essa data para iniciar as cobranças no cartão.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoRecorrencia label="Telefone" valor={cadastroRecorrencia.telefone} onChange={telefone => setCadastroRecorrencia(atual => ({ ...atual, telefone }))} autoComplete="tel" maxLength={20} />
              <CampoRecorrencia label="CEP" valor={cadastroRecorrencia.cep} onChange={cep => setCadastroRecorrencia(atual => ({ ...atual, cep }))} autoComplete="postal-code" maxLength={10} />
              <CampoRecorrencia label="Logradouro" valor={cadastroRecorrencia.logradouro} onChange={logradouro => setCadastroRecorrencia(atual => ({ ...atual, logradouro }))} autoComplete="address-line1" maxLength={120} />
              <CampoRecorrencia label="Número" valor={cadastroRecorrencia.numero} onChange={numero => setCadastroRecorrencia(atual => ({ ...atual, numero }))} maxLength={20} />
              <CampoRecorrencia label="Bairro" valor={cadastroRecorrencia.bairro} onChange={bairro => setCadastroRecorrencia(atual => ({ ...atual, bairro }))} autoComplete="address-level3" maxLength={80} />
              <label className="space-y-1 text-xs font-bold uppercase tracking-wide">
                <span>Complemento (opcional)</span>
                <input className="min-h-10 w-full border bg-transparent px-3 text-sm font-normal normal-case tracking-normal outline-none focus:ring-2" style={{ borderColor: 'var(--border)' }} value={cadastroRecorrencia.complemento} onChange={event => setCadastroRecorrencia(atual => ({ ...atual, complemento: event.target.value }))} autoComplete="address-line2" maxLength={80} />
              </label>
            </div>
            <button type="submit" disabled={iniciandoRecorrencia} className="border px-3 py-2 text-xs font-bold uppercase disabled:opacity-50" style={{ borderColor: primary, color: primary }}>{iniciandoRecorrencia ? 'Preparando autorização...' : dados.recorrencia?.status === 'FALHA' ? 'Tentar autorização novamente' : dados.recorrencia?.status === 'CANCELADA' ? 'Autorizar cartão novamente' : 'Autorizar cartão para cobranças futuras'}</button>
          </> : null}
        </form>}
      </section>}
      <section aria-label="Pagamentos e pendências" className="border p-4" style={{ backgroundColor: 'var(--background-secondary)' }}>
        <h2 className="font-bold">Cobranças do plano</h2>
        <p className="mt-1 text-sm text-foreground-muted">Faturas antes do vencimento aparecem como futuras. Somente depois do prazo elas passam a ser exibidas como pendentes. Autorizar o cartão automático não marca uma cobrança como paga.</p>
        {dados.gateway.environment === 'sandbox' && <p className="mt-2 text-xs font-bold uppercase tracking-wider text-amber-500">Ambiente de testes: nenhuma cobrança real será concluída.</p>}
        {!dados.empresa.temDocumentoFiscal && (
          <div role="alert" className="mt-4 border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 shrink-0 text-amber-500" size={16} />Cadastre o CNPJ da empresa antes de gerar uma cobrança.</span>
              <button type="button" onClick={() => onNavigateProfile ? onNavigateProfile() : setEditandoDocumentoFiscal(atual => !atual)} className="min-h-10 border border-amber-500/60 px-3 text-xs font-bold uppercase text-amber-500">{editandoDocumentoFiscal && !onNavigateProfile ? 'Fechar cadastro' : 'Cadastrar CNPJ'}</button>
            </div>
            {editandoDocumentoFiscal && !onNavigateProfile && (
              <form className="mt-3 flex flex-col gap-3 border-t border-amber-500/30 pt-3 sm:flex-row sm:items-end" onSubmit={salvarDocumentoFiscal}>
                <label className="flex-1 space-y-1 text-xs font-bold uppercase tracking-wide">
                  <span>CNPJ da empresa</span>
                  <input
                    className="min-h-11 w-full border bg-transparent px-3 text-sm font-normal normal-case tracking-normal outline-none focus:ring-2"
                    style={{ borderColor: 'var(--border)' }}
                    value={cnpjDocumentoFiscal}
                    onChange={event => setCnpjDocumentoFiscal(event.target.value)}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={18}
                    placeholder="00.000.000/0000-00"
                    aria-describedby="cnpj-regularizacao-ajuda"
                    required
                  />
                  <span id="cnpj-regularizacao-ajuda" className="block font-normal normal-case tracking-normal text-foreground-muted">Usaremos este documento somente para identificar a empresa na cobrança.</span>
                </label>
                <button type="submit" disabled={salvandoDocumentoFiscal} className="min-h-11 border px-4 text-xs font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: primary, color: primary }}>{salvandoDocumentoFiscal ? 'Salvando...' : 'Salvar CNPJ'}</button>
              </form>
            )}
          </div>
        )}
        {implantacaoPendente && mensalidadeConjunta && !mensalidadeRecorrente && (
          <div className="mt-4 border p-4" style={{ borderColor: primary }}>
            <p className="font-bold">Pagar implantação e primeira mensalidade juntas</p>
            <p className="mt-1 text-sm text-foreground-muted">Uma cobrança de {moeda.format(implantacaoPendente.valor + mensalidadeConjunta.valor)} para quitar as duas faturas. Você também pode gerar cada uma separadamente abaixo.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={Boolean(gerandoCobranca)} onClick={() => void gerarCobranca(implantacaoPendente.id, 'PIX', mensalidadeConjunta.id)} className="border px-3 py-2 text-xs font-bold uppercase disabled:opacity-50" style={{ borderColor: primary, color: primary }}>Pagar juntas por Pix</button>
              <button type="button" disabled={Boolean(gerandoCobranca)} onClick={() => void gerarCobranca(implantacaoPendente.id, 'UNDEFINED', mensalidadeConjunta.id)} className="border px-3 py-2 text-xs font-bold uppercase disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>Pagar juntas com cartão ou boleto</button>
            </div>
          </div>
        )}
        {dados.faturasPendentes.length === 0 ? <div className="mt-4 border border-dashed p-6 text-center"><CheckCircle2 className="mx-auto text-green-500" size={22} /><p className="mt-2 text-sm font-bold">Tudo em dia</p><p className="mt-1 text-xs text-foreground-muted">Nenhuma cobrança está aguardando pagamento.</p></div> : <ul className="mt-4 space-y-3 text-sm">{dados.faturasPendentes.map(fatura => {
          const futura = faturaFutura(fatura, agoraServidor)
          return (
          <li key={fatura.id} className="border p-4" style={{ borderColor: futura ? 'color-mix(in srgb, var(--primary) 35%, var(--border))' : 'var(--border)' }}>
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div>
                <strong>{fatura.tipo === 'IMPLEMENTACAO' ? 'Implantação' : 'Mensalidade'} de {fatura.mes}/{fatura.ano}</strong>
                <p className="mt-1 text-xs text-foreground-muted">{fatura.vencimento ? `Pague até ${dataCobranca(fatura.vencimento)} para evitar bloqueio após o prazo.` : 'Prazo a confirmar com o suporte.'}</p>
              </div>
              <div className="sm:text-right">
                <strong className="text-base">{moeda.format(fatura.valor)}</strong>
                <span className={`mt-1 block text-[10px] font-bold uppercase tracking-wider ${futura ? 'text-blue-500' : 'text-amber-500'}`}>{statusCobranca(fatura, agoraServidor)}</span>
              </div>
            </div>
            <div className="mt-3 flex w-full flex-wrap gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              {!fatura.gatewayPaymentId && !(fatura.tipo === 'MENSALIDADE' && mensalidadeRecorrente) && <><button type="button" disabled={Boolean(gerandoCobranca)} onClick={() => void gerarCobranca(fatura.id, 'PIX')} className="border px-3 py-2 text-[10px] font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: primary, color: primary }}>{gerandoCobranca === fatura.id ? 'Gerando...' : 'Pagar por Pix'}</button><button type="button" disabled={Boolean(gerandoCobranca)} onClick={() => void gerarCobranca(fatura.id, 'UNDEFINED')} className="border px-3 py-2 text-[10px] font-bold uppercase disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>Pagar com cartão ou boleto</button></>}
              {fatura.gatewayPaymentId && fatura.gatewayBillingType === 'PIX' && <a href={`/api/empresa/faturas/${fatura.id}/pix-qr`} target="_blank" rel="noreferrer" className="border px-3 py-2 text-[10px] font-bold uppercase" style={{ borderColor: primary, color: primary }}>Visualizar QR Pix</a>}
              {fatura.gatewayInvoiceUrl && fatura.gatewayStatus !== 'REFUNDED' && <a href={fatura.gatewayInvoiceUrl} target="_blank" rel="noreferrer" className="border px-3 py-2 text-[10px] font-bold uppercase" style={{ borderColor: primary, color: primary }}>Continuar pagamento</a>}
              {fatura.pixCopiaECola && <button type="button" onClick={() => void navigator.clipboard.writeText(fatura.pixCopiaECola!)} className="border px-3 py-2 text-[10px] font-bold uppercase" style={{ borderColor: 'var(--border)' }}>Copiar código Pix</button>}
              <label className="cursor-pointer border px-3 py-2 text-[10px] font-bold uppercase" style={{ borderColor: 'var(--border)' }}><input className="sr-only" type="file" accept="application/pdf" disabled={enviandoComprovante === fatura.id} onChange={(event) => void enviarComprovante(fatura.id, event.currentTarget.files?.[0] ?? null)} />{enviandoComprovante === fatura.id ? 'Enviando...' : fatura.comprovantePath ? 'Substituir comprovante PDF' : 'Comprovante PDF opcional'}</label>
              {fatura.comprovantePath && <a href={`/api/empresa/faturas/${fatura.id}/comprovante`} target="_blank" rel="noreferrer" className="px-2 py-2 text-[10px] font-bold uppercase" style={{ color: primary }}>Visualizar enviado</a>}
              {!dados.gateway.ready && <span className="self-center text-xs text-foreground-muted">Pagamentos online temporariamente indisponíveis. Tente novamente mais tarde.</span>}
            </div>
          </li>
        )})}</ul>}
      </section>
      <section className="border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: primary }}>{dados.pagamento.bloqueado ? 'Acesso operacional bloqueado' : 'Seu plano'}</div>
            <h3 className="mt-2 text-3xl font-black uppercase font-rajdhani">Plano {dados.empresa.plano}</h3>
          </div>
          <div className="text-left md:text-right">
            <div className="text-3xl font-black font-rajdhani" style={{ color: primary }}>{moeda.format(dados.empresa.mensalidade)}</div>
            <div className="text-[10px] uppercase tracking-widest text-foreground-muted">mensalidade atual calculada</div>
          </div>
        </div>
        {dados.empresa.condicaoComercial && (
          <div className="mb-6 border border-green-500/35 bg-green-500/10 p-4">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-green-600">Condição de empresa fundadora</p>
                <h4 className="mt-1 font-bold">{dados.empresa.condicaoComercial.nome}</h4>
                {dados.empresa.condicaoComercial.descricao && <p className="mt-1 text-xs text-foreground-muted">{dados.empresa.condicaoComercial.descricao}</p>}
              </div>
              <span className="w-fit border border-green-500/40 px-2 py-1 text-[10px] font-black uppercase text-green-600">Uma das 5 fundadoras</span>
            </div>
            <dl className="mt-4 grid gap-3 border-y py-3 sm:grid-cols-3" style={{ borderColor: 'var(--border)' }}>
              <div><dt className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Período promocional</dt><dd className="mt-1 font-bold">{moeda.format(dados.empresa.condicaoComercial.precoBasePromocional)}/mês por {dados.empresa.condicaoComercial.mesesPromocionais} mensalidades</dd></div>
              <div><dt className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Depois da promoção</dt><dd className="mt-1 font-bold">{moeda.format(dados.empresa.condicaoComercial.precoBaseRenovacao)}/mês de base</dd></div>
              <div><dt className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Implantação</dt><dd className="mt-1 font-bold">{dados.empresa.condicaoComercial.taxaImplantacao === 0 ? 'Isenta' : moeda.format(dados.empresa.condicaoComercial.taxaImplantacao)}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-foreground-muted">Condição iniciada em {dataCobranca(dados.empresa.condicaoComercial.ativadaEm)}. Usuários e veículos adicionais são somados ao preço-base conforme os valores exibidos abaixo.</p>
            {!dados.empresa.condicaoComercial.primeiraMensalidadePaga && <p role="status" className="mt-3 border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-bold text-amber-600">Sua condição de fundadora está registrada. Pague a primeira mensalidade até o vencimento para concluir a adesão ao plano.</p>}
          </div>
        )}
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
                disabled={atual || processando || dados.pagamento.bloqueado}
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
                  disabled={processando || dados.pagamento.bloqueado}
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
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h3 className="text-xl font-black uppercase font-rajdhani">Dia fixo da mensalidade</h3>
            <p className="mt-1 max-w-2xl text-sm text-foreground-muted">O vencimento atual é todo dia {dados.empresa.diaVencimento}. A empresa pode solicitar outro dia, mas a mudança só vale para ciclos futuros depois da aprovação do SuperAdmin.</p>
          </div>
          <span className="w-fit border px-3 py-2 text-xs font-black uppercase" style={{ borderColor: primary, color: primary }}>Dia {dados.empresa.diaVencimento}</span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-end">
          <label className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Novo dia desejado
            <select value={diaVencimentoSolicitado ?? dados.empresa.diaVencimento} onChange={event => setDiaVencimentoSolicitado(Number(event.target.value))} className="mt-2 min-h-11 w-full border bg-background px-3 text-sm text-foreground" style={{ borderColor: 'var(--border)' }}>
              {Array.from({ length: 28 }, (_, index) => index + 1).map(dia => <option key={dia} value={dia}>Todo dia {dia}</option>)}
            </select>
          </label>
          <button
            type="button"
            disabled={processando || dados.pagamento.bloqueado || diaVencimentoSolicitado === null || diaVencimentoSolicitado === dados.empresa.diaVencimento}
            onClick={() => void enviar({ tipo: 'ALTERAR_VENCIMENTO', diaVencimento: diaVencimentoSolicitado }, 'Solicitação de novo dia de vencimento enviada para aprovação.')}
            className="min-h-11 w-fit px-5 text-xs font-black uppercase tracking-wider disabled:opacity-40"
            style={{ backgroundColor: primary, color: '#000' }}
          >
            Solicitar alteração
          </button>
        </div>
        <p className="mt-4 text-xs text-foreground-muted">Faturas já emitidas mantêm o vencimento original. Se o cartão automático estiver ativo, desative-o antes de solicitar; após a aprovação, será possível autorizá-lo novamente com o novo dia.</p>
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
            disabled={processando || dados.pagamento.bloqueado || (adicionarUsuarios === 0 && adicionarVeiculos === 0)}
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
          <p className="text-sm text-foreground-muted">Não existem faturas em aberto para negociação.</p>
        ) : (
          <div className="space-y-4">
            <select value={faturaId} onChange={(event) => setFaturaId(event.target.value)} className="w-full border bg-background p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
              <option value="">Selecione uma fatura em aberto</option>
              {dados.faturasPendentes.map((fatura) => <option key={fatura.id} value={fatura.id}>{fatura.mes}/{fatura.ano} · {fatura.tipo} · {moeda.format(fatura.valor)}</option>)}
            </select>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground-muted">Nova data desejada (opcional)
              <input type="date" value={vencimentoProposto} onChange={(event) => setVencimentoProposto(event.target.value)} className="mt-2 block min-h-11 w-full border bg-background px-3 text-sm text-foreground" style={{ borderColor: 'var(--border)' }} />
            </label>
            <textarea value={mensagemNegociacao} onChange={(event) => setMensagemNegociacao(event.target.value)} maxLength={1200} rows={4} placeholder="Descreva a proposta, datas ou condições que deseja negociar." className="w-full resize-none border bg-background p-3 text-sm outline-none" style={{ borderColor: 'var(--border)' }} />
            <p className="text-xs text-foreground-muted">A nova data só entra em vigor depois da aprovação do SuperAdmin. Se já houver cobrança emitida, solicite suporte para ajustar o pagamento existente.</p>
            <p className="text-xs text-foreground-muted">Não informe senhas, dados completos de cartão ou credenciais bancárias.</p>
            <button
              type="button"
              disabled={processando || !faturaId || mensagemNegociacao.trim().length < 10}
              onClick={() => void enviar({ tipo: 'NEGOCIAR_PAGAMENTO', faturaId, mensagem: mensagemNegociacao, ...(vencimentoProposto ? { vencimentoProposto } : {}) }, 'Pedido de negociação enviado.')}
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
                  {solicitacao.tipo === 'NEGOCIAR_PAGAMENTO' && solicitacao.impacto?.vencimentoProposto && <p className="mt-2 text-xs text-foreground-muted">Data solicitada: {new Date(`${solicitacao.impacto.vencimentoProposto}T12:00:00`).toLocaleDateString('pt-BR')}</p>}
                  {solicitacao.tipo === 'ALTERAR_VENCIMENTO' && solicitacao.impacto?.diaVencimentoProposto && <p className="mt-2 text-xs text-foreground-muted">Vencimento solicitado: dia {solicitacao.impacto.diaVencimentoProposto} de cada mês.</p>}
                  {solicitacao.respostaAdmin && <p className="mt-3 border-t pt-3 text-sm text-foreground-muted" style={{ borderColor: 'var(--border)' }}>Resposta: {solicitacao.respostaAdmin}</p>}
                </div>
              )
            })}
          </div>
        )}
        {pendencias.length > 0 && <p className="mt-3 text-xs text-foreground-muted">Existem {pendencias.length} solicitação(ões) aguardando análise.</p>}
      </section>
      <ActionConfirmDialog
        open={confirmarCancelamento}
        title="Desativar pagamento automático"
        description="O cartão deixará de receber novas cobranças automáticas. A mensalidade vencida e outras faturas já emitidas continuarão pendentes até o pagamento."
        eyebrow="Cobranças futuras"
        confirmLabel="Desativar recorrência"
        loadingLabel="Desativando..."
        cancelLabel="Manter pagamento automático"
        tone="warning"
        loading={iniciandoRecorrencia}
        onClose={() => { if (!iniciandoRecorrencia) setConfirmarCancelamento(false) }}
        onConfirm={() => void cancelarRecorrencia()}
      />
    </div>
  )
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="border p-3" style={{ borderColor: 'var(--border)' }}><div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-foreground-muted">{icon}{label}</div><div className="mt-2 text-lg font-black">{value}</div></div>
}

function ResumoFinanceiroItem({
  icon,
  label,
  value,
  description,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  description: string
  tone: 'success' | 'warning' | 'danger' | 'neutral'
}) {
  const toneClass = tone === 'success'
    ? 'text-green-600'
    : tone === 'warning'
      ? 'text-amber-600'
      : tone === 'danger'
        ? 'text-red-600'
        : 'text-foreground'

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
        <span className={toneClass} aria-hidden="true">{icon}</span>
        {label}
      </div>
      <div className={`mt-2 text-lg font-black ${toneClass}`}>{value}</div>
      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{description}</p>
    </div>
  )
}

function NumberField({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return <label className="block text-xs font-bold uppercase tracking-wider text-foreground-muted">{label}<input type="number" min={0} max={max} value={value} onChange={(event) => onChange(Math.min(max, Math.max(0, Number.parseInt(event.target.value || '0', 10))))} className="mt-2 w-full border bg-background p-3 text-foreground outline-none" style={{ borderColor: 'var(--border)' }} /></label>
}

function Status({ status }: { status: SolicitacaoAssinatura['status'] }) {
  const classes = status === 'APROVADA' ? 'border-green-500/30 text-green-500' : status === 'REJEITADA' ? 'border-red-500/30 text-red-500' : 'border-amber-500/30 text-amber-500'
  return <span className={`w-fit border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${classes}`}>{status}</span>
}
