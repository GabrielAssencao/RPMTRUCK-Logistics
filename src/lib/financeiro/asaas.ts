import 'server-only'
import { Prisma } from '@prisma/client'
import { comOperacaoFinanceira, OperacaoFinanceiraError } from '@/lib/financeiro/operacaoFinanceira'

import { exposeEmpresa } from '@/lib/fieldEncryption'
import { prisma } from '@/lib/prisma'
import { montarReferenciaCobranca, somarCentavos } from '@/lib/financeiro/referenciaCobranca'
import { calcularMensalidadeEmpresa, obterPlanoComercial, obterTransicaoPromocionalEmpresa } from '@/lib/financeiro/planosComerciais'
import { avaliarSituacaoFinanceira, competenciaBrasil, limiteVencimentoMensal } from '@/lib/financeiro/situacaoFinanceira'
import { somenteDigitosTelefoneBR } from '@/utils/telefone'

type MetodoAsaas = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface ClienteAsaas { id: string }
interface ListaAsaas<T> { data: T[] }
interface CobrancaAsaas {
  id: string
  status: string
  billingType: string
  value?: number
  invoiceUrl?: string
  netValue?: number
}

interface CheckoutAsaas { id: string; link?: string; status?: string }
interface AssinaturaAsaas { id: string; value?: number; status?: string }

const MESES_COBRANCA = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const

export interface DadosCadastraisRecorrencia {
  telefone: string
  cep: string
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
}

export interface QrCodeAsaas {
  encodedImage: string
  payload: string
  expirationDate?: string
}

export class AsaasError extends OperacaoFinanceiraError {
  constructor(message: string, status = 502, resultadoIncerto = false) {
    super(message, status, resultadoIncerto)
    this.name = 'AsaasError'
  }
}

export function configuracaoAsaas() {
  const enabled = process.env.ASAAS_ENABLED === 'true'
  const environment = process.env.ASAAS_ENVIRONMENT === 'production' ? 'production' : 'sandbox'
  const apiKey = process.env.ASAAS_API_KEY?.trim()
  return {
    enabled,
    environment,
    apiKey,
    baseUrl: environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3',
    ready: enabled && Boolean(apiKey),
  }
}

export function origemCheckoutAsaas() {
  try {
    const url = new URL(process.env.ASAAS_CALLBACK_BASE_URL?.trim() || '')
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null
    return url.origin
  } catch {
    return null
  }
}

async function requisitarAsaas<T>(path: string, method: MetodoAsaas, body?: unknown): Promise<T> {
  const config = configuracaoAsaas()
  if (!config.ready || !config.apiKey) throw new AsaasError('A cobrança automática ainda não está configurada.', 503)

  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      access_token: config.apiKey,
      'user-agent': 'RPMTruck/0.2',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
    redirect: 'error',
  }).catch(() => { throw new AsaasError('Não foi possível confirmar a resposta do processador de pagamentos. Aguarde a conciliação antes de tentar novamente.', 503, true) })
  const payload = await response.json().catch(() => null) as { errors?: Array<{ description?: string }> } | T | null
  if (!response.ok) {
    const description = payload && typeof payload === 'object' && 'errors' in payload
      ? payload.errors?.map(item => item.description).filter(Boolean).join(' ')
      : null
    throw new AsaasError(description || 'O processador de pagamentos não conseguiu concluir a solicitação.', response.status >= 500 ? 502 : 422, response.status >= 500)
  }
  if (!payload && method === 'POST' && path.endsWith('/cancel')) return {} as T
  if (!payload) throw new AsaasError('O processador de pagamentos retornou uma resposta incompleta.', 502, true)
  return payload as T
}

function somenteDigitos(value: string | null | undefined) {
  return value?.replace(/\D/g, '') || ''
}

function dataAsaas(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(value)
}

