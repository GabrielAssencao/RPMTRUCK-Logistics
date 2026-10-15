import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server.js'
import { loadTs } from './helpers/load-ts.mjs'

function setup(authorized = true) {
  const queries = []
  let rawQueryCalls = 0
  const events = Array.from({ length: 45 }, (_, id) => ({ id: String(id), tipo: 'LOGIN_SUCESSO', criadoEm: new Date(), ipHash: 'private-hash-never-exposed', usuario: null, empresa: null }))
  const model = name => ({
    findMany: async options => { queries.push([name, options]); return name === 'eventos' ? events.slice(options.skip, options.skip + options.take) : [] },
    count: async () => 0,
    groupBy: async () => [],
  })
  const { GET } = loadTs('src/app/api/admin/seguranca/route.ts', {
    '@/lib/auth': { requireAdminAuth: async () => authorized ? { session: { userId: 'admin' } } : { error: 'Unauthorized', status: 401 } },
    '@/lib/rateLimit': { applyRateLimit: async () => null, RATE_LIMITS: { ADMIN_READ: { limit: 100, windowMs: 60000 } } },
    '@/lib/prisma': { prisma: { sessaoUsuario: model('sessoes'), eventoSeguranca: model('eventos'), auditoriaLog: model('auditoria'), exclusaoEmpresaJob: model('exclusoes'), rateLimit: { count: async () => 0 }, relatorioArquivo: { aggregate: async () => ({ _sum: { tamanho_bytes: 0 } }) }, empresa: { findMany: async () => [], findUnique: async () => ({ id: 'company' }) }, usuario: { findMany: async () => [] }, $queryRaw: async () => { rawQueryCalls += 1; return rawQueryCalls % 3 === 1 ? [{ bytes: 0n }] : rawQueryCalls % 3 === 0 ? [{ total: 0, geolocalizados: 0 }] : [] } } },
    '@/lib/storageCapacity': { getDatabaseSoftLimitBytes: () => 500 * 1024 * 1024 },
    '@/lib/relatoriosStorage': { getRelatoriosSoftLimitBytes: () => 700 * 1024 * 1024 },
  })
  return { get: query => GET(new NextRequest(`http://localhost/api/admin/seguranca${query}`)), queries }
}

test('logs return bounded independent pages and preserve privacy and filters', async () => {
  const { get, queries } = setup()
  const first = await (await get('')).json()
  const second = await (await get('?paginaEVENTOS=2')).json()
  assert.equal(first.eventos.length, 20)
  assert.equal(second.eventos.length, 20)
  assert.equal(second.eventos[0].id, '20')
  assert.equal(second.paginacao.EVENTOS.temProxima, true)
  assert.equal(second.paginacao.SESSOES.pagina, 1)
  assert.ok(second.eventos.every(event => !('ipHash' in event)))
  const last = await (await get('?paginaEVENTOS=3&empresaId=SISTEMA')).json()
  assert.equal(last.eventos.length, 5)
  assert.equal(last.paginacao.EVENTOS.temProxima, false)
  assert.equal(last.exclusoes.length, 0)
  const query = queries.filter(([name]) => name === 'eventos').at(-1)[1]
  assert.equal(query.where.empresaId, null)
  assert.ok(query.where.criadoEm.gte instanceof Date)
  assert.equal(query.take, 21)
  assert.deepEqual(query.orderBy, [{ criadoEm: 'desc' }, { id: 'desc' }])
})

test('security filters are validated and applied server-side', async () => {
  const { get, queries } = setup()
  assert.equal((await get('?periodo=INVALIDO')).status, 400)
  assert.equal((await get('?tipoEvento=OUTRO')).status, 400)
  const response = await get('?periodo=30D&tipoEvento=LOGIN_FALHA&busca=IP%23abcdef')
  assert.equal(response.status, 200)
  const query = queries.findLast(([name]) => name === 'eventos')[1]
  assert.equal(query.where.tipo, 'LOGIN_FALHA')
  assert.deepEqual(query.where.OR.at(-1), { ipHash: { startsWith: 'abcdef' } })
})

test('invalid log pages are rejected before any database query', async () => {
  const { get, queries } = setup()
  for (const page of ['0', '-1', '1.5', 'abc', '100001', '']) assert.equal((await get(`?paginaEVENTOS=${page}`)).status, 400)
  assert.equal(queries.length, 0)
})

test('log pagination remains restricted to administrators', async () => {
  const { get, queries } = setup(false)
  assert.equal((await get('?paginaEVENTOS=2')).status, 401)
  assert.equal(queries.length, 0)
})
