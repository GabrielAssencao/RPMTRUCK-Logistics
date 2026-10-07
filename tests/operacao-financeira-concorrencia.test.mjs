import assert from 'node:assert/strict'
import test from 'node:test'
import { Prisma } from '@prisma/client'
import { loadTs } from './helpers/load-ts.mjs'

test('duas operações da mesma empresa não chegam ao provedor ao mesmo tempo', async () => {
  let held = false, entered = 0
  let release
  const waiting = new Promise(resolve => { release = resolve })
  const prisma = {
    operacaoFinanceira: {
      create: async () => {
        if (held) throw new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.4.1' })
        held = true
      },
      deleteMany: async () => { held = false; return { count: 1 } },
    },
    empresa: { findFirst: async () => ({ id: 'empresa-a' }) },
  }
  const { comOperacaoFinanceira } = loadTs('src/lib/financeiro/operacaoFinanceira.ts', { '@/lib/prisma': { prisma } })
  const first = comOperacaoFinanceira('empresa-a', 'EMITIR_COBRANCA', async () => { entered++; await waiting })
  await new Promise(resolve => setImmediate(resolve))
  await assert.rejects(comOperacaoFinanceira('empresa-a', 'ADESAO_CARTAO', async () => { entered++ }), /operação financeira em andamento/)
  assert.equal(entered, 1)
  release()
  await first
  assert.equal(held, false)
})

test('resultado incerto conserva o bloqueio para conciliação', async () => {
  let deleted = false
  const prisma = {
    operacaoFinanceira: { create: async () => ({}), deleteMany: async () => { deleted = true } },
    empresa: { findFirst: async () => ({ id: 'empresa-a' }) },
  }
  const { comOperacaoFinanceira, OperacaoFinanceiraError } = loadTs('src/lib/financeiro/operacaoFinanceira.ts', { '@/lib/prisma': { prisma } })
  await assert.rejects(comOperacaoFinanceira('empresa-a', 'EMITIR_COBRANCA', async () => {
    throw new OperacaoFinanceiraError('Resposta incerta do provedor', 503, true)
  }))
  assert.equal(deleted, false)
})
