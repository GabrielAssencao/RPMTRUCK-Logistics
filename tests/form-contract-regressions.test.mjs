import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('cadastro de veículo envia somente o contrato aceito pela API', () => {
  const page = read('src/app/dashboard/empresa/frota/page.tsx')
  const handler = page.match(/const handleSalvarVeiculo[\s\S]*?\/\/ 🗑️ EXCLUSÃO/)?.[0] ?? ''

  assert.match(handler, /const payload = \{/)
  assert.match(handler, /localizacaoId: typeof formData\.localizacao/)
  assert.match(handler, /body: JSON\.stringify\(payload\)/)
  assert.doesNotMatch(handler, /JSON\.stringify\(\{\s*\.\.\.formData/)
})

test('drawer mantém os dados no erro e bloqueia submissão duplicada', () => {
  const drawer = read('src/components/dashboard/GenericDrawer.tsx')

  assert.match(drawer, /if \(submittingRef\.current\) return/)
  assert.match(drawer, /if \(sucesso === false\) return/)
  assert.match(drawer, /disabled=\{loading\}/)
  assert.match(drawer, /role="alert"/)
})

test('cadastro de usuário usa payload explícito e protege o campo de senha', () => {
  const page = read('src/app/dashboard/empresa/usuarios/page.tsx')

  assert.match(page, /name: 'senha',[\s\S]*type: 'password'/)
  assert.match(page, /nome: formData\.nome,[\s\S]*role: formData\.role/)
  assert.doesNotMatch(page, /JSON\.stringify\(\{\s*\.\.\.formData/)
})

test('delegação de alertas de motoristas é aceita pelo contrato de tarefas', () => {
  const page = read('src/app/dashboard/empresa/page.tsx')
  const route = read('src/app/api/tarefas/route.ts')

  assert.match(page, /: 'MOTORISTAS'/)
  assert.match(route, /z\.enum\(\[[^\]]*'MOTORISTAS'/)
})
