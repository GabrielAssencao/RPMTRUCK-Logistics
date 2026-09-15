import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { NextRequest } from 'next/server.js'
import { loadTs } from './helpers/load-ts.mjs'

test('superadmin recebe usuários do tenant com primeiro acesso e reset, sem credenciais', async () => {
  const consultas = []
  const expiraEm = new Date(Date.now() - 60_000)
  const prisma = {
    usuario: {
      findMany: async (query) => {
        consultas.push(query)
        return [{
          id: 'user-a', nome: 'Maria Souza', email: 'maria@example.invalid', role: 'OPERADOR', ativo: true,
          exigeTrocaSenha: true, senhaTemporariaExpiraEm: expiraEm, senhaAlteradaEm: new Date(),
          criado_em: new Date(), atualizado_em: new Date(),
        }]
      },
    },
    resetSenha: {
      findMany: async (query) => {
        consultas.push(query)
        return [{ id: 'reset-a', email: 'maria@example.invalid', status: 'PENDENTE', criado_em: new Date(), atualizado_em: new Date() }]
      },
    },
  }
  const { GET } = loadTs('src/app/api/empresas/[id]/usuarios/route.ts', {
    '@/lib/auth': { requireAdminAuth: async () => ({ session: { userId: 'admin-a', role: 'ADMIN_RPM' } }) },
    '@/lib/prisma': { prisma },
    '@/lib/password': { hashPassword: async () => 'unused' },
    '@/lib/notificacoes': { criarNotificacao: async () => undefined },
    '@/lib/usuariosEmpresa': {},
  })

  const response = await GET(new NextRequest('http://localhost/api/empresas/company-a/usuarios'), { params: Promise.resolve({ id: 'company-a' }) })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(consultas[0].where, { empresaId: 'company-a', excluidoEm: null })
  assert.equal(consultas[0].select.senha_hash, undefined)
  assert.equal(body[0].nome, 'Maria Souza')
  assert.equal(body[0].credencialTemporariaExpirada, true)
  assert.equal(body[0].ultimoReset.status, 'PENDENTE')
  assert.equal(body[0].senha_hash, undefined)
})

test('fila de reset associa nome e empresa sem expor dados de autenticação', async () => {
  const consultas = []
  const prisma = {
    resetSenha: { findMany: async () => [{ id: 'reset-a', email: 'maria@example.invalid', status: 'PENDENTE', criado_em: new Date(), atualizado_em: new Date() }] },
    usuario: {
      findMany: async (query) => {
        consultas.push(query)
        return [{ id: 'user-a', nome: 'Maria Souza', email: 'maria@example.invalid', role: 'OPERADOR', ativo: true, empresa: { id: 'company-a', nome: 'Transportadora A', excluidoEm: null } }]
      },
    },
  }
  const { GET } = loadTs('src/app/api/resets/route.ts', {
    '@/lib/auth': { requireAdminAuth: async () => ({ session: { userId: 'admin-a', role: 'ADMIN_RPM' } }) },
    '@/lib/prisma': { prisma },
  })

  const response = await GET(new NextRequest('http://localhost/api/resets'))
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(consultas[0].select.senha_hash, undefined)
  assert.equal(body[0].usuario.nome, 'Maria Souza')
  assert.equal(body[0].usuario.empresa.nome, 'Transportadora A')
  assert.equal(body[0].usuario.senha_hash, undefined)
})

test('solicitações aprovadas exibem o estado do primeiro acesso da conta ativa', () => {
  const route = load('src/app/api/solicitacoes/route.ts')
  const page = load('src/app/dashboard/admin/_modulos/solicitacoes/AdminRequests.jsx')

  assert.match(route, /empresa: \{ is: \{ excluidoEm: null \} \}/)
  assert.match(route, /credencialTemporariaExpirada/)
  assert.match(page, /Primeiro acesso concluído/)
  assert.match(page, /Aguardando troca da senha/)
  assert.match(page, /Senha temporária expirada/)
})

function load(path) {
  return readFileSync(path, 'utf8')
}