async function obterOuCriarClienteAsaas(empresaId: string) {
  const row = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { id: true, nome: true, email: true, cnpj: true, cnpjHash: true, telefone: true, asaasCustomerId: true },
  })
  if (!row) throw new AsaasError('Empresa não encontrada.', 404)
  if (row.asaasCustomerId) return row.asaasCustomerId

  const empresa = exposeEmpresa(row)
  const cpfCnpj = somenteDigitos(empresa.cnpj)
  if (!cpfCnpj) throw new AsaasError('Informe o CNPJ da empresa em Configurações antes de gerar a cobrança.', 409)

  const existentes = await requisitarAsaas<ListaAsaas<ClienteAsaas>>(
    `/customers?externalReference=${encodeURIComponent(empresa.id)}&limit=1`, 'GET',
  )
  const cliente = existentes.data[0] ?? await requisitarAsaas<ClienteAsaas>('/customers', 'POST', {
    name: empresa.nome,
    cpfCnpj,
    email: empresa.email,
    mobilePhone: somenteDigitos(empresa.telefone) || undefined,
    externalReference: empresa.id,
    notificationDisabled: false,
  })

  const atualizado = await prisma.empresa.updateMany({
    where: { id: empresa.id, asaasCustomerId: null },
    data: { asaasCustomerId: cliente.id },
  })
  if (atualizado.count === 0) {
    return (await prisma.empresa.findUniqueOrThrow({ where: { id: empresa.id }, select: { asaasCustomerId: true } })).asaasCustomerId!
  }
  return cliente.id
}

async function atualizarClienteParaRecorrencia(clienteId: string, empresaId: string, dados: DadosCadastraisRecorrencia) {
  const row = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { id: true, nome: true, email: true, cnpj: true, cnpjHash: true },
  })
  if (!row) throw new AsaasError('Empresa não encontrada.', 404)
  const empresa = exposeEmpresa(row)
  const telefone = somenteDigitosTelefoneBR(dados.telefone)
  const cpfCnpj = somenteDigitos(empresa.cnpj)
  if (!telefone || !cpfCnpj) throw new AsaasError('Complete o telefone e o CNPJ antes de iniciar a recorrência.', 409)
  await requisitarAsaas<ClienteAsaas>(`/customers/${encodeURIComponent(clienteId)}`, 'PUT', {
    name: empresa.nome,
    company: empresa.nome,
    cpfCnpj,
    email: empresa.email,
    phone: telefone,
    mobilePhone: telefone,
    address: dados.logradouro,
    addressNumber: dados.numero,
    complement: dados.complemento || undefined,
    province: dados.bairro,
    postalCode: dados.cep.replace(/\D/g, ''),
    externalReference: empresa.id,
  })
}

export async function iniciarRecorrenciaCartao(empresaId: string, faturaId: string | undefined, dadosCadastrais: DadosCadastraisRecorrencia) {
  return comOperacaoFinanceira(empresaId, 'ADESAO_CARTAO', () => iniciarRecorrenciaCartaoExclusiva(empresaId, faturaId, dadosCadastrais))
}

