import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractTunnelUrl,
  normalizeApiKey,
  selectWebhook,
} from '../scripts/start-payment-development.mjs'

test('iniciador reconhece somente URL pública do Quick Tunnel', () => {
  assert.equal(
    extractTunnelUrl('INF Your quick Tunnel has been created! Visit it at https://safe-example.trycloudflare.com'),
    'https://safe-example.trycloudflare.com',
  )
  assert.equal(extractTunnelUrl('https://example.com'), null)
  assert.equal(
    extractTunnelUrl('https://safe-example.trycloud' + 'flare.com'),
    'https://safe-example.trycloudflare.com',
  )
})

test('iniciador normaliza apenas o escape inicial da chave sandbox', () => {
  assert.equal(normalizeApiKey('\\$aact_hmlg_example'), '$aact_hmlg_example')
  assert.equal(normalizeApiKey('$aact_hmlg_example'), '$aact_hmlg_example')
})

test('iniciador seleciona um único webhook existente pela rota exata', () => {
  const selected = selectWebhook([
    { id: 'one', url: 'https://old.trycloudflare.com/api/webhooks/asaas' },
    { id: 'two', url: 'https://example.com/api/other' },
  ])
  assert.equal(selected.id, 'one')
  assert.throws(
    () => selectWebhook([
      { id: 'one', url: 'https://one.trycloudflare.com/api/webhooks/asaas' },
      { id: 'two', url: 'https://two.trycloudflare.com/api/webhooks/asaas' },
    ]),
    /ASAAS_WEBHOOK_ID/,
  )
})
