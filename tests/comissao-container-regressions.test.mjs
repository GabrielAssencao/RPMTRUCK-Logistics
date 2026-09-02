import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('comissão de transporte possui categoria e vínculo único com o container', () => {
  const schema = read('prisma/schema.prisma')
  const migration = read('prisma/migrations/20260901030000_categoria_comissao_container/migration.sql')

  assert.match(schema, /enum CategoriaCusto[\s\S]*COMISSAO_TRANSPORTE/)
  assert.match(schema, /comissao_ativa\s+Boolean\s+@default\(true\)/)
  assert.match(schema, /containerId String\?\s+@unique/)
  assert.match(migration, /CREATE UNIQUE INDEX "custos_container_id_key"/)
  assert.match(migration, /ON DELETE CASCADE/)
})

test('criação e edição de container sincronizam o custo automático no servidor', () => {
  const collection = read('src/app/api/containers/route.ts')
  const item = read('src/app/api/containers/[id]/route.ts')
  const sync = read('src/lib/financeiro/comissoesContainer.ts')

  assert.match(collection, /comissaoAtiva: z\.boolean\(\)\.default\(true\)/)
  assert.match(collection, /sincronizarCustoComissaoContainer\(tx, criada?o\)/)
  assert.match(item, /comissaoAtiva: z\.boolean\(\)\.optional\(\)/)
  assert.match(item, /sincronizarCustoComissaoContainer\(tx, atualizado\)/)
  assert.match(sync, /container\.status !== 'CANCELADO'/)
  assert.match(sync, /categoria: 'COMISSAO_TRANSPORTE'/)
  assert.match(sync, /container\.status === 'ENTREGUE' \? 'PAGO'/)
  assert.match(sync, /data: \{ relatorioArquivoId: null \}/)
})

test('cadastro permite desligar comissão e custos não sintetizam valores em memória', () => {
  const containers = read('src/app/dashboard/empresa/containers/page.tsx')
  const motoristas = read('src/app/dashboard/empresa/motoristas/page.tsx')
  const custos = read('src/app/dashboard/empresa/custos/page.tsx')

  assert.match(containers, /Gerar comissão automática/)
  assert.match(containers, /comissaoAtiva: form\.comissaoAtiva/)
  assert.match(containers, /Nenhuma comissão automática será lançada/)
  assert.doesNotMatch(custos, /linhasComissaoContainer|comissoesContainerSemana/)
  assert.match(custos, /origemComissaoContainer/)
  assert.match(motoristas, /c\.comissaoAtiva[\s\S]*c\.status !== 'CANCELADO'/)
})

test('dashboard agrupa salários e comissões sem perder as categorias de origem', () => {
  const dashboard = read('src/app/api/dashboard/empresa/route.ts')
  const custos = read('src/app/api/custos/route.ts')

  assert.match(dashboard, /custo\.categoria === 'SALARIO' \|\| custo\.categoria === 'COMISSAO_TRANSPORTE'/)
  assert.match(dashboard, /Pessoal — salários e comissões/)
  assert.match(custos, /'SALARIO', 'COMISSAO_TRANSPORTE'/)
})

test('migração materializa comissões históricas uma única vez', () => {
  const migration = read('prisma/migrations/20260901040000_backfill_custos_comissao_container/migration.sql')

  assert.match(migration, /container\."comissao_ativa" = true/)
  assert.match(migration, /container\."status" <> 'CANCELADO'/)
  assert.match(migration, /NOT EXISTS/)
  assert.match(migration, /'COMISSAO_TRANSPORTE'::"CategoriaCusto"/)
})
