import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('todas as APIs autenticadas recebem teto global antes da consulta de sessão', () => {
  const auth = read('src/lib/auth.ts')
  assert.ok(auth.indexOf('await verifySession(request)') < auth.indexOf('await applyRateLimit(request'))
  assert.ok(auth.indexOf('await applyRateLimit(request') < auth.indexOf('prisma.sessaoUsuario.findFirst'))
  assert.match(auth, /AUTHENTICATED_READ : RATE_LIMITS.AUTHENTICATED_MUTATION/)
  assert.match(auth, /tokenSession\.userId/)
  assert.match(read('src/app/api/planos/route.ts'), /applyRateLimit\(/)
  assert.match(read('src/app/api/internal/retencao/route.ts'), /RATE_LIMITS.RETENTION_RUN/)
})

test('Preview possui cotas finitas editáveis sem apagar registros existentes', async () => {
  const typescript = await import('typescript')
  const js = typescript.transpileModule(read('src/utils/planos.ts'), {
    compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
  }).outputText
  const { PLANOS_CONFIG } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
  assert.equal(PLANOS_CONFIG.PREVIEW.usuariosBase, 1)
  assert.equal(PLANOS_CONFIG.PREVIEW.veiculosBase, 0)
  assert.equal(PLANOS_CONFIG.ESSENCIAL.usuariosBase, 4)
  assert.equal(PLANOS_CONFIG.ESSENCIAL.veiculosBase, 10)
  const ui = read('src/app/dashboard/admin/_modulos/empresas/CompanyFinancialControl.jsx')
  assert.match(ui, /Total de usuários \(inclui o gestor\)/)
  assert.match(ui, /Total de veículos/)
  assert.match(ui, /usuarios_adicionais: uExtra/)
  assert.match(ui, /veiculos_adicionais: vExtra/)
  assert.doesNotMatch(read('src/app/api/empresas/[id]/route.ts'), /veiculo.delete|usuario.delete/)
})

test('cadastro de frota verifica cota e localização na mesma transação serializável', async () => {
  const typescript = await import('typescript')
  let source = read('src/lib/veiculosEmpresa.ts')
  source = source.replace(/^import .*$/gm, '')
  source = `const Prisma = { TransactionIsolationLevel: { Serializable: 'Serializable' } };
    const PLANOS_CONFIG = { PREVIEW: { veiculosBase: 0 }, ESSENCIAL: { veiculosBase: 10 } };
    let testTx;
    export function configure(tx) { testTx = tx; }
    async function executarComAuditoria(context, callback, options) {
      if (options.isolationLevel !== 'Serializable') throw new Error('isolamento incorreto');
      return callback(testTx);
    }
    ${source}`
  const js = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
  }).outputText
  const vehicleService = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
  let total = 2
  let created = 0
  let readings = 0
  vehicleService.configure({
    empresa: { findUnique: async () => ({ plano: 'PREVIEW', veiculos_adicionais: 2 }) },
    veiculo: {
      count: async () => total,
      create: async ({ data }) => { created++; return { ...data, id: 'vehicle', quilometragem: 0 } },
    },
    localizacao: { findFirst: async () => null },
    leituraQuilometragem: { create: async () => { readings++ } },
  })
  const input = { empresaId: 'tenant', usuarioId: 'actor', dados: { modelo: 'Volvo', placa: 'ABC1D23', tipo: 'Sider' } }
  await assert.rejects(vehicleService.criarVeiculoEmpresaComLimite(input), error => error.status === 409)
  assert.equal(created, 0)
  total = 1
  await assert.rejects(vehicleService.criarVeiculoEmpresaComLimite({ ...input, dados: { ...input.dados, localizacaoId: 'other-tenant' } }), error => error.status === 400)
  assert.equal(created, 0)
  await vehicleService.criarVeiculoEmpresaComLimite(input)
  assert.equal(created, 1)
  assert.equal(readings, 1)
  for (const route of ['src/app/api/veiculos/route.ts', 'src/app/api/empresas/[id]/veiculos/route.ts']) {
    assert.match(read(route), /criarVeiculoEmpresaComLimite\(/)
    assert.doesNotMatch(read(route), /veiculo.create\(/)
  }
})

test('migração fecha acesso direto a suporte, lembretes, alertas e contas a pagar', () => {
  const migration = read('prisma/migrations/20260911160000_security_rls_missing_tables/migration.sql')
  for (const table of ['conversas_suporte', 'mensagens_suporte', 'lembretes_pessoais', 'alertas_sistema', 'alertas_leituras', 'contas_pagar']) {
    assert.ok(migration.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`))
  }
  assert.match(migration, /REVOKE ALL ON TABLE/)
  assert.match(migration, /ARRAY\['anon', 'authenticated'\]/)
})

test('IP na Vercel ignora cf-connecting-ip forjado e produção sem proxy não confia em forwarded', async () => {
  const typescript = await import('typescript')
  const source = read('src/lib/rateLimit.ts').match(/export function getClientIp[\s\S]*?(?=export const RATE_LIMITS)/)[0]
  const js = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
  }).outputText
  const { getClientIp } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
  const keys = ['NODE_ENV', 'VERCEL', 'TRUST_CLOUDFLARE_PROXY', 'TRUST_FORWARDED_PROXY']
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  const request = { headers: new Headers({
    'cf-connecting-ip': '198.51.100.200',
    'x-vercel-forwarded-for': '203.0.113.10',
    'x-forwarded-for': '203.0.113.10, 192.0.2.5',
  }) }
  try {
    process.env.NODE_ENV = 'production'
    process.env.VERCEL = '1'
    delete process.env.TRUST_CLOUDFLARE_PROXY
    delete process.env.TRUST_FORWARDED_PROXY
    assert.equal(getClientIp(request), '203.0.113.10')
    delete process.env.VERCEL
    assert.equal(getClientIp(request), 'unknown')
    process.env.TRUST_FORWARDED_PROXY = 'true'
    assert.equal(getClientIp(request), '203.0.113.10')
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
  }
})

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

test('usuário gerencia somente as próprias sessões e não revoga a sessão atual pelo painel', () => {
  const route = read('src/app/api/auth/sessions/route.ts')
  const panel = read('src/app/dashboard/empresa/configuracoes/_componentes/SecuritySessions.tsx')

  assert.match(route, /const auth = await requireAuth\(request\)/)
  assert.match(route, /usuarioId: auth\.session\.userId/)
  assert.match(route, /parsed\.data\.sessionId === auth\.session\.sessionId/)
  assert.match(route, /SESSAO_REVOGADA/)
  assert.match(route, /RATE_LIMITS\.SESSION_MUTATION/)
  assert.doesNotMatch(route, /usuarioId: parsed\.data/)
  assert.match(panel, /session\.atual/)
  assert.doesNotMatch(panel, /window\.confirm/)
  assert.match(panel, /<ActionConfirmDialog/)
  assert.match(panel, /setSessionToRevoke\(session\)/)
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

test('assistente faz triagem limitada e entrega o chamado ao atendimento humano', async () => {
  const typescript = await import('typescript')
  const source = read('src/lib/suporteBot.ts')
  const javascript = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
  }).outputText
  const bot = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)
  const chat = read('src/app/api/chat/route.ts')

  const contexto = { assunto: 'Problema de acesso', categoria: 'SUPORTE_TECNICO' }
  const confirmacao = bot.montarRespostaTriagemBot({ ...contexto, mensagensUsuario: ['Descrição inicial', 'sim'], interacoesAutomaticas: 1 })
  const orientacao = bot.montarRespostaTriagemBot({ ...contexto, mensagensUsuario: ['Descrição inicial', 'sim', 'Não consigo entrar com minha senha'], interacoesAutomaticas: 2 })
  const resolvido = bot.montarRespostaTriagemBot({ ...contexto, mensagensUsuario: ['Descrição inicial', 'sim', 'Não consigo entrar com minha senha', 'sim, funcionou'], interacoesAutomaticas: 3 })
  const entrega = bot.montarRespostaTriagemBot({ ...contexto, mensagensUsuario: ['Descrição inicial', 'sim', 'Não consigo entrar com minha senha', 'não resolveu'], interacoesAutomaticas: 3 })

  assert.match(confirmacao.resposta, /Agora descreva exatamente o problema/)
  assert.match(orientacao.resposta, /Esqueci minha senha/)
  assert.equal(resolvido.acao, 'RESOLVER')
  assert.equal(entrega.acao, 'ESCALAR')
  assert.match(entrega.resumoAdmin, /RESUMO INTERNO DA TRIAGEM/)
  assert.equal(bot.montarRespostaTriagemBot({ ...contexto, mensagensUsuario: ['Mais detalhes'], interacoesAutomaticas: 4 }), null)
  assert.match(chat, /!escopo\.admin && ticket\.status === 'ABERTO'/)
  assert.match(chat, /interacoesAutomaticas: ticket\.etapaTriagem/)
  assert.match(chat, /etapaTriagem: ticket\.etapaTriagem[\s\S]*triagemConcluidaEm: null/)
  assert.match(chat, /reivindicacaoTriagem\?\.count === 1/)
  assert.match(chat, /tipo: 'SISTEMA'[\s\S]*automatica: true[\s\S]*lida_em: agora/)
  assert.match(chat, /visibilidade: 'ADMIN'/)
  assert.match(chat, /resultadoTriagem\?\.acao === 'ESCALAR'/)
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
  assert.doesNotMatch(adminUi, /window\.confirm/)
  assert.match(adminUi, /classificacaoPendente/)
  assert.match(adminUi, /<ActionConfirmDialog/)
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

  assert.doesNotMatch(tickets, /notificarAdmins\(/)
  assert.match(chat, /notificarUsuariosDaEmpresa\(escopo\.empresaId, aviso, \['GESTOR_EMPRESA'\], tx\)/)
  assert.match(chat, /notificarAdmins\(aviso, tx\)/)
  assert.match(chat, /Triagem concluída/)
  assert.match(chat, /visibilidade: escopo\.admin \? undefined : 'TODOS'/)
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
  assert.match(securityModule, /new URLSearchParams/)
  assert.match(securityModule, /query\.set\('empresaId', empresaId\)/)
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

test('logs permanecem acessíveis e suas seções podem ser recolhidas localmente', () => {
  const layout = read('src/app/dashboard/admin/_estrutura/AdminLayout.tsx')
  const settings = read('src/app/dashboard/admin/_modulos/configuracoes/SettingsModule.jsx')
  const preferences = read('src/lib/adminSidebarPreferences.ts')
  const security = read('src/app/dashboard/admin/_modulos/seguranca/SecurityModule.tsx')

  assert.match(layout, /NAV_ADMIN\.map/)
  assert.doesNotMatch(layout, /atalhoSegurancaVisivel/)
  assert.match(layout, /min-h-0 flex-1 overflow-x-hidden overflow-y-auto/)
  assert.doesNotMatch(settings, /Mostrar logs na sidebar/)
  assert.match(preferences, /SECOES_LOG_ADMIN/)
  assert.match(preferences, /usuario\.id \|\| usuario\.email \|\| 'local'/)
  assert.match(security, /role="switch"/)
  assert.match(security, /salvarSecoesLogsAdmin/)
})

test('superadmin possui ambiente visual, central de notificações e exclusão integral de ticket', () => {
  const layout = read('src/app/dashboard/admin/_estrutura/AdminLayout.tsx')
  const page = read('src/app/dashboard/admin/page.tsx')
  const settings = read('src/app/dashboard/admin/_modulos/configuracoes/SettingsModule.jsx')
  const notifications = read('src/app/dashboard/admin/_modulos/notificacoes/NotificationsModule.tsx')
  const ticketRoute = read('src/app/api/admin/chat/[id]/route.ts')
  const ticketUi = read('src/app/dashboard/admin/_modulos/chat/ChatModule.tsx')

  assert.match(layout, /<DashboardEnvironmentBackground estilo=\{estiloFundo\}/)
  assert.match(layout, /onOpenCentral=\{\(\) => changeTab\('notifications'\)\}/)
  assert.match(layout, /CENTRAL DE NOTIFICAÇÕES/)
  assert.match(layout, /changeTab\(NOTIFICATIONS_ITEM\.id\)/)
  assert.match(page, /case 'notifications'/)
  assert.match(settings, /<AppearancePreferences/)
  assert.match(settings, /salvarEstiloFundoAdmin/)
  assert.match(settings, /Redefinição de senha/)
  assert.match(settings, /max-w-\[1200px\]/)
  assert.match(notifications, /Central de notificações/i)
  assert.match(ticketRoute, /export async function DELETE/)
  assert.match(ticketRoute, /tx\.notificacao\.deleteMany\(\{ where: \{ ticketSuporteId: ticket\.id \} \}\)/)
  assert.match(ticketRoute, /tx\.conversaSuporte\.delete/)
  assert.match(ticketRoute, /recalcularCoberturaCompetencia\(tx, ticket\.empresaId, ticket\.competencia\)/)
  assert.match(ticketUi, /role="alertdialog"/)
  assert.match(ticketUi, /Excluir permanentemente/)
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

test('edicao de mensagem do suporte preserva original e exige autor e empresa corretos', () => {
  const chat = read('src/app/api/chat/route.ts')
  const schema = read('prisma/schema.prisma')
  const migration = read('prisma/migrations/20260909180000_edicao_mensagens_suporte/migration.sql')

  assert.match(chat, /export async function PATCH\(request: NextRequest\)/)
  assert.match(chat, /conversa: \{ empresaId: escopo\.empresaId \}/)
  assert.match(chat, /atual\.autorId !== escopo\.auth\.session!\.userId/)
  assert.match(chat, /atual\.tipo !== 'USUARIO' \|\| atual\.automatica/)
  assert.match(chat, /conteudoOriginal: atual\.conteudoOriginal \?\? atual\.conteudo/)
  assert.match(chat, /RATE_LIMITS\.CHAT_EDIT/)
  assert.match(chat, /executarComAuditoria/)
  assert.match(schema, /conteudoOriginal String\?\s+@map\("conteudo_original"\)/)
  assert.match(schema, /editado_em\s+DateTime\?/)
  assert.match(migration, /ADD COLUMN "conteudo_original" TEXT/)
  assert.match(migration, /ADD COLUMN "editado_em" TIMESTAMP\(3\)/)
})

test('personalizacao visual de operadores respeita gestor, empresa e liberdade individual', () => {
  const managerRoute = read('src/app/api/empresa/usuarios/[id]/personalizacao/route.ts')
  const selfRoute = read('src/app/api/empresa/preferencias-visuais/route.ts')
  const creation = read('src/lib/usuariosEmpresa.ts')
  const schema = read('prisma/schema.prisma')
  const migration = read('prisma/migrations/20260910130000_personalizacao_visual_usuarios/migration.sql')
  const backgroundMigration = read('prisma/migrations/20260911170000_fundo_visual_usuario/migration.sql')
  const personalizationPage = read('src/app/dashboard/empresa/usuarios/[id]/personalizacao/page.tsx')
  const visualPreferences = read('src/lib/preferenciasVisuaisUsuario.ts')

  assert.match(managerRoute, /requireEmpresaAuth\(request, \{ acao: 'GESTAO' \}\)/)
  assert.match(managerRoute, /id, empresaId: auth\.session\.empresaId, excluidoEm: null/)
  assert.match(managerRoute, /z\.string\(\)\.trim\(\)\.toLowerCase\(\)\.refine\(corTemaValida\)/)
  assert.match(selfRoute, /!gestor && !auth\.usuario\.podePersonalizarTema/)
  assert.match(selfRoute, /O tema desta conta é administrado pelo gestor/)
  assert.match(creation, /id: input\.criadoPorId, empresaId: input\.empresaId/)
  assert.match(creation, /corTema: normalizarCorTema\(criador\?\.corTema/)
  assert.match(creation, /podePersonalizarTema: false/)
  assert.match(schema, /rotuloEquipe\s+String\?\s+@map\("rotulo_equipe"\)/)
  assert.match(schema, /estiloFundo\s+String\?\s+@map\("estilo_fundo"\)/)
  assert.match(migration, /"pode_personalizar_tema" BOOLEAN NOT NULL DEFAULT false/)
  assert.match(backgroundMigration, /CHECK \([\s\S]*'TOPOGRAFICO'[\s\S]*'VIDRO_FLUIDO'[\s\S]*'ORGANICO'/)
  assert.match(managerRoute, /estiloFundo: z\.enum\(ESTILOS_FUNDO_EMPRESA\)/)
  assert.match(managerRoute, /data: \{[\s\S]*estiloFundo: parsed\.data\.estiloFundo/)
  assert.match(selfRoute, /estiloFundo: z\.enum\(ESTILOS_FUNDO_EMPRESA\)/)
  assert.match(visualPreferences, /estiloFundo \?\?= gestor\?\.estiloFundo \?\? 'DESLIGADO'/)
  assert.match(personalizationPage, /Plano de fundo do operador[\s\S]*OPCOES_FUNDO_EMPRESA\.map/)
})
