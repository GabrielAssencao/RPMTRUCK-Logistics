import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { loadTs } from './helpers/load-ts.mjs'
import { distribuirLiquidoCentavos, extrairIdsCobrancaConjunta, somarCentavos } from '../src/lib/financeiro/referenciaCobranca.ts'

const require = createRequire(import.meta.url)
const idFatura = '11111111-1111-4111-8111-111111111111'

function prepararWebhook(recorrente = false, statusRecorrencia = 'ATIVA') {
  const fatura = {
    id: idFatura, empresaId: 'empresa-1', tipo: 'MENSALIDADE', valor: 250,
    status: 'PENDENTE', gatewayPaymentId: 'pay-teste', gatewayStatus: 'PENDING',
    gatewayBillingType: 'UNDEFINED', gatewayNetValue: null, gatewayRecebidoEm: null,
    vencimento: new Date('2026-11-29T03:00:00.000Z'),
  }
  const eventos = [], inativacoes = [], notificacoes = []
  const recorrencia = {
    id: 'rec-1', empresaId: 'empresa-1', metodo: 'CARTAO', status: statusRecorrencia,
    asaasSubscriptionId: 'sub-1', asaasCheckoutId: 'checkout-1', valor: 297,
    valorRenovacao: 397, renovacaoEm: new Date('2027-09-29T03:00:00.000Z'),
    acaoFimPromocao: 'ATUALIZAR_VALOR', transicaoPromocaoStatus: 'PROCESSANDO',
    empresa: { asaasCustomerId: 'cus-1', nome: 'Empresa Teste' },
  }
  const tx = {
    eventoWebhookPagamento: {
      create: async ({ data }) => { eventos.push(data.id) },
      update: async () => ({}),
    },
    fatura: {
      findMany: async () => [{ ...fatura }],
      update: async ({ data }) => Object.assign(fatura, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))),
    },
    recorrenciaPagamento: { findFirst: async () => recorrente ? recorrencia : null, update: async ({ data }) => Object.assign(recorrencia, data) },
  }
  const source = readFileSync('src/app/api/webhooks/asaas/route.ts', 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exported = { exports: {} }
  const dependencies = {
    '@/lib/requestBody': loadTs('src/lib/requestBody.ts'),
    '@prisma/client': { Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' }, PrismaClientKnownRequestError: class extends Error {} } },
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    zod: require('zod'),
    '@/lib/auditoria': { executarComAuditoria: async (_audit, callback) => callback(tx) },
    '@/lib/financeiro/faturas': {
      liquidarFatura: async (_tx, _id, data) => {
        if (fatura.status === 'PENDENTE') Object.assign(fatura, { status: 'PAGO', pago_em: data.pagoEm, gatewayStatus: data.gatewayStatus })
      },
      registrarEstornoFatura: async (_tx, _id, status) => Object.assign(fatura, { status: 'ESTORNADA', pago_em: null, gatewayStatus: status, gatewayRecebidoEm: null }),
    },
    '@/lib/financeiro/asaas': { desativarRecorrenciaPorInadimplencia: async (...args) => { inativacoes.push(args); return true } },
    '@/lib/financeiro/notificacoesPagamento': {
      notificarPagamentoConfirmado: async (_tx, faturas) => { notificacoes.push({ tipo: 'CONFIRMADO', quantidade: faturas.length }) },
      notificarPagamentoEstornado: async (_tx, faturas) => { notificacoes.push({ tipo: 'ESTORNADO', quantidade: faturas.length }) },
      notificarPagamentoVencido: async (_tx, faturas, recorrente) => { notificacoes.push({ tipo: 'VENCIDO', quantidade: faturas.length, recorrente }) },
      notificarSituacaoRecorrencia: async () => undefined,
      notificarTransicaoPromocaoConfirmada: async (_tx, _empresaId, acao) => { notificacoes.push({ tipo: 'TRANSICAO', acao }) },
      notificarFalhaTransicaoPromocao: async () => { notificacoes.push({ tipo: 'FALHA_TRANSICAO' }) },
    },
    '@/lib/financeiro/referenciaCobranca': { distribuirLiquidoCentavos, extrairIdsCobrancaConjunta, somarCentavos },
  }
  vm.runInNewContext(js, {
    module: exported, exports: exported.exports, Buffer, Date, Set, console, TextDecoder,
    process: { env: { ASAAS_WEBHOOK_TOKEN: 't'.repeat(32) } },
    require: name => dependencies[name] ?? require(name),
  })
  const enviar = (event, opcoes = {}) => {
    const payload = JSON.stringify({
      id: `evt-${event}-${eventos.length + 1}`, event,
      payment: {
        id: 'pay-teste', externalReference: idFatura, status: event.replace('PAYMENT_', ''),
        value: opcoes.value ?? 250, netValue: 249, billingType: opcoes.billingType ?? 'CREDIT_CARD',
        confirmedDate: '2026-09-19', creditDate: '2026-10-20',
        ...(opcoes.dueDate ? { dueDate: opcoes.dueDate } : {}),
        ...(recorrente ? { subscription: 'sub-1', checkoutSession: opcoes.checkoutSession ?? 'checkout-1', customer: opcoes.customer ?? 'cus-1' } : {}),
      },
    })
    return exported.exports.POST(new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST', headers: { 'asaas-access-token': 't'.repeat(32) }, body: payload,
    }))
  }
  const enviarRecorrencia = (event, value = 397) => exported.exports.POST(new Request('http://localhost/api/webhooks/asaas', {
    method: 'POST', headers: { 'asaas-access-token': 't'.repeat(32) }, body: JSON.stringify({
      id: `evt-${event}-${eventos.length + 1}`, event,
      subscription: { id: 'sub-1', customer: 'cus-1', externalReference: 'rec-1', value },
    }),
  }))
  return { fatura, eventos, enviar, enviarRecorrencia, inativacoes, notificacoes, recorrencia }
}

