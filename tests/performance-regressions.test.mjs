import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

const nativeRequire = createRequire(import.meta.url)
function compile(source, dependencies = {}) {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  new Function('exports', 'require', js)(exports, name => name in dependencies ? dependencies[name] : nativeRequire(name))
  return exports
}

test('topografia otimizada preserva o campo visual original em todo o ciclo', () => {
  const source = readFileSync('src/components/dashboard/DashboardEnvironmentBackground.tsx', 'utf8')
  const functions = source.slice(source.indexOf('interface Relevo'), source.indexOf('function pontoNaAresta'))
  const { criarRelevos, valorDoRelevo } = compile(functions + '\nexports.criarRelevos = criarRelevos; exports.valorDoRelevo = valorDoRelevo;')
  for (const phase of [0, 0.5, 1.8, Math.PI, 5, 2 * Math.PI]) {
    const hills = criarRelevos(phase)
    const original = [
      [0.16 + Math.sin(phase) * 0.055, 0.18 + Math.cos(phase) * 0.035, 0.23, 0.31, 1.12],
      [0.79 + Math.cos(phase) * 0.06, 0.2 + Math.sin(phase * 2) * 0.025, 0.3, 0.28, 0.98],
      [0.53 + Math.sin(phase + 1.8) * 0.07, 0.82 + Math.cos(phase) * 0.045, 0.34, 0.3, 1.24],
      [-0.08 + Math.cos(phase + 0.7) * 0.035, 0.67, 0.25, 0.37, 0.82],
    ]
    for (let row = 0; row <= 20; row++) for (let column = 0; column <= 30; column++) {
      const x = column / 30, y = row / 20
      const expected = original.reduce((sum, [hx, hy, sx, sy, height]) => {
        const dx = (x - hx) / sx, dy = (y - hy) / sy
        return sum + height * Math.exp(-(dx * dx + dy * dy) * 1.15)
      }, 0) + Math.sin(x * 5.2 + y * 3.1 + Math.sin(phase) * 0.55) * 0.035
      assert.equal(valorDoRelevo(x, y, hills, Math.sin(phase) * 0.55), expected)
    }
  }
})

const session = { userId: 'user-a', empresaId: 'company-a', role: 'GESTOR_EMPRESA' }
const auth = { error: null, status: 200, session }
const request = { nextUrl: { searchParams: new URLSearchParams('resumo=true') } }
const response = { NextResponse: { json: (body, options) => ({ body, ...options }) } }

test('resumo de suporte empresarial só conta mensagens autorizadas e não busca tickets', async () => {
  const z = nativeRequire('zod').z
  let query
  const dependencies = {
    'next/server': response,
    '@/lib/auth': { requireAuth: async () => auth, isAdminRole: () => false },
    '@/lib/empresaAuth': { requireEmpresaAuth: async () => ({ ...auth, empresa: { id: 'company-a', plano: 'ESSENCIAL' } }) },
    '@/lib/domainValidation': { textoOperacional: () => z.string() },
    '@/lib/prisma': { prisma: { mensagemSuporte: { count: async value => { query = value; return 7 } } } },
    '@/lib/rateLimit': { applyRateLimit: async () => null, RATE_LIMITS: { CHAT_READ: { limit: 1, windowMs: 1 } } },
    '@/lib/suporte': {}, '@/lib/suporteConfig': {}, '@/lib/notificacoes': {}, '@/lib/auditoria': {}, '@/lib/suporteBot': {},
  }
  const { GET } = compile(readFileSync('src/app/api/chat/route.ts', 'utf8'), dependencies)
  const result = await GET(request)
  assert.deepEqual(result.body, { resumo: { mensagensNaoLidas: 7 } })
  assert.equal(query.where.conversa.empresaId, 'company-a')
  assert.equal(query.where.visibilidade, 'TODOS')
  assert.equal(query.where.lida_em, null)
  assert.equal(result.headers['Cache-Control'], 'private, no-store')
  dependencies['@/lib/empresaAuth'].requireEmpresaAuth = async () => ({ error: 'Denied', status: 403 })
  assert.equal((await GET(request)).status, 403)
})

test('resumo de suporte admin mantém autenticação e consulta única', async () => {
  let queries = 0
  const dependencies = {
    'next/server': response,
    '@/lib/auth': { requireAdminAuth: async () => auth },
    '@/lib/prisma': { prisma: { mensagemSuporte: { count: async query => {
      queries++
      assert.equal(query.where.tipo, 'USUARIO')
      assert.equal(query.where.lida_em, null)
      return 4
    } } } },
    '@/lib/rateLimit': { applyRateLimit: async () => null, RATE_LIMITS: { CHAT_READ: { limit: 1, windowMs: 1 } } },
    '@/lib/suporte': {},
  }
  const { GET } = compile(readFileSync('src/app/api/admin/chat/route.ts', 'utf8'), dependencies)
  assert.deepEqual((await GET(request)).body, { resumo: { mensagensNaoLidas: 4 } })
  assert.equal(queries, 1)
  dependencies['@/lib/auth'].requireAdminAuth = async () => ({ error: 'Denied', status: 403 })
  assert.equal((await GET(request)).status, 403)
  assert.equal(queries, 1)
})
