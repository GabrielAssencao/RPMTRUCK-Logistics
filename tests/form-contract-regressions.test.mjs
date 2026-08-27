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

test('CPF e RG usam máscara visual, limites brasileiros e envio somente numérico', () => {
  const page = read('src/app/dashboard/empresa/motoristas/novo/page.tsx')
  const route = read('src/app/api/motoristas/route.ts')
  const documentos = read('src/utils/documentos.ts')

  assert.match(page, /setCpf\(formatarCPF\(e\.target\.value\)\)/)
  assert.match(page, /setRg\(formatarRG\(e\.target\.value\)\)/)
  assert.match(page, /formData\.set\('cpf', somenteNumeros\(cpf, 11\)\)/)
  assert.match(page, /formData\.set\('rg', somenteNumeros\(rg, 9\)\)/)
  assert.match(documentos, /somenteNumeros\(valor, 11\)/)
  assert.match(documentos, /somenteNumeros\(valor, 9\)/)
  assert.match(route, /cpf: z\.string\(\)\.trim\(\)\.regex\(\/\^\\d\{11\}\$\//)
  assert.match(route, /rg: z\.string\(\)\.trim\(\)\.regex\(\/\^\\d\{9\}\$\//)
  assert.match(route, /valorDocumentoNumericoOpcional\(formData, 'cpf'\)/)
  assert.match(route, /valorDocumentoNumericoOpcional\(formData, 'rg'\)/)
})

test('detalhes do alerta exibem a observação completa em diálogo acessível', () => {
  const page = read('src/app/dashboard/empresa/page.tsx')

  assert.match(page, /aria-label=\{`Ver observação completa de \$\{alerta\.foco\}`\}/)
  assert.match(page, /aria-labelledby="titulo-detalhes-alerta"/)
  assert.match(page, /\{alertaDetalhado\.descricao\}/)
})

test('central de notificações fica disponível na navegação sem regra de plano', () => {
  const layout = read('src/app/dashboard/empresa/layout.tsx')
  const central = read('src/app/dashboard/empresa/notificacoes/page.tsx')

  assert.match(layout, /path: '\/dashboard\/empresa\/notificacoes'/)
  assert.match(layout, /NOTIFICACOES_ITEM[^\n]*modulo: null/)
  assert.match(central, /Central de <span[^>]*>Notificações/)
  assert.match(central, /Marcar todas como lidas/)
  assert.match(central, /Limpar lidas/)
  assert.match(central, /notificacao\.lida \? 'Lida' : 'Não lida'/)
})
