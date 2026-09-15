// All users, sessions and operational fixtures live inside one rollback-only transaction.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server.js'
import * as jose from 'jose'
import { loadTs } from '../tests/helpers/load-ts.mjs'

if (process.env.LOCAL_ENVIRONMENT !== 'development') throw new Error('Only isolated local development is permitted.')
await import('./verify-local-environment.mjs')
const prisma = new PrismaClient()
const companyIds = [randomUUID(), randomUUID()]
const rollback = new Error('ROLLBACK_TENANT_SECURITY_FIXTURES')
try {
  await prisma.$transaction(async tx => {
    for (const id of companyIds) await tx.empresa.create({ data: { id, nome: 'Synthetic tenant fixture', email: `${id}@example.invalid`, plano: 'ENTERPRISE', modulos: ['FROTA', 'GESTAO', 'TAREFAS', 'NOTIFICACOES'] } })
    const users = []
    for (const [role, empresaId] of [['GESTOR_EMPRESA', companyIds[0]], ['OPERADOR', companyIds[0]], ['VISUALIZADOR', companyIds[0]], ['GESTOR_EMPRESA', companyIds[1]]]) {
      const user = await tx.usuario.create({ data: { nome: 'Synthetic tenant user', email: `${randomUUID()}@example.invalid`, senha_hash: 'synthetic-unused-login-hash', role, empresaId, modulosAcesso: ['FROTA', 'TAREFAS', 'NOTIFICACOES'] } })
      const session = await tx.sessaoUsuario.create({ data: { usuarioId: user.id, empresaId, expiraEm: new Date(Date.now() + 300000) } })
      users.push({ ...user, sessionId: session.id })
    }
    const vehicles = []
    for (const empresaId of companyIds) vehicles.push(await tx.veiculo.create({ data: { empresaId, placa: randomUUID().slice(0, 7).toUpperCase(), modelo: 'Synthetic truck', tipo: 'Synthetic fixture', ano: 2026, quilometragem: 0 } }))
    const reminders = []
    for (const user of users) reminders.push(await tx.lembretePessoal.create({ data: { usuarioId: user.id, empresaId: user.empresaId, titulo: 'Synthetic personal reminder', dataHora: new Date(Date.now() + 86400000), notificarEm: new Date() } }))
    const unlimitedFixture = { applyRateLimit: async () => null, RATE_LIMITS: Object.fromEntries(['AUTHENTICATED_READ', 'AUTHENTICATED_MUTATION', 'TASK_READ', 'TASK_MUTATION', 'ADMIN_READ', 'ADMIN_MUTATION'].map(name => [name, { limit: 100, windowMs: 60000 }])) }
    const overrides = {
      jose,
      '@/lib/prisma': { prisma: tx },
      '@/lib/rateLimit': unlimitedFixture,
      '@/lib/fieldEncryption': { exposeEmpresa: value => value },
      '@/lib/financeiro/acessoFinanceiro': { verificarAcessoFinanceiro: async () => ({ bloqueado: false }) },
      '@/lib/auditoria': { executarComAuditoria: async (_, callback) => callback(tx) },
      '@/lib/notificacoes': { criarNotificacao: async () => undefined },
    }
    const cache = new Map()
    const auth = loadTs('src/lib/auth.ts', overrides, cache)
    const vehicleApi = loadTs('src/app/api/veiculos/route.ts', overrides, cache)
    const reminderApi = loadTs('src/app/api/lembretes-pessoais/route.ts', overrides, cache)
    const reminderItem = loadTs('src/app/api/lembretes-pessoais/[id]/route.ts', overrides, cache)
    const permissionsApi = loadTs('src/app/api/empresa/usuarios/[id]/route.ts', overrides, cache)
    async function req(user, path, method = 'GET', data, extra = {}) {
      const token = await new jose.SignJWT({ userId: user.id, email: user.email, empresaId: user.empresaId, role: user.role, sessionVersion: user.sessaoVersao, sessionId: user.sessionId, ...extra }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(process.env.JWT_SECRET))
      return new NextRequest(`http://localhost${path}`, { method, headers: { Cookie: `rpmtruck_session=${token}`, 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) })
    }
    const ownVehicles = await (await vehicleApi.GET(await req(users[1], '/api/veiculos?empresaId=' + companyIds[1]))).json()
    assert.deepEqual(ownVehicles.map(item => item.id), [vehicles[0].id])
    const ownReminders = await (await reminderApi.GET(await req(users[1], '/api/lembretes-pessoais?usuarioId=' + users[0].id))).json()
    assert.deepEqual(ownReminders.map(item => item.id), [reminders[1].id])
    for (const foreign of [reminders[0], reminders[3]]) {
      const props = { params: Promise.resolve({ id: foreign.id }) }
      assert.equal((await reminderItem.DELETE(await req(users[1], `/api/lembretes-pessoais/${foreign.id}`, 'DELETE'), props)).status, 404)
    }
    assert.equal((await auth.requireAdminAuth(await req(users[1], '/api/admin/seguranca'))).status, 403)
    assert.equal((await auth.requireAuth(await req(users[1], '/api/admin/seguranca', 'GET', undefined, { role: 'ADMIN_RPM' }))).status, 401)
    assert.equal((await vehicleApi.POST(await req(users[2], '/api/veiculos', 'POST', {}))).status, 403)
    assert.equal((await permissionsApi.PATCH(await req(users[0], `/api/empresa/usuarios/${users[3].id}`, 'PATCH', { ativo: false }), { params: Promise.resolve({ id: users[3].id }) })).status, 404)
    assert.equal((await permissionsApi.PATCH(await req(users[0], `/api/empresa/usuarios/${users[1].id}`, 'PATCH', { role: 'ADMIN_RPM' }), { params: Promise.resolve({ id: users[1].id }) })).status, 400)
    await tx.usuario.update({ where: { id: users[1].id }, data: { modulosAcesso: ['NOTIFICACOES'] } })
    assert.equal((await vehicleApi.GET(await req(users[1], '/api/veiculos'))).status, 403)
    await tx.sessaoUsuario.update({ where: { id: users[1].sessionId }, data: { revogadaEm: new Date() } })
    assert.equal((await auth.requireAuth(await req(users[1], '/api/veiculos'))).status, 401)
    assert.equal(await tx.lembretePessoal.count({ where: { empresaId: { in: companyIds } } }), 4)
    console.log('Database tenant isolation, owner isolation, role elevation, viewer writes, live permission removal and revoked-cookie replay passed.')
    throw rollback
  }, { timeout: 60000 })
} catch (error) { if (error !== rollback) throw new Error('Synthetic tenant isolation exercise failed; all fixtures rolled back.', { cause: error }) }
finally { await prisma.$disconnect() }
const verify = new PrismaClient()
try { assert.equal(await verify.empresa.count({ where: { id: { in: companyIds } } }), 0); console.log('Rollback verified: no synthetic companies or users persisted.') } finally { await verify.$disconnect() }