async function garantirProximaMensalidadeRecorrente(empresaId: string, agora = new Date()) {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } })
  if (!empresa || empresa.excluidoEm || empresa.status === 'INATIVO' || empresa.plano === 'PREVIEW') {
    throw new AsaasError('Empresa não disponível para pagamento automático.', 409)
  }
  if (!empresa.primeiraMensalidadePagaEm) {
    throw new AsaasError('Pague a primeira mensalidade antes de ativar o pagamento automático.', 409)
  }
  const pendentes = await prisma.fatura.findMany({
    where: { empresaId, status: 'PENDENTE', valor: { gt: 0 } },
    select: { vencimento: true },
  })
  if (avaliarSituacaoFinanceira({ ...empresa, faturas: pendentes }, agora).bloqueado) {
    throw new AsaasError('Quite as cobranças vencidas antes de ativar novamente o pagamento automático.', 409)
  }

  const disponivel = await prisma.fatura.findFirst({
    where: { empresaId, tipo: 'MENSALIDADE', status: 'PENDENTE', valor: { gt: 0 }, gatewayPaymentId: null, vencimento: { gt: agora } },
    orderBy: { vencimento: 'asc' },
    select: { id: true },
  })
  if (disponivel) return disponivel.id

  const prefixo = `mensalidade:${empresaId}:`
  const competencias = await prisma.fatura.findMany({
    where: { empresaId, tipo: 'MENSALIDADE', chaveCobranca: { startsWith: prefixo } },
    select: { chaveCobranca: true },
  })
  const atual = competenciaBrasil(agora)
  let ultimaCompetencia = atual.ano * 12 + atual.mes - 1
  for (const fatura of competencias) {
    const partes = fatura.chaveCobranca?.slice(prefixo.length).split(':')
    const ano = Number(partes?.[0])
    const mes = Number(partes?.[1])
    if (Number.isInteger(ano) && Number.isInteger(mes) && mes >= 1 && mes <= 12) {
      ultimaCompetencia = Math.max(ultimaCompetencia, ano * 12 + mes - 1)
    }
  }
  const proximaCompetencia = ultimaCompetencia + 1
  const ano = Math.floor(proximaCompetencia / 12)
  const mes = proximaCompetencia % 12 + 1
  const chaveCobranca = `${prefixo}${ano}:${mes}`
  const vencimento = limiteVencimentoMensal(ano, mes, empresa.diaVencimento)
  const catalogo = await obterPlanoComercial(empresa.plano)
  if (!catalogo) throw new AsaasError('Plano comercial não configurado.', 503)
  const valor = calcularMensalidadeEmpresa(empresa, catalogo, vencimento)
  if (valor <= 0) throw new AsaasError('O plano atual não possui mensalidade válida para recorrência.', 409)

  try {
    const criada = await prisma.fatura.create({
      data: { empresaId, ano, mes: MESES_COBRANCA[mes - 1], tipo: 'MENSALIDADE', valor, vencimento, chaveCobranca },
      select: { id: true },
    })
    return criada.id
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existente = await prisma.fatura.findUnique({ where: { chaveCobranca }, select: { id: true, empresaId: true } })
      if (existente?.empresaId === empresaId) return existente.id
    }
    throw error
  }
}

