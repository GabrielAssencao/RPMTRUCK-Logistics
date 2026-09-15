import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server.js'
import { loadTs } from './helpers/load-ts.mjs'

const routePath = 'src/app/api/admin/usuarios/[id]/reemitir-primeiro-acesso/route.ts'

function carregarRota({ usuario, updateCount = 1 } = {}) {
  const chamadas = { consultas: [], hashes: [], transacoes: [], usuarios: [], sessoes: [] }
  const tx = {
    usuario: {
      updateMany: async (query) => {
        chamadas.usuarios.push(query)
        return { count: updateCount }
      },
    },
    sessaoUsuario: {
      updateMany: async (query) => {
        chamadas.sessoes.push(query)
        return { count: 2 }
      },
    },
  }
  const { POST } = loadTs(routePath, {
    '@/lib/auth': { requireAdminAuth: async () => ({ session: { userId: 'admin-a', role: 'ADMIN_RPM' } }) },
    '@/lib/prisma': {
      prisma: {
        usuario: {
          findFirst: async (query) => {
            chamadas.consultas.push(query)
            return usuario
          },
        },
      },
    },
    '@/lib/rateLimit': {
      RATE_LIMITS: {
        ADMIN_MUTATION: { limit: 20, windowMs: 60_000 },
        PASSWORD_RESET_ACCOUNT: { limit: 5, windowMs: 60_000 },
      },
      applyRateLimit: async () => null,
    },
    '@/lib/password': {
      hashPassword: async (senha) => {
        chamadas.hashes.push(senha)
        return 'hash-seguro'
      },
    },
    '@/lib/temporaryPassword': {
      gerarSenhaTemporaria: () => 'SenhaTemporaria@123',
      TEMPORARY_PASSWORD_TTL_MS: 72 * 60 * 60 * 1000,
    },
    '@/lib/auditoria': {
      executarComAuditoria: async (contexto, callback, options) => {
        chamadas.transacoes.push({ contexto, options })
        return callback(tx)
      },
    },
  })
  return { POST, chamadas }
}

const usuarioPendente = {
  id: 'user-a',
  nome: 'Maria Souza',
  email: 'maria@example.invalid',
  ativo: true,
  exigeTrocaSenha: true,
  senha_hash: 'hash-anterior',
  empresa: { id: 'company-a', nome: 'Transportadora A', excluidoEm: null },
}

test('superadmin reemite primeiro acesso, invalida sessões e nunca retorna o hash', async () => {
  const { POST, chamadas } = carregarRota({ usuario: usuarioPendente })
  const response = await POST(
    new NextRequest('http://localhost/api/admin/usuarios/user-a/reemitir-primeiro-acesso', { method: 'POST' }),
    { params: Promise.resolve({ id: 'user-a' }) },
  )
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store, max-age=0')
  assert.equal(body.credencialTemporaria.senha, 'SenhaTemporaria@123')
  assert.equal(body.credencialTemporaria.senha_hash, undefined)
  assert.deepEqual(chamadas.hashes, ['SenhaTemporaria@123'])
  assert.deepEqual(chamadas.consultas[0].where, { id: 'user-a', empresaId: { not: null }, excluidoEm: null })
  assert.equal(chamadas.usuarios[0].where.empresaId, 'company-a')
  assert.equal(chamadas.usuarios[0].where.senha_hash, 'hash-anterior')
  assert.equal(chamadas.usuarios[0].data.senha_hash, 'hash-seguro')
  assert.deepEqual(chamadas.usuarios[0].data.sessaoVersao, { increment: 1 })
  assert.deepEqual(chamadas.sessoes[0].where, { usuarioId: 'user-a', revogadaEm: null })
  assert.equal(chamadas.transacoes[0].contexto.origem, 'SUPERADMIN')
  assert.equal(chamadas.transacoes[0].options.isolationLevel, 'Serializable')
})

test('primeiro acesso já concluído não permite reemitir nem cria nova senha', async () => {
  const { POST, chamadas } = carregarRota({ usuario: { ...usuarioPendente, exigeTrocaSenha: false } })
  const response = await POST(
    new NextRequest('http://localhost/api/admin/usuarios/user-a/reemitir-primeiro-acesso', { method: 'POST' }),
    { params: Promise.resolve({ id: 'user-a' }) },
  )

  assert.equal(response.status, 409)
  assert.equal(chamadas.hashes.length, 0)
  assert.equal(chamadas.transacoes.length, 0)
})

test('concorrência ao trocar credencial falha fechada e não revoga sessões da operação vencedora', async () => {
  const { POST, chamadas } = carregarRota({ usuario: usuarioPendente, updateCount: 0 })
  const response = await POST(
    new NextRequest('http://localhost/api/admin/usuarios/user-a/reemitir-primeiro-acesso', { method: 'POST' }),
    { params: Promise.resolve({ id: 'user-a' }) },
  )
  const body = await response.json()

  assert.equal(response.status, 409)
  assert.match(body.erro, /alterada em outra operação/i)
  assert.equal(chamadas.sessoes.length, 0)
})

test('tela só oferece reemissão para conta ativa que ainda exige primeiro acesso', async () => {
  const source = await import('node:fs').then(({ readFileSync }) => readFileSync('src/app/dashboard/admin/_modulos/solicitacoes/AdminRequests.jsx', 'utf8'))
  assert.match(source, /acesso\?\.ativo && req\.acesso\?\.exigeTrocaSenha/)
  assert.match(source, /Reemitir credencial/)
  assert.match(source, /reemissao: true/)
})
