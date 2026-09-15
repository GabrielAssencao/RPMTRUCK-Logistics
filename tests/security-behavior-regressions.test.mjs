import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server.js'
import * as jose from 'jose'
import { loadTs } from './helpers/load-ts.mjs'

// Synthetic signing material, used only in this isolated test process.
process.env.JWT_SECRET = 'synthetic-test-signing-material-not-a-real-secret-2026'
const key = new TextEncoder().encode(process.env.JWT_SECRET)
const payload = { userId: 'user-a', email: 'user-a@example.invalid', empresaId: 'company-a', role: 'OPERADOR', sessionVersion: 1, sessionId: 'session-a' }
async function request(fields = {}, { algorithm = 'HS256', signingKey = key, expired = false, method = 'GET', path = '/api/veiculos' } = {}) {
  const token = await new jose.SignJWT({ ...payload, ...fields }).setProtectedHeader({ alg: algorithm }).setIssuedAt().setExpirationTime(expired ? '0s' : '5m').sign(signingKey)
  return new NextRequest(`http://localhost${path}`, { method, headers: { Cookie: `rpmtruck_session=${token}` } })
}
function setup(changes = {}) {
  const user = { ...payload, id: payload.userId, nome: 'Synthetic User', ativo: true, excluidoEm: null, sessaoVersao: 1, senhaAlteradaEm: new Date(), modulosAcesso: ['FROTA', 'NOTIFICACOES'], ...changes }
  const state = { revoked: false, limited: null, reads: 0 }
  const company = { id: 'company-a', nome: 'Synthetic Company', plano: 'ESSENCIAL', status: 'ATIVO', excluidoEm: null, modulos: ['FROTA', 'GESTAO', 'TAREFAS', 'NOTIFICACOES'], usuarios_adicionais: 0, veiculos_adicionais: 0 }
  const overrides = {
    jose,
    '@/lib/prisma': { prisma: {
      sessaoUsuario: {
        findFirst: async ({ where }) => { state.reads++; return !state.revoked && where.id === 'session-a' && where.usuarioId === user.id ? { usuario: user } : null },
        updateMany: async () => ({ count: 0 }),
      },
      usuario: { findUnique: async () => user },
      empresa: { findUnique: async ({ where }) => where.id === company.id ? company : null },
    } },
    '@/lib/rateLimit': { applyRateLimit: async () => state.limited, RATE_LIMITS: { AUTHENTICATED_READ: { limit: 300, windowMs: 60000 }, AUTHENTICATED_MUTATION: { limit: 60, windowMs: 60000 } } },
    '@/lib/financeiro/acessoFinanceiro': { verificarAcessoFinanceiro: async () => ({ bloqueado: false }) },
    '@/lib/fieldEncryption': { exposeEmpresa: data => data },
  }
  const cache = new Map()
  return { auth: loadTs('src/lib/auth.ts', overrides, cache), empresaAuth: loadTs('src/lib/empresaAuth.ts', overrides, cache), state, company, overrides }
}

test('signed session never grants a role, tenant or identity that differs from the database', async () => {
  for (const fields of [{ role: 'ADMIN_RPM' }, { empresaId: 'company-b' }, { email: 'other@example.invalid' }, { sessionVersion: 0 }, { userId: 'user-b' }]) {
    const { auth } = setup()
    assert.equal((await auth.requireAuth(await request(fields))).status, 401)
  }
})

test('expired, foreign-key and unsupported-algorithm tokens fail before database access', async () => {
  for (const options of [{ expired: true }, { signingKey: new TextEncoder().encode('another-synthetic-signing-key-for-test-only') }, { algorithm: 'HS512' }]) {
    const { auth, state } = setup()
    assert.equal((await auth.requireAuth(await request({}, options))).status, 401)
    assert.equal(state.reads, 0)
  }
})

test('revoked sessions, disabled users and deleted users cannot replay their cookies', async () => {
  for (const changes of [{ ativo: false }, { excluidoEm: new Date() }, { sessaoVersao: 2 }]) {
    const { auth } = setup(changes)
    assert.equal((await auth.requireAuth(await request())).status, 401)
  }
  const { auth, state } = setup()
  state.revoked = true
  assert.equal((await auth.requireAuth(await request())).status, 401)
})

