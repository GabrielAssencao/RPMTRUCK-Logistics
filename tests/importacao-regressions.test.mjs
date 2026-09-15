import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTs } from './helpers/load-ts.mjs'

const empty = () => ({ Localizacoes: [], Veiculos: [], Motoristas: [], Custos: [], Manutencoes: [], Containers: [] })
const vehicle = () => ({ modelo: 'Volvo FH', placa: 'ABC1D23', tipo: 'Cavalo Mecânico', ano: 2022, quilometragem: 125000, status: 'OPERACIONAL', localizacao: null })
function setup() {
  const state = { registro: null, vehicles: [], writes: [], externalPlate: false }
  const tx = {
    empresa: { findUnique: async () => ({ id: 'company-a', plano: 'ESSENCIAL', status: 'ATIVO', modulos: ['FROTA', 'GESTAO'], veiculos_adicionais: 0 }) },
    veiculo: { findMany: async () => state.vehicles, count: async () => state.externalPlate ? 1 : 0, createMany: async ({ data }) => { state.writes.push(['vehicles', data]); state.vehicles.push(...data) } },
    motorista: { findMany: async () => [] }, localizacao: { findMany: async () => [] },
    leituraQuilometragem: { createMany: async ({ data }) => state.writes.push(['km', data]) },
    container: { count: async () => 0 },
    importacaoInicial: {
      findUnique: async () => state.registro,
      upsert: async ({ create, update }) => state.registro = { ...(state.registro || create), ...(state.registro ? update : {}) },
      update: async ({ data }) => state.registro = { ...state.registro, ...data },
    },
  }
  const encryption = { encryptionConfigured: () => true, encryptSensitive: text => `protected:${text}`, decryptSensitive: text => text.replace(/^protected:/, ''), exposeMotorista: value => value }
  const { enviarImportacao, decidirImportacao, validarContextoImportacao } = loadTs('src/lib/importacaoInicial.ts', {
    '@/lib/auditoria': { executarComAuditoria: async (_, callback, options) => { assert.equal(options.isolationLevel, 'Serializable'); return callback(tx) } },
    '@/lib/fieldEncryption': encryption,
  })
  return { state, tx, enviarImportacao, decidirImportacao, validarContextoImportacao }
}

test('envio mantém dados fora do catálogo e aprovação consome o benefício uma única vez', async () => {
  const { state, enviarImportacao, decidirImportacao } = setup()
  const lote = empty(); lote.Veiculos.push(vehicle())
  const pending = await enviarImportacao('company-a', 'manager', lote)
  assert.equal(state.writes.length, 0)
  assert.ok(state.registro.dados.startsWith('protected:'))
  await assert.rejects(decidirImportacao('company-a', 'admin', 'stale', true), /mudou|revisada/)
  assert.equal(state.writes.length, 0)
  const approved = await decidirImportacao('company-a', 'admin', pending.checksum, true)
  assert.equal(approved.status, 'APROVADO'); assert.equal(approved.dados, null)
  assert.equal(state.vehicles.length, 1)
  assert.equal(state.writes.find(x => x[0] === 'km')[1][0].quilometragem, 125000)
  await assert.rejects(decidirImportacao('company-a', 'admin', pending.checksum, true))
  await assert.rejects(enviarImportacao('company-a', 'manager', lote), /utilizada/)
  assert.equal(state.vehicles.length, 1)
})
test('reprovação permite corrigir e reenviar sem consumir a importação inicial', async () => {
  const { state, enviarImportacao, decidirImportacao } = setup()
  const lote = empty(); lote.Veiculos.push(vehicle())
  const pending = await enviarImportacao('company-a', 'manager', lote)
  await decidirImportacao('company-a', 'admin', pending.checksum, false, 'Corrija o modelo do veículo.')
  assert.equal(state.registro.dados, null)
  assert.equal(state.registro.status, 'REJEITADO')
  const corrected = await enviarImportacao('company-a', 'manager', lote)
  assert.equal(corrected.status, 'PENDENTE'); assert.equal(state.writes.length, 0)
})
test('importação não permite ultrapassar cota, duplicar placas ou vincular outro tenant', async () => {
  const { state, tx, validarContextoImportacao } = setup()
  const lote = empty(); lote.Veiculos.push(vehicle())
  state.vehicles = Array.from({ length: 10 }, (_, index) => ({ placa: `XYZ${index}`, id: `${index}` }))
  await assert.rejects(validarContextoImportacao(tx, 'company-a', lote), /vagas/)
  state.vehicles = []; lote.Veiculos.push(vehicle())
  await assert.rejects(validarContextoImportacao(tx, 'company-a', lote), /duplicados/)
  lote.Veiculos.pop(); state.externalPlate = true
  await assert.rejects(validarContextoImportacao(tx, 'company-a', lote), /disponível/)
  assert.equal(state.writes.length, 0)
})
test('aprovação revalida referências e histórico do plano antes de qualquer inclusão', async () => {
  const { state, enviarImportacao, decidirImportacao } = setup()
  const lote = empty(); lote.Veiculos.push(vehicle())
  const pending = await enviarImportacao('company-a', 'manager', lote)
  const modified = { ...lote, Custos: [{ data: '2026-09-14', categoria: 'OUTROS', descricao: 'Despesa de teste', valor: 20, formaPagamento: 'PIX', status: 'PAGO', placa: 'DEF1D23', cpfMotorista: null }] }
  state.registro.dados = `protected:${JSON.stringify(modified)}`
  await assert.rejects(decidirImportacao('company-a', 'admin', pending.checksum, true), /integridade/)
  state.registro.dados = `protected:${JSON.stringify(lote)}`
  state.vehicles = Array.from({ length: 10 }, (_, index) => ({ placa: `XYZ${index}`, id: `${index}` }))
  await assert.rejects(decidirImportacao('company-a', 'admin', pending.checksum, true), /vagas/)
  assert.equal(state.writes.length, 0)
})