async function iniciarRecorrenciaCartaoExclusiva(empresaId: string, faturaId: string | undefined, dadosCadastrais: DadosCadastraisRecorrencia) {
  const origem = origemCheckoutAsaas()
  if (!origem) throw new AsaasError('O retorno seguro do pagamento ainda não está configurado. Contate o suporte.', 503)
  const existente = await prisma.recorrenciaPagamento.findUnique({ where: { empresaId } })
  const falhaRetomavel = existente?.status === 'FALHA' && !existente.asaasCheckoutId && !existente.asaasSubscriptionId
  if (existente && !falhaRetomavel && existente.status !== 'CANCELADA') {
    throw new AsaasError('Esta empresa já possui uma adesão recorrente. Consulte o status antes de criar outra.', 409)
  }
  const faturaAlvoId = faturaId ?? await garantirProximaMensalidadeRecorrente(empresaId)
  const fatura = await prisma.fatura.findFirst({
    where: { id: faturaAlvoId, empresaId, tipo: 'MENSALIDADE', status: 'PENDENTE', gatewayPaymentId: null, valor: { gt: 0 },
      empresa: { excluidoEm: null, status: { not: 'INATIVO' }, plano: { not: 'PREVIEW' }, primeiraMensalidadePagaEm: { not: null } } },
    select: { id: true, valor: true, vencimento: true, empresa: true },
  })
  if (!fatura?.vencimento || fatura.vencimento.getTime() <= Date.now()) {
    throw new AsaasError('Escolha uma mensalidade futura, ainda sem cobrança emitida, para aderir ao cartão recorrente.', 409)
  }
  const faturasPendentes = await prisma.fatura.findMany({
    where: { empresaId, status: 'PENDENTE', valor: { gt: 0 } },
    select: { vencimento: true },
  })
  const situacao = avaliarSituacaoFinanceira({
    plano: fatura.empresa.plano,
    status: fatura.empresa.status,
    pagamentoInicialVenceEm: fatura.empresa.pagamentoInicialVenceEm,
    primeiraMensalidadePagaEm: fatura.empresa.primeiraMensalidadePagaEm,
    faturas: faturasPendentes,
  })
  if (situacao.bloqueado) {
    throw new AsaasError('Quite as cobranças vencidas antes de ativar novamente o pagamento automático.', 409)
  }
  const catalogo = await obterPlanoComercial(fatura.empresa.plano)
  const valorAtual = catalogo ? calcularMensalidadeEmpresa(fatura.empresa, catalogo, fatura.vencimento) : 0
  if (!catalogo || Math.round(valorAtual * 100) !== Math.round(Number(fatura.valor) * 100)) {
    throw new AsaasError('O valor desta mensalidade diverge da condição comercial vigente. Atualize a página ou contate o suporte.', 409)
  }
  const transicaoCalculada = obterTransicaoPromocionalEmpresa(fatura.empresa, catalogo)
  const transicaoPromocional = transicaoCalculada
    && fatura.vencimento.getTime() < transicaoCalculada.renovacaoEm.getTime()
    && Math.round(Number(fatura.valor) * 100) !== Math.round(transicaoCalculada.valorRenovacao * 100)
    ? transicaoCalculada
    : null
  const dadosTransicao = transicaoPromocional ? {
    valorRenovacao: transicaoPromocional.valorRenovacao,
    renovacaoEm: transicaoPromocional.renovacaoEm,
    acaoFimPromocao: 'ATUALIZAR_VALOR' as const,
    transicaoPromocaoStatus: 'AGENDADA' as const,
  } : {
    valorRenovacao: null,
    renovacaoEm: null,
    acaoFimPromocao: null,
    transicaoPromocaoStatus: null,
  }
  const dadosRecorrencia = {
    empresaId,
    metodo: 'CARTAO' as const,
    status: 'AGUARDANDO_ADESAO' as const,
    valor: fatura.valor,
    faturaInicialId: fatura.id,
    ...dadosTransicao,
  }
  const recorrencia = falhaRetomavel
    ? await prisma.recorrenciaPagamento.update({
      where: { id: existente.id },
      data: {
        status: 'AGUARDANDO_ADESAO', valor: fatura.valor, faturaInicialId: fatura.id, adesaoUrl: null,
        avisoPromocaoEnviadoEm: null, transicaoPromocaoSolicitadaEm: null,
        transicaoPromocaoConfirmadaEm: null, transicaoPromocaoErro: null, ...dadosTransicao,
      },
    })
    : existente?.status === 'CANCELADA'
      ? await prisma.$transaction(async tx => {
        const removida = await tx.recorrenciaPagamento.deleteMany({ where: { id: existente.id, empresaId, status: 'CANCELADA' } })
        if (removida.count !== 1) throw new AsaasError('A situação do pagamento automático mudou. Atualize a página e tente novamente.', 409)
        return tx.recorrenciaPagamento.create({ data: dadosRecorrencia })
      })
      : await prisma.recorrenciaPagamento.create({ data: dadosRecorrencia })
  try {
    const cliente = await obterOuCriarClienteAsaas(empresaId)
    await atualizarClienteParaRecorrencia(cliente, empresaId, dadosCadastrais)
    const retorno = `${origem}/dashboard/empresa/configuracoes`
    const checkout = await requisitarAsaas<CheckoutAsaas>('/checkouts', 'POST', {
      customer: cliente,
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: 60,
      externalReference: recorrencia.id,
      callback: { successUrl: retorno, cancelUrl: retorno, expiredUrl: retorno },
      items: [{ name: 'Mensalidade RPM Truck', quantity: 1, value: fatura.valor }],
      subscription: { cycle: 'MONTHLY', nextDueDate: dataAsaas(fatura.vencimento) },
    })
    if (!checkout.id || !/^[a-zA-Z0-9-]{8,160}$/.test(checkout.id)) throw new AsaasError('Não foi possível gerar uma autorização válida para o cartão.')
    const dominioCheckout = configuracaoAsaas().environment === 'sandbox' ? 'https://sandbox.asaas.com' : 'https://asaas.com'
    const adesaoUrl = `${dominioCheckout}/checkoutSession/show?id=${encodeURIComponent(checkout.id)}`
    return prisma.recorrenciaPagamento.update({
      where: { id: recorrencia.id }, data: { asaasCheckoutId: checkout.id, adesaoUrl },
    })
  } catch (error) {
    await prisma.recorrenciaPagamento.update({ where: { id: recorrencia.id }, data: { status: 'FALHA' } })
    throw error
  }
}

