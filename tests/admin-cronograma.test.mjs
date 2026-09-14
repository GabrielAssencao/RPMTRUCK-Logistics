import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function carregarAuth(auth, empresaAuth) {
  const source = readFileSync('src/lib/lembreteAuth.ts', 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  const require = (path) => path === '@/lib/auth'
    ? { requireAuth: async () => auth, isAdminRole: (role) => ['ADMIN', 'ADMIN_RPM'].includes(role) }
    : { requireEmpresaAuth: empresaAuth }
  new Function('exports', 'require', js)(exports, require)
  return exports.requireLembreteAuth
}

test('admins autenticados podem usar lembretes sem empresa, sem consultar permissoes empresariais', async () => {
  for (const role of ['ADMIN', 'ADMIN_RPM']) {
    const auth = { error: null, status: 200, session: { userId: 'admin-a', role } }
    const autenticar = carregarAuth(auth, () => assert.fail('Admin nao depende de empresa'))
    assert.equal(await autenticar({}, true), auth)
  }
})

test('usuarios empresariais continuam sujeitos ao modulo e permissao de escrita', async () => {
  const auth = { error: null, session: { userId: 'operador', role: 'OPERADOR', empresaId: 'empresa' } }
  const denied = { error: 'Modulo indisponivel', status: 403, session: null }
  const options = []
  const autenticar = carregarAuth(auth, async (_request, config) => { options.push(config); return denied })
  assert.equal(await autenticar({}, true), denied)
  assert.equal(await autenticar({}, false), denied)
  assert.deepEqual(options, [{ modulo: 'TAREFAS', acao: 'ESCRITA' }, { modulo: 'TAREFAS', acao: 'LEITURA' }])
})

test('sessao recusada nunca recebe acesso aos lembretes', async () => {
  const denied = { error: 'Sessao revogada', status: 401, session: null }
  const autenticar = carregarAuth(denied, () => assert.fail('Sessao recusada'))
  assert.equal(await autenticar({}), denied)
})

test('lembretes de admin permanecem isolados por usuario e empresa nula', () => {
  const collection = readFileSync('src/app/api/lembretes-pessoais/route.ts', 'utf8')
  const item = readFileSync('src/app/api/lembretes-pessoais/[id]/route.ts', 'utf8')
  assert.ok(collection.includes('where: { empresaId: auth.session.empresaId ?? null, usuarioId: auth.session.userId }'))
  assert.ok(item.includes('where: { id, empresaId: auth.session.empresaId ?? null, usuarioId: auth.session.userId }'))
  const cronograma = readFileSync('src/components/cronograma/CronogramaPessoal.tsx', 'utf8')
  assert.ok(cronograma.includes("if (lembrete.concluido) continue"))
  assert.ok(!cronograma.includes('/api/tarefas'))
})
