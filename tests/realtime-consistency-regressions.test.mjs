import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadTs } from './helpers/load-ts.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('presença online usa heartbeat menor que a janela de confirmação', () => {
  const presence = loadTs('src/lib/sessionPresence.ts')
  assert.ok(presence.SESSION_HEARTBEAT_INTERVAL_MS < presence.SESSION_ONLINE_WINDOW_MS)
  assert.equal(presence.sessaoEstaOnline('2026-09-16T12:00:00.000Z', Date.parse('2026-09-16T12:02:00.000Z')), true)
  assert.equal(presence.sessaoEstaOnline('2026-09-16T12:00:00.000Z', Date.parse('2026-09-16T12:03:00.000Z')), false)
  assert.equal(presence.formatarDuracaoSessao(3_661_000), '1h 01min 01s')

  const heartbeat = read('src/hooks/useSessionActivity.ts')
  assert.match(heartbeat, /SESSION_HEARTBEAT_INTERVAL_MS/)
  assert.match(heartbeat, /document\.visibilityState !== 'visible'/)
})

test('custos e vínculos recarregam após alterações operacionais e retorno à aba', () => {
  const context = read('src/contexts/ContainersContext.tsx')
  const costs = read('src/app/dashboard/empresa/custos/page.tsx')
  for (const source of [context, costs]) {
    assert.match(source, /DASHBOARD_EMPRESA_ATUALIZADA_EVENT/)
    assert.match(source, /addEventListener\('focus'/)
    assert.match(source, /addEventListener\('visibilitychange'/)
  }
  assert.match(context, /fetch\('\/api\/containers', \{ cache: 'no-store'/)
  assert.match(costs, /\[anoSelecionado, versaoDados\]/)
})

test('sessões abertas incluem a atual e distinguem presença online', () => {
  const sessionsRoute = read('src/app/api/auth/sessions/route.ts')
  const sessionsPanel = read('src/app/dashboard/empresa/configuracoes/_componentes/SecuritySessions.tsx')
  assert.match(sessionsRoute, /id: auth\.session\.sessionId/)
  assert.match(sessionsRoute, /conectadaAgora: sessaoEstaOnline/)
  assert.match(sessionsRoute, /onlineWindowMs: SESSION_ONLINE_WINDOW_MS/)
  assert.match(sessionsPanel, /window\.setInterval\(atualizar, 30_000\)/)
  assert.match(sessionsPanel, /Conectado agora/)
  assert.match(sessionsPanel, /Sessão aberta/)
  assert.match(sessionsPanel, /formatarDuracaoSessao/)
})

test('logs contabilizam entradas e exibem tempo conectado em atualização contínua', () => {
  const api = read('src/app/api/admin/seguranca/route.ts')
  const logs = read('src/app/dashboard/admin/_modulos/seguranca/SecurityModule.tsx')
  assert.match(api, /tipo: 'LOGIN_SUCESSO'/)
  assert.match(api, /loginsSucesso24h/)
  assert.match(api, /SESSION_ONLINE_WINDOW_MS/)
  assert.match(logs, /Entradas confirmadas \/ 24h/)
  assert.match(logs, /Tempo conectado/)
  assert.match(logs, /setAgora\(Date\.now\(\)\)/)
})

test('painéis laterais mantêm margem e altura natural em viewports grandes', () => {
  const css = read('src/app/globals.css')
  const desktopRule = css.match(/@media \(min-width: 1100px\) and \(min-height: 720px\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(desktopRule, /align-items: center/)
  assert.match(desktopRule, /padding: 1rem/)
  assert.match(css, /max-height: calc\(100% - 2rem\)/)
  assert.doesNotMatch(desktopRule, /height: 100%/)
})