test('cartão confirmado libera acesso antes do repasse; receita entra só no recebimento e estorno reabre a fatura', async () => {
  const { fatura, enviar, notificacoes } = prepararWebhook()
  assert.equal((await enviar('PAYMENT_CONFIRMED')).status, 200)
  assert.equal(fatura.status, 'PAGO')
  assert.equal(fatura.gatewayRecebidoEm, null)
  assert.equal(fatura.pago_em.toISOString().slice(0, 10), '2026-09-19')

  assert.equal((await enviar('PAYMENT_RECEIVED')).status, 200)
  assert.equal(fatura.status, 'PAGO')
  assert.equal(fatura.gatewayRecebidoEm.toISOString().slice(0, 10), '2026-10-20')
  assert.deepEqual(notificacoes, [{ tipo: 'CONFIRMADO', quantidade: 1 }])

  assert.equal((await enviar('PAYMENT_REFUNDED')).status, 200)
  assert.equal(fatura.status, 'ESTORNADA')
  assert.equal(fatura.gatewayRecebidoEm, null)
  assert.deepEqual(notificacoes.at(-1), { tipo: 'ESTORNADO', quantidade: 1 })
  assert.equal((await enviar('PAYMENT_CONFIRMED')).status, 200)
  assert.equal(fatura.status, 'ESTORNADA')
})

