import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(path, 'utf8')

test('aprovação vincula a solicitação ao tenant criado na mesma transação', () => {
  const approval = read('src/app/api/solicitacoes/[id]/aprovar/route.ts')
  const schema = read('prisma/schema.prisma')

  assert.match(schema, /model SolicitacaoAcesso[\s\S]*empresaId\s+String\?\s+@unique/)
  assert.match(schema, /tenant\s+Empresa\?\s+@relation\(fields: \[empresaId\]/)
  assert.match(approval, /solicitacaoAcesso\.update\(\{[\s\S]*empresaId: novaEmpresa\.id/)
})

test('exclusão remove a solicitação vinculada antes de anonimizar a empresa', () => {
  const deletion = read('src/app/api/empresa/exclusao-conta/route.ts')
  const removeRequest = deletion.indexOf('solicitacaoAcesso.deleteMany({ where: { empresaId } })')
  const anonymizeCompany = deletion.indexOf('empresa.update({')

  assert.notEqual(removeRequest, -1)
  assert.notEqual(anonymizeCompany, -1)
  assert.ok(removeRequest < anonymizeCompany)
})

test('migração recupera vínculos válidos e apaga apenas aprovações órfãs', () => {
  const migration = read('prisma/migrations/20260915160000_vinculo_solicitacao_empresa/migration.sql')

  assert.match(migration, /usuario\.role = 'GESTOR_EMPRESA'/)
  assert.match(migration, /usuario\.excluido_em IS NULL/)
  assert.match(migration, /empresa\.excluido_em IS NULL/)
  assert.match(migration, /DELETE FROM public\.solicitacoes_acesso[\s\S]*status = 'APROVADO'[\s\S]*NOT EXISTS/)
  assert.doesNotMatch(migration, /DELETE FROM public\.solicitacoes_acesso\s*;/)
  assert.match(migration, /ON DELETE SET NULL/)
})

test('listagem encontra o gestor pelo tenant mesmo após mudança de e-mail', () => {
  const collection = read('src/app/api/solicitacoes/route.ts')

  assert.match(collection, /gestorPorEmpresa/)
  assert.match(collection, /empresaId: \{ in:/)
  assert.match(collection, /role: 'GESTOR_EMPRESA'/)
})
