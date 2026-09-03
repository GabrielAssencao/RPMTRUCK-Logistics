import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('tarefas encerradas deixam de manter a notificação de pendência ativa', () => {
  const route = read('src/app/api/tarefas/[id]/route.ts')
  const migration = read('prisma/migrations/20260901020000_encerrar_notificacoes_tarefas/migration.sql')

  assert.match(route, /status === 'CONCLUIDA' \|\| parsed\.data\.status === 'CANCELADA'/)
  assert.match(route, /notificacao\.updateMany\(\{[\s\S]*tarefaId: atualizada\.id[\s\S]*lida: true/)
  assert.match(migration, /tarefa\."status" IN \('CONCLUIDA', 'CANCELADA'\)/)
})

test('dashboard recarrega dados atuais e reage a mutações dos módulos', () => {
  const dashboard = read('src/app/dashboard/empresa/page.tsx')
  const tarefas = read('src/app/dashboard/empresa/tarefas/page.tsx')
  const contas = read('src/app/dashboard/empresa/contas-pagar/page.tsx')
  const custos = read('src/app/dashboard/empresa/custos/page.tsx')
  const frota = read('src/app/dashboard/empresa/frota/page.tsx')
  const manutencoes = read('src/app/dashboard/empresa/frota/manutencao/page.tsx')
  const motoristas = read('src/app/dashboard/empresa/motoristas/page.tsx')
  const containers = read('src/contexts/ContainersContext.tsx')

  assert.match(dashboard, /cache: 'no-store'/)
  assert.match(dashboard, /visibilitychange/)
  assert.match(dashboard, /DASHBOARD_EMPRESA_ATUALIZADA_EVENT/)
  for (const modulo of [tarefas, contas, custos, frota, manutencoes, motoristas, containers]) {
    assert.match(modulo, /sinalizarAtualizacaoDashboardEmpresa\(\)/)
  }
})

test('resumo financeiro agrega todas as contas e limita apenas a lista visual', () => {
  const route = read('src/app/api/dashboard/empresa/route.ts')
  const resumoFinanceiro = route.match(/const resumoContasPagarPromise[\s\S]*?const \[/)?.[0] ?? ''

  assert.match(resumoFinanceiro, /contaPagar\.aggregate\(/)
  assert.match(resumoFinanceiro, /_sum: \{ valor: true \}/)
  assert.match(resumoFinanceiro, /take: 5/)
  assert.doesNotMatch(resumoFinanceiro, /take: 20/)
})

test('dashboard ignora manutenção arquivada e pendências que já possuem tarefa ativa', () => {
  const route = read('src/app/api/dashboard/empresa/route.ts')
  const tarefas = read('src/app/api/tarefas/route.ts')

  assert.match(route, /status: 'PENDENTE', relatorioArquivoId: null/)
  assert.match(route, /origensComTarefaAtiva/)
  assert.match(route, /!origensComTarefaAtiva\.has\(manutencao\.id\)/)
  assert.match(route, /!origensComTarefaAtiva\.has\(motorista\.id\)/)
  assert.match(tarefas, /Esta pendência já possui uma tarefa ativa/)
  assert.match(tarefas, /status: \{ in: \['PENDENTE', 'EM_ANDAMENTO'\] \}/)
})

test('tooltips dos gráficos respeitam as cores do tema', () => {
  const charts = read('src/components/dashboard/empresa/EmpresaDashboardCharts.tsx')

  assert.match(charts, /itemStyle=\{\{ color: 'var\(--foreground\)' \}\}/)
  assert.match(charts, /labelStyle=\{\{ color: 'var\(--foreground\)' \}\}/)
})
