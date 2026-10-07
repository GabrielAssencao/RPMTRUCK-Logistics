import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

async function load(path) {
  const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
}
const regras = await load('src/lib/financeiro/situacaoFinanceira.ts')
const planos = await load('src/utils/planos.ts')
const agora = new Date('2026-09-15T12:00:00Z')

test('competência brasileira mantém dezembro até a virada local do ano', () => {
  assert.deepEqual(regras.competenciaBrasil(new Date('2027-01-01T02:59:59Z')), { ano: 2026, mes: 12 })
  assert.deepEqual(regras.competenciaBrasil(new Date('2027-01-01T03:00:00Z')), { ano: 2027, mes: 1 })
})

test('mensalidade administrativa acompanha a primeira competência promocional e a renovação', () => {
  const source = readFileSync('src/lib/financeiro/planosComerciais.ts', 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exported = { exports: {} }
  vm.runInNewContext(js, {
    module: exported,
    exports: exported.exports,
    Date,
    require: name => name === '@/lib/financeiro/situacaoFinanceira' ? regras : {},
  })
  const { calcularMensalidadeEmpresa } = exported.exports
  const catalogo = { precoBase: 397, precoUsuarioAdicional: 35, precoVeiculoAdicional: 45 }
  const empresa = {
    precoBasePromocional: 250,
    precoBaseRenovacao: 150,
    promocaoMesesIniciais: 1,
    promocaoAtivadaEm: new Date('2026-09-19T01:15:10Z'),
    usuarios_adicionais: 1,
    veiculos_adicionais: 2,
  }
  assert.equal(calcularMensalidadeEmpresa(empresa, catalogo, new Date('2026-09-30T12:00:00Z')), 375)
  assert.equal(calcularMensalidadeEmpresa(empresa, catalogo, new Date('2026-10-01T03:00:00Z')), 275)
  assert.equal(calcularMensalidadeEmpresa({ ...empresa, precoBasePromocional: null }, catalogo, new Date('2026-09-30T12:00:00Z')), 522)
  assert.match(readFileSync('src/app/api/empresas/route.ts', 'utf8'), /mensalidade: planoComercial \? calcularMensalidadeEmpresa\(empresa, planoComercial\)/)
})

test('aviso do painel oculta Preview/quitados e mantém atalho de regularização', () => {
  const source = readFileSync('src/components/dashboard/empresa/PaymentAccessCountdown.tsx', 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const exported = { exports: {} }
  const require = createRequire(import.meta.url)
  vm.runInNewContext(js, { module: exported, exports: exported.exports, Date, require: name => name === 'next/link' ? ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) : require(name) })
  const pagamento = { vencimento: '2026-09-15T12:00:00Z', bloqueioEm: '2026-09-18T12:00:00Z', valorPendente: 750, primeiraMensalidadePaga: false, situacao: 'AGUARDANDO_PAGAMENTO_INICIAL', bloqueado: false, emCarencia: false, recorrenciaAtiva: false, servidorAgora: '2026-09-12T12:00:00Z' }
  const render = valor => renderToStaticMarkup(React.createElement(exported.exports.default, { pagamento: valor }))
  assert.equal(render({ ...pagamento, situacao: 'PREVIEW' }), '')
  assert.equal(render({ ...pagamento, valorPendente: 0 }), '')
  assert.equal(render({ ...pagamento, primeiraMensalidadePaga: true, vencimento: '2026-10-05T12:00:00Z' }), '')
  assert.equal(render({ ...pagamento, primeiraMensalidadePaga: true, recorrenciaAtiva: true, servidorAgora: '2026-09-14T12:00:00Z' }), '')
  assert.match(render({ ...pagamento, primeiraMensalidadePaga: true, servidorAgora: '2026-09-13T12:00:00Z' }), /Fatura próxima do vencimento/)
  assert.match(render({ ...pagamento, primeiraMensalidadePaga: true, recorrenciaAtiva: true, emCarencia: true, servidorAgora: '2026-09-16T12:00:00Z' }), /Pagamento vencido/)
  assert.match(render(pagamento), /href="\/dashboard\/plano"/)
  assert.match(render(pagamento), /Calculando prazo/)
  assert.match(render({ ...pagamento, bloqueado: true }), /Prazo encerrado/)
  assert.match(render({ ...pagamento, vencimento: null }), /Consulte as condições/)
})

test('regularização financeira só permite gestor, nunca operador ou suspensão manual', () => {
  assert.equal(regras.podeRegularizarFinanceiro('GESTOR_EMPRESA', 'INADIMPLENTE'), true)
  assert.equal(regras.podeRegularizarFinanceiro('GESTOR_EMPRESA', 'PAGAMENTO_INICIAL_VENCIDO'), true)
  for (const role of ['OPERADOR', 'VISUALIZADOR', 'ADMIN_RPM']) assert.equal(regras.podeRegularizarFinanceiro(role, 'INADIMPLENTE'), false)
  assert.equal(regras.podeRegularizarFinanceiro('GESTOR_EMPRESA', 'SUSPENSA'), false)
  assert.equal(regras.podeRegularizarFinanceiro('GESTOR_EMPRESA', undefined), false)
  const auth = readFileSync('src/lib/auth.ts', 'utf8')
  assert.match(auth, /rotaRegularizacaoFinanceira\(pathname, request\.method\)/)
  const assinatura = readFileSync('src/app/api/empresa/assinatura/route.ts', 'utf8')
  assert.match(assinatura, /bloqueado && parsed.data.tipo !== 'NEGOCIAR_PAGAMENTO'/)
})

test('regularização permite apenas rotas e métodos necessários para cadastrar CNPJ e pagar', () => {
  const rota = regras.rotaRegularizacaoFinanceira
  for (const [path, method] of [
    ['/api/empresa/assinatura', 'GET'],
    ['/api/empresa/perfil', 'GET'],
    ['/api/empresa/perfil', 'PATCH'],
    ['/api/empresa/recorrencia', 'DELETE'],
    ['/api/empresa/faturas/fatura-1/cobranca', 'POST'],
    ['/api/empresa/faturas/fatura-1/pix-qr', 'GET'],
  ]) assert.equal(rota(path, method), true)
  for (const [path, method] of [
    ['/api/empresa/perfil', 'DELETE'],
    ['/api/empresa/recorrencia', 'POST'],
    ['/api/empresa/faturas/fatura-1/cobranca', 'GET'],
    ['/api/empresa/faturas/fatura-1/cobranca/extra', 'POST'],
    ['/api/veiculos', 'GET'],
  ]) assert.equal(rota(path, method), false)
})

test('tela financeira bloqueada permite cadastrar somente o CNPJ sem liberar Configurações', () => {
  const assinatura = readFileSync('src/app/dashboard/empresa/configuracoes/_componentes/SubscriptionManagement.tsx', 'utf8')
  const perfil = readFileSync('src/app/api/empresa/perfil/route.ts', 'utf8')

  assert.match(assinatura, /setEditandoDocumentoFiscal\(atual => !atual\)/)
  assert.match(assinatura, /fetch\('\/api\/empresa\/perfil', \{[\s\S]*method: 'PATCH'[\s\S]*JSON\.stringify\(\{ cnpj \}\)/)
  assert.match(assinatura, /Agora você pode gerar a cobrança/)
  assert.doesNotMatch(assinatura, /router\.push\('\/dashboard\/empresa\/configuracoes'\)/)
  assert.match(perfil, /nome: nomeOperacional\(2, 150\)\.optional\(\)/)
  assert.match(perfil, /email: z\.string\(\)[\s\S]*\.optional\(\)/)
  assert.match(perfil, /Object\.keys\(dados\)\.length > 0/)
})

test('sessão vencida financeiramente só acessa regularização; revogação e operador continuam negados', async () => {
  const source = readFileSync('src/lib/auth.ts', 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exported = { exports: {} }
  let role = 'GESTOR_EMPRESA'
  let ativo = true
  let situacao = 'INADIMPLENTE'
  const user = () => ({ id: 'u', email: 'test@example.invalid', role, empresaId: 'e', sessaoVersao: 1, ativo, excluidoEm: null })
  const dependencies = {
    '@/lib/prisma': { prisma: { usuario: { findUnique: async () => user() } } },
    '@/lib/rateLimit': { applyRateLimit: async () => null, RATE_LIMITS: { AUTHENTICATED_READ: { limit: 300, windowMs: 60000 }, AUTHENTICATED_MUTATION: { limit: 60, windowMs: 60000 } } },
    '@/lib/financeiro/acessoFinanceiro': { verificarAcessoFinanceiro: async () => ({ bloqueado: true, mensagem: 'Bloqueado', situacao }) },
    '@/lib/financeiro/situacaoFinanceira': regras,
    '@/lib/sessionToken': { verifySession: async () => ({ userId: 'u', email: 'test@example.invalid', role, empresaId: 'e', sessionVersion: 1 }), isAdminRole: value => value === 'ADMIN_RPM' },
  }
  vm.runInNewContext(js, { module: exported, exports: exported.exports, Date, WeakMap, Map, require: name => dependencies[name] ?? {} })
  const request = (pathname, method = 'GET') => ({ method, nextUrl: { pathname } })
  const auth = (pathname, method) => exported.exports.requireAuth(request(pathname, method))
  assert.equal((await auth('/api/empresa/assinatura')).status, 200)
  assert.equal((await auth('/api/empresa/perfil')).status, 200)
  assert.equal((await auth('/api/empresa/perfil', 'PATCH')).status, 200)
  assert.equal((await auth('/api/empresa/recorrencia', 'DELETE')).status, 200)
  assert.equal((await auth('/api/empresa/faturas/fatura-1/cobranca', 'POST')).status, 200)
  assert.equal((await auth('/api/empresa/faturas/fatura-1/cobranca')).status, 403)
  for (const path of ['/api/dashboard/empresa', '/api/veiculos', '/api/custos', '/api/empresa/assinatura/extra']) assert.equal((await auth(path)).status, 403)
  role = 'OPERADOR'
  assert.equal((await auth('/api/empresa/assinatura')).status, 403)
  assert.equal((await auth('/api/empresa/perfil', 'PATCH')).status, 403)
  role = 'GESTOR_EMPRESA'
  situacao = 'SUSPENSA'
  assert.equal((await auth('/api/empresa/assinatura')).status, 403)
  assert.equal((await auth('/api/empresa/faturas/fatura-1/cobranca', 'POST')).status, 403)
  situacao = 'INADIMPLENTE'
  ativo = false
  assert.equal((await auth('/api/empresa/assinatura')).status, 401)
})
const empresa = { plano: 'ESSENCIAL', status: 'ATIVO', primeiraMensalidadePagaEm: null, pagamentoInicialVenceEm: new Date('2026-09-15T12:00:00Z'), faturas: [{ vencimento: new Date('2026-09-15T12:00:00Z') }] }

test('Preview não transforma 4 usuários e 20 veículos de teste em R$ 700 extras', () => {
  assert.deepEqual(planos.adicionaisPadraoNaTrocaDePlano('PREVIEW', 'ESSENCIAL', 4, 20), { usuariosAdicionais: 0, veiculosAdicionais: 0 })
  assert.deepEqual(planos.adicionaisPadraoNaTrocaDePlano('ESSENCIAL', 'AVANCADO', 2, 3), { usuariosAdicionais: 2, veiculosAdicionais: 3 })
  assert.deepEqual(planos.adicionaisPadraoNaTrocaDePlano('ESSENCIAL', 'PREVIEW', 2, 3), { usuariosAdicionais: 5, veiculosAdicionais: 13 })
})

test('inicial permite acesso até o prazo e distingue não ingresso de inadimplência', () => {
  assert.equal(regras.PRAZO_PAGAMENTO_INICIAL_MS, 72 * 60 * 60 * 1000)
  const antes = regras.avaliarSituacaoFinanceira(empresa, new Date(agora.getTime() - 1))
  assert.equal(antes.situacao, 'AGUARDANDO_PAGAMENTO_INICIAL')
  assert.equal(antes.bloqueado, false)
  const carencia = regras.avaliarSituacaoFinanceira(empresa, agora)
  assert.equal(carencia.situacao, 'AGUARDANDO_PAGAMENTO_INICIAL')
  assert.equal(carencia.emCarencia, true)
  assert.equal(carencia.bloqueado, false)
  const vencido = regras.avaliarSituacaoFinanceira(empresa, new Date(agora.getTime() + 72 * 60 * 60 * 1000))
  assert.equal(vencido.situacao, 'PAGAMENTO_INICIAL_VENCIDO')
  assert.equal(vencido.bloqueado, true)
})

test('pagamento parcial não libera dívida vencida; quitar não desfaz suspensão manual', () => {
  assert.equal(regras.avaliarSituacaoFinanceira({ ...empresa, primeiraMensalidadePagaEm: new Date(), faturas: empresa.faturas }, new Date(agora.getTime() + 72 * 60 * 60 * 1000)).situacao, 'INADIMPLENTE')
  assert.equal(regras.avaliarSituacaoFinanceira({ ...empresa, faturas: [] }, agora).bloqueado, false)
  assert.equal(regras.avaliarSituacaoFinanceira({ ...empresa, status: 'INATIVO', faturas: [] }, agora).bloqueado, true)
  assert.equal(regras.avaliarSituacaoFinanceira({ ...empresa, plano: 'PREVIEW' }, agora).bloqueado, false)
})

test('vencimento fixo de 1 a 28 vai até o final do dia em Brasília, independentemente do servidor', () => {
  assert.deepEqual(regras.competenciaBrasil(new Date('2026-10-01T02:59:00Z')), { ano: 2026, mes: 9 })
  for (const dia of [1, 5, 15, 28]) {
    const limite = regras.limiteVencimentoMensal(2026, 9, dia)
    assert.equal(limite.toISOString(), `2026-09-${String(dia + 1).padStart(2, '0')}T03:00:00.000Z`)
    const recorrente = { ...empresa, primeiraMensalidadePagaEm: new Date('2026-08-01'), faturas: [{ vencimento: limite }] }
    assert.equal(regras.avaliarSituacaoFinanceira(recorrente, new Date(limite.getTime() - 1)).bloqueado, false)
    assert.equal(regras.avaliarSituacaoFinanceira(recorrente, limite).emCarencia, true)
    assert.equal(regras.avaliarSituacaoFinanceira(recorrente, new Date(limite.getTime() + 72 * 60 * 60 * 1000)).situacao, 'INADIMPLENTE')
  }
  for (const dia of [0, 29, 10.5]) assert.throws(() => regras.limiteVencimentoMensal(2026, 9, dia))
})

test('empresa solicita dia fixo e somente o SuperAdmin aplica aos ciclos futuros', () => {
  const empresaApi = readFileSync('src/app/api/empresa/assinatura/route.ts', 'utf8')
  const adminApi = readFileSync('src/app/api/admin/assinaturas/[id]/route.ts', 'utf8')
  const adminListaApi = readFileSync('src/app/api/admin/assinaturas/route.ts', 'utf8')
  const telaEmpresa = readFileSync('src/app/dashboard/empresa/configuracoes/_componentes/SubscriptionManagement.tsx', 'utf8')
  const migrationEnum = readFileSync('prisma/migrations/20260930190000_solicitacao_dia_vencimento/migration.sql', 'utf8')
  const migrationConstraint = readFileSync('prisma/migrations/20260930190100_solicitacao_dia_vencimento_constraint/migration.sql', 'utf8')

  assert.match(migrationEnum, /ALTER TYPE "TipoSolicitacaoAssinatura" ADD VALUE IF NOT EXISTS 'ALTERAR_VENCIMENTO'/)
  assert.match(migrationConstraint, /"tipo" = 'ALTERAR_VENCIMENTO'[\s\S]*"fatura_id" IS NULL/)
  assert.match(empresaApi, /tipo: z\.literal\('ALTERAR_VENCIMENTO'\)/)
  assert.match(empresaApi, /diaVencimentoAtual: empresa\.diaVencimento, diaVencimentoProposto: parsed\.data\.diaVencimento/)
  assert.match(adminApi, /data: \{ diaVencimento: diaVencimentoProposto as number \}/)
  assert.match(adminApi, /solicitacao\.tipo === 'ALTERAR_PLANO' \|\| solicitacao\.tipo === 'ALTERAR_COTAS'/)
  assert.match(adminApi, /solicitacao\.tipo === 'NEGOCIAR_PAGAMENTO' \|\| solicitacao\.tipo === 'ALTERAR_VENCIMENTO'[\s\S]*solicitacao\.impacto \?\? Prisma\.JsonNull/)
  assert.match(adminListaApi, /solicitacao\.tipo === 'NEGOCIAR_PAGAMENTO' \|\| solicitacao\.tipo === 'ALTERAR_VENCIMENTO'[\s\S]*\? solicitacao\.impacto/)
  assert.match(telaEmpresa, /Faturas já emitidas mantêm o vencimento original/)
  assert.match(telaEmpresa, /cartão automático estiver ativo, desative-o antes de solicitar/)
})

test('legados sem vencimento não ganham bloqueio financeiro retroativo', () => {
  assert.equal(regras.avaliarSituacaoFinanceira({ ...empresa, pagamentoInicialVenceEm: null, faturas: [{ vencimento: null }] }, agora).bloqueado, false)
  const migration = readFileSync('prisma/migrations/20260912223000_ciclo_financeiro_inicial/migration.sql', 'utf8')
  assert.match(migration, /MIN\(COALESCE\("pago_em", "criado_em"\)\)/)
  assert.doesNotMatch(migration, /SET "pagamento_inicial_vence_em"/)
})

test('login e sessões abertas são bloqueados no servidor; mensalidade tem idempotência', () => {
  for (const path of ['src/lib/auth.ts', 'src/app/api/auth/login/route.ts']) assert.match(readFileSync(path, 'utf8'), /await verificarAcessoFinanceiro\(/)
  const cycle = readFileSync('src/lib/financeiro/cicloCobranca.ts', 'utf8')
  assert.match(cycle, /TransactionIsolationLevel.Serializable/)
  assert.match(cycle, /chaveCobranca: `mensalidade:/)
  assert.match(cycle, /tipo: 'MENSALIDADE'/)
})

test('fatura gratuita paga no Preview não dispensa a primeira mensalidade comercial', async () => {
  const source = readFileSync('src/lib/financeiro/faturamentoAdmin.ts', 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exported = { exports: {} }
  vm.runInNewContext(js, { module: exported, exports: exported.exports, Date, require: name => name.endsWith('situacaoFinanceira') ? regras : {
    obterPlanoComercial: async () => ({ taxaImplantacao: 300 }),
    calcularMensalidadePersistida: async () => 450,
    calcularMensalidadeEmpresa: () => 450,
    dadosPixBase: async () => ({}),
    dadosPixCobranca: async () => ({}),
  } })
  const criadas = []
  const tx = {
    empresa: {
      findUniqueOrThrow: async () => ({ id: 'local-test', cobrancaIniciadaEm: null, primeiraMensalidadePagaEm: null, pagamentoInicialVenceEm: null, diaVencimento: 28 }),
      update: async () => {},
    },
    fatura: {
      count: async () => 1,
      findFirst: async ({ where }) => where.tipo === 'MENSALIDADE' ? { status: 'PAGO', valor: 0 } : null,
      create: async ({ data }) => { criadas.push(data) },
    },
  }
  await exported.exports.sincronizarCobrancaEmpresa(tx, { empresaId: 'local-test', planoAnterior: 'PREVIEW', plano: 'ESSENCIAL', usuariosAdicionais: 0, veiculosAdicionais: 0, agora })
  assert.deepEqual(criadas.map(fatura => fatura.valor), [450, 300])
  assert.ok(criadas.every(fatura => fatura.vencimento.getTime() === agora.getTime() + regras.PRAZO_PAGAMENTO_INICIAL_MS))
})

test('notificações financeiras acompanham eventos reais sem alertar semanas antes', () => {
  const ciclo = readFileSync('src/lib/financeiro/cicloCobranca.ts', 'utf8')
  const webhook = readFileSync('src/app/api/webhooks/asaas/route.ts', 'utf8')
  const mensagens = readFileSync('src/lib/financeiro/notificacoesPagamento.ts', 'utf8')
  const schema = readFileSync('prisma/schema.prisma', 'utf8')
  const migration = readFileSync('prisma/migrations/20261005120000_notificacoes_pagamento/migration.sql', 'utf8')

  assert.doesNotMatch(ciclo, /titulo: `Mensalidade do plano:/)
  assert.match(ciclo, /2 \* 86_400_000/)
  assert.match(ciclo, /lembretePagamentoEnviadoEm: null/)
  assert.match(ciclo, /status: \{ in: \['AGUARDANDO_ADESAO', 'CANCELADA'\] \}/)
  assert.match(ciclo, /status: 'FALHA', transicaoPromocaoStatus: null/)
  assert.match(webhook, /fatura\.gatewayStatus !== 'OVERDUE'/)
  assert.match(webhook, /notificarPagamentoConfirmado\(tx, liquidadas\)/)
  assert.match(webhook, /notificarPagamentoEstornado\(tx, estornadas\)/)
  assert.match(mensagens, /Pagamento confirmado/)
  assert.match(mensagens, /Pagamento automático não concluído/)
  assert.match(mensagens, /Pagamento estornado/)
  assert.match(mensagens, /Pagamento automático ativado/)
  assert.match(schema, /lembretePagamentoEnviadoEm DateTime\?/)
  assert.match(migration, /UPDATE "notificacoes"[\s\S]*"titulo" LIKE 'Mensalidade do plano:%'/)
})
