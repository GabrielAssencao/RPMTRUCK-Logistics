import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(path, 'utf8')

test('operador recebe contas a pagar e containers somente pelos módulos delegados', () => {
  const preferences = read('src/lib/empresaPreferences.ts')
  const contas = preferences.match(/\{ path: '\/dashboard\/empresa\/contas-pagar'[^\n]+/u)?.[0] ?? ''
  const containers = preferences.match(/\{ path: '\/dashboard\/empresa\/containers'[^\n]+/u)?.[0] ?? ''
  const inteligencia = preferences.match(/\{ path: '\/dashboard\/empresa\/inteligencia'[^\n]+/u)?.[0] ?? ''

  assert.match(contas, /modulo: 'CONTAS_PAGAR'/)
  assert.doesNotMatch(contas, /somenteGestor/)
  assert.match(containers, /modulo: 'FROTA'/)
  assert.doesNotMatch(containers, /somenteGestor/)
  assert.match(inteligencia, /somenteGestor: true/)
})

test('tema individual tem rota própria e exige autorização persistida pelo gestor', () => {
  const layout = read('src/app/dashboard/empresa/layout.tsx')
  const api = read('src/app/api/empresa/preferencias-visuais/route.ts')

  assert.match(layout, /TEMA_ITEM[^\n]+exigePersonalizacaoTema: true/)
  assert.match(layout, /item\.exigePersonalizacaoTema && !podePersonalizarTema/)
  assert.match(api, /!gestor && !auth\.usuario\.podePersonalizarTema/)
})

test('operador sem módulos permanece autenticado e recebe orientação recuperável', () => {
  const layout = read('src/app/dashboard/empresa/layout.tsx')
  const page = read('src/app/dashboard/empresa/sem-acesso/page.tsx')

  assert.match(layout, /NAV_EMPRESA\.find\(itemPermitido\)\?\.path \|\| SEM_ACESSO_ITEM\.path/)
  assert.doesNotMatch(layout, /NAV_EMPRESA\.find\(itemPermitido\)\?\.path \|\| '\/auth\/login'/)
  assert.match(page, /Nenhum módulo foi liberado/)
  assert.match(page, /Peça ao gestor da empresa/)
})

test('operador abre suporte na franquia da empresa sem enxergar chamados de terceiros', () => {
  const layout = read('src/app/dashboard/empresa/layout.tsx')
  const tickets = read('src/app/api/chat/tickets/route.ts')
  const chat = read('src/app/api/chat/route.ts')
  const admin = read('src/app/api/admin/chat/route.ts')
  const notifications = read('src/lib/notificacoes.ts')
  const proxy = read('src/proxy.ts')

  assert.match(layout, /SUPORTE_ITEM[^\n]+modulo: null/)
  assert.doesNotMatch(layout.match(/SUPORTE_ITEM[^\n]+/u)?.[0] ?? '', /somenteGestor/)
  assert.match(tickets, /requireEmpresaAuth\(request\)/)
  assert.match(tickets, /where: \{ empresaId, competencia, origem: 'EMPRESA', classificacaoCobranca: 'ATENDIMENTO' \}/)
  assert.match(chat, /filtroConversasPermitidas/)
  assert.match(chat, /autorId: escopo\.auth\.session!\.userId/)
  assert.match(admin, /abertoPor: autorPorConversa\.get\(ticket\.id\)/)
  assert.match(chat, /notificarParticipantesDoTicket\(escopo\.empresaId, ticket\.id, aviso, tx\)/)
  assert.match(notifications, /mensagens_suporte:[\s\S]*conversaId: ticketSuporteId/)
  assert.match(notifications, /\{ role: 'GESTOR_EMPRESA' \}/)
  assert.doesNotMatch(proxy, /rotasSomenteGestor[\s\S]*'\/dashboard\/empresa\/chat'/)
})
