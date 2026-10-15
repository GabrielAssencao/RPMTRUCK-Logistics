import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { loadTs } from './helpers/load-ts.mjs'

const require = createRequire(import.meta.url)
const source = readFileSync('src/lib/financeiro/asaas.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const cadastroRecorrencia = { telefone: '11999999999', cep: '01310000', logradouro: 'Avenida Paulista', numero: '150', complemento: 'Sala 1', bairro: 'Bela Vista' }

function montarGateway({ valor = 397, baseVigente = 397, precoBaseRenovacao = null, recorrenciaInicial = null, semMensalidadeFutura = false } = {}) {
  const empresa = {
    id: 'empresa-local', nome: 'Empresa Local', email: 'empresa@example.test', cnpj: '11222333000181',
    plano: 'ESSENCIAL', status: 'ATIVO', asaasCustomerId: 'cus_local',
    pagamentoInicialVenceEm: null, primeiraMensalidadePagaEm: new Date(),
    precoBasePromocional: precoBaseRenovacao === null ? null : valor, precoBaseRenovacao,
    promocaoMesesIniciais: precoBaseRenovacao === null ? null : 1, promocaoAtivadaEm: new Date('2026-08-01'),
    usuarios_adicionais: 0, veiculos_adicionais: 0, diaVencimento: 28, excluidoEm: null,
  }
  const fatura = { id: 'fatura-local', valor, vencimento: new Date(Date.now() + 7 * 86400000), empresa }
  let faturaGerada = null
  const recorrencia = recorrenciaInicial ?? { id: 'recorrencia-local', empresaId: empresa.id, status: 'AGUARDANDO_ADESAO', metodo: 'CARTAO' }
  const chamadas = []
  const prisma = {
    fatura: {
      findFirst: async ({ where }) => {
        if (where.id) return where.id === faturaGerada?.id ? faturaGerada : fatura
        if (where.vencimento) return semMensalidadeFutura ? null : fatura
        return fatura
      },
      findMany: async ({ where }) => where.chaveCobranca
        ? [{ chaveCobranca: 'mensalidade:empresa-local:2026:11' }]
        : faturaGerada ? [{ vencimento: faturaGerada.vencimento }] : semMensalidadeFutura ? [] : [{ vencimento: fatura.vencimento }],
      create: async ({ data }) => {
        faturaGerada = { id: 'fatura-gerada', ...data, empresa }
        return { id: faturaGerada.id }
      },
      findUnique: async () => faturaGerada,
    },
    recorrenciaPagamento: {
      findUnique: async () => recorrenciaInicial,
      findFirst: async ({ where } = {}) => {
        if (!recorrenciaInicial) return null
        if (where?.id && (where.id !== recorrenciaInicial.id || recorrenciaInicial.status !== 'ATIVA')) return null
        return { ...recorrenciaInicial, empresa: { asaasCustomerId: empresa.asaasCustomerId } }
      },
      create: async ({ data }) => Object.assign(recorrencia, { id: recorrenciaInicial?.status === 'CANCELADA' ? 'recorrencia-nova' : recorrencia.id, ...data }),
      update: async ({ data }) => Object.assign(recorrencia, data),
      updateMany: async ({ data }) => { Object.assign(recorrencia, data); return { count: 1 } },
      deleteMany: async () => ({ count: 1 }),
    },
    empresa: { findUnique: async () => empresa, findFirst: async () => empresa },
    operacaoFinanceira: { create: async () => ({}), deleteMany: async () => ({ count: 1 }) },
  }
  prisma.$transaction = async callback => callback(prisma)
  const dependencies = {
    'server-only': {},
    '@/lib/financeiro/operacaoFinanceira': loadTs('src/lib/financeiro/operacaoFinanceira.ts', { '@/lib/prisma': { prisma } }),
    'server-only': {},
    '@/lib/fieldEncryption': { exposeEmpresa: value => value },
    '@/lib/prisma': { prisma },
    '@/lib/financeiro/referenciaCobranca': {},
    '@/lib/financeiro/planosComerciais': {
      obterPlanoComercial: async () => ({ precoBase: 397 }),
      calcularMensalidadeEmpresa: () => valor,
      precoBaseVigenteEmpresa: () => baseVigente,
      obterTransicaoPromocionalEmpresa: () => precoBaseRenovacao !== null && valor !== precoBaseRenovacao
        ? { valorRenovacao: precoBaseRenovacao, renovacaoEm: new Date('2027-09-29T03:00:00.000Z') }
        : null,
    },
    '@/lib/financeiro/situacaoFinanceira': loadTs('src/lib/financeiro/situacaoFinanceira.ts'),
    '@/utils/telefone': loadTs('src/utils/telefone.ts'),
  }
  const sandboxModule = { exports: {} }
  vm.runInNewContext(compiled, {
    module: sandboxModule, exports: sandboxModule.exports, Date, Intl, AbortSignal, URL, console,
    process: { env: { ASAAS_ENABLED: 'true', ASAAS_ENVIRONMENT: 'sandbox', ASAAS_API_KEY: 'key', ASAAS_CALLBACK_BASE_URL: 'https://rpm-local.example' } },
    fetch: async (url, options) => {
      chamadas.push({ url, body: JSON.parse(options.body) })
      return { ok: true, json: async () => ({ id: options.method === 'PUT' ? 'cus_local' : '12345678-1234-1234-1234-123456789abc' }) }
    },
    require: name => dependencies[name] ?? require(name),
  })
  return { iniciar: sandboxModule.exports.iniciarRecorrenciaCartao, gateway: sandboxModule.exports, recorrencia, chamadas, faturaGerada: () => faturaGerada }
}

test('checkout recorrente usa mensalidade local e monta URL segura mesmo quando Asaas retorna apenas ID', async () => {
  const { iniciar, recorrencia, chamadas } = montarGateway()
  const resultado = await iniciar('empresa-local', 'fatura-local', cadastroRecorrencia)
  assert.equal(resultado.status, 'AGUARDANDO_ADESAO')
  assert.equal(resultado.adesaoUrl, 'https://sandbox.asaas.com/checkoutSession/show?id=12345678-1234-1234-1234-123456789abc')
  assert.equal(chamadas.length, 2)
  assert.equal(chamadas[0].url, 'https://api-sandbox.asaas.com/v3/customers/cus_local')
  assert.equal(chamadas[0].body.phone, '11999999999')
  assert.equal(chamadas[0].body.postalCode, '01310000')
  assert.equal(chamadas[1].url, 'https://api-sandbox.asaas.com/v3/checkouts')
  assert.deepEqual(Array.from(chamadas[1].body.billingTypes), ['CREDIT_CARD'])
  assert.deepEqual(Array.from(chamadas[1].body.chargeTypes), ['RECURRENT'])
  assert.equal(chamadas[1].body.items[0].value, 397)
  assert.equal(chamadas[1].body.externalReference, recorrencia.id)
})

test('cartão recorrente aceita promoção e agenda a alteração antes da primeira mensalidade integral', async () => {
  const promocional = montarGateway({ valor: 250, baseVigente: 250, precoBaseRenovacao: 150 })
  const resultado = await promocional.iniciar('empresa-local', 'fatura-local', cadastroRecorrencia)
  assert.equal(resultado.status, 'AGUARDANDO_ADESAO')
  assert.equal(promocional.recorrencia.valorRenovacao, 150)
  assert.equal(promocional.recorrencia.acaoFimPromocao, 'ATUALIZAR_VALOR')
  assert.equal(promocional.recorrencia.transicaoPromocaoStatus, 'AGENDADA')
  assert.equal(promocional.chamadas[1].body.items[0].value, 250)

  const renovado = montarGateway({ valor: 150, baseVigente: 150, precoBaseRenovacao: 150 })
  const semTransicao = await renovado.iniciar('empresa-local', 'fatura-local', cadastroRecorrencia)
  assert.equal(semTransicao.status, 'AGUARDANDO_ADESAO')
  assert.equal(renovado.recorrencia.transicaoPromocaoStatus, null)
})

test('adesão falha sem checkout remoto pode ser retomada com os dados corrigidos', async () => {
  const anterior = { id: 'recorrencia-falha', empresaId: 'empresa-local', status: 'FALHA', metodo: 'CARTAO', asaasCheckoutId: null, asaasSubscriptionId: null }
  const fluxo = montarGateway({ recorrenciaInicial: anterior })
  const resultado = await fluxo.iniciar('empresa-local', 'fatura-local', cadastroRecorrencia)
  assert.equal(resultado.id, anterior.id)
  assert.equal(resultado.status, 'AGUARDANDO_ADESAO')
  assert.equal(fluxo.chamadas.length, 2)
})

test('empresa em dia pode autorizar novamente depois de cancelar a recorrência', async () => {
  const anterior = { id: 'recorrencia-cancelada', empresaId: 'empresa-local', status: 'CANCELADA', metodo: 'CARTAO', asaasCheckoutId: 'checkout-antigo', asaasSubscriptionId: 'sub-antiga' }
  const fluxo = montarGateway({ recorrenciaInicial: anterior })
  const resultado = await fluxo.iniciar('empresa-local', 'fatura-local', cadastroRecorrencia)
  assert.equal(resultado.id, 'recorrencia-nova')
  assert.equal(resultado.status, 'AGUARDANDO_ADESAO')
  assert.equal(fluxo.chamadas[1].body.externalReference, 'recorrencia-nova')
})

test('empresa em dia sem fatura futura prepara a próxima mensalidade ao reativar o cartão', async () => {
  const anterior = { id: 'recorrencia-cancelada', empresaId: 'empresa-local', status: 'CANCELADA', metodo: 'CARTAO', asaasCheckoutId: 'checkout-antigo', asaasSubscriptionId: 'sub-antiga' }
  const fluxo = montarGateway({ recorrenciaInicial: anterior, semMensalidadeFutura: true })
  const resultado = await fluxo.iniciar('empresa-local', undefined, cadastroRecorrencia)
  const fatura = fluxo.faturaGerada()

  assert.equal(resultado.status, 'AGUARDANDO_ADESAO')
  assert.equal(fatura.id, 'fatura-gerada')
  assert.equal(fatura.chaveCobranca, 'mensalidade:empresa-local:2026:12')
  assert.equal(fatura.mes, 'Dez')
  assert.equal(fatura.valor, 397)
  assert.equal(fluxo.chamadas[1].body.subscription.nextDueDate, '2026-12-29')
})

test('mensalidade recorrente vencida inativa novas cobranças e preserva a cobrança existente', async () => {
  const ativa = { id: 'recorrencia-ativa', empresaId: 'empresa-local', status: 'ATIVA', metodo: 'CARTAO', asaasCheckoutId: 'checkout-atual', asaasSubscriptionId: 'sub-atual' }
  const fluxo = montarGateway({ recorrenciaInicial: ativa })
  assert.equal(await fluxo.gateway.desativarRecorrenciaPorInadimplencia('sub-atual', 'cus_local'), true)
  assert.equal(ativa.status, 'CANCELADA')
  assert.equal(fluxo.chamadas[0].url, 'https://api-sandbox.asaas.com/v3/subscriptions/sub-atual')
  assert.deepEqual(fluxo.chamadas[0].body, { status: 'INACTIVE' })
  assert.equal(await fluxo.gateway.desativarRecorrenciaPorInadimplencia('sub-atual', 'outro-cliente'), false)
  assert.equal(fluxo.chamadas.length, 1)
})

test('cancelamento comum inativa assinatura; exclusão exige remoção definitiva', async () => {
  const recorrencia = { id: 'rec-1', empresaId: 'empresa-local', metodo: 'CARTAO', status: 'ATIVA', asaasSubscriptionId: 'sub-123' }
  const requests = []
  const prisma = {
    empresa: { findFirst: async () => ({ id: 'empresa-local' }) },
    operacaoFinanceira: { create: async () => ({}), deleteMany: async () => ({ count: 1 }) },
    recorrenciaPagamento: { findUnique: async () => recorrencia, update: async ({ data }) => Object.assign(recorrencia, data) },
  }
  const dependencies = {
    '@/lib/financeiro/operacaoFinanceira': loadTs('src/lib/financeiro/operacaoFinanceira.ts', { '@/lib/prisma': { prisma } }),
    '@/lib/prisma': { prisma }, '@/lib/fieldEncryption': { exposeEmpresa: x => x },
    '@/lib/financeiro/referenciaCobranca': {}, '@/lib/financeiro/planosComerciais': {},
    '@/lib/financeiro/situacaoFinanceira': loadTs('src/lib/financeiro/situacaoFinanceira.ts'),
    '@/utils/telefone': loadTs('src/utils/telefone.ts'),
  }
  const sandboxModule = { exports: {} }
  vm.runInNewContext(compiled, { module: sandboxModule, exports: sandboxModule.exports, AbortSignal, URL, console,
    fetch: async (url, options) => {
      requests.push({ url, method: options.method, body: options.body })
      return { ok: true, json: async () => options.method === 'DELETE' ? { deleted: true } : { id: 'sub-123' } }
    },
    process: { env: { ASAAS_ENABLED: 'true', ASAAS_API_KEY: 'sandbox-key', ASAAS_ENVIRONMENT: 'sandbox' } },
    require: name => name === 'server-only' ? {} : dependencies[name] ?? require(name),
  })
  const gateway = sandboxModule.exports
  await gateway.encerrarRecorrenciaCartao('empresa-local')
  assert.equal(requests[0].method, 'PUT')
  assert.equal(JSON.parse(requests[0].body).status, 'INACTIVE')
  assert.equal(recorrencia.status, 'CANCELADA')
  await gateway.cancelarRecorrenciaAntesDaExclusao('empresa-local')
  assert.deepEqual(requests.slice(1).map(item => item.method), ['GET', 'DELETE'])
})