test('boleto usa o checkout do Asaas e confirmação de valor divergente não libera acesso', async () => {
  const route = readFileSync('src/app/api/empresa/faturas/[id]/cobranca/route.ts', 'utf8')
  const gateway = readFileSync('src/lib/financeiro/asaas.ts', 'utf8')
  const ui = readFileSync('src/app/dashboard/empresa/configuracoes/_componentes/SubscriptionManagement.tsx', 'utf8')
  const stats = readFileSync('src/app/api/admin/stats/route.ts', 'utf8')
  assert.match(route, /z\.enum\(\['PIX', 'UNDEFINED'\]\)/)
  assert.match(gateway, /gatewayInvoiceUrl: cobranca\.invoiceUrl/)
  assert.match(ui, /gerarCobranca\(fatura\.id, 'UNDEFINED'\)/)
  assert.match(ui, /Pagar com cartão ou boleto/)
  assert.match(ui, /Continuar pagamento/)
  assert.match(ui, /gatewayStatus !== 'REFUNDED'/)
  assert.match(ui, /ambiente seguro de pagamento/)
  assert.doesNotMatch(ui, /\bAsaas\b/)
  assert.match(ui, /Autorizar o cartão automático não marca uma cobrança como paga/)
  assert.match(ui, /Desativar impede novas cobranças automáticas, mas não remove faturas/)
  assert.match(stats, /gatewayRecebidoEm: \{ not: null \}/)
  const { fatura, enviar } = prepararWebhook()
  assert.equal((await enviar('PAYMENT_CONFIRMED', { value: 200, billingType: 'BOLETO' })).body.ignorado, true)
  assert.equal(fatura.status, 'PENDENTE')
  assert.equal((await enviar('PAYMENT_CONFIRMED', { billingType: 'BOLETO' })).status, 200)
  assert.equal(fatura.status, 'PAGO')
})

test('Pix recebido diretamente continua quitando a fatura e não duplica a data do repasse', async () => {
  const { fatura, enviar } = prepararWebhook()
  assert.equal((await enviar('PAYMENT_RECEIVED', { billingType: 'PIX' })).status, 200)
  assert.equal(fatura.status, 'PAGO')
  const primeiroRecebimento = fatura.gatewayRecebidoEm.toISOString()
  assert.equal((await enviar('PAYMENT_RECEIVED', { billingType: 'PIX' })).status, 200)
  assert.equal(fatura.gatewayRecebidoEm.toISOString(), primeiroRecebimento)
})

test('webhook recorrente rejeita cliente ou checkout divergente antes de quitar a mensalidade', async () => {
  const { fatura, enviar } = prepararWebhook(true)
  assert.equal((await enviar('PAYMENT_CONFIRMED', { customer: 'cus-outra' })).body.ignorado, true)
  assert.equal(fatura.status, 'PENDENTE')
  assert.equal((await enviar('PAYMENT_CONFIRMED', { checkoutSession: 'checkout-outro' })).body.ignorado, true)
  assert.equal(fatura.status, 'PENDENTE')
  assert.equal((await enviar('PAYMENT_CONFIRMED')).body.ignorado, false)
  assert.equal(fatura.status, 'PAGO')
})

test('assinatura cancelada ainda quita cobrança que já estava emitida e vinculada', async () => {
  const { fatura, enviar } = prepararWebhook(true, 'CANCELADA')
  const response = await enviar('PAYMENT_CONFIRMED')
  assert.equal(response.status, 200)
  assert.equal(response.body.ignorado, false)
  assert.equal(fatura.status, 'PAGO')
})

test('SUBSCRIPTION_UPDATED confirma exatamente o valor integral agendado', async () => {
  const { enviarRecorrencia, recorrencia, notificacoes } = prepararWebhook(true)
  const response = await enviarRecorrencia('SUBSCRIPTION_UPDATED', 397)
  assert.equal(response.status, 200)
  assert.equal(recorrencia.valor, 397)
  assert.equal(recorrencia.transicaoPromocaoStatus, 'CONFIRMADA')
  assert.ok(recorrencia.transicaoPromocaoConfirmadaEm instanceof Date)
  assert.deepEqual(notificacoes.at(-1), { tipo: 'TRANSICAO', acao: 'ATUALIZAR_VALOR' })
})

