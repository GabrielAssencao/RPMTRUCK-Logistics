import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('login e recuperação não revelam a existência da conta', () => {
  const login = read('src/app/api/auth/login/route.ts')
  const password = read('src/lib/password.ts')
  const reset = read('src/app/api/auth/reset-request/route.ts')

  assert.match(password, /passwordHash \?\? DUMMY_PASSWORD_HASH/)
  assert.match(login, /verifyLoginPassword\(senha, usuario\?\.senha_hash\)/)
  assert.match(login, /if \(!usuario \|\| !senhaValida\)/)
  assert.match(reset, /status: 202/)
  assert.match(reset, /return respostaAceita\(\)/)
  assert.doesNotMatch(reset, /status: 201/)
})

test('todas as rotas de relatórios e notificações aplicam rate limit', () => {
  const routes = [
    'src/app/api/relatorios/dados/route.ts',
    'src/app/api/relatorios/gerar/route.ts',
    'src/app/api/relatorios/arquivos/route.ts',
    'src/app/api/relatorios/arquivos/[id]/confirmar/route.ts',
    'src/app/api/relatorios/arquivos/[id]/download/route.ts',
    'src/app/api/relatorios/arquivos/[id]/purgar/route.ts',
    'src/app/api/notificacoes/route.ts',
    'src/app/api/notificacoes/[id]/route.ts',
  ]

  for (const route of routes) {
    assert.match(read(route), /applyRateLimit\(/, `${route} precisa consumir o limitador persistente`)
  }
})

test('limpeza em lote remove somente notificações lidas dentro do escopo autorizado', () => {
  const route = read('src/app/api/notificacoes/route.ts')
  const bulkDelete = route.match(/export async function DELETE[\s\S]*?export async function POST/)?.[0] ?? ''

  assert.match(bulkDelete, /applyRateLimit\(/)
  assert.match(bulkDelete, /deleteMany\(/)
  assert.match(bulkDelete, /escopoNotificacoes\(auth\.session\)/)
  assert.match(bulkDelete, /lida: true/)
})

test('aprovação de acesso possui claim atômico contra replay concorrente', () => {
  const approval = read('src/app/api/solicitacoes/[id]/aprovar/route.ts')

  assert.match(approval, /updateMany\(\{[\s\S]*status: StatusSolicitacao\.PENDENTE/)
  assert.match(approval, /if \(claim\.count !== 1\)/)
  assert.match(approval, /status: 409/)
})

test('primeiro acesso exige troca atômica de senha temporária', () => {
  const approval = read('src/app/api/solicitacoes/[id]/aprovar/route.ts')
  const login = read('src/app/api/auth/login/route.ts')
  const migration = read('prisma/migrations/20260827010000_primeiro_acesso_seguro/migration.sql')
  const temporaryPassword = read('src/lib/temporaryPassword.ts')

  assert.match(approval, /exigeTrocaSenha: true/)
  assert.match(approval, /TEMPORARY_PASSWORD_TTL_MS/)
  assert.match(temporaryPassword, /72 \* 60 \* 60 \* 1000/)
  assert.match(login, /trocaSenhaObrigatoria: true/)
  assert.match(login, /senhaTemporariaExpiraEm: \{ gt: agora \}/)
  assert.match(login, /if \(troca\.count !== 1\)/)
  assert.match(login, /exigeTrocaSenha: false/)
  assert.match(migration, /ADD COLUMN "exige_troca_senha" BOOLEAN NOT NULL DEFAULT false/)
})

test('troca de senha autenticada revoga todas as sessões', () => {
  const route = read('src/app/api/auth/change-password/route.ts')

  assert.match(route, /requireAuth\(request\)/)
  assert.match(route, /auth\.session\.role === 'GESTOR_EMPRESA'/)
  assert.match(route, /autorização prévia do superadmin/)
  assert.match(route, /verifyPassword\(parsed\.data\.senhaAtual/)
  assert.match(route, /sessaoVersao: \{ increment: 1 \}/)
  assert.match(route, /sessaoUsuario\.updateMany/)
  assert.match(route, /revogadaEm: agora/)
  assert.match(route, /senhaAlteradaEm: agora/)
})

test('gestor solicita redefinição ao superadmin sem confiar em email do cliente', () => {
  const route = read('src/app/api/auth/change-password/request/route.ts')

  assert.match(route, /requireAuth\(request\)/)
  assert.match(route, /role !== 'GESTOR_EMPRESA'/)
  assert.match(route, /auth\.usuario!\.email/)
  assert.match(route, /criarSolicitacaoRedefinicaoSenha/)
  assert.match(route, /notificarAdmins/)
  assert.doesNotMatch(route, /request\.json\(/)
})

test('gestor redefine apenas operadores do próprio tenant e revoga sessões', () => {
  const route = read('src/app/api/empresa/usuarios/[id]/redefinir-senha/route.ts')
  const page = read('src/app/dashboard/empresa/usuarios/page.tsx')

  assert.match(route, /requireEmpresaAuth\(request\)/)
  assert.match(route, /where: \{ id, empresaId: auth\.session\.empresaId \}/)
  assert.match(route, /usuario\.role === 'GESTOR_EMPRESA'/)
  assert.match(route, /exigeTrocaSenha: true/)
  assert.match(route, /sessaoUsuario\.updateMany/)
  assert.match(route, /Cache-Control': 'no-store'/)
  assert.doesNotMatch(page, /fetch\('\/api\/auth\/reset-request'/)
})

test('CSP usa nonce e não permite scripts inline em produção', () => {
  const proxy = read('src/proxy.ts')
  const layout = read('src/app/layout.tsx')
  const scriptDirective = proxy.match(/`script-src[^\n]+/)?.[0] ?? ''

  assert.match(scriptDirective, /nonce-\$\{nonce\}/)
  assert.doesNotMatch(scriptDirective, /unsafe-inline/)
  assert.match(proxy, /script-src-attr 'none'/)
  assert.match(layout, /await connection\(\)/)
})

test('origens de loopback são aceitas apenas no ambiente de desenvolvimento', () => {
  const proxy = read('src/proxy.ts')
  const developmentOrigins = proxy.match(/function developmentOrigins[\s\S]*?\n}/)?.[0] ?? ''

  assert.match(developmentOrigins, /NODE_ENV === 'production'/)
  assert.match(developmentOrigins, /http:\/\/localhost/)
  assert.match(developmentOrigins, /http:\/\/127\.0\.0\.1/)
  assert.match(proxy, /\.\.\.developmentOrigins\(request\)/)
})

test('arquivos versionados não contêm formatos comuns de segredos privados', () => {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root })
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
  const binaryExtensions = new Set(['.glb', '.png', '.wasm'])
  const patterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
    /\bsb_secret_(?!REPLACE)[A-Za-z0-9_-]{16,}\b/,
    /postgres(?:ql)?:\/\/(?!USER:PASSWORD@|user:password@localhost)[^\s:@]+:[^\s@]+@/,
  ]

  for (const file of files) {
    if (!existsSync(resolve(root, file)) || binaryExtensions.has(extname(file).toLowerCase())) continue
    const content = read(file)
    for (const pattern of patterns) {
      assert.doesNotMatch(content, pattern, `possível segredo encontrado em ${file}`)
    }
  }
})

test('chat restringe empresas ao gestor e deriva o tenant da sessão', () => {
  const chat = read('src/app/api/chat/route.ts')
  const tickets = read('src/app/api/chat/tickets/route.ts')
  const adminChat = read('src/app/api/admin/chat/route.ts')
  const adminTicket = read('src/app/api/admin/chat/[id]/route.ts')
  const proxy = read('src/proxy.ts')

  assert.match(chat, /requireEmpresaAuth\(request, \{ acao: 'GESTAO' \}\)/)
  assert.match(chat, /empresaAuth\.session\.empresaId/)
  assert.match(chat, /isAdminRole/)
  assert.match(chat, /applyRateLimit\(/)
  assert.match(adminChat, /requireAdminAuth\(request\)/)
  assert.match(adminChat, /applyRateLimit\(/)
  assert.match(tickets, /requireEmpresaAuth\(request, \{ acao: 'GESTAO' \}\)/)
  assert.match(tickets, /auth\.session\.empresaId/)
  assert.match(tickets, /TransactionIsolationLevel\.Serializable/)
  assert.match(tickets, /cobravelExtra: cobertura\.cobravelExtra/)
  assert.match(adminTicket, /requireAdminAuth\(request\)/)
  assert.match(adminTicket, /where: \{ id: atual\.id \}/)
  assert.match(proxy, /\/dashboard\/empresa\/chat/)
})

test('migração de tickets preserva histórico e corrige a ambiguidade do rate limit', () => {
  const migration = read('prisma/migrations/20260903020000_tickets_suporte_e_rate_limit/migration.sql')

  assert.match(migration, /DROP INDEX IF EXISTS "conversas_suporte_empresaId_key"/)
  assert.match(migration, /SUP-LEG-/)
  assert.match(migration, /candidato\.expira_em/)
  assert.match(migration, /DELETE FROM public\.rate_limits AS expirado/)
  assert.doesNotMatch(migration, /DROP TABLE "mensagens_suporte"/)
})

test('tickets geram notificacoes individuais e sincronizam leitura ao abrir', () => {
  const chat = read('src/app/api/chat/route.ts')
  const tickets = read('src/app/api/chat/tickets/route.ts')
  const adminTicket = read('src/app/api/admin/chat/[id]/route.ts')
  const notifications = read('src/lib/notificacoes.ts')
  const migration = read('prisma/migrations/20260903020000_tickets_suporte_e_rate_limit/migration.sql')

  assert.match(tickets, /notificarAdmins\(/)
  assert.match(chat, /notificarUsuariosDaEmpresa\(escopo\.empresaId, aviso, \['GESTOR_EMPRESA'\], tx\)/)
  assert.match(chat, /notificarAdmins\(aviso, tx\)/)
  assert.match(chat, /ticketSuporteId: ticketSelecionado\.id, lida: false/)
  assert.match(adminTicket, /\['GESTOR_EMPRESA'\], tx/)
  assert.match(notifications, /usuarioId: id[\s\S]*ticketSuporteId: input\.ticketSuporteId/)
  assert.match(migration, /notificacoes_ticketSuporteId_fkey/)
})

test('alertas globais e individuais são filtrados e lidos pelo usuário autenticado', () => {
  const alerts = read('src/app/api/alertas/route.ts')
  const readAlert = read('src/app/api/alertas/[id]/ler/route.ts')
  const adminAlerts = read('src/app/api/admin/alertas/route.ts')
  const scope = read('src/lib/alertas.ts')
  const migration = read('prisma/migrations/20260903010000_chat_e_alertas_sistema/migration.sql')

  assert.match(alerts, /requireAuth\(request\)/)
  assert.match(alerts, /leituras: \{ none: \{ usuarioId: auth\.session\.userId \} \}/)
  assert.match(readAlert, /escopoAlertaVisivel\(auth\.session\.userId\)/)
  assert.match(readAlert, /alertaId_usuarioId/)
  assert.match(adminAlerts, /requireAdminAuth\(request\)/)
  assert.match(adminAlerts, /Destinatário não encontrado/)
  assert.match(scope, /destinatarioId: usuarioId/)
  assert.match(migration, /REVOKE ALL ON TABLE "conversas_suporte"/)
  assert.doesNotMatch(migration, /auditar_mensagens_suporte/)
})
