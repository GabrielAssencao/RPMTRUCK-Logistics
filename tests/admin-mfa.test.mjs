import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { NextRequest } from 'next/server.js'
import { loadTs } from './helpers/load-ts.mjs'

const { codigoTotp, verificarTotp, novoSegredoTotp } = loadTs('src/lib/totp.ts')
const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' // RFC 6238 public test key

test('TOTP matches all RFC 6238 SHA1 test vectors and blocks replay', () => {
  for (const [seconds, expected] of [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']]) {
    assert.equal(codigoTotp(secret, Math.floor(seconds / 30), 8), expected)
  }
  const now = Date.now(), counter = Math.floor(now / 30000), code = codigoTotp(secret, counter)
  assert.equal(verificarTotp(secret, code, -1, now), counter)
  assert.equal(verificarTotp(secret, code, counter, now), null)
  assert.equal(verificarTotp(secret, 'not-a-code', -1, now), null)
  assert.match(novoSegredoTotp(), /^[A-Z2-7]{32}$/)
})

test('admin MFA enrollment offers a locally generated QR Code without leaking the secret to an external service', () => {
  const form = readFileSync('src/app/auth/login/_componentes/AdminMfaForm.tsx', 'utf8')
  assert.match(form, /import\('@zxing\/library'\)/)
  assert.match(form, /BarcodeFormat\.QR_CODE/)
  assert.match(form, /QR Code para configurar o segundo fator/)
  assert.match(form, /AuthenticatorRecommendations/)
  assert.match(form, /Não compartilhe o QR Code nem a chave/)
  assert.doesNotMatch(form, /api\.qrserver|chart\.googleapis|quickchart/i)
})

test('MFA recommends only official authenticator pages and is documented in tutorials', () => {
  const recommendations = readFileSync('src/components/security/AuthenticatorRecommendations.tsx', 'utf8')
  const tutorials = readFileSync('src/data/tutoriais.ts', 'utf8')
  const tutorialPage = readFileSync('src/app/dashboard/empresa/tutoriais/page.tsx', 'utf8')

  assert.match(recommendations, /support\.google\.com\/accounts\/answer\/1066447/)
  assert.match(recommendations, /support\.microsoft\.com\/pt-br\/authenticator\/download-microsoft-authenticator/)
  assert.match(recommendations, /rel="noopener noreferrer"/)
  assert.match(tutorials, /id: 'mfa'/)
  assert.match(tutorials, /códigos de recuperação/)
  assert.match(tutorialPage, /mostrarAplicativosAutenticadores/)
})

function fixture({ activated = false, role = 'ADMIN_RPM' } = {}) {
  const state = { segredo: secret, ativadoEm: activated ? new Date() : null, ultimoContador: -1, recuperacao: [], desafioHash: 'challenge', desafioExpiraEm: new Date(Date.now() + 300000) }
  const user = { id: 'admin-1', email: 'admin@example.invalid', nome: 'Admin', role, empresaId: null, ativo: true, excluidoEm: null, exigeTrocaSenha: false, sessaoVersao: 1, mfaAdmin: state }
  const sessions = [], tokens = []
  const challenge = { usuarioId: user.id, hash: 'challenge', versao: 1 }
  const { hashRecuperacao } = loadTs('src/lib/adminMfa.ts', { '@/lib/prisma': {} })
  const tx = {
    mfaAdmin: { updateMany: async ({ where, data }) => {
      if (state.desafioHash !== where.desafioHash || (where.ultimoContador !== undefined && state.ultimoContador !== where.ultimoContador)) return { count: 0 }
      Object.assign(state, data); return { count: 1 }
    } },
    sessaoUsuario: { create: async ({ data }) => { sessions.push(data); return { id: 'session-1' } }, updateMany: async () => ({ count: 1 }) },
    dispositivoConfiavel: { updateMany: async () => ({ count: 1 }) },
    usuario: { update: async () => ({ sessaoVersao: 2 }) },
  }
  const { POST } = loadTs('src/app/api/auth/mfa/route.ts', {
    '@/lib/prisma': { prisma: { usuario: { findUnique: async () => user }, mfaAdmin: tx.mfaAdmin, $transaction: async callback => callback(tx) } },
    '@/lib/auth': { isAdminRole: role => ['ADMIN', 'ADMIN_RPM'].includes(role), createSession: async data => tokens.push(data) },
    '@/lib/adminMfa': { hashRecuperacao, lerDesafioMfa: async () => challenge, iniciarDesafioMfa: async () => ({ mfaObrigatorio: true, configurar: true }), MFA_COOKIE: 'test-mfa' },
    '@/lib/fieldEncryption': { decryptSensitive: data => data, encryptSensitive: data => data },
    '@/lib/rateLimit': { applyRateLimit: async () => null, getClientIp: () => 'test' },
    '@/lib/securityEvents': { pseudonymize: () => 'hashed', safeUserAgent: () => 'test', recordSecurityEvent: async () => {} },
    '@/lib/trustedDevice': { registrarDispositivoConfiavel: async () => {}, revogarDispositivosConfiaveis: async () => {} },
    '@/lib/financeiro/acessoFinanceiro': { verificarAcessoFinanceiro: async () => ({ bloqueado: false }) },
    '@/lib/financeiro/situacaoFinanceira': { podeRegularizarFinanceiro: () => false },
  })
  const send = codigo => POST(new NextRequest('http://localhost/api/auth/mfa', { method: 'POST', body: JSON.stringify({ codigo }) }))
  return { state, sessions, tokens, send, hashRecuperacao, user }
}

test('enrollment creates MFA session only after a valid code and shows recovery codes once', async () => {
  const f = fixture()
  assert.equal((await f.send('badcode')).status, 401)
  assert.equal(f.sessions.length, 0)
  const code = codigoTotp(secret, Math.floor(Date.now() / 30000))
  const response = await f.send(code), body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(f.tokens[0].mfaVerified, true)
  assert.equal(body.codigosRecuperacao.length, 10)
  assert.ok(body.codigosRecuperacao.every(code => !f.state.recuperacao.includes(code)))
  assert.equal((await f.send(code)).status, 401)
  assert.equal(f.sessions.length, 1)
})

test('recovery code is consumed once; operator and expired challenge never receive a session', async () => {
  const f = fixture({ activated: true })
  const code = 'AABBCCDDEEFF001122334455'
  f.state.recuperacao = [f.hashRecuperacao(f.user.id, code)]
  assert.equal((await f.send(code)).status, 202)
  assert.equal(f.sessions.length, 0)
  assert.deepEqual(f.state.recuperacao, [])
  f.state.desafioHash = 'challenge'
  assert.equal((await f.send(code)).status, 401)
  const operator = fixture({ role: 'OPERADOR' })
  assert.equal((await operator.send(codigoTotp(secret, Math.floor(Date.now() / 30000)))).status, 401)
  const expired = fixture(); expired.state.desafioExpiraEm = new Date(0)
  assert.equal((await expired.send('123456')).status, 401)
  assert.equal(operator.sessions.length + expired.sessions.length, 0)
})

test('simultaneous MFA submissions cannot mint two sessions', async () => {
  const f = fixture({ activated: true })
  const code = codigoTotp(secret, Math.floor(Date.now() / 30000))
  const responses = await Promise.all([f.send(code), f.send(code)])
  assert.equal(responses.filter(response => response.status === 200).length, 1)
  assert.equal(f.sessions.length, 1)
})
