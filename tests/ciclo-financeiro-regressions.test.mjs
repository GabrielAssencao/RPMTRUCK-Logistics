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

test('aviso do painel oculta Preview/quitados e mantém atalho de regularização', () => {
  const source = readFileSync('src/components/dashboard/empresa/PaymentAccessCountdown.tsx', 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const exported = { exports: {} }
  const require = createRequire(import.meta.url)
  vm.runInNewContext(js, { module: exported, exports: exported.exports, Date, require: name => name === 'next/link' ? ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) : require(name) })
  const pagamento = { vencimento: '2026-09-15T12:00:00Z', valorPendente: 750, situacao: 'AGUARDANDO_PAGAMENTO_INICIAL', bloqueado: false, servidorAgora: '2026-09-12T12:00:00Z' }
  const render = valor => renderToStaticMarkup(React.createElement(exported.exports.default, { pagamento: valor }))
  assert.equal(render({ ...pagamento, situacao: 'PREVIEW' }), '')
  assert.equal(render({ ...pagamento, valorPendente: 0 }), '')
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
  assert.match(auth, /request.nextUrl.pathname === '\/api\/empresa\/assinatura'/)
  const assinatura = readFileSync('src/app/api/empresa/assinatura/route.ts', 'utf8')
  assert.match(assinatura, /bloqueado && parsed.data.tipo !== 'NEGOCIAR_PAGAMENTO'/)
})

test('sessão vencida financeiramente só acessa assinatura; revogação e operador continuam negados', async () => {
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
  const request = pathname => ({ method: 'GET', nextUrl: { pathname } })
  const auth = pathname => exported.exports.requireAuth(request(pathname))
  assert.equal((await auth('/api/empresa/assinatura')).status, 200)
  for (const path of ['/api/dashboard/empresa', '/api/veiculos', '/api/custos', '/api/empresa/assinatura/extra']) assert.equal((await auth(path)).status, 403)
  role = 'OPERADOR'
  assert.equal((await auth('/api/empresa/assinatura')).status, 403)
  role = 'GESTOR_EMPRESA'
  situacao = 'SUSPENSA'
  assert.equal((await auth('/api/empresa/assinatura')).status, 403)
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
  const vencido = regras.avaliarSituacaoFinanceira(empresa, agora)
  assert.equal(vencido.situacao, 'PAGAMENTO_INICIAL_VENCIDO')
  assert.equal(vencido.bloqueado, true)
})

test('pagamento parcial não libera dívida vencida; quitar não desfaz suspensão manual', () => {
  assert.equal(regras.avaliarSituacaoFinanceira({ ...empresa, primeiraMensalidadePagaEm: new Date(), faturas: empresa.faturas }, agora).situacao, 'INADIMPLENTE')
  assert.equal(regras.avaliarSituacaoFinanceira({ ...empresa, faturas: [] }, agora).bloqueado, false)
  assert.equal(regras.avaliarSituacaoFinanceira({ ...empresa, status: 'INATIVO', faturas: [] }, agora).bloqueado, true)
  assert.equal(regras.avaliarSituacaoFinanceira({ ...empresa, plano: 'PREVIEW' }, agora).bloqueado, false)
})

test('vencimento 5 ou 28 vai até o final do dia em Brasília, independentemente do servidor', () => {
  assert.deepEqual(regras.competenciaBrasil(new Date('2026-10-01T02:59:00Z')), { ano: 2026, mes: 9 })
  for (const dia of [5, 28]) {
    const limite = regras.limiteVencimentoMensal(2026, 9, dia)
    assert.equal(limite.toISOString(), `2026-09-${String(dia + 1).padStart(2, '0')}T03:00:00.000Z`)
    const recorrente = { ...empresa, primeiraMensalidadePagaEm: new Date('2026-08-01'), faturas: [{ vencimento: limite }] }
    assert.equal(regras.avaliarSituacaoFinanceira(recorrente, new Date(limite.getTime() - 1)).bloqueado, false)
    assert.equal(regras.avaliarSituacaoFinanceira(recorrente, limite).situacao, 'INADIMPLENTE')
  }
  assert.throws(() => regras.limiteVencimentoMensal(2026, 9, 10))
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