export async function atualizarValorAssinaturaAsaas(subscriptionId: string, valor: number) {
  if (!/^[a-zA-Z0-9_-]{3,160}$/.test(subscriptionId) || !Number.isFinite(valor) || valor <= 0) {
    throw new AsaasError('Dados inválidos para atualizar o pagamento automático.', 400)
  }
  return requisitarAsaas<AssinaturaAsaas>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, 'PUT', {
    value: valor,
    updatePendingPayments: false,
  })
}

export async function inativarAssinaturaAsaas(subscriptionId: string) {
  if (!/^[a-zA-Z0-9_-]{3,160}$/.test(subscriptionId)) {
    throw new AsaasError('Assinatura inválida para desativação.', 400)
  }
  return requisitarAsaas<AssinaturaAsaas>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, 'PUT', { status: 'INACTIVE' })
}

export async function encerrarRecorrenciaCartao(empresaId: string) {
  return comOperacaoFinanceira(empresaId, 'CANCELAR_RECORRENCIA', async () => {
    const recorrencia = await prisma.recorrenciaPagamento.findUnique({ where: { empresaId } })
    if (!recorrencia) return null
    if (recorrencia.metodo !== 'CARTAO') throw new AsaasError('Esta recorrência precisa ser conciliada pelo suporte.', 409)
    if (recorrencia.status === 'CANCELADA') return recorrencia
    if (recorrencia.asaasSubscriptionId) {
      await requisitarAsaas(`/subscriptions/${encodeURIComponent(recorrencia.asaasSubscriptionId)}`, 'PUT', { status: 'INACTIVE' })
    } else if (recorrencia.asaasCheckoutId) {
      await requisitarAsaas(`/checkouts/${encodeURIComponent(recorrencia.asaasCheckoutId)}/cancel`, 'POST')
    } else {
      throw new AsaasError('Aguarde a confirmação da assinatura antes de cancelar. Contate o suporte.', 409)
    }
    return prisma.recorrenciaPagamento.update({ where: { id: recorrencia.id }, data: { status: 'CANCELADA', adesaoUrl: null } })
  })
}

