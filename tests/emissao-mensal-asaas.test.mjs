import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = readFileSync('src/lib/financeiro/cicloCobranca.ts', 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText

function preparar(enabled) {
  const chamadas = []
  const consultas = []
  const faturas = [{ id: 'fatura-1', empresaId: 'empresa-1' }, { id: 'fatura-2', empresaId: 'empresa-2' }]
  const modulo = { exports: {} }
  const dependencias = {
    '@prisma/client': { Prisma: {} },
    '@/lib/prisma': { prisma: { fatura: { findMany: async ({ where, cursor }) => {
      consultas.push(where)
      return cursor ? [] : faturas
    } } } },
    '@/lib/financeiro/planosComerciais': {},
    '@/lib/financeiro/situacaoFinanceira': { competenciaBrasil: () => ({ ano: 2026, mes: 9 }) },
    '@/lib/notificacoes': { notificarUsuariosDaEmpresa: async () => ({ count: 0 }) },
    '@/lib/financeiro/asaas': {
      configuracaoAsaas: () => ({ ready: true }),
      emitirCobrancaAsaas: async (...args) => { chamadas.push(args); if (args[0] === 'fatura-2') throw new Error('CNPJ inválido') },
    },
  }
  vm.runInNewContext(js, {
    module: modulo, exports: modulo.exports, Date, console: { error() {} },
    process: { env: { ASAAS_AUTO_ISSUE_ENABLED: enabled ? 'true' : 'false' } },
    require: name => dependencias[name] ?? require(name),
  })
  return { executar: modulo.exports.emitirMensalidadesAutomaticas, chamadas, consultas }
}

test('emissão automática exige opt-in operacional e não consulta faturas se desligada', async () => {
  const { executar, chamadas, consultas } = preparar(false)
  assert.equal((await executar()).desabilitada, true)
  assert.equal(chamadas.length, 0)
  assert.equal(consultas.length, 0)
})

test('emite só mensalidades posteriores à primeira e oferece escolha no checkout, isolando falhas', async () => {
  const { executar, chamadas, consultas } = preparar(true)
  const resultado = await executar()
  assert.equal(resultado.emitidas, 1)
  assert.equal(resultado.falhas, 1)
  assert.equal(resultado.desabilitada, false)
  assert.equal(consultas[0].chaveCobranca.startsWith, 'mensalidade:')
  assert.equal(consultas[0].empresa.primeiraMensalidadePagaEm.not, null)
  assert.equal(consultas[0].empresa.AND[0].OR[1].cnpjHash.not, null)
  assert.equal(consultas[0].empresa.AND[1].OR[1].recorrenciaPagamento.is.status, 'CANCELADA')
  assert.equal(consultas[0].empresa.AND[1].OR[2].recorrenciaPagamento.is.status, 'FALHA')
  assert.equal(consultas[0].empresa.AND[1].OR[2].recorrenciaPagamento.is.transicaoPromocaoStatus, null)
  assert.equal(consultas[0].gatewayPaymentId, null)
  assert.ok(consultas[0].vencimento.lte instanceof Date)
  assert.deepEqual(Array.from(chamadas[0]), ['fatura-1', 'empresa-1', 'UNDEFINED'])
})
