import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

test('limpeza exige conclusao, prazo vencido, preferencia e isolamento pessoal', async () => {
  let recebido
  const prisma = { lembretePessoal: { deleteMany: async (query) => { recebido = query; return { count: 2 } } } }
  const source = readFileSync('src/lib/lembreteRetencao.ts', 'utf8').replace("import 'server-only'", '').replace("import { prisma } from '@/lib/prisma'", '')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  new Function('exports', 'prisma', js)(exports, prisma)
  const agora = new Date('2026-09-13T12:00:00Z')
  assert.equal(await exports.limparLembretesConcluidos({ empresaId: 'empresa-a', usuarioId: 'usuario-a' }, agora), 2)
  assert.equal(recebido.where.empresaId, 'empresa-a')
  assert.equal(recebido.where.usuarioId, 'usuario-a')
  assert.equal(recebido.where.concluido, true)
  assert.deepEqual(recebido.where.OR.map((item) => item.usuario.lembretesRetencaoDias), [1, 7, 30, 90])
  for (const item of recebido.where.OR) {
    assert.equal(item.concluidoEm.lte.getTime(), agora.getTime() - item.usuario.lembretesRetencaoDias * 86400000)
  }
  await exports.limparLembretesConcluidos(undefined, agora)
  assert.equal(recebido.where.usuarioId, undefined)
  assert.equal(recebido.where.concluido, true)
})