test('SUBSCRIPTION_UPDATED divergente interrompe a recorrência e alerta sem aceitar outro valor', async () => {
  const { enviarRecorrencia, recorrencia, notificacoes } = prepararWebhook(true)
  const response = await enviarRecorrencia('SUBSCRIPTION_UPDATED', 450)
  assert.equal(response.status, 200)
  assert.equal(recorrencia.valor, 297)
  assert.equal(recorrencia.status, 'FALHA')
  assert.equal(recorrencia.transicaoPromocaoStatus, 'FALHA')
  assert.deepEqual(notificacoes.at(-1), { tipo: 'FALHA_TRANSICAO' })
})

test('gestão do plano acompanha pagamentos sem recarregar a página e limita consultas', () => {
  const ui = readFileSync('src/app/dashboard/empresa/configuracoes/_componentes/SubscriptionManagement.tsx', 'utf8')
  assert.match(ui, /window\.setInterval\(\(\) => \{ void atualizar\(\) \}, 30_000\)/)
  assert.match(ui, /document\.hidden \|\| consultaEmAndamento/)
  assert.match(ui, /agora - ultimaConsulta < 10_000/)
  assert.match(ui, /document\.addEventListener\('visibilitychange'/)
  assert.match(ui, /window\.addEventListener\('focus'/)
  assert.match(ui, /return 'Fatura futura'/)
  assert.match(ui, /return 'Fatura pendente'/)
  assert.match(ui, /Faturas antes do vencimento aparecem como futuras/)
  assert.match(ui, /new Date\(fatura\.vencimento\)\.getTime\(\) > agoraServidor/)
})

test('estorno não vira dívida automaticamente e exige decisão auditada do SuperAdmin', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8')
  const migration = readFileSync('prisma/migrations/20260929220100_classificar_faturas_estornadas/migration.sql', 'utf8')
  const invoices = readFileSync('src/lib/financeiro/faturas.ts', 'utf8')
  const adminRoute = readFileSync('src/app/api/faturas/[id]/route.ts', 'utf8')
  const adminUi = readFileSync('src/app/dashboard/admin/_modulos/empresas/CompanyFinancialControl.jsx', 'utf8')
  const gateway = readFileSync('src/lib/financeiro/asaas.ts', 'utf8')

  assert.match(schema, /enum StatusFatura \{[\s\S]*ESTORNADA[\s\S]*CANCELADA/)
  assert.match(migration, /gateway_status" = 'REFUNDED'/)
  assert.match(invoices, /status: 'ESTORNADA'/)
  assert.match(adminRoute, /requireAdminAuth/)
  assert.match(adminRoute, /executarComAuditoria/)
  assert.match(adminRoute, /acaoEstorno: z\.enum\(\['RECOBRAR', 'ENCERRAR'\]\)/)
  assert.match(adminRoute, /where: \{ id, status: 'ESTORNADA', gatewayStatus: 'REFUNDED' \}/)
  assert.match(adminUi, /Preparar nova cobrança/)
  assert.match(adminUi, /Encerrar obrigação/)
  assert.match(gateway, /find\(item => item\.status !== 'REFUNDED'\)/)
})

test('vencimento forçado no Sandbox sincroniza a data local pelo PAYMENT_OVERDUE', async () => {
  const { fatura, enviar, inativacoes, notificacoes } = prepararWebhook(true)
  const response = await enviar('PAYMENT_OVERDUE', { dueDate: '2026-09-25' })
  assert.equal(response.status, 200)
  assert.equal(response.body.ignorado, false)
  assert.equal(fatura.status, 'PENDENTE')
  assert.equal(fatura.gatewayStatus, 'OVERDUE')
  assert.equal(fatura.vencimento.toISOString(), '2026-09-26T02:59:59.000Z')
  assert.deepEqual(Array.from(inativacoes[0]), ['sub-1', 'cus-1'])
  assert.deepEqual(notificacoes.at(-1), { tipo: 'VENCIDO', quantidade: 1, recorrente: true })
})
