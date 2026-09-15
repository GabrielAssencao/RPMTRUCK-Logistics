import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function compilar(path, dependencias = {}) {
  const source = readFileSync(path, 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  new Function('exports', 'require', js)(exports, (name) => {
    if (!(name in dependencias)) throw new Error('Dependencia inesperada: ' + name)
    return dependencias[name]
  })
  return exports
}
const planos = compilar('src/utils/planos.ts')

function autenticar(plano, role = 'GESTOR_EMPRESA') {
  return compilar('src/lib/empresaAuth.ts', {
    '@/lib/auth': { requireAuth: async () => ({ error: null, status: 200, session: { userId: 'usuario-a', empresaId: 'empresa-a', role }, usuario: { modulosAcesso: ['TAREFAS'] } }) },
    '@/lib/prisma': { prisma: { empresa: { findUnique: async () => ({ id: 'empresa-a', plano, status: 'ATIVO', modulos: ['TAREFAS'], excluidoEm: null }) } } },
    '@/utils/planos': planos,
    '@/lib/fieldEncryption': { exposeEmpresa: (value) => value },
  }).requireEmpresaAuth
}
const request = { nextUrl: { pathname: '/api/tarefas' } }

test('Essencial inclui cronograma pessoal e permanece sem quadro ou delegacao', () => {
  assert.ok(planos.obterModulosPadrao('ESSENCIAL').includes('TAREFAS'))
  assert.equal(planos.PLANOS_CONFIG.ESSENCIAL.telaTarefas, false)
  assert.equal(planos.PLANOS_CONFIG.ESSENCIAL.delegacaoTarefas, false)
  for (const plano of ['AVANCADO', 'ENTERPRISE', 'PREVIEW']) {
    assert.equal(planos.PLANOS_CONFIG[plano].telaTarefas, true)
    assert.equal(planos.PLANOS_CONFIG[plano].delegacaoTarefas, true)
  }
})

test('servidor autoriza lembretes e recusa tarefas delegadas no Essencial', async () => {
  const auth = autenticar('ESSENCIAL')
  const pessoal = await auth(request, { modulo: 'TAREFAS', acao: 'ESCRITA' })
  assert.equal(pessoal.error, null)
  for (const acao of ['LEITURA', 'ESCRITA', 'GESTAO']) {
    const denied = await auth(request, { modulo: 'TAREFAS', acao, exigirDelegacaoTarefas: true })
    assert.equal(denied.status, 403)
    assert.equal(denied.session, null)
  }
  assert.equal((await autenticar('AVANCADO')(request, { modulo: 'TAREFAS', acao: 'GESTAO', exigirDelegacaoTarefas: true })).error, null)
  assert.equal((await autenticar('ESSENCIAL', 'VISUALIZADOR')(request, { modulo: 'TAREFAS', acao: 'ESCRITA' })).status, 403)
})

test('todas as operacoes de tarefas exigem capacidade validada no servidor', () => {
  const collection = readFileSync('src/app/api/tarefas/route.ts', 'utf8')
  const item = readFileSync('src/app/api/tarefas/[id]/route.ts', 'utf8')
  assert.equal(collection.match(/exigirDelegacaoTarefas: true/g).length, 2)
  assert.equal(item.match(/exigirDelegacaoTarefas: true/g).length, 2)
  const page = readFileSync('src/app/dashboard/empresa/tarefas/page.tsx', 'utf8')
  assert.ok(page.indexOf('if (pessoal)') < page.indexOf("fetch('/api/tarefas'"))
  assert.ok(page.includes('if (somenteLembretes) return <CronogramaPessoal'))
})
