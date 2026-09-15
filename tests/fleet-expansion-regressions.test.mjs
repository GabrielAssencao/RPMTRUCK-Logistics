import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadTs } from './helpers/load-ts.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('RENAVAM é normalizado, validado e protegido por unicidade global', () => {
  const { normalizarRenavam, renavamValido } = loadTs('src/utils/renavam.ts')
  assert.equal(normalizarRenavam('123456789'), '00123456789')
  assert.equal(renavamValido('00123456789'), true)
  assert.equal(renavamValido('00123456780'), false)
  assert.equal(renavamValido('11111111111'), false)

  const schema = read('prisma/schema.prisma')
  const migration = read('prisma/migrations/20260915190000_frota_ocorrencias_conformidade_datas_flexiveis/migration.sql')
  assert.match(schema, /renavam\s+String\?\s+@unique/)
  assert.match(migration, /CREATE UNIQUE INDEX veiculos_renavam_key/)
})

test('ocorrências validam vínculos no tenant e sincronizam o custo no servidor', () => {
  const collection = read('src/app/api/ocorrencias-veiculos/route.ts')
  const item = read('src/app/api/ocorrencias-veiculos/[id]/route.ts')
  assert.match(collection, /veiculo\.findFirst\([\s\S]*empresaId/)
  assert.match(collection, /motorista\.findFirst\([\s\S]*empresaId/)
  assert.match(collection, /contaPagar\.findFirst\([\s\S]*empresaId/)
  assert.match(collection, /conta\?\.veiculoId && conta\.veiculoId !== veiculo\.id/)
  assert.match(collection, /tx\.custo\.(?:create|update)/)
  assert.match(collection, /TransactionIsolationLevel\.Serializable/)
  assert.match(collection, /RATE_LIMITS\.TASK_(?:READ|MUTATION)/)
  assert.match(item, /findFirst\(\{ where: \{ id, empresaId: auth\.session\.empresaId/)
})

test('conformidade do motorista mantém datas válidas e isolamento empresarial', () => {
  const { dataSomenteDia, situacaoConformidade, conformidadeMotoristaSchema } = loadTs('src/lib/conformidadeMotorista.ts')
  assert.equal(dataSomenteDia('2026-09-15').toISOString(), '2026-09-15T00:00:00.000Z')
  assert.throws(() => dataSomenteDia('2026-02-31'), /DATA_INVALIDA/)
  assert.equal(situacaoConformidade(new Date('2026-09-14T00:00:00Z'), new Date('2026-09-15T12:00:00Z')), 'VENCIDO')
  assert.equal(conformidadeMotoristaSchema.safeParse({ tipo: 'CURSO', nome: 'MOPP', emitidoEm: '2026-09-15', validade: '2026-09-14' }).success, false)

  const collection = read('src/app/api/motoristas/[id]/conformidades/route.ts')
  const item = read('src/app/api/motoristas/[id]/conformidades/[conformidadeId]/route.ts')
  assert.match(collection, /motorista\.findFirst\([\s\S]*empresaId: auth\.session\.empresaId/)
  assert.match(collection, /conformidadeMotorista\.findMany\([\s\S]*empresaId: auth\.session\.empresaId/)
  assert.match(item, /motoristaId: id, empresaId: auth\.session\.empresaId/)
  assert.match(item, /RATE_LIMITS\.TASK_MUTATION/)
})

test('tarefas e lembretes de dia inteiro comparam o dia local e omitem horário', () => {
  const { anteriorAoDiaDaReferencia } = loadTs('src/lib/dataHoraOperacional.ts')
  const referencia = new Date('2026-09-15T20:30:00-03:00')
  assert.equal(anteriorAoDiaDaReferencia(new Date('2026-09-15T12:00:00-03:00'), referencia), false)
  assert.equal(anteriorAoDiaDaReferencia(new Date('2026-09-14T23:59:00-03:00'), referencia), true)

  const tasks = read('src/app/api/tarefas/route.ts')
  const reminders = read('src/app/api/lembretes-pessoais/route.ts')
  const delivery = read('src/lib/tarefaReminders.ts')
  assert.match(tasks, /diaInteiro: z\.boolean\(\)\.default\(false\)/)
  assert.match(reminders, /diaInteiro: z\.boolean\(\)\.default\(false\)/)
  assert.match(tasks, /anteriorAoDiaDaReferencia/)
  assert.match(reminders, /anteriorAoDiaDaReferencia/)
  assert.match(delivery, /diaInteiro \? formatoData\.format/)
})

test('backup e exclusão da empresa abrangem ocorrências e conformidades', () => {
  const backup = read('src/app/api/empresa/exclusao-conta/exportar/route.ts')
  const deletion = read('src/app/api/empresa/exclusao-conta/route.ts')
  assert.match(backup, /prisma\.ocorrenciaVeiculo\.findMany/)
  assert.match(backup, /prisma\.conformidadeMotorista\.findMany/)
  assert.match(deletion, /ocorrenciaVeiculo\.deleteMany[\s\S]*conformidadeMotorista\.deleteMany[\s\S]*veiculo\.deleteMany/)
})