/** Interrompe novas cobranças automáticas, preservando a cobrança vencida para pagamento manual. */
export async function desativarRecorrenciaPorInadimplencia(subscriptionId: string | null | undefined, customerId: string | null | undefined) {
  if (!subscriptionId) return false
  const recorrencia = await prisma.recorrenciaPagamento.findFirst({
    where: { asaasSubscriptionId: subscriptionId, metodo: 'CARTAO', status: 'ATIVA' },
    include: { empresa: { select: { asaasCustomerId: true } } },
  })
  if (!recorrencia || !customerId || recorrencia.empresa.asaasCustomerId !== customerId) return false

  return comOperacaoFinanceira(recorrencia.empresaId, 'CANCELAR_RECORRENCIA_INADIMPLENTE', async () => {
    const aindaAtiva = await prisma.recorrenciaPagamento.findFirst({
      where: { id: recorrencia.id, asaasSubscriptionId: subscriptionId, status: 'ATIVA' },
      select: { id: true },
    })
    if (!aindaAtiva) return false
    await requisitarAsaas(`/subscriptions/${encodeURIComponent(subscriptionId)}`, 'PUT', { status: 'INACTIVE' })
    const atualizada = await prisma.recorrenciaPagamento.updateMany({
      where: { id: recorrencia.id, status: 'ATIVA' },
      data: { status: 'CANCELADA', adesaoUrl: null },
    })
    return atualizada.count === 1
  })
}

/** Caller must hold comOperacaoFinanceira until company deletion commits. */
export async function cancelarRecorrenciaAntesDaExclusao(empresaId: string) {
  const recorrencia = await prisma.recorrenciaPagamento.findUnique({ where: { empresaId } })
  if (!recorrencia) return null
  if (recorrencia.metodo !== 'CARTAO') throw new AsaasError('Esta recorrência precisa ser conciliada pelo suporte antes do encerramento.', 409)
  // CANCELADA from a webhook only means inactive; permanent deletion still needs
  // confirmation, including pending payments. Never infer absence from HTTP 404.
  if (recorrencia.asaasSubscriptionId) {
    const assinatura = await requisitarAsaas<{ deleted?: boolean }>(`/subscriptions/${encodeURIComponent(recorrencia.asaasSubscriptionId)}`, 'GET')
    if (!assinatura.deleted) {
      const removida = await requisitarAsaas<{ deleted?: boolean }>(`/subscriptions/${encodeURIComponent(recorrencia.asaasSubscriptionId)}`, 'DELETE')
      if (removida.deleted !== true) throw new AsaasError('O processador de pagamentos ainda não confirmou o cancelamento definitivo.', 503, true)
    }
  } else if (recorrencia.asaasCheckoutId) {
    if (recorrencia.status === 'ATIVA') throw new AsaasError('Aguarde a conciliação da assinatura antes de encerrar a conta.', 409)
    // Checkout has no documented GET endpoint. Its authenticated webhook is
    // the authoritative cancellation/expiration receipt.
    const confirmado = await prisma.eventoWebhookPagamento.findFirst({ where: {
      provedor: 'ASAAS', pagamentoExternoId: recorrencia.asaasCheckoutId,
      tipo: { in: ['CHECKOUT_CANCELED', 'CHECKOUT_EXPIRED'] }, processadoEm: { not: null }, erro: null,
    }, select: { id: true } })
    if (!confirmado) {
      await requisitarAsaas(`/checkouts/${encodeURIComponent(recorrencia.asaasCheckoutId)}/cancel`, 'POST')
      throw new AsaasError('Cancelamento enviado. Aguarde a confirmação do processador de pagamentos e tente o encerramento novamente.', 409)
    }
  } else {
    throw new AsaasError('Aguarde a confirmação da assinatura antes de cancelar. Contate o suporte.', 409)
  }
  return prisma.recorrenciaPagamento.update({ where: { id: recorrencia.id }, data: { status: 'CANCELADA', adesaoUrl: null } })
}

export async function emitirCobrancaAsaas(faturaId: string, empresaId: string, billingType: 'PIX' | 'UNDEFINED' = 'PIX', segundaFaturaId?: string) {
  return comOperacaoFinanceira(empresaId, 'EMITIR_COBRANCA', () => emitirCobrancaExclusiva(faturaId, empresaId, billingType, segundaFaturaId))
}

