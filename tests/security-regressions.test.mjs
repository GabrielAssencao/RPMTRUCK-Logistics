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
  assert.match(route, /where: \{ id, empresaId: auth\.session\.empresaId, excluidoEm: null \}/)
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
  assert.match(scriptDirective, /https:\/\/va\.vercel-scripts\.com/)
  assert.match(proxy, /script-src-attr 'none'/)
  assert.match(layout, /await connection\(\)/)
  assert.match(layout, /process\.env\.VERCEL === '1'/)
  assert.match(layout, /isVercelDeployment && <Analytics \/>/)
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
  assert.match(adminChat, /status: \{ notIn: \['RESOLVIDO', 'FECHADO'\] \}/)
  assert.match(adminChat, /competencia: competenciaAtual, cobravelExtra: true/)
  assert.match(adminChat, /resumo: \{ ticketsAtivos, mensagensNaoLidas, extrasNoMes, bugsConfirmadosNoMes \}/)
  assert.match(tickets, /requireEmpresaAuth\(request, \{ acao: 'GESTAO' \}\)/)
  assert.match(tickets, /auth\.session\.empresaId/)
  assert.match(tickets, /TransactionIsolationLevel\.Serializable/)
  assert.match(tickets, /cobravelExtra: cobertura\.cobravelExtra/)
  assert.match(adminTicket, /requireAdminAuth\(request\)/)
  assert.match(adminTicket, /where: \{ id: atual\.id \}/)
  assert.match(proxy, /\/dashboard\/empresa\/chat/)
})

test('franquia de suporte ignora apenas bugs confirmados pelo superadmin', () => {
  const plans = read('src/utils/planos.ts')
  const tickets = read('src/app/api/chat/tickets/route.ts')
  const companyChat = read('src/app/api/chat/route.ts')
  const adminTicket = read('src/app/api/admin/chat/[id]/route.ts')
  const support = read('src/lib/suporte.ts')
  const adminUi = read('src/app/dashboard/admin/_modulos/chat/ChatModule.tsx')
  const migration = read('prisma/migrations/20260908130000_classificacao_bugs_suporte/migration.sql')

  assert.match(plans, /ESSENCIAL:[\s\S]*ticketsSuporteMes: 25/)
  assert.match(plans, /AVANCADO:[\s\S]*ticketsSuporteMes: 35/)
  assert.match(plans, /ENTERPRISE:[\s\S]*ticketsSuporteMes: 50/)
  assert.match(tickets, /classificacaoCobranca: 'ATENDIMENTO'/)
  assert.match(companyChat, /classificacaoCobranca: 'ATENDIMENTO'/)
  assert.match(adminTicket, /requireAdminAuth\(request\)/)
  assert.match(adminTicket, /BUG_SISTEMA_CONFIRMADO/)
  assert.match(adminTicket, /classificadoPorId:[\s\S]*auth\.session!\.userId/)
  assert.match(adminTicket, /recalcularCoberturaCompetencia\(tx, atual\.empresaId, atual\.competencia\)/)
  assert.match(support, /WHEN ordenados\."classificacao_cobranca" = 'BUG_SISTEMA_CONFIRMADO' THEN 0/)
  assert.match(support, /ELSE ordenados\.ordem > conversa\."franquia_no_momento"/)
  assert.doesNotMatch(support, /SET[\s\S]{0,80}"franquia_no_momento"\s*=/)
  assert.match(adminUi, /window\.confirm/)
  assert.match(migration, /CREATE TYPE "ClassificacaoCobrancaTicket"/)
  assert.match(migration, /FOREIGN KEY \("classificado_por_id"\)/)
})

