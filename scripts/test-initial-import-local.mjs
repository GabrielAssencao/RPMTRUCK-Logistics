// Integration exercise: every fixture and audit entry is rolled back together.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { loadTs } from '../tests/helpers/load-ts.mjs'

if (process.env.LOCAL_ENVIRONMENT !== 'development') throw new Error('Use the isolated local development environment.')
await import('./verify-local-environment.mjs')
const prisma = new PrismaClient()
const rollback = new Error('ROLLBACK_SYNTHETIC_IMPORT_TEST')
const fixtureCompany = randomUUID()
try {
  await prisma.$transaction(async tx => {
    const company = await tx.empresa.create({ data: { id: fixtureCompany, nome: 'Synthetic onboarding fixture', email: `${fixtureCompany}@example.invalid`, plano: 'ENTERPRISE', modulos: ['FROTA', 'GESTAO'] } })
    const user = await tx.usuario.create({ data: { nome: 'Synthetic Admin', email: `${randomUUID()}@example.invalid`, senha_hash: 'synthetic-hash-unused-for-authentication', role: 'ADMIN_RPM' } })
    await tx.$queryRaw`SELECT set_config('rpm.usuario_id', ${user.id}, true), set_config('rpm.origem', 'SUPERADMIN', true)`
    const service = loadTs('src/lib/importacaoInicial.ts', { '@/lib/auditoria': { executarComAuditoria: async (_, callback) => callback(tx) } })
    const suffix = Math.floor(Math.random() * 1000)
    const plate = `TST${suffix.toString().padStart(3, '0')}0`
    const year = new Date().getFullYear(), date = `${year}-09-14`
    const lote = {
      Localizacoes: [{ nome: 'Synthetic Garage', cidadeUF: 'Santos / SP', capacidade: 20 }],
      Veiculos: [{ modelo: 'Volvo FH', placa: plate, tipo: 'Cavalo Mecânico', ano: year, quilometragem: 125000, status: 'OPERACIONAL', localizacao: 'Synthetic Garage' }],
      Motoristas: [{ nome: 'Synthetic Driver', cpf: '52998224725', rg: null, cnh: '01234567890', categoria: 'E', validade: `${year + 1}-12-31`, status: 'DISPONIVEL', placa: plate }],
      Custos: [{ data: date, categoria: 'COMBUSTIVEL', descricao: 'Synthetic fuel cost', valor: 100, formaPagamento: 'PIX', status: 'PAGO', placa: plate, cpfMotorista: '52998224725' }],
      Manutencoes: [{ data: date, conclusao: date, tipo: 'PREVENTIVA', descricao: 'Synthetic service', pecas: null, custo: 200, quilometragem: 125000, status: 'CONCLUIDA', placa: plate }],
      Containers: [{ data: date, codigo: 'TSTU 123456-7', tipo: '20 PÉS', origem: 'Synthetic Origin', destino: 'Synthetic Destination', frete: 1000, comissaoAtiva: true, percentualComissao: 10, status: 'ENTREGUE', observacoes: null, placa: plate, cpfMotorista: '52998224725' }],
    }
    const pending = await service.enviarImportacao(company.id, user.id, lote)
    assert.equal(await tx.veiculo.count({ where: { empresaId: company.id } }), 0)
    const stored = await tx.importacaoInicial.findUnique({ where: { empresaId: company.id } })
    assert.ok(!stored.dados.includes('52998224725'))
    await service.decidirImportacao(company.id, user.id, pending.checksum, false, 'Synthetic correction request')
    const again = await service.enviarImportacao(company.id, user.id, lote)
    await service.decidirImportacao(company.id, user.id, again.checksum, true)
    assert.equal(await tx.veiculo.count({ where: { empresaId: company.id } }), 1)
    assert.equal(await tx.motorista.count({ where: { empresaId: company.id } }), 1)
    assert.equal(await tx.historicoVeiculo.count({ where: { empresaId: company.id } }), 1)
    assert.equal(await tx.movimentacaoContainerPermanente.count({ where: { empresaId: company.id } }), 1)
    assert.equal(await tx.custo.count({ where: { empresaId: company.id } }), 2)
    assert.equal(await tx.leituraQuilometragem.count({ where: { empresaId: company.id } }), 1)
    await assert.rejects(service.decidirImportacao(company.id, user.id, again.checksum, true))
    assert.equal((await tx.importacaoInicial.findUnique({ where: { empresaId: company.id } })).dados, null)
    const logs = await tx.auditoriaLog.findMany({ where: { empresaId: company.id, tabela: 'importacoes_iniciais' } })
    assert.ok(logs.length >= 4)
    assert.ok(!JSON.stringify(logs).includes('52998224725'))
    console.log('All six modules imported; references, encryption, review, one-time use and audit passed.')
    throw rollback
  }, { timeout: 60000 })
} catch (error) { if (error !== rollback) throw new Error('Synthetic import integration failed; transaction rolled back.', { cause: error }) }
finally { await prisma.$disconnect() }
const check = new PrismaClient()
try { assert.equal(await check.empresa.count({ where: { id: fixtureCompany } }), 0); console.log('Rollback verified: no synthetic operational data persisted.') } finally { await check.$disconnect() }
