import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server.js'
import { loadTs } from './helpers/load-ts.mjs'

test('edição do motorista rejeita payload vazio, campo inesperado e CPF inválido', () => {
  const { atualizacaoMotoristaSchema } = loadTs('src/lib/motoristaValidation.ts')

  assert.equal(atualizacaoMotoristaSchema.safeParse({}).success, false)
  assert.equal(atualizacaoMotoristaSchema.safeParse({ empresaId: 'company-b' }).success, false)
  assert.equal(atualizacaoMotoristaSchema.safeParse({ cpf: '11111111111' }).success, false)
  assert.equal(atualizacaoMotoristaSchema.safeParse({ nome: 'Carlos da Silva' }).success, true)
})

test('edição procura o motorista no tenant e protege documentos antes da escrita auditada', async () => {
  const consultas = []
  const escritas = []
  let busca = 0
  const atual = { id: 'driver-a', empresaId: 'company-a', nome: 'Nome antigo', cpf: 'cpf-antigo', rg: null, cnh: 'cnh-antiga' }
  const prisma = {
    motorista: {
      findFirst: async (query) => {
        consultas.push(query)
        busca += 1
        return busca === 1 ? atual : null
      },
    },
  }
  const tx = {
    motorista: {
      update: async (query) => {
        escritas.push(query)
        return { ...atual, ...query.data, cnh: query.data.cnh, empresaId: 'company-a' }
      },
      updateMany: async () => ({ count: 0 }),
    },
  }
  const { PATCH } = loadTs('src/app/api/motoristas/[id]/route.ts', {
    '@/lib/empresaAuth': { requireEmpresaAuth: async () => ({ session: { userId: 'manager-a', empresaId: 'company-a', role: 'GESTOR_EMPRESA' } }) },
    '@/lib/prisma': { prisma },
    '@/lib/auditoria': { executarComAuditoria: async (_contexto, executar) => executar(tx) },
    '@/lib/fieldEncryption': {
      encryptionConfigured: () => true,
      blindIndex: (valor, tenant, campo) => valor ? `hash:${tenant}:${campo}:${valor}` : null,
      encryptSensitive: (valor, tenant, campo) => valor ? `enc:${tenant}:${campo}:${valor}` : null,
      exposeMotorista: (valor) => valor,
    },
    '@/lib/motoristaFotos': { removerFotoMotorista: async () => undefined },
  })

  const response = await PATCH(new NextRequest('http://localhost/api/motoristas/driver-a', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: 'Carlos da Silva',
      cpf: '529.982.247-25',
      rg: '12.345.678-9',
      cnh: '01234567890',
      categoria: 'E',
      validade: '2028-10-31',
      status: 'DISPONIVEL',
    }),
  }), { params: Promise.resolve({ id: 'driver-a' }) })

  assert.equal(response.status, 200)
  assert.deepEqual(consultas[0].where, { id: 'driver-a', empresaId: 'company-a' })
  assert.equal(consultas[1].where.empresaId, 'company-a')
  assert.deepEqual(consultas[1].where.id, { not: 'driver-a' })
  assert.equal(escritas.length, 1)
  assert.equal(escritas[0].data.cpf, 'enc:company-a:motorista.cpf:52998224725')
  assert.equal(escritas[0].data.cpfHash, 'hash:company-a:motorista.cpf:52998224725')
  assert.equal(escritas[0].data.cnh, 'enc:company-a:motorista.cnh:01234567890')
})

test('identificador de outro tenant não produz escrita', async () => {
  let escreveu = false
  const { PATCH } = loadTs('src/app/api/motoristas/[id]/route.ts', {
    '@/lib/empresaAuth': { requireEmpresaAuth: async () => ({ session: { userId: 'manager-a', empresaId: 'company-a', role: 'GESTOR_EMPRESA' } }) },
    '@/lib/prisma': { prisma: { motorista: { findFirst: async () => null } } },
    '@/lib/auditoria': { executarComAuditoria: async () => { escreveu = true } },
    '@/lib/fieldEncryption': {},
    '@/lib/motoristaFotos': { removerFotoMotorista: async () => undefined },
  })

  const response = await PATCH(new NextRequest('http://localhost/api/motoristas/driver-b', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'Nome válido' }),
  }), { params: Promise.resolve({ id: 'driver-b' }) })

  assert.equal(response.status, 404)
  assert.equal(escreveu, false)
})
