import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server.js'
import { loadTs } from './helpers/load-ts.mjs'

const { lerJsonLimitado } = loadTs('src/lib/requestBody.ts')

test('JSON limit counts actual bytes, cancels chunked bodies and rejects malformed JSON', async () => {
  let cancelled = false
  const body = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(1024)) },
    cancel() { cancelled = true },
  })
  await assert.rejects(lerJsonLimitado(new Request('http://localhost', {
    method: 'POST', headers: { 'Content-Length': '1' }, body, duplex: 'half',
  })), error => error.status === 413)
  assert.equal(cancelled, true)
  await assert.rejects(lerJsonLimitado(new Request('http://localhost', { method: 'POST', body: '{' })), error => error.status === 400)
  const value = { nome: 'João', token: 'synthetic' }
  assert.deepEqual(await lerJsonLimitado(new Request('http://localhost', { method: 'POST', body: JSON.stringify(value) })), value)
})

test('public entry points reject oversized and malformed bodies before database or bot access', async () => {
  const unexpected = () => { throw new Error('Unexpected downstream access') }
  const overrides = {
    '@/lib/prisma': { prisma: new Proxy({}, { get: unexpected }) },
    '@/lib/auth': {},
    '@/lib/auditoria': {},
    '@/lib/notificacoes': {},
    '@/lib/securityEvents': {},
    '@/lib/passwordResetRequests': {},
    '@/lib/financeiro/planosComerciais': {},
    '@/lib/financeiro/acessoFinanceiro': {},
    '@/lib/botProtection': { verifyBotToken: unexpected },
    '@/lib/rateLimit': {
      applyRateLimit: async () => null, getClientIp: () => 'test',
      RATE_LIMITS: new Proxy({}, { get: () => ({ limit: 10, windowMs: 60000 }) }),
    },
  }
  for (const path of ['auth/login', 'auth/reset-request', 'auth/reset-confirm', 'solicitacoes']) {
    const { POST } = loadTs(`src/app/api/${path}/route.ts`, overrides)
    for (const [body, status] of [['x'.repeat(16385), 413], ['{', 400]]) {
      const response = await POST(new NextRequest(`http://localhost/api/${path}`, { method: 'POST', body }))
      assert.equal(response.status, status, path)
    }
  }
})

test('webhook rejects forged authentication before reading body, and bounds authenticated streams', async () => {
  const previous = process.env.ASAAS_WEBHOOK_TOKEN
  process.env.ASAAS_WEBHOOK_TOKEN = 'synthetic-webhook-secret-for-security-tests'
  try {
    const { POST } = loadTs('src/app/api/webhooks/asaas/route.ts', {
      '@/lib/auditoria': { executarComAuditoria: () => { throw new Error('Unexpected write') } },
      '@/lib/financeiro/faturas': {},
    })
    const unauthorized = await POST({ headers: new Headers(), get body() { throw new Error('Unauthorized read') } })
    assert.equal(unauthorized.status, 401)
    let cancelled = false
    const body = new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(8192)) },
      cancel() { cancelled = true },
    })
    const response = await POST(new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST', headers: { 'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN }, body, duplex: 'half',
    }))
    assert.equal(response.status, 413)
    assert.equal(cancelled, true)
  } finally {
    if (previous === undefined) delete process.env.ASAAS_WEBHOOK_TOKEN
    else process.env.ASAAS_WEBHOOK_TOKEN = previous
  }
})