test('valid company operators are denied admin and manager operations', async () => {
  const { auth, empresaAuth } = setup()
  assert.equal((await auth.requireAdminAuth(await request())).status, 403)
  assert.equal((await empresaAuth.requireEmpresaAuth(await request(), { acao: 'GESTAO' })).status, 403)
})

test('module grants and plan restrictions are enforced from current server data', async () => {
  const { empresaAuth, company } = setup()
  assert.equal((await empresaAuth.requireEmpresaAuth(await request(), { modulo: 'GESTAO' })).status, 403)
  assert.equal((await empresaAuth.requireEmpresaAuth(await request(), { modulo: 'FROTA' })).status, 200)
  assert.equal((await empresaAuth.requireEmpresaAuth(await request(), { exigirDelegacaoTarefas: true })).status, 403)
  company.status = 'INATIVO'
  assert.equal((await empresaAuth.requireEmpresaAuth(await request())).status, 403)
})

test('viewers cannot mutate and rate-limit failure closes access', async () => {
  const { empresaAuth } = setup({ role: 'VISUALIZADOR' })
  assert.equal((await empresaAuth.requireEmpresaAuth(await request({ role: 'VISUALIZADOR' }), { acao: 'ESCRITA' })).status, 403)
  for (const status of [429, 503]) {
    const { auth, state } = setup()
    state.limited = { status }
    assert.equal((await auth.requireAuth(await request())).status, status)
    assert.equal(state.reads, 0)
  }
})

test('malicious manager cannot grant admin, change tenant or grant an uncontracted module', async () => {
  const writes = []
  const fixture = setup()
  const manager = { session: { ...payload, role: 'GESTOR_EMPRESA' }, empresa: { id: 'company-a', modulosContratados: ['FROTA', 'NOTIFICACOES'] } }
  const prisma = { usuario: { findFirst: async ({ where }) => where.empresaId === 'company-a' && where.id === 'target-a' ? { id: 'target-a', role: 'OPERADOR' } : null } }
  const { PATCH } = loadTs('src/app/api/empresa/usuarios/[id]/route.ts', {
    ...fixture.overrides,
    '@/lib/empresaAuth': { requireEmpresaAuth: async () => manager },
    '@/lib/prisma': { prisma },
    '@/lib/rateLimit': { applyRateLimit: async () => null, RATE_LIMITS: { ADMIN_MUTATION: { limit: 30, windowMs: 60000 } } },
    '@/lib/auditoria': { executarComAuditoria: async () => { writes.push('write'); throw new Error('Unexpected write') } },
  })
  async function patch(data, id = 'target-a') {
    return PATCH(new NextRequest('http://localhost/api/empresa/usuarios/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }), { params: Promise.resolve({ id }) })
  }
  assert.equal((await patch({ role: 'ADMIN_RPM' })).status, 400)
  assert.equal((await patch({ ativo: true, empresaId: 'company-b' })).status, 400)
  assert.equal((await patch({ modulosAcesso: ['GESTAO'] })).status, 403)
  assert.equal((await patch({ ativo: false }, 'target-b')).status, 404)
  assert.equal((await patch({ ativo: false }, 'user-a')).status, 400)
  assert.equal(writes.length, 0)
})

test('personal reminder IDs remain scoped to both owner and company', async () => {
  const queries = [], writes = []
  const { DELETE, PATCH } = loadTs('src/app/api/lembretes-pessoais/[id]/route.ts', {
    '@/lib/lembreteAuth': { requireLembreteAuth: async () => ({ session: payload }) },
    '@/lib/rateLimit': { applyRateLimit: async () => null, RATE_LIMITS: { TASK_MUTATION: { limit: 30, windowMs: 60000 } } },
    '@/lib/prisma': { prisma: { lembretePessoal: { findFirst: async query => { queries.push(query); return null }, deleteMany: async query => { queries.push(query); return { count: 0 } }, update: async () => writes.push('write') } } },
  })
  const props = { params: Promise.resolve({ id: 'foreign-reminder' }) }
  assert.equal((await DELETE(new NextRequest('http://localhost/api/lembretes-pessoais/foreign-reminder', { method: 'DELETE' }), props)).status, 404)
  assert.equal((await PATCH(new NextRequest('http://localhost/api/lembretes-pessoais/foreign-reminder', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concluido: true }) }), props)).status, 404)
  for (const query of queries) assert.deepEqual(query.where, { id: 'foreign-reminder', empresaId: 'company-a', usuarioId: 'user-a' })
  assert.equal(writes.length, 0)
})