test('migração de tickets preserva histórico e corrige a ambiguidade do rate limit', () => {
  const migration = read('prisma/migrations/20260903020000_tickets_suporte_e_rate_limit/migration.sql')

  assert.match(migration, /DROP INDEX IF EXISTS "conversas_suporte_empresaId_key"/)
  assert.match(migration, /SUP-LEG-/)
  assert.match(migration, /replace\("id"::text, '-', ''\)/)
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
  assert.match(migration, /ADD COLUMN "ticketSuporteId" TEXT/)
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

test('central de seguranca filtra logs no servidor sem confiar no cliente', () => {
  const route = read('src/app/api/admin/seguranca/route.ts')
  const securityModule = read('src/app/dashboard/admin/_modulos/seguranca/SecurityModule.tsx')

  assert.match(route, /requireAdminAuth\(request\)/)
  assert.match(route, /searchParams\.get\('empresaId'\)/)
  assert.match(route, /z\.union\(\[z\.literal\('SISTEMA'\), z\.string\(\)\.uuid\(\)\]\)/)
  assert.match(route, /empresaExiste/)
  assert.match(route, /where: \{ \.\.\.porEmpresa, tipo: 'LOGIN_FALHA'/)
  assert.match(route, /prisma\.auditoriaLog\.findMany\(\{[\s\S]*where: porEmpresa/)
  assert.match(route, /prisma\.exclusaoEmpresaJob\.findMany/)
  assert.match(route, /Empresa removida · \$\{referencia\}/)
  assert.match(securityModule, /Filtrar logs por empresa/)
  assert.match(securityModule, /encodeURIComponent\(empresaId\)/)
  assert.match(securityModule, /Histórico de exclusões · comprovante mínimo/)
})

test('retencao automatica exige segredo e aplica prazos limitados', () => {
  const route = read('src/app/api/internal/retencao/route.ts')
  const cleanup = read('src/lib/retencaoDados.ts')
  const deletion = read('src/app/api/empresa/exclusao-conta/route.ts')
  const migration = read('prisma/migrations/20260908100000_retencao_logs_comprovantes_exclusao/migration.sql')

  assert.match(route, /CRON_SECRET/)
  assert.match(route, /segredo\.length < 32/)
  assert.match(route, /timingSafeEqual/)
  assert.match(cleanup, /import 'server-only'/)
  assert.match(cleanup, /MESES_RETENCAO_SEGURANCA/)
  assert.match(cleanup, /corteEssencial/)
  assert.match(cleanup, /corteAvancado/)
  assert.match(cleanup, /corteEnterprise/)
  assert.match(cleanup, /status: 'CONCLUIDO', reterAte:/)
  assert.match(cleanup, /excluidoEm: \{ not: null, lte: corteTombstone \}/)
  assert.match(deletion, /protocolo: gerarProtocoloExclusao\(\)/)
  assert.match(deletion, /reterAte: adicionarAnosUtc/)
  assert.match(migration, /rpm\.retention_cleanup/)
  assert.match(migration, /current_setting\('rpm\.retention_cleanup', true\) = 'authorized'/)
})

test('atalho de auditoria pode ser ocultado visualmente sem alterar autorizacao', () => {
  const layout = read('src/app/dashboard/admin/_estrutura/AdminLayout.tsx')
  const settings = read('src/app/dashboard/admin/_modulos/configuracoes/SettingsModule.jsx')
  const preferences = read('src/lib/adminSidebarPreferences.ts')

  assert.match(layout, /item\.id !== 'security' \|\| atalhoSegurancaVisivel/)
  assert.match(layout, /min-h-0 flex-1 overflow-y-auto/)
  assert.match(settings, /Mostrar logs na sidebar/)
  assert.match(settings, /somente visual e não altera suas permissões/)
  assert.match(preferences, /usuario\.id \|\| 'local'/)
  assert.match(preferences, /ADMIN_SIDEBAR_UPDATED_EVENT/)
})

test('logout revoga a sessao no servidor e sempre remove o cookie do navegador', () => {
  const auth = read('src/lib/auth.ts')
  const adminLayout = read('src/app/dashboard/admin/_estrutura/AdminLayout.tsx')
  const empresaLayout = read('src/app/dashboard/empresa/layout.tsx')

  assert.match(auth, /finally \{[\s\S]*cookieStore\.delete\(SESSION_COOKIE_NAME\)/)
  assert.match(adminLayout, /fetch\('\/api\/auth\/logout', \{ method: 'POST' \}\)/)
  assert.match(empresaLayout, /fetch\('\/api\/auth\/logout', \{ method: 'POST' \}\)/)
  assert.doesNotMatch(adminLayout, /window\.location\.href = '\/auth\/login'/)
  assert.doesNotMatch(empresaLayout, /window\.location\.href = '\/auth\/login'/)
})

test('dados pessoais e mutacoes de motoristas exigem gestor no backend', () => {
  const collection = read('src/app/api/motoristas/route.ts')
  const item = read('src/app/api/motoristas/[id]/route.ts')
  const photo = read('src/app/api/motoristas/[id]/foto/route.ts')

  assert.match(collection, /export async function GET[\s\S]*acao: 'GESTAO'/)
  assert.match(collection, /export async function POST[\s\S]*acao: 'GESTAO'/)
  assert.equal((item.match(/acao: 'GESTAO'/g) || []).length, 2)
  assert.equal((photo.match(/acao: 'GESTAO'/g) || []).length, 2)
  assert.doesNotMatch(collection, /role === 'OPERADOR'/)
  assert.doesNotMatch(photo, /role === 'OPERADOR'/)
})

test('permissoes individuais nunca ampliam os modulos contratados pela empresa', () => {
  const empresaAuth = read('src/lib/empresaAuth.ts')
  const usuarios = read('src/app/api/empresa/usuarios/[id]/route.ts')
  const planos = read('src/utils/planos.ts')

  assert.match(planos, /obterModulosEfetivosUsuario/)
  assert.match(planos, /return contratados\.filter\(\(modulo\) => permitidos\.has\(modulo\)\)/)
  assert.match(empresaAuth, /auth\.usuario\?\.modulosAcesso/)
  assert.match(empresaAuth, /!modulosEfetivos\.includes\(options\.modulo\)/)
  assert.match(usuarios, /modulosSolicitados\?\.some\(\(modulo\) => !modulosEmpresa\.includes\(modulo\)\)/)
  assert.match(usuarios, /sessaoVersao: \{ increment: 1 \}/)
  assert.match(usuarios, /sessaoUsuario\.(updateMany|deleteMany)/)
})

test('remoção de funcionario anonimiza a conta e preserva referencias operacionais', () => {
  const usuarios = read('src/app/api/empresa/usuarios/[id]/route.ts')

  assert.match(usuarios, /nome: 'Usuário removido'/)
  assert.match(usuarios, /email: emailAnonimo/)
  assert.match(usuarios, /ativo: false/)
  assert.match(usuarios, /excluidoEm: agora/)
  assert.doesNotMatch(usuarios, /tx\.usuario\.delete/)
})

test('relatorios e dashboard respeitam os modulos efetivos do funcionario', () => {
  const arquivos = read('src/app/api/relatorios/arquivos/route.ts')
  const download = read('src/app/api/relatorios/arquivos/[id]/download/route.ts')
  const gerar = read('src/app/api/relatorios/gerar/route.ts')
  const dashboard = read('src/app/api/dashboard/empresa/route.ts')

  assert.match(arquivos, /requireEmpresaAuth\(request, \{ modulo: 'RELATORIOS'/)
  assert.match(download, /requireEmpresaAuth\(request, \{ modulo: 'RELATORIOS'/)
  assert.match(gerar, /requireEmpresaAuth\(request, \{ modulo: 'RELATORIOS', acao: 'GESTAO' \}\)/)
  assert.match(dashboard, /frotaHabilitada = auth\.empresa\.modulos\.includes\('FROTA'\)/)
  assert.match(dashboard, /gestaoHabilitada = auth\.empresa\.modulos\.includes\('GESTAO'\)/)
  assert.match(dashboard, /tarefasHabilitadas = auth\.empresa\.modulos\.includes\('TAREFAS'\)/)
})
