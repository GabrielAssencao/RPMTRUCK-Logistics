import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('cronograma estende tarefas existentes sem criar domínio concorrente', () => {
  const schema = read('prisma/schema.prisma')
  const migration = read('prisma/migrations/20260911100000_cronograma_tarefas/migration.sql')

  assert.match(schema, /model Tarefa \{[\s\S]*inicio\s+DateTime\?[\s\S]*duracaoMinutos[\s\S]*ordem\s+Int[\s\S]*exibirCalendario[\s\S]*lembreteEm/)
  assert.doesNotMatch(schema, /model Cronograma/)
  assert.match(migration, /ROW_NUMBER\(\) OVER[\s\S]*PARTITION BY "empresaId", "status"/)
  assert.match(migration, /CHECK \("duracao_minutos" IS NULL OR "duracao_minutos" BETWEEN 15 AND 10080\)/)
  assert.match(migration, /"empresaId", "status", "ordem"/)
})

test('API mantém isolamento por empresa e limita a autoridade do operador', () => {
  const collection = read('src/app/api/tarefas/route.ts')
  const item = read('src/app/api/tarefas/[id]/route.ts')

  assert.match(collection, /empresaId: auth\.session\.empresaId/)
  assert.match(collection, /responsavelId: auth\.session\.userId/)
  assert.match(collection, /acao: 'GESTAO'/)
  assert.match(collection, /RATE_LIMITS\.TASK_(?:READ|MUTATION)/)
  assert.match(item, /findFirst\(\{ where: \{ id, empresaId: auth\.session\.empresaId \} \}\)/)
  assert.match(item, /somenteFluxo[\s\S]*campo === 'status' \|\| campo === 'ordem'/)
  assert.match(item, /operadorResponsavel[\s\S]*atual\.responsavelId === auth\.session\.userId/)
  assert.match(item, /ordem: z\.number\(\)\.int\(\)\.min\(0\)\.max\(1_000_000_000\)/)
})

test('lembretes usam claim atômico e geram notificação individual', () => {
  const reminders = read('src/lib/tarefaReminders.ts')
  const notifications = read('src/app/api/notificacoes/route.ts')

  assert.match(reminders, /updateMany\([\s\S]*lembreteEnviadoEm: null[\s\S]*data: \{ lembreteEnviadoEm: agora \}/)
  assert.match(reminders, /if \(claim\.count !== 1\) return false/)
  assert.match(reminders, /usuarioId: tarefa\.responsavelId[\s\S]*tarefaId: tarefa\.id/)
  assert.match(notifications, /if \(limited\) return limited[\s\S]*entregarLembretesTarefas\(lembreteScope\)/)
})

test('interface oferece quadro, calendário, filtros, drag e alternativa por teclado', () => {
  const page = read('src/app/dashboard/empresa/tarefas/page.tsx')
  const navigation = read('src/lib/empresaPreferences.ts')

  assert.match(navigation, /\/dashboard\/empresa\/cronograma[\s\S]*label: 'Cronograma'[\s\S]*modulo: 'TAREFAS'/)
  assert.match(page, /type Visualizacao = 'QUADRO' \| 'LEMBRETES' \| 'CALENDARIO'/)
  assert.match(page, /filtroResponsavel[\s\S]*filtroPrioridade[\s\S]*filtroPeriodo/)
  assert.match(page, /draggable=\{podeAtualizar && !processando\}/)
  assert.match(page, /onDragStartCapture=\{onDragStart\}/)
  assert.match(page, /Mover para cima[\s\S]*Mover para baixo[\s\S]*Mover para coluna anterior[\s\S]*Mover para próxima coluna/)
  assert.match(page, /prefers-reduced-motion|transition=\{\{ duration: 0\.24/)
  assert.match(page, /exibirCalendario/)
})

test('lembretes pessoais são isolados, notificáveis e integrados ao calendário', () => {
  const schema = read('prisma/schema.prisma')
  const collection = read('src/app/api/lembretes-pessoais/route.ts')
  const item = read('src/app/api/lembretes-pessoais/[id]/route.ts')
  const rules = read('src/lib/lembretePessoal.ts')
  const reminders = read('src/lib/tarefaReminders.ts')
  const board = read('src/components/cronograma/LembretesPessoaisBoard.tsx')
  const dateTimePicker = read('src/components/cronograma/BrazilianDateTimePicker.tsx')
  const page = read('src/app/dashboard/empresa/tarefas/page.tsx')

  assert.match(schema, /model LembretePessoal \{[\s\S]*empresaId String[\s\S]*usuarioId String[\s\S]*notificacoes Notificacao\[\]/)
  assert.match(collection, /where: \{ empresaId: auth\.session\.empresaId, usuarioId: auth\.session\.userId \}/)
  assert.match(item, /where: \{ id, empresaId: auth\.session\.empresaId, usuarioId: auth\.session\.userId \}/)
  assert.match(rules, /LEVE: 3[\s\S]*MEDIA: 3[\s\S]*ALTA: 5/)
  assert.match(reminders, /lembretePessoal\.updateMany\([\s\S]*notificacaoEm: null[\s\S]*lembretePessoalId: lembrete\.id/)
  assert.match(board, /Meu quadro de lembretes[\s\S]*Somente você pode visualizar/)
  assert.match(board, /BrazilianDateTimePicker[\s\S]*Automática pela urgência[\s\S]*Escolher data e hora/)
  assert.match(dateTimePicker, /aria-label="Dia"[\s\S]*aria-label="Mês"[\s\S]*aria-label="Ano"/)
  assert.match(dateTimePicker, /24 horas[\s\S]*Array\.from\(\{ length: 24 \}/)
  assert.doesNotMatch(dateTimePicker, /type="time"|type="date"/)
  assert.match(page, /BrazilianDateTimePicker value=\{form\.inicio\}[\s\S]*BrazilianDateTimePicker value=\{form\.prazo\}[\s\S]*BrazilianDateTimePicker value=\{form\.lembreteEm\}/)
  assert.match(page, /lembretesCalendario[\s\S]*Quadro de lembretes/)
  assert.match(page, /visualizacao === 'LEMBRETES' \|\| visualizacao === 'CALENDARIO'[\s\S]*Novo lembrete/)
  assert.match(page, /visualizacao === 'QUADRO' \|\| visualizacao === 'CALENDARIO'[\s\S]*Nova tarefa/)
  assert.match(board, /createRequest[\s\S]*ultimoPedidoCriacao[\s\S]*showCreateAction/)
})