async function emitirCobrancaExclusiva(faturaId: string, empresaId: string, billingType: 'PIX' | 'UNDEFINED', segundaFaturaId?: string) {
  if (segundaFaturaId === faturaId) throw new AsaasError('Selecione duas faturas diferentes.', 400)
  const faturas = await prisma.fatura.findMany({
    where: { id: { in: segundaFaturaId ? [faturaId, segundaFaturaId] : [faturaId] }, empresaId },
    select: { id: true, mes: true, ano: true, tipo: true, valor: true, vencimento: true, status: true, gatewayPaymentId: true, gatewayStatus: true, gatewayInvoiceUrl: true, gatewayBillingType: true, pixCopiaECola: true },
  })
  if (faturas.length !== (segundaFaturaId ? 2 : 1)) throw new AsaasError('Fatura não encontrada.', 404)
  const existente = faturas.find(item => item.id === faturaId)!
  if (faturas.some(item => item.status !== 'PENDENTE')) throw new AsaasError('Uma das faturas já foi liquidada.', 409)
  if (faturas.some(item => item.valor <= 0)) throw new AsaasError('Fatura isenta não precisa de cobrança.', 409)
  if (segundaFaturaId && (new Set(faturas.map(item => item.tipo)).size !== 2 || !faturas.some(item => item.tipo === 'IMPLEMENTACAO') || !faturas.some(item => item.tipo === 'MENSALIDADE'))) {
    throw new AsaasError('A cobrança conjunta exige uma implantação e uma mensalidade pendentes.', 409)
  }
  if (segundaFaturaId && faturas.some(item => item.mes !== existente.mes || item.ano !== existente.ano)) {
    throw new AsaasError('As duas faturas devem pertencer ao mesmo período.', 409)
  }
  if (faturas.some(item => item.gatewayPaymentId)) {
    if (faturas.every(item => item.gatewayPaymentId && item.gatewayPaymentId === existente.gatewayPaymentId)) {
      if (faturas.every(item => item.gatewayBillingType === billingType)) return existente
      throw new AsaasError('Já existe uma cobrança com outra forma de pagamento para esta fatura.', 409)
    }
    throw new AsaasError('Uma das faturas já possui cobrança. Use os pagamentos separados.', 409)
  }
  if (faturas.some(item => item.tipo === 'MENSALIDADE') && await prisma.recorrenciaPagamento.findFirst({
    where: { empresaId, status: { in: ['AGUARDANDO_ADESAO', 'ATIVA'] } }, select: { id: true },
  })) {
    throw new AsaasError('A mensalidade está vinculada a uma adesão recorrente. Aguarde a confirmação ou solicite suporte.', 409)
  }
  if (faturas.some(item => !item.vencimento)) throw new AsaasError('Defina o vencimento das faturas antes de emitir a cobrança.', 409)
  const faturaIds = faturas.map(item => item.id)
  const referencia = montarReferenciaCobranca(faturaIds)
  const valorCentavos = somarCentavos(faturas.map(item => item.valor))
  const vencimento = new Date(Math.max(...faturas.map(item => item.vencimento!.getTime()), Date.now()))

  const agora = new Date()
  await prisma.$transaction(async tx => {
    const claim = await tx.fatura.updateMany({
      where: {
        id: { in: faturaIds },
        empresaId,
        status: 'PENDENTE',
        gatewayPaymentId: null,
        OR: [
          { gatewayStatus: null },
          { gatewayStatus: 'ERROR' },
          { gatewayStatus: 'CREATING', gatewaySincronizadoEm: { lt: new Date(agora.getTime() - 2 * 60_000) } },
        ],
      },
      data: { provedorPagamento: 'ASAAS', gatewayStatus: 'CREATING', gatewaySincronizadoEm: agora, gatewayErro: null },
    })
    if (claim.count !== faturas.length) throw new AsaasError('A cobrança já está sendo emitida. Aguarde alguns segundos.', 409)
  })

  try {
    const customer = await obterOuCriarClienteAsaas(empresaId)
    const conciliadas = await requisitarAsaas<ListaAsaas<CobrancaAsaas>>(
      `/payments?externalReference=${encodeURIComponent(referencia)}&limit=100`, 'GET',
    )
    // Uma cobrança estornada é terminal e não pode ser reaproveitada. Em uma
    // recobrança, somente uma tentativa ainda válida mantém a emissão idempotente.
    const recuperada = conciliadas.data.find(item => item.status !== 'REFUNDED')
    if (recuperada?.value != null && Math.round(recuperada.value * 100) !== valorCentavos) {
      throw new AsaasError('Já existe uma cobrança online com a mesma referência e outro valor. Contate o suporte.', 409)
    }
    if (recuperada && recuperada.billingType !== billingType) throw new AsaasError('Já existe uma cobrança com outra forma de pagamento para esta fatura.', 409)
    const cobranca = recuperada ?? await requisitarAsaas<CobrancaAsaas>('/payments', 'POST', {
      customer,
      billingType,
      value: valorCentavos / 100,
      dueDate: dataAsaas(vencimento),
      description: segundaFaturaId ? 'Implantação + mensalidade RPM Truck' : `${existente.tipo === 'IMPLEMENTACAO' ? 'Implantação' : 'Mensalidade'} RPM Truck`,
      externalReference: referencia,
      postalService: false,
    })
    await prisma.fatura.updateMany({
      where: { id: { in: faturaIds }, empresaId, status: 'PENDENTE' },
      data: {
        provedorPagamento: 'ASAAS',
        gatewayPaymentId: cobranca.id,
        gatewayStatus: cobranca.status,
        gatewayBillingType: cobranca.billingType,
        gatewayInvoiceUrl: cobranca.invoiceUrl ?? null,
        gatewayNetValue: segundaFaturaId ? null : cobranca.netValue ?? null,
        gatewaySincronizadoEm: new Date(),
        gatewayErro: null,
        pixQrPath: null,
        pixQrNome: null,
        pixQrMime: null,
      },
    })
    const vinculada = await prisma.fatura.findUniqueOrThrow({ where: { id: existente.id }, select: { id: true, gatewayPaymentId: true, gatewayStatus: true, gatewayInvoiceUrl: true, gatewayBillingType: true, pixCopiaECola: true } })
    if (billingType !== 'PIX') return vinculada
    try {
      const qr = await requisitarAsaas<QrCodeAsaas>(`/payments/${encodeURIComponent(cobranca.id)}/pixQrCode`, 'GET')
      await prisma.fatura.updateMany({
        where: { id: { in: faturaIds }, empresaId },
        data: { pixCopiaECola: qr.payload, gatewayErro: null, gatewaySincronizadoEm: new Date() },
      })
      return { ...vinculada, pixCopiaECola: qr.payload }
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Falha ao consultar o QR Pix.'
      await prisma.fatura.updateMany({ where: { id: { in: faturaIds }, empresaId }, data: { gatewayErro: message } })
      return vinculada
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Falha ao emitir cobrança.'
    await prisma.fatura.updateMany({
      where: { id: { in: faturaIds }, empresaId, gatewayPaymentId: null },
      data: { gatewayStatus: 'ERROR', gatewayErro: message, gatewaySincronizadoEm: new Date() },
    })
    throw error
  }
}

export async function obterQrCodeAsaas(paymentId: string) {
  return requisitarAsaas<QrCodeAsaas>(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`, 'GET')
}

export async function atualizarVencimentoAsaas(paymentId: string, data: string, billingType: string, valorCentavos: number) {
  if (!['PIX', 'BOLETO', 'CREDIT_CARD', 'UNDEFINED'].includes(billingType)) throw new AsaasError('Forma de pagamento inválida para alteração.', 409)
  return requisitarAsaas<CobrancaAsaas>(`/payments/${encodeURIComponent(paymentId)}`, 'PUT', {
    billingType, value: valorCentavos / 100, dueDate: data,
  })
}
